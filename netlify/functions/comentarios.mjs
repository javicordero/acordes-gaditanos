// Proxy del worker de comentarios para el panel /estudio.
//
// El token de administrador del worker vive en `COMMENTS_ADMIN_TOKEN` y no
// sale nunca al navegador: el panel entra con la sesión de GitHub y esta
// función añade el Bearer al hablar con el worker.
//
// Rutas:
//   GET    /estudio/api/comentarios?path=/pedir-copla
//   POST   /estudio/api/comentarios            { path, author, content, parentId }
//   PATCH  /estudio/api/comentarios?id=<id>    { completed }
//   DELETE /estudio/api/comentarios?id=<id>
import { sesion, sinSesion, json } from './_lib.mjs';

const WORKER = 'https://comments-worker.javiercorderotoscano.workers.dev';
const TOKEN = process.env.COMMENTS_ADMIN_TOKEN || '';

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();
  if (!TOKEN) {
    return json({ error: 'Falta COMMENTS_ADMIN_TOKEN en el entorno del panel (Netlify o .env).' }, 503);
  }

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
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  };

  if (req.method === 'POST' || req.method === 'PATCH') {
    const cuerpo = await req.text();
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = cuerpo;
  }

  try {
    const r = await fetch(destino, opciones);
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
