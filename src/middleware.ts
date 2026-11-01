import type { MiddlewareHandler } from 'astro';

// Funciones de Netlify que usa el panel /estudio. En producción las ejecuta
// Netlify (redirección de netlify.toml); en `astro dev` no existen, así que se
// ejecutan desde aquí para poder probar el panel sin `netlify dev`.
const FUNCIONES: Record<string, () => Promise<{ default: (req: Request) => Promise<Response> }>> = {
  auth: () => import('../netlify/functions/auth.mjs'),
  'auth-callback': () => import('../netlify/functions/auth-callback.mjs'),
  me: () => import('../netlify/functions/me.mjs'),
  salir: () => import('../netlify/functions/salir.mjs'),
  ficha: () => import('../netlify/functions/ficha.mjs'),
  lista: () => import('../netlify/functions/lista.mjs'),
  guardar: () => import('../netlify/functions/guardar.mjs'),
  publicar: () => import('../netlify/functions/publicar.mjs'),
  fusionar: () => import('../netlify/functions/fusionar.mjs'),
  aviso: () => import('../netlify/functions/aviso.mjs'),
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { url, request } = context;
  const pathname = url.pathname;

  if (pathname.startsWith('/formateadores') || pathname === '/coming-soon') {
    return context.redirect('/404', 302);
  }

  if (import.meta.env.DEV && pathname.startsWith('/estudio/api/')) {
    const nombre = pathname.slice('/estudio/api/'.length).replace(/\/+$/, '');
    const cargar = FUNCIONES[nombre];
    if (!cargar) return new Response('No encontrado', { status: 404 });

    // Las funciones leen process.env; Vite deja las variables en import.meta.env.
    for (const [k, v] of Object.entries(import.meta.env)) {
      if (typeof v === 'string' && !process.env[k]) process.env[k] = v;
    }
    process.env.URL = url.origin;

    try {
      const mod = await cargar();
      // `request.url` puede venir sin la query en dev: se reconstruye con la URL
      // completa de Astro para que las funciones lean bien `?code`, `?slug`, etc.
      const peticion = new Request(request.url, request);
      const res = await mod.default(peticion);
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
  }

  return next();
};
