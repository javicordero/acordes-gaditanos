// Audita las cabeceras de seguridad y caché del sitio desplegado.
//
// Netlify no aplica `_headers` ni `netlify.toml` en `astro preview`, así que la
// única comprobación real es contra producción (o un deploy preview):
//
//   1. Cabeceras de seguridad globales en la home y en una ficha.
//   2. `/_astro/*` con caché de un año `immutable` (el nombre lleva el hash).
//   3. `sw.js` sin caché, o el navegador serviría una versión vieja.
//   4. `/admin/` con `noindex` y su CSP estricta, sin cabeceras duplicadas.
//
// Uso: npm run auditar:cabeceras [-- --url https://acordesgaditanos.com]

const args = process.argv.slice(2);
const iUrl = args.indexOf('--url');
const BASE = (iUrl === -1 ? 'https://acordesgaditanos.com' : args[iUrl + 1] || '').replace(/\/+$/, '');

if (!/^https?:\/\//.test(BASE)) {
  console.error('Uso: node scripts/auditar-cabeceras.mjs [--url https://…]');
  process.exit(2);
}

let errores = 0;
let avisos = 0;

const fallo = (texto) => {
  console.error(`FALLO  ${texto}`);
  errores++;
};
const aviso = (texto) => {
  console.warn(`AVISO  ${texto}`);
  avisos++;
};

/** Pide una ruta y devuelve la respuesta. */
async function pedir(ruta) {
  const res = await fetch(BASE + ruta, {
    redirect: 'follow',
    headers: { 'User-Agent': 'auditar-cabeceras/1.0 (+acordesgaditanos.com)' },
  });
  return res;
}

/** Comprueba una cabecera con un predicado y describe el valor real si falla. */
function cabecera(res, ruta, nombre, predicado, esperado) {
  const valor = res.headers.get(nombre);
  if (valor === null) {
    fallo(`${ruta} no manda ${nombre}`);
  } else if (!predicado(valor)) {
    fallo(`${ruta} ${nombre} = "${valor}" (se esperaba ${esperado})`);
  }
}

const CLARO = {
  nosniff: (v) => v.toLowerCase() === 'nosniff',
  deny: (v) => v.toLowerCase() === 'deny',
  referrer: (v) => v.toLowerCase() === 'strict-origin-when-cross-origin',
  permisos: (v) => /camera=\(\)/i.test(v) && /microphone=\(\)/i.test(v) && /geolocation=\(\)/i.test(v),
  inmutable: (v) => /immutable/i.test(v) && /max-age=31536000/i.test(v),
  sinCache: (v) => /max-age=0/i.test(v) && /must-revalidate/i.test(v),
  noindex: (v) => /noindex/i.test(v),
};

const seguridad = (res, ruta) => {
  cabecera(res, ruta, 'x-content-type-options', CLARO.nosniff, 'nosniff');
  cabecera(res, ruta, 'x-frame-options', CLARO.deny, 'DENY');
  cabecera(res, ruta, 'referrer-policy', CLARO.referrer, 'strict-origin-when-cross-origin');
  cabecera(res, ruta, 'permissions-policy', CLARO.permisos, 'camera=(), microphone=() y geolocation=()');
};

try {
  // --- Home -------------------------------------------------------------
  const home = await pedir('/');
  if (!home.ok) fallo(`/ responde ${home.status}`);
  const html = await home.text();
  seguridad(home, '/');

  const css = (html.match(/\/_astro\/[A-Za-z0-9._-]+\.css/) || [])[0];
  const ficha = (html.match(/href="(\/acordes\/[^"#?]+\/)"/) || [])[1];

  // El HTML se queda con el `max-age=0, must-revalidate` de Netlify a
  // propósito (el CDN lo sirve con ETag); si Netlify lo cambia, avisamos.
  const cacheHtml = home.headers.get('cache-control') || '';
  if (!/must-revalidate/i.test(cacheHtml)) {
    aviso(`/ ya no lleva "must-revalidate" en Cache-Control: "${cacheHtml}"`);
  }

  // --- Ficha: las cabeceras tienen que llegar a todas las páginas ---------
  if (ficha) {
    const res = await pedir(ficha);
    if (!res.ok) fallo(`${ficha} responde ${res.status}`);
    seguridad(res, ficha);
  } else {
    aviso('no se ha encontrado una ficha en la home para comprobar las cabeceras');
  }

  // --- Assets de Astro ----------------------------------------------------
  if (css) {
    const res = await pedir(css);
    if (!res.ok) fallo(`${css} responde ${res.status}`);
    cabecera(res, css, 'cache-control', CLARO.inmutable, 'un año e immutable');
  } else {
    fallo('no se ha encontrado ningún CSS de /_astro/ en la home');
  }

  // --- Service worker -----------------------------------------------------
  const sw = await pedir('/sw.js');
  if (!sw.ok) fallo(`/sw.js responde ${sw.status}`);
  cabecera(sw, '/sw.js', 'cache-control', CLARO.sinCache, 'max-age=0, must-revalidate');

  // --- Panel --------------------------------------------------------------
  const admin = await pedir('/admin/');
  if (!admin.ok) fallo(`/admin/ responde ${admin.status}`);
  cabecera(admin, '/admin/', 'x-robots-tag', CLARO.noindex, 'noindex');
  const csp = admin.headers.get('content-security-policy');
  if (!csp) {
    fallo('/admin/ no manda Content-Security-Policy');
  } else if (!/script-src 'self'/i.test(csp)) {
    fallo(`/admin/ tiene una CSP inesperada: "${csp}"`);
  }

  // Un mismo header repetido entre `netlify.toml` y `_headers` llega
  // concatenado con coma; en Referrer-Policy eso es ambiguo.
  const referrer = admin.headers.get('referrer-policy') || '';
  if (referrer.includes(',')) {
    fallo(`/admin/ manda Referrer-Policy duplicada: "${referrer}"`);
  }
} catch (error) {
  fallo(`no se pudo completar la auditoría: ${error?.message || error}`);
}

if (errores) {
  console.error(`\n✗ ${errores} fallo(s) en ${BASE}.`);
  process.exit(1);
}

console.log(`✓ Cabeceras correctas en ${BASE}${avisos ? ` (${avisos} aviso/s)` : ''}.`);
