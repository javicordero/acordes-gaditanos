// Proxy del worker de comentarios para el panel /admin.
//
// El panel entra con la sesión de GitHub y esta función manda al worker el
// token de GitHub de la sesión: el worker nuevo comprueba con la API de GitHub
// que el usuario es el propietario, así que no hay un segundo login ni un token
// aparte que pedir en el navegador.
//
// Si existe `COMMENTS_ADMIN_TOKEN` (el `ADMIN_TOKEN` del worker) se manda ese
// primero, porque la versión desplegada del worker solo acepta ese: sin él, el
// POST guardaba la respuesta con `isAdmin: false` (salía «Anónimo») y el
// PATCH/DELETE devolvía 401. En un 401 se reintenta con la otra credencial, así
// que vale tanto el worker antiguo como el nuevo.
//
// Rutas:
//   GET    /admin/api/comentarios?path=/pedir-copla
//   POST   /admin/api/comentarios            { path, author, content, parentId }
//   PATCH  /admin/api/comentarios?id=<id>    { completed }
//   DELETE /admin/api/comentarios?id=<id>
import { sesion, sinSesion, json } from './_lib.mjs';

const WORKER = 'https://comments-worker.javiercorderotoscano.workers.dev';
const TOKEN_ADMIN = process.env.COMMENTS_ADMIN_TOKEN || '';

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  const url = new URL(req.url);
  const id = String(url.searchParams.get('id') || '').trim();
  const path = String(url.searchParams.get('path') || '/pedir-copla').trim();
  if (id && !/^[a-zA-Z0-9-]+$/.test(id)) return json({ error: 'id inválido' }, 400);
  if (!path.startsWith('/')) return json({ error: 'path inválido' }, 400);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return json({ error: 'método no permitido' }, 405);
  }

  // GET filtra por path; POST va a la raíz (el path viaja en el cuerpo) y
  // PATCH/DELETE llevan el id en la ruta, como el worker.
  const destino = id
    ? `${WORKER}/${encodeURIComponent(id)}`
    : req.method === 'GET'
      ? `${WORKER}?path=${encodeURIComponent(path)}`
      : WORKER;
  const opciones = {
    method: req.method,
    headers: { Accept: 'application/json' },
  };

  if (req.method === 'POST' || req.method === 'PATCH') {
    const cuerpo = await req.text();
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = cuerpo;
  }

  // Primero el token de administrador (si está) y luego el de GitHub de la
  // sesión. Se prueban en orden hasta que uno no devuelva 401.
  const credenciales = [...new Set([TOKEN_ADMIN, s.token].filter(Boolean))];
  if (!credenciales.length) return json({ error: 'sin credenciales' }, 500);

  try {
    let r = null;
    for (const credencial of credenciales) {
      r = await fetch(destino, {
        ...opciones,
        headers: { ...opciones.headers, Authorization: `Bearer ${credencial}` },
      });
      if (r.status !== 401) break;
    }
    const texto = await r.text();
    return new Response(texto, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
