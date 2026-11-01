// Puente entre Astro y las funciones de Netlify, solo para `astro dev`.
//
// En producción las ejecuta Netlify (redirección de `netlify.toml`); en
// desarrollo no existen, así que esta ruta las llama directamente. Se hace con
// una ruta de verdad (y no con middleware) porque el middleware de Astro recibe
// una petición sintética sin query ni cabeceras para rutas que no existen.
import type { APIRoute } from 'astro';

export const prerender = !import.meta.env.DEV;

export function getStaticPaths() {
  return [];
}

const FUNCIONES: Record<string, () => Promise<{ default: (req: Request) => Promise<Response> }>> = {
  auth: () => import('../../../../netlify/functions/auth.mjs'),
  'auth-callback': () => import('../../../../netlify/functions/auth-callback.mjs'),
  me: () => import('../../../../netlify/functions/me.mjs'),
  salir: () => import('../../../../netlify/functions/salir.mjs'),
  ficha: () => import('../../../../netlify/functions/ficha.mjs'),
  lista: () => import('../../../../netlify/functions/lista.mjs'),
  guardar: () => import('../../../../netlify/functions/guardar.mjs'),
  publicar: () => import('../../../../netlify/functions/publicar.mjs'),
  fusionar: () => import('../../../../netlify/functions/fusionar.mjs'),
  aviso: () => import('../../../../netlify/functions/aviso.mjs'),
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
