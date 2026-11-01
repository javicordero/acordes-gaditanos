// Descarga la letra de una página web y la deja en un .txt con una línea por
// verso, lista para `npm run acordes:plan`.
//
// Uso:
//   node scripts/letra-web.mjs <url> [--salida .cache/letra-<slug>.txt] [--ver]
//
// Qué hace:
//   - Descarga el HTML (sin ejecutar JavaScript).
//   - Se queda con el bloque de contenido más largo de la página (el artículo).
//   - Convierte <br>, <p>, <div> de línea en saltos de línea y quita el resto de
//     etiquetas, scripts y estilos.
//   - Decodifica entidades (&aacute;, &#39;, &hellip;…).
//   - Limpia el ruido típico de los blogs (menús, «Comparte», política de
//     cookies, relacionados) y junta las líneas partidas por el maquetado.
//   - Avisa de la agrupación y el año que detecta en el título, para que puedas
//     comprobar que has dado con la copla correcta antes de aplicarle acordes.
//
// Nunca escribe dentro de src/content: eso lo hace `acordes:aplicar`.

import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
const iSalida = args.indexOf('--salida');
const ver = args.includes('--ver');

if (!url) {
  console.error('Uso: node scripts/letra-web.mjs <url> [--salida <ruta>] [--ver]');
  process.exit(1);
}

const ENTIDADES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', mdash: '—', ndash: '–', quot: '"', amp: '&', apos: "'",
  lt: '<', gt: '>', nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°', euro: '€',
  iexcl: '¡', iquest: '¿', cedil: 'ç', Ccedil: 'Ç',
};

function decodificar(t) {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (ENTIDADES[n] !== undefined ? ENTIDADES[n] : m));
}

