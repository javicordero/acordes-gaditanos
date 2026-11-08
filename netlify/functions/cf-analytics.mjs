// Proxy de Cloudflare Web Analytics (RUM) para el panel.
//
// La consulta la hace esta función desde el servidor con un token de solo
// lectura (`CLOUDFLARE_API_TOKEN`, permiso Account Analytics: Read). El token
// no llega nunca al navegador. Solo responde con sesión del panel.
//
// Vistas:
//   GET /admin/api/cf-analytics?vista=resumen&dias=30&limite=200
//   GET /admin/api/cf-analytics?vista=ruta&ruta=/acordes/x/&dias=90
//
// Cloudflare es RUM: muestrea, redondea y excluye bots (`bot: 0`, el mismo
// criterio que `excludeBots=Yes` del dashboard). No cuadra con el contador
// propio de D1, que cuenta cada petición del tracker.
import { sesion, sinSesion, json } from './_lib.mjs';

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const DIAS_MAX = 180;
const LIMITE_MAX = 5000;
const CACHE = 'private, max-age=600';

const numero = (v) => Number(v || 0);
const fila = (x) => ({
  paginas: numero(x && x.count),
  visitas: numero(x && x.sum && x.sum.visits),
  muestreo: Number((x && x.avg && x.avg.sampleInterval) || 1),
});

function configuracion() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID;
  const site = process.env.CLOUDFLARE_WA_SITE_TAG;
  const faltan = [];
  if (!token) faltan.push('CLOUDFLARE_API_TOKEN');
  if (!cuenta) faltan.push('CLOUDFLARE_ACCOUNT_ID');
  if (!site) faltan.push('CLOUDFLARE_WA_SITE_TAG');
  return { token, cuenta, site, faltan };
}

/** Minutos de desfase de una zona respecto a UTC en un instante dado. */
function offsetMinutos(fecha, zona) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(fecha).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comoUtc - fecha.getTime()) / 60000);
}

/**
 * Instante UTC de las 00:00 de hoy en Europe/Madrid. No vale restar 24 horas:
 * «hoy» es desde medianoche, y Madrid cambia de offset con el horario de verano.
 */
function inicioDeHoyMadrid(ahora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(ahora).map((x) => [x.type, x.value]));
  const base = Date.UTC(+p.year, +p.month - 1, +p.day, 0, 0, 0);
  const off = offsetMinutos(new Date(base), 'Europe/Madrid');
  return new Date(base - off * 60000);
}

async function graphql({ token, cuenta }, query, variables) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });

  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = null; }

  if (!r.ok || !datos || datos.errors) {
    const detalle = datos && datos.errors && datos.errors[0] && datos.errors[0].message;
    if (r.status === 403 || /authorization|permission|not authorized/i.test(detalle || '')) {
      throw new Error('Cloudflare rechazó el token: revisa que tenga Account Analytics: Read.');
    }
    throw new Error(`Cloudflare ${r.status}: ${detalle || texto.slice(0, 180) || 'sin respuesta'}`);
  }

  const cuentaDatos = datos.data && datos.data.viewer && datos.data.viewer.accounts && datos.data.viewer.accounts[0];
  if (!cuentaDatos) throw new Error('La cuenta de Cloudflare no devolvió datos.');
  return cuentaDatos;
}

const FILTRO = 'siteTag: $site, bot: 0, datetime_geq: $desde, datetime_lt: $hasta';

const QUERY_RESUMEN = `query($cuenta:String!,$site:String!,$desde:Time!,$hasta:Time!,$limite:Int!){
  viewer {
    accounts(filter: { accountTag: $cuenta }) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ${FILTRO} }) {
        count
        sum { visits }
        avg { sampleInterval }
      }
      rutas: rumPageloadEventsAdaptiveGroups(
        limit: $limite
        filter: { ${FILTRO} }
        orderBy: [count_DESC]
      ) {
        count
        sum { visits }
        avg { sampleInterval }
        dimensions { requestPath }
      }
      fuentes: rumPageloadEventsAdaptiveGroups(
        limit: 20
        filter: { ${FILTRO} }
        orderBy: [count_DESC]
      ) {
        count
        sum { visits }
        dimensions { refererHost }
      }
      fuentesRutas: rumPageloadEventsAdaptiveGroups(
        limit: 10000
        filter: { ${FILTRO} }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { requestPath refererHost }
      }
      diario: rumPageloadEventsAdaptiveGroups(
        limit: 200
        filter: { ${FILTRO} }
        orderBy: [date_ASC]
      ) {
        count
        sum { visits }
        dimensions { date }
      }
      paises: rumPageloadEventsAdaptiveGroups(
        limit: 10
        filter: { ${FILTRO} }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { countryName }
      }
      dispositivos: rumPageloadEventsAdaptiveGroups(
        limit: 5
        filter: { ${FILTRO} }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { deviceType }
      }
    }
  }
}`;

