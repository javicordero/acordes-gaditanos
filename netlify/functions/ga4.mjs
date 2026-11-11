// Google Analytics 4 (Data API) para el panel.
//
// Datos de sesiones, usuarios, páginas vistas, engagement, páginas, canales,
// países y dispositivos. La ventana termina ayer: GA4 aún está procesando hoy.
//
// Variables: GA4_PROPERTY_ID (el ID numérico de la propiedad, no el G-...) y la
// autenticación de `_google.mjs`.
import { sesion, sinSesion, json } from './_lib.mjs';
import {
  faltanServicio,
  tokenGoogle,
  pedirGoogle,
  rangoDias,
  rangoAnterior,
  numero,
} from './_google.mjs';

const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];
const CACHE = { 'Cache-Control': 'private, max-age=900' };
const PERIODOS = ['ayer', '7', '30', '90'];
const METRICAS_TOTAL = ['sessions', 'totalUsers', 'screenPageViews', 'engagementRate', 'averageSessionDuration', 'eventCount'];

const INSTRUCCIONES = [
  'Crea un proyecto en Google Cloud y habilita la Google Analytics Data API.',
  'Crea una cuenta de servicio y añade su email como lector de la propiedad de GA4.',
  'Define GA4_PROPERTY_ID con el ID numérico de la propiedad (Administrar → Propiedad → ID).',
  'Guarda GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en Netlify, o las tres variables de OAuth.',
];

const metrica = (d) => {
  const cabeceras = (d && d.metricHeaders ? d.metricHeaders : []).map((h) => h.name);
  const fila = (d && d.rows && d.rows[0]) || (d && d.totals && d.totals[0]) || {};
  const valores = (fila && fila.metricValues) || [];
  return Object.fromEntries(cabeceras.map((nombre, i) => [nombre, numero(valores[i] && valores[i].value)]));
};

const filas = (d) => {
  const cabeceras = (d && d.metricHeaders ? d.metricHeaders : []).map((h) => h.name);
  return (d && d.rows ? d.rows : []).map((fila) => ({
    dims: (fila.dimensionValues || []).map((v) => v.value),
    valores: Object.fromEntries(cabeceras.map((nombre, i) => [
      nombre,
      numero(fila.metricValues && fila.metricValues[i] && fila.metricValues[i].value),
    ])),
  }));
};

