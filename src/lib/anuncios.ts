import { SEO } from './constants.ts';

// Lista negra: donde NO se cargan anuncios ni se mide. Es la única fuente de
// verdad; el <script> del <head> de Layout.astro recibe estas listas con
// `define:vars`, así que no puede haber dos criterios distintos.
//
// Si aparece un proveedor de túnel nuevo (u otro host de desarrollo), se añade
// su sufijo aquí y queda cubierto en toda la web.

// Hosts exactos de desarrollo.
export const HOSTS_SIN_ANUNCIOS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

// Sufijos de dominios de desarrollo: mDNS de la red local, túneles y deploy
// previews. Se comparan con `endsWith`, así que siempre empiezan por punto.
export const SUFIJOS_SIN_ANUNCIOS = [
  '.local',
  '.devtunnels.ms',
  '.ngrok.io',
  '.ngrok.app',
  '.ngrok-free.app',
  '.ngrok-free.dev',
  '.trycloudflare.com',
  '.loca.lt',
  '.netlify.app',
];

// Rutas privadas del propietario: panel, borradores y listas internas.
export const RUTAS_PRIVADAS = [
  '/estudio',
  '/acordes2',
  '/acordes3',
  '/lista2',
  '/admin',
  '/reconocer-acorde',
];

// Cualquier IPv4 literal (192.168.1.40, 10.0.0.5…) es desarrollo.
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function esHostDeDesarrollo(hostname: string): boolean {
  // `location.hostname` llega con corchetes en IPv6 (`[::1]`).
  const host = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (HOSTS_SIN_ANUNCIOS.includes(host)) return true;
  if (SUFIJOS_SIN_ANUNCIOS.some((sufijo) => host.endsWith(sufijo))) return true;
  return IPV4.test(host);
}

export function esRutaPrivada(pathname = '/'): boolean {
  const ruta = (pathname || '/').toLowerCase();
  return RUTAS_PRIVADAS.some((privada) => ruta === privada || ruta.startsWith(`${privada}/`));
}

export function anunciosPermitidos(hostname: string, pathname = '/'): boolean {
  return !esHostDeDesarrollo(hostname) && !esRutaPrivada(pathname);
}

// URL del loader de AdSense, montada desde la cuenta (no repetir el ca-pub-…).
export const SCRIPT_ADSENSE = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SEO.adsenseAccount}`;
