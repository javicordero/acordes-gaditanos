import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async ({ url, redirect }, next) => {
  const pathname = url.pathname;

  // if (pathname.startsWith('/formateadores') || pathname === '/coming-soon') {
  //   return redirect('/404', 302);
  // }

  return next();
};