function aTexto(html) {
  return decodificar(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, '\n')
      .replace(/<(p|div|li|h[1-6]|tr|blockquote|section|article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l !== '');
}

// Ruido de plantilla que aparece pegado a la letra.
const RUIDO = [
  /^pol[ií]tica/i, /^aviso legal/i, /^cookies?$/i, /^comparte/i, /^comentarios?$/i,
  /^deja un comentario/i, /^relacionad/i, /^siguiente/i, /^anterior/i, /^inicio$/i,
  /^men[uú]$/i, /^buscar$/i, /^search$/i, /^categor[ií]as/i, /^etiquetas/i,
  /^archivo/i, /^suscrip/i, /^newsletter/i, /^publicidad/i, /^anuncio/i,
  /^leer m[aá]s$/i, /^ver m[aá]s$/i, /^compartir/i, /^whatsapp$/i, /^facebook$/i,
  /^twitter$/i, /^telegram$/i, /^imprimir$/i, /^descargar/i, /^autor/i, /^autoría/i,
  /^©/u, /^copyright/i, /^\d{4}$/, /^carnaval de c[aá]diz/i, /^coac/i,
  /^publicado por/i, /^entrada (anterior|siguiente)/i,
  /^responder$/i, /^respuestas?$/i, /^comentario/i, /^archivado en/i, /^navegaci[oó]n/i,
  /^a[nñ]adir un comentario/i, /^art[ií]culos? relacionad/i, /^te puede interesar/i,
  /^m[aá]s entradas/i, /^inicio de la p[aá]gina/i, /^buscar en este blog/i,
  // Pies de página y widgets que se cuelan detrás de la letra.
  /^volver$/i, /^mensaje:$/i, /^cerrar\s+enviar error$/i, /^informar de un error$/i,
  /^gracias por enviar tu sugerencia$/i, /^(ú|u)ltima modificaci[oó]n/i,
  /^\d+\s*comentarios?$/i, /^vendedor\s*:/i, /^seleccionar opciones$/i,
  /^a[nñ]adir al carrito$/i, /^iva incluido$/i, /^rango de precios/i,
  /^[\d.,]+K$/i, /^gracias a\s+/i, /^recopilaci[oó]n de letras/i,
  /^(pasodoble|tango|presentaci[oó]n|cupl[eé]s?|popurr[ií]|estribillo)\b/i,
  /A-\s*A\+/, /^[!¡]$/,
];

const esRuido = (l) => l.length < 4 || RUIDO.some((r) => r.test(l));

// El bloque de la letra es la tirada de líneas más larga del artículo.
function mejorBloque(lineas) {
  let mejor = { ini: 0, fin: 0 };
  let ini = 0;
  for (let i = 0; i <= lineas.length; i++) {
    const corta = i === lineas.length || esRuido(lineas[i]);
    if (corta) {
      if (i - ini > mejor.fin - mejor.ini) mejor = { ini, fin: i };
      ini = i + 1;
    }
  }
  return lineas.slice(mejor.ini, mejor.fin);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' } });
if (!res.ok) {
  console.error(`✗ ${res.status} ${res.statusText}: ${url}`);
  process.exit(1);
}
const html = await res.text();

// much muchos blogs de Blogger no sirven la letra en el HTML (el cuerpo se
// carga aparte), pero sí en el feed Atom. `--blogger` la busca ahí.
async function desdeFeedBlogger() {
  const u = new URL(url);
  const title = (/<title>([^<]+)<\/title>/i.exec(fuenteHtml) || [])[1] || '';
  const frase = title.includes(':') ? title.split(':').slice(1).join(':') : title;
  const limpiaTitulo = frase.replace(/["“”'()]/g, ' ').replace(/\s+/g, ' ').trim();
  const consulta = limpiaTitulo.split(' ').slice(0, 8).join(' ') || decodeURIComponent(u.pathname).replace(/[-/]+/g, ' ').trim();
  const feed = `${u.origin}/feeds/posts/default?alt=json&max-results=8&q=${encodeURIComponent(consulta)}`;
  const r = await fetch(feed, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  const entradas = j.feed?.entry || [];
  const limpia = (h) => String(h || '').replace(/\/+$/, '');
  const entrada = entradas.find((e) => limpia(e.link?.find((l) => l.rel === 'alternate')?.href) === limpia(url)) || entradas[0];
  if (!entrada) return null;
  console.log(`Feed: ${entrada.title?.$t}`);
  return entrada.content?.$t || entrada.summary?.$t || null;
}

let fuenteHtml = html;
if (args.includes('--blogger')) {
  const delFeed = await desdeFeedBlogger();
  if (!delFeed) console.error('! No he encontrado la entrada en el feed; sigo con el HTML.');
  else fuenteHtml = delFeed;
}

// Recorta al contenedor del artículo cuando se puede: en Blogger, el cuerpo del
// post va entre `post-body` y `post-footer`, y si no se acota, el bloque más
// largo de la página acaba siendo la lista de «recomendados» de la barra.
function recortarArticulo(h) {
  const marcas = [
    [/<div[^>]*class="[^"]*post-body[^"]*"[^>]*>/i, /<div[^>]*class="[^"]*post-footer[^"]*"[^>]*>/i],
    [/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>/i, /<footer[^>]*>/i],
    [/<article[^>]*>/i, /<\/article>/i],
  ];
  for (const [ini, fin] of marcas) {
    const a = h.search(ini);
    if (a < 0) continue;
    const resto = h.slice(a + 1);
    const b = resto.search(fin);
    if (b < 0) continue;
    return resto.slice(0, b);
  }
  return h;
}

const lineas = aTexto(recortarArticulo(fuenteHtml));
let bloque = mejorBloque(lineas);
const sinCortar = args.includes('--sin-cortar');

// --desde "<texto>": tira todo lo anterior a la primera línea que lo contenga.
// Sirve para saltarse la cabecera de los blogs cuando la letra empieza por la
// frase que estamos buscando.
const iDesde = args.indexOf('--desde');
const plano = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
if (iDesde >= 0) {
  const marca = plano(String(args[iDesde + 1]));
  // Se busca en toda la página, no solo en el bloque más largo: en muchos blogs
  // el bloque que gana es el menú lateral y la letra queda fuera.
  const k = lineas.findIndex((l) => plano(l).includes(marca));
  if (k >= 0) {
    let j = k;
    while (j < lineas.length && !esRuido(lineas[j])) j++;
    bloque = lineas.slice(k, j);
  } else {
    console.error(`! No encuentro «${args[iDesde + 1]}» en la página; se deja el bloque principal.`);
  }
}

// --hasta "<texto>": corta ahí (no incluye la línea). Para cuando la web pega
// recomendaciones u otra copla justo detrás de la letra.
const iHasta = args.indexOf('--hasta');
if (iHasta >= 0) {
  const marca = plano(String(args[iHasta + 1]));
  // Se busca a partir de la segunda línea: la primera suele ser el título.
  const k = bloque.findIndex((l, i) => i > 0 && plano(l).includes(marca));
  if (k > 0) bloque = bloque.slice(0, k);
}

// Une líneas que el maquetado partió a la mitad (sin puntuación final y con
// minúscula al principio) salvo que la siguiente empiece por mayúscula.
const unidas = [];
for (const l of bloque) {
  const previa = unidas[unidas.length - 1];
  const puedeUnir = previa && !/[.,;:!?…]$/.test(previa) && /^[a-záéíóúüñ¿¡]/.test(l) && previa.length < 70;
  if (puedeUnir) unidas[unidas.length - 1] = `${previa} ${l}`;
  else unidas.push(l);
}

// Muchas webs publican la letra de corrido, sin saltos de línea. Para que la
// alineación tenga de dónde agarrarse, se corta en cada signo de cierre y, si
// una frase se va de largo, en la última coma que quepa.
const LARGO_MAX = 62;
function cortarEnFrases(lineas) {
  const out = [];
  for (const l of lineas) {
    const trozos = l.split(/(?<=[.!?…])\s+/).filter(Boolean);
    for (const t of trozos) {
      if (t.length <= LARGO_MAX) { out.push(t); continue; }
      let resto = t;
      while (resto.length > LARGO_MAX) {
        const ventana = resto.slice(0, LARGO_MAX + 12);
        const i = Math.max(ventana.lastIndexOf(', '), ventana.lastIndexOf('; '));
        if (i < 25) break;
        out.push(resto.slice(0, i + 1).trim());
        resto = resto.slice(i + 1).trim();
      }
      if (resto) out.push(resto);
    }
  }
  return out;
}

const versos = sinCortar ? unidas : cortarEnFrases(unidas);

console.log(`Fuente: ${url}`);
console.log(`Bloque de ${bloque.length} línea(s) → ${versos.length} verso(s)`);
if (versos[0]) console.log(`Primera: ${versos[0].slice(0, 80)}`);
if (versos.length > 1) console.log(`Última:  ${versos[versos.length - 1].slice(0, 80)}`);
if (ver) {
  console.log('---');
  console.log(versos.join('\n'));
}
if (args.includes('--mapa')) {
  versos.forEach((l, i) => console.log(`${String(i).padStart(2)} ${String(l.length).padStart(3)} ${l.slice(0, 45)}`));
}

if (iSalida >= 0) {
  const ruta = args[iSalida + 1];
  if (!ruta) {
    console.error('Falta la ruta después de --salida');
    process.exit(1);
  }
  writeFileSync(ruta, `${versos.join('\n')}\n`);
  console.log(`\n✅ ${ruta} (${versos.length} versos)`);
} else if (!ver) {
  console.log('\n(usa --salida <ruta> para guardarla o --ver para verla entera)');
  console.log(`Sugerencia: --salida .cache/letra-${basename(url).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.txt`);
}
