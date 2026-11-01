import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async ({ url, redirect }, next) => {
  const pathname = url.pathname;

  if (pathname.startsWith('/formateadores') || pathname === '/coming-soon') {
    return redirect('/404', 302);
  }

  // El panel /estudio usa `src/pages/estudio/api/[...ruta].ts` para ejecutar las
  // funciones de Netlify en desarrollo (en producción las ejecuta Netlify).
  return next();
};