const QUERY_RUTA = `query($cuenta:String!,$site:String!,$desde:Time!,$hasta:Time!,$ruta:String!){
  viewer {
    accounts(filter: { accountTag: $cuenta }) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ${FILTRO}, requestPath: $ruta }) {
        count
        sum { visits }
        avg { sampleInterval }
      }
      fuentes: rumPageloadEventsAdaptiveGroups(
        limit: 20
        filter: { ${FILTRO}, requestPath: $ruta }
        orderBy: [count_DESC]
      ) {
        count
        sum { visits }
        dimensions { refererHost }
      }
      diario: rumPageloadEventsAdaptiveGroups(
        limit: 200
        filter: { ${FILTRO}, requestPath: $ruta }
        orderBy: [date_ASC]
      ) {
        count
        sum { visits }
        dimensions { date }
      }
      paises: rumPageloadEventsAdaptiveGroups(
        limit: 10
        filter: { ${FILTRO}, requestPath: $ruta }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { countryName }
      }
      dispositivos: rumPageloadEventsAdaptiveGroups(
        limit: 5
        filter: { ${FILTRO}, requestPath: $ruta }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { deviceType }
      }
      navegadores: rumPageloadEventsAdaptiveGroups(
        limit: 10
        filter: { ${FILTRO}, requestPath: $ruta }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { userAgentBrowser }
      }
    }
  }
}`;

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  const cfg = configuracion();
  if (cfg.faltan.length) {
    return json({
      configurado: false,
      faltan: cfg.faltan,
      error: 'Falta configurar Cloudflare Web Analytics en el servidor.',
    }, 200, { 'Cache-Control': 'no-store' });
  }

  let url;
  try { url = new URL(req.url); } catch { /* petición sin URL absoluta */ }
  const vista = (url && url.searchParams.get('vista')) || 'resumen';
  const esHoy = vista === 'hoy' || Boolean(url && url.searchParams.get('hoy') === '1');
  const dias = Math.min(DIAS_MAX, Math.max(1, Number(url && url.searchParams.get('dias')) || 30));
  const limite = Math.min(LIMITE_MAX, Math.max(10, Number(url && url.searchParams.get('limite')) || 1000));

  const hasta = new Date();
  const desde = esHoy ? inicioDeHoyMadrid(hasta) : new Date(hasta.getTime() - dias * 86400000);
  const variables = {
    cuenta: cfg.cuenta,
    site: cfg.site,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
  };

  try {
    if (vista === 'ruta') {
      let ruta = String((url && url.searchParams.get('ruta')) || '').trim();
      if (!ruta) return json({ error: 'falta la ruta' }, 400);
      if (!ruta.startsWith('/')) ruta = '/' + ruta;
      if (ruta.length > 300) return json({ error: 'ruta demasiado larga' }, 400);

      const d = await graphql(cfg, QUERY_RUTA, { ...variables, ruta });
      return json({
        configurado: true,
        hoy: esHoy,
        ruta,
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        dias: esHoy ? 1 : dias,
        total: fila(d.total && d.total[0]),
        fuentes: (d.fuentes || []).map((x) => ({
          fuente: (x.dimensions && x.dimensions.refererHost) || '',
          ...fila(x),
        })),
        diario: (d.diario || []).map((x) => ({
          dia: x.dimensions && x.dimensions.date,
          ...fila(x),
        })),
        paises: (d.paises || []).map((x) => ({
          pais: (x.dimensions && x.dimensions.countryName) || '',
          paginas: numero(x.count),
        })),
        dispositivos: (d.dispositivos || []).map((x) => ({
          tipo: (x.dimensions && x.dimensions.deviceType) || '',
          paginas: numero(x.count),
        })),
        navegadores: (d.navegadores || []).map((x) => ({
          navegador: (x.dimensions && x.dimensions.userAgentBrowser) || '',
          paginas: numero(x.count),
        })),
      }, 200, { 'Cache-Control': CACHE });
    }

    const d = await graphql(cfg, QUERY_RESUMEN, { ...variables, limite });
    return json({
      configurado: true,
      hoy: esHoy,
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
      dias: esHoy ? 1 : dias,
      total: fila(d.total && d.total[0]),
      rutas: (d.rutas || []).map((x) => ({
        ruta: (x.dimensions && x.dimensions.requestPath) || '',
        ...fila(x),
      })),
      fuentes: (d.fuentes || []).map((x) => ({
        fuente: (x.dimensions && x.dimensions.refererHost) || '',
        ...fila(x),
      })),
      fuentesRutas: (d.fuentesRutas || []).map((x) => ({
        ruta: (x.dimensions && x.dimensions.requestPath) || '',
        fuente: (x.dimensions && x.dimensions.refererHost) || '',
        paginas: numero(x.count),
      })),
      diario: (d.diario || []).map((x) => ({
        dia: x.dimensions && x.dimensions.date,
        ...fila(x),
      })),
      paises: (d.paises || []).map((x) => ({
        pais: (x.dimensions && x.dimensions.countryName) || '',
        paginas: numero(x.count),
      })),
      dispositivos: (d.dispositivos || []).map((x) => ({
        tipo: (x.dimensions && x.dimensions.deviceType) || '',
        paginas: numero(x.count),
      })),
    }, 200, { 'Cache-Control': CACHE });
  } catch (e) {
    return json({
      configurado: true,
      error: String(e && e.message ? e.message : e),
    }, 502);
  }
};
