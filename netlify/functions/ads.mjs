// AdSense Management API v2 para el panel.
//
// Ingresos estimados, Page RPM, RPM de impresiones, Active View, impresiones y
// clics. Informes por método de emplazamiento, unidad de anuncio, página y país.
//
// Periodos: hoy, ayer, 7, 30 y 90 días.
//
// Variables: ADSENSE_ACCOUNT_ID (pub-...), ADSENSE_CURRENCY (EUR por defecto) y
// la autenticación de `_google.mjs`. AdSense suele necesitar OAuth de usuario:
// si la cuenta de servicio falla, usa GOOGLE_REFRESH_TOKEN.
import { sesion, sinSesion, json } from './_lib.mjs';
import {
  faltanServicio,
  tokenGoogle,
  pedirGoogle,
  rangoDias,
  rangoAnterior,
  numero,
} from './_google.mjs';

const SCOPES = ['https://www.googleapis.com/auth/adsense.readonly'];
const CACHE = { 'Cache-Control': 'private, max-age=900' };
const PERIODOS = ['hoy', 'ayer', '7', '30', '90'];

const INSTRUCCIONES = [
  'Habilita la AdSense Management API en Google Cloud.',
  'Crea credenciales OAuth y obtén un refresh token de un usuario con acceso a la cuenta de AdSense.',
  'Define ADSENSE_ACCOUNT_ID=pub-... (sin ca-) y, si hace falta, ADSENSE_CURRENCY=EUR.',
  'Guarda GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en Netlify. La cuenta de servicio no suele valer para AdSense.',
];

const METRICAS_TOTAL = [
  'ESTIMATED_EARNINGS',
  'PAGE_VIEWS',
  'IMPRESSIONS',
  'CLICKS',
  'PAGE_VIEWS_RPM',
  'IMPRESSIONS_RPM',
  'ACTIVE_VIEW_VIEWABILITY',
];

const METRICAS_DIA = [
  'ESTIMATED_EARNINGS',
  'PAGE_VIEWS',
  'IMPRESSIONS',
  'IMPRESSIONS_RPM',
  'ACTIVE_VIEW_VIEWABILITY',
  'CLICKS',
  'PAGE_VIEWS_RPM',
];

const METRICAS_INFORME = [
  'ESTIMATED_EARNINGS',
  'IMPRESSIONS',
  'IMPRESSIONS_RPM',
  'ACTIVE_VIEW_VIEWABILITY',
  'CLICKS',
  'PAGE_VIEWS_RPM',
];

function urlInforme({ cuenta, moneda, desde, hasta, dimensions = [], metrics, limit = 0 }) {
  const u = new URL('https://adsense.googleapis.com/v2/accounts/' + cuenta + '/reports:generate');
  u.searchParams.set('dateRange', 'CUSTOM');
  const [anio1, mes1, dia1] = desde.split('-');
  const [anio2, mes2, dia2] = hasta.split('-');
  u.searchParams.set('startDate.year', anio1);
  u.searchParams.set('startDate.month', String(Number(mes1)));
  u.searchParams.set('startDate.day', String(Number(dia1)));
  u.searchParams.set('endDate.year', anio2);
  u.searchParams.set('endDate.month', String(Number(mes2)));
  u.searchParams.set('endDate.day', String(Number(dia2)));
  u.searchParams.set('currencyCode', moneda);
  dimensions.forEach((d) => u.searchParams.append('dimensions', d));
  metrics.forEach((m) => u.searchParams.append('metrics', m));
  if (limit) u.searchParams.set('limit', String(limit));
  return u.toString();
}

function leerInforme(d) {
  const cabeceras = (d && d.headers ? d.headers : []).map((h) => ({
    nombre: h.name,
    metrica: String(h.type || '').startsWith('METRIC'),
  }));
  const celdasAObjeto = (celdas) => Object.fromEntries(cabeceras.map((c, i) => {
    const valor = celdas && celdas[i] ? celdas[i].value : '';
    return [c.nombre, c.metrica ? numero(valor) : String(valor ?? '')];
  }));
  const filas = (d && d.rows ? d.rows : []).map((fila) => celdasAObjeto((fila && fila.cells) || []));
  if (!filas.length && d && d.totals && Array.isArray(d.totals.cells)) {
    filas.push(celdasAObjeto(d.totals.cells));
  }
  const totales = filas.length ? filas[0] : {};
  return { filas, totales };
}

function rangoPeriodo(periodo) {
  if (periodo === 'hoy') {
    return { ...rangoDias(1, 0), anterior: null, dia: 1, retraso: 0 };
  }
  if (periodo === 'ayer') {
    return { ...rangoDias(1, 1), anterior: rangoDias(1, 2), dia: 1, retraso: 1 };
  }
  const dias = Number(periodo);
  const rango = rangoDias(dias, 1);
  return { ...rango, anterior: rangoAnterior(rango.desde, rango.hasta), dia: dias, retraso: 1 };
}

const informe = (d, clave, campo) => leerInforme(d).filas.map((x) => ({
  [campo]: String(x[clave] || ''),
  estimatedEarnings: x.ESTIMATED_EARNINGS || 0,
  impressions: x.IMPRESSIONS || 0,
  impressionsRpm: x.IMPRESSIONS_RPM || 0,
  activeView: x.ACTIVE_VIEW_VIEWABILITY || 0,
  clicks: x.CLICKS || 0,
  pageRpm: x.PAGE_VIEWS_RPM || 0,
}));

