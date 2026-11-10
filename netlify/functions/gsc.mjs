// Search Console (Search Analytics API) para el panel.
//
// Datos de clics, impresiones, CTR y posición por consulta, página, país y
// dispositivo. Google tarda 2-3 días en cerrar los datos, así que la ventana
// termina dos días antes de hoy.
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
      conDimension('query', 25),
      conDimension('page', 25),
      conDimension('country', 10),
      conDimension('device', 5),
      consulta(rango(anteriorRango)),
    ]);

    const filas = (d) => (d && Array.isArray(d.rows) ? d.rows : []);
    const conClave = (d, clave) => filas(d).map((x) => ({
      [clave]: (x.keys && x.keys[0]) || '',
      ...metrica(x),
    }));

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
    }, 200, CACHE);
  } catch (e) {
    return json({
      configurado: true,
      error: String(e && e.message ? e.message : e),
      pista: 'Revisa que el email de la cuenta de servicio tenga acceso a la propiedad de Search Console y que GSC_SITE_URL sea exactamente esa propiedad.',
    }, 502);
  }
};
