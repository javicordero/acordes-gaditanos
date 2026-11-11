// Search Console (Search Analytics API) para el panel.
//
// Datos de clics, impresiones, CTR y posición por consulta, página, país y
// dispositivo. Google tarda 2-3 días en cerrar los datos, así que la ventana
// termina dos días antes de hoy.
//
// Con `?ruta=<texto>&tipo=<fichas|autores|carnaval|glosario|otros>` devuelve
// además las consultas y las páginas que coinciden con ese filtro, usando
// `dimensionFilterGroups` sobre la dimensión `page`.
//
// Variables: GSC_SITE_URL y la autenticación de `_google.mjs`.
import { sesion, sinSesion, json } from './_lib.mjs';
import {
  faltanServicio,
  tokenGoogle,
  pedirGoogle,
  rangoDias,
  rangoAnterior,
  numero,
  diasPedidos,
} from './_google.mjs';

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const CACHE = { 'Cache-Control': 'private, max-age=900' };

const INSTRUCCIONES = [
  'Crea un proyecto en Google Cloud y habilita la Search Console API.',
  'Crea una cuenta de servicio y añade su email como usuario de la propiedad en Search Console.',
  'Define GSC_SITE_URL con la propiedad exacta: sc-domain:acordesgaditanos.com o https://acordesgaditanos.com/.',
  'Guarda GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en Netlify, o las tres variables de OAuth.',
];

const metrica = (x) => ({
  clicks: numero(x && x.clicks),
  impressions: numero(x && x.impressions),
  ctr: numero(x && x.ctr),
  position: numero(x && x.position),
});

// Prefijo de página de cada chip. `otros` se resuelve excluyendo los conocidos.
const PREFIJOS_RUTA = {
  fichas: '/acordes/',
  autores: '/autor/',
  carnaval: '/(carnaval|agrupacion|modalidad)/',
  glosario: '/glosario/',
};
const RUTAS_CONOCIDAS = '/(acordes|autor|carnaval|agrupacion|modalidad|glosario)/';

/** Escapa un texto para usarlo como patrón literal dentro de un regex RE2. */
const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Grupo de filtros sobre `page` para una búsqueda de ruta y/o un tipo. */
function filtroPagina(ruta, tipo) {
  const filtros = [];
  if (tipo && tipo !== 'todas') {
    if (tipo === 'otros') {
      filtros.push({ dimension: 'page', operator: 'excludingRegex', expression: RUTAS_CONOCIDAS });
    } else if (PREFIJOS_RUTA[tipo]) {
      filtros.push({ dimension: 'page', operator: 'includingRegex', expression: PREFIJOS_RUTA[tipo] });
    }
  }
  if (ruta) {
    // Las rutas del sitio van en minúsculas: así la búsqueda no depende del caso.
    filtros.push({ dimension: 'page', operator: 'includingRegex', expression: escaparRegex(ruta.toLowerCase()) });
  }
  if (!filtros.length) return null;
  return { dimensionFilterGroups: [{ groupType: 'and', filters: filtros }] };
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  let url;
  try { url = new URL(req.url); } catch { /* petición sin URL absoluta */ }
  const dias = diasPedidos(url);
  const site = String(process.env.GSC_SITE_URL || '').trim();
  const cfg = faltanServicio(site ? [] : ['GSC_SITE_URL']);

  if (cfg.faltan.length) {
    return json({
      configurado: false,
      servicio: 'search-console',
      faltan: cfg.faltan,
      instrucciones: INSTRUCCIONES,
    }, 200, { 'Cache-Control': 'no-store' });
  }

  const { desde, hasta } = rangoDias(dias, 2);
  const anteriorRango = rangoAnterior(desde, hasta);
  const ruta = String((url && url.searchParams.get('ruta')) || '').trim().slice(0, 120);
  const tipo = String((url && url.searchParams.get('tipo')) || 'todas');
  const filtro = filtroPagina(ruta, tipo);

  try {
    const token = await tokenGoogle(SCOPES);
    const base = 'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
      encodeURIComponent(site) + '/searchAnalytics/query';

    const consulta = (body) => pedirGoogle(base, token, { method: 'POST', body });
    const rango = (r = { desde, hasta }) => ({
      startDate: r.desde,
      endDate: r.hasta,
      type: 'web',
      dataState: 'all',
    });
    const conDimension = (dimension, limite = 25, r = { desde, hasta }) => consulta({
      ...rango(r),
      dimensions: [dimension],
      rowLimit: limite,
      startRow: 0,
    });

    const [totalD, diarioD, consultasD, paginasD, paisesD, dispositivosD, anteriorD] = await Promise.all([
      consulta(rango()),
      conDimension('date', 200),
      conDimension('query', 200),
      conDimension('page', 200),
      conDimension('country', 10),
      conDimension('device', 5),
      consulta(rango(anteriorRango)),
    ]);

    const filas = (d) => (d && Array.isArray(d.rows) ? d.rows : []);
    const conClave = (d, clave) => filas(d).map((x) => ({
      [clave]: (x.keys && x.keys[0]) || '',
      ...metrica(x),
    }));

    // Con filtro de ruta: qué búsquedas y qué páginas entran en ese filtro.
    let porRuta = null;
    if (filtro) {
      const [consultasRutaD, paginasRutaD] = await Promise.all([
        consulta({ ...rango(), ...filtro, dimensions: ['query'], rowLimit: 500, startRow: 0 }),
        consulta({ ...rango(), ...filtro, dimensions: ['page'], rowLimit: 500, startRow: 0 }),
      ]);
      porRuta = {
        consultas: conClave(consultasRutaD, 'consulta'),
        paginas: conClave(paginasRutaD, 'pagina'),
      };
    }

    return json({
      configurado: true,
      desde,
      hasta,
      dias,
      retraso: 2,
      total: metrica(filas(totalD)[0]),
      anterior: metrica(filas(anteriorD)[0]),
      diario: conClave(diarioD, 'dia'),
      consultas: conClave(consultasD, 'consulta'),
      paginas: conClave(paginasD, 'pagina'),
      paises: conClave(paisesD, 'pais'),
      dispositivos: conClave(dispositivosD, 'dispositivo'),
      filtrado: Boolean(filtro),
      filtro: { ruta, tipo },
      consultasRuta: porRuta ? porRuta.consultas : [],
      paginasRuta: porRuta ? porRuta.paginas : [],
    }, 200, CACHE);
  } catch (e) {
    return json({
      configurado: true,
      error: String(e && e.message ? e.message : e),
      pista: 'Revisa que el email de la cuenta de servicio tenga acceso a la propiedad de Search Console y que GSC_SITE_URL sea exactamente esa propiedad.',
    }, 502);
  }
};