const metricas = (d) => ({
  estimatedEarnings: d.ESTIMATED_EARNINGS || 0,
  pageViews: d.PAGE_VIEWS || 0,
  impressions: d.IMPRESSIONS || 0,
  clicks: d.CLICKS || 0,
  pageRpm: d.PAGE_VIEWS_RPM || 0,
  impressionsRpm: d.IMPRESSIONS_RPM || 0,
  activeView: d.ACTIVE_VIEW_VIEWABILITY || 0,
});

const top = (lista, n) => [...lista]
  .sort((a, b) => b.estimatedEarnings - a.estimatedEarnings)
  .slice(0, n);

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  let url;
  try { url = new URL(req.url); } catch { /* petición sin URL absoluta */ }
  const periodo = String((url && url.searchParams.get('periodo')) || '30');
  const periodoValido = PERIODOS.includes(periodo);
  const cuenta = String(process.env.ADSENSE_ACCOUNT_ID || '')
    .replace(/^accounts\//i, '')
    .replace(/^ca-/i, '')
    .trim();
  const moneda = String(process.env.ADSENSE_CURRENCY || 'EUR').toUpperCase();
  const cuentaValida = /^pub-\d+$/.test(cuenta);
  const monedaValida = /^[A-Z]{3}$/.test(moneda);
  const cfg = faltanServicio([
    ...(periodoValido ? [] : ['periodo=hoy|ayer|7|30|90']),
    ...(cuentaValida ? [] : ['ADSENSE_ACCOUNT_ID=pub-...']),
    ...(monedaValida ? [] : ['ADSENSE_CURRENCY (código ISO de 3 letras)']),
  ], 'oauth');

  if (cfg.faltan.length) {
    return json({
      configurado: false,
      servicio: 'adsense',
      faltan: cfg.faltan,
      instrucciones: INSTRUCCIONES,
    }, 200, { 'Cache-Control': 'no-store' });
  }

  const rango = rangoPeriodo(periodo);

  try {
    const token = await tokenGoogle(SCOPES, 'oauth');
    const base = { cuenta, moneda, desde: rango.desde, hasta: rango.hasta };
    const tareas = [
      pedirGoogle(urlInforme({ ...base, metrics: METRICAS_TOTAL }), token),
      pedirGoogle(urlInforme({ ...base, dimensions: ['DATE'], metrics: METRICAS_DIA, limit: 200 }), token),
      pedirGoogle(urlInforme({ ...base, dimensions: ['AD_PLACEMENT_NAME'], metrics: METRICAS_INFORME, limit: 50 }), token),
      pedirGoogle(urlInforme({ ...base, dimensions: ['AD_UNIT_NAME'], metrics: METRICAS_INFORME, limit: 500 }), token),
      pedirGoogle(urlInforme({ ...base, dimensions: ['PAGE_URL'], metrics: METRICAS_INFORME, limit: 500 }), token),
      pedirGoogle(urlInforme({ ...base, dimensions: ['COUNTRY_CODE'], metrics: METRICAS_INFORME, limit: 250 }), token),
    ];
    if (rango.anterior) {
      tareas.push(pedirGoogle(urlInforme({
        cuenta,
        moneda,
        desde: rango.anterior.desde,
        hasta: rango.anterior.hasta,
        metrics: METRICAS_TOTAL,
      }), token));
    }

    const [totalD, diarioD, emplazamientosD, unidadesD, paginasD, paisesD, anteriorD] = await Promise.all(tareas);

    const diario = leerInforme(diarioD).filas.map((x) => ({
      dia: String(x.DATE || ''),
      estimatedEarnings: x.ESTIMATED_EARNINGS || 0,
      pageViews: x.PAGE_VIEWS || 0,
      impressions: x.IMPRESSIONS || 0,
      impressionsRpm: x.IMPRESSIONS_RPM || 0,
      activeView: x.ACTIVE_VIEW_VIEWABILITY || 0,
      clicks: x.CLICKS || 0,
      pageRpm: x.PAGE_VIEWS_RPM || 0,
    }));

    return json({
      configurado: true,
      periodo,
      desde: rango.desde,
      hasta: rango.hasta,
      dias: rango.dia,
      retraso: rango.retraso,
      moneda,
      total: metricas(leerInforme(totalD).totales),
      anterior: rango.anterior ? metricas(leerInforme(anteriorD).totales) : null,
      diario,
      emplazamientos: top(informe(emplazamientosD, 'AD_PLACEMENT_NAME', 'emplazamiento'), 10),
      unidades: top(informe(unidadesD, 'AD_UNIT_NAME', 'unidad'), 25),
      paginas: top(informe(paginasD, 'PAGE_URL', 'pagina'), 25),
      paises: top(informe(paisesD, 'COUNTRY_CODE', 'pais'), 10),
    }, 200, CACHE);
  } catch (e) {
    return json({
      configurado: true,
      error: String(e && e.message ? e.message : e),
      pista: 'AdSense suele necesitar OAuth de usuario. Revisa el refresh token, que la cuenta tenga la API habilitada y que ADSENSE_ACCOUNT_ID sea pub-...',
    }, 502);
  }
};
