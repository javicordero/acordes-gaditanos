// Ruta de desarrollo para ejecutar las funciones de Netlify del panel /admin.
//
// Se inyecta solo con `astro dev` (ver astro.config.mjs). En producción las
// ejecuta Netlify con la redirección de `netlify.toml`; en desarrollo no existen,
// así que esta ruta las llama con la petición real (query y cabeceras incluidas).
import type { APIRoute } from 'astro';

const FUNCIONES: Record<string, () => Promise<{ default: (req: Request) => Promise<Response> }>> = {
  auth: () => import('../../netlify/functions/auth.mjs'),
  'auth-callback': () => import('../../netlify/functions/auth-callback.mjs'),
  me: () => import('../../netlify/functions/me.mjs'),
  salir: () => import('../../netlify/functions/salir.mjs'),
  ficha: () => import('../../netlify/functions/ficha.mjs'),
  lista: () => import('../../netlify/functions/lista.mjs'),
  guardar: () => import('../../netlify/functions/guardar.mjs'),
  publicar: () => import('../../netlify/functions/publicar.mjs'),
  fusionar: () => import('../../netlify/functions/fusionar.mjs'),
  aviso: () => import('../../netlify/functions/aviso.mjs'),
  letra: () => import('../../netlify/functions/letra.mjs'),
  stats: () => import('../../netlify/functions/stats.mjs'),
  comentarios: () => import('../../netlify/functions/comentarios.mjs'),
  'publicar-local': () => import('../../netlify/functions/publicar-local.mjs'),
  importar: () => import('../../netlify/functions/importar.mjs'),
};

export const ALL: APIRoute = async ({ request, params, url }) => {
  const nombre = String(params.ruta || '').replace(/\/+$/, '');
  const cargar = FUNCIONES[nombre];
  if (!cargar) return new Response('No encontrado', { status: 404 });

  // Las funciones leen process.env; Vite deja las variables en import.meta.env.
  for (const [k, v] of Object.entries(import.meta.env)) {
    if (typeof v === 'string' && !process.env[k]) process.env[k] = v;
  }
  process.env.URL = url.origin;
  // Marca de desarrollo: las funciones pueden leer fichas del disco que aún no
  // están en GitHub y decir cuándo hay una copia local más nueva.
  process.env.ESTUDIO_LOCAL = '1';

  try {
    const mod = await cargar();
    const res = await mod.default(request);
    // En http://localhost el navegador descarta las cookies `Secure`.
    const cookies = res.headers.getSetCookie?.() ?? [];
    if (!cookies.length) return res;
    const headers = new Headers(res.headers);
    headers.delete('set-cookie');
    for (const c of cookies) headers.append('Set-Cookie', c.replace(/;\s*Secure/gi, ''));
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};
