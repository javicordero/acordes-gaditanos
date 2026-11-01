// Proxy de las estadísticas del worker de Cloudflare.
//
// El worker no manda CORS, así que el navegador no puede llamarlo desde
// /admin. Esta función lo pide desde el servidor y solo responde con sesión
// del panel (el mismo login de GitHub que el resto del estudio).
import { sesion, sinSesion, json } from './_lib.mjs';

const WORKER = 'https://stats-worker.javiercorderotoscano.workers.dev/';

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  try {
    const r = await fetch(WORKER, { headers: { Accept: 'application/json' } });
    if (!r.ok) return json({ error: 'el worker de estadísticas respondió ' + r.status }, 502);
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
