import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async ({ url, redirect }, next) => {
  const pathname = url.pathname;

  if (pathname.startsWith('/formateadores') || pathname === '/coming-soon') {
    return redirect('/404', 302);
  }

  // En desarrollo, el API del panel /estudio lo inyecta la integración
  // `estudioApiDev` (astro.config.mjs); en producción lo ejecuta Netlify.
  return next();
};