const fechaGa = (valor) => {
  const v = String(valor || '');
  return /^\d{8}$/.test(v)
    ? v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8)
    : v;
};

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  let url;
  try { url = new URL(req.url); } catch { /* petición sin URL absoluta */ }
  const periodoParam = String((url && url.searchParams.get('periodo')) || '').trim();
  const diasParam = Math.min(180, Math.max(7, Number(url && url.searchParams.get('dias')) || 7));
  const periodo = PERIODOS.includes(periodoParam) ? periodoParam : String(diasParam);
  const propertyId = String(process.env.GA4_PROPERTY_ID || '').replace(/^properties\//, '').trim();
  const propiedadValida = /^\d+$/.test(propertyId);
  const cfg = faltanServicio(propiedadValida ? [] : ['GA4_PROPERTY_ID numérico (no el G-...)']);

  if (cfg.faltan.length) {
    return json({
      configurado: false,
      servicio: 'google-analytics',
      faltan: cfg.faltan,
      instrucciones: INSTRUCCIONES,
    }, 200, { 'Cache-Control': 'no-store' });
  }

  let desde;
  let hasta;
  let anteriorRango;
  let dias;
  if (periodo === 'ayer') {
    const r = rangoDias(1, 1);
    desde = r.desde;
    hasta = r.hasta;
    anteriorRango = rangoDias(1, 2);
    dias = 1;
  } else {
    dias = Number(periodo);
    const r = rangoDias(dias, 1);
    desde = r.desde;
    hasta = r.hasta;
    anteriorRango = rangoAnterior(desde, hasta);
  }

  try {
    const token = await tokenGoogle(SCOPES);
    const endpoint = 'https://analyticsdata.googleapis.com/v1beta/properties/' +
      propertyId + ':runReport';

    const consulta = (body) => pedirGoogle(endpoint, token, { method: 'POST', body });
    const rango = (r) => ({ startDate: r.desde, endDate: r.hasta });
    const metrics = (nombres) => nombres.map((name) => ({ name }));
    const dims = (nombres) => nombres.map((name) => ({ name }));

    const [totalD, diarioD, eventosD, paginasD, canalesD, paisesD, dispositivosD, anteriorD, busquedasD] = await Promise.all([
      consulta({
        dateRanges: [rango({ desde, hasta })],
        metrics: metrics(METRICAS_TOTAL),
      }),
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['date']),
        metrics: metrics(['sessions', 'screenPageViews', 'totalUsers']),
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 200,
      }),
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['eventName']),
        metrics: metrics(['eventCount', 'totalUsers']),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 50,
      }),
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['pagePath']),
        metrics: metrics(['screenPageViews', 'sessions']),
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 25,
      }),
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['sessionDefaultChannelGroup']),
        metrics: metrics(['sessions', 'totalUsers']),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['countryId']),
        metrics: metrics(['sessions']),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['deviceCategory']),
        metrics: metrics(['sessions']),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5,
      }),
      consulta({
        dateRanges: [rango(anteriorRango)],
        metrics: metrics(METRICAS_TOTAL),
      }),
      // Lo que se busca y no encuentra nada. Lleva `catch` propio: el parámetro
      // `consulta` es una dimensión personalizada que hay que crear en GA4 y,
      // mientras no exista o no se haya propagado, la Data API responde 400.
      // Ese fallo no puede tumbar el resto de la pestaña.
      consulta({
        dateRanges: [rango({ desde, hasta })],
        dimensions: dims(['customEvent:consulta']),
        metrics: metrics(['eventCount', 'totalUsers']),
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'buscar_sin_resultados' },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 200,
      }).catch((e) => ({ __error: String(e && e.message ? e.message : e) })),
    ]);

    // Las búsquedas anteriores a crear la dimensión llegan como «(not set)».
    // Se cuentan aparte para poder explicarlo, sin ensuciar la tabla.
    const todasBusquedas = busquedasD && busquedasD.__error
      ? []
      : filas(busquedasD).map((x) => ({
        consulta: x.dims[0] || '',
        eventCount: x.valores.eventCount || 0,
        totalUsers: x.valores.totalUsers || 0,
      }));
    const busquedas = todasBusquedas.filter((x) => x.consulta && x.consulta !== '(not set)');
    const busquedasSinParametro = todasBusquedas
      .filter((x) => !x.consulta || x.consulta === '(not set)')
      .reduce((n, x) => n + Number(x.eventCount || 0), 0);

    return json({
      configurado: true,
      periodo,
      desde,
      hasta,
      dias,
      retraso: 1,
      total: metrica(totalD),
      anterior: metrica(anteriorD),
      diario: filas(diarioD).map((x) => ({
        dia: fechaGa(x.dims[0]),
        sessions: x.valores.sessions || 0,
        screenPageViews: x.valores.screenPageViews || 0,
        totalUsers: x.valores.totalUsers || 0,
      })),
      eventos: filas(eventosD).map((x) => ({
        evento: x.dims[0] || '(sin nombre)',
        eventCount: x.valores.eventCount || 0,
        totalUsers: x.valores.totalUsers || 0,
      })),
      busquedas,
      busquedasSinParametro,
      busquedasError: busquedasD && busquedasD.__error ? busquedasD.__error : null,
      paginas: filas(paginasD).map((x) => ({
        pagina: x.dims[0] || '',
        screenPageViews: x.valores.screenPageViews || 0,
        sessions: x.valores.sessions || 0,
      })),
      canales: filas(canalesD).map((x) => ({
        canal: x.dims[0] || '(sin canal)',
        sessions: x.valores.sessions || 0,
        totalUsers: x.valores.totalUsers || 0,
      })),
      paises: filas(paisesD).map((x) => ({
        pais: x.dims[0] || '',
        sessions: x.valores.sessions || 0,
      })),
      dispositivos: filas(dispositivosD).map((x) => ({
        tipo: x.dims[0] || '',
        sessions: x.valores.sessions || 0,
      })),
    }, 200, CACHE);
  } catch (e) {
    return json({
      configurado: true,
      error: String(e && e.message ? e.message : e),
      pista: 'Comprueba que el email de la cuenta de servicio sea lector de la propiedad de GA4 y que GA4_PROPERTY_ID sea el ID numérico.',
    }, 502);
  }
};
