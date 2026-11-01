// Busca una copla en «Letras desde el Paraíso» (Blogger) usando su feed Atom.
//
// Uso:
//   node scripts/buscar-letra-blog.mjs "frase de la letra" [--agrupacion "Los X"] [-n 8]
//
// Devuelve título, URL y fecha de cada entrada que case, para después pasarla
// por `letra:web --blogger --desde "<frase>"`.
//
// El blog sirve el texto completo en el feed aunque la página no lo traiga en el
// HTML (el cuerpo se carga aparte), así que esta es la vía fiable.

const BLOG = (() => {
  const i = args.indexOf('--blog');
  return (i >= 0 && args[i + 1]) || 'letrasdesdeelparaiso.blogspot.com';
})();
const iBlog = args.indexOf('--blog');
const args = process.argv.slice(2);
const iAgr = args.indexOf('--agrupacion');
const agrupacion = iAgr >= 0 ? args[iAgr + 1] : '';
const iN = args.indexOf('-n');
const n = iN >= 0 ? Number(args[iN + 1]) : 8;
const saltar = new Set();
if (iAgr >= 0) { saltar.add(iAgr); saltar.add(iAgr + 1); }
if (iN >= 0) { saltar.add(iN); saltar.add(iN + 1); }
if (iBlog >= 0) { saltar.add(iBlog); saltar.add(iBlog + 1); }
const frase = args.filter((a, i) => !saltar.has(i) && !a.startsWith('--')).join(' ').trim();

if (!frase) {
  console.error('Uso: node scripts/buscar-letra-blog.mjs "frase" [--agrupacion "Los X"] [-n 8]');
  process.exit(1);
}

const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const limpia = (t) => plano(t).replace(/[^a-z0-9]+/g, ' ').trim();

async function feed(q) {
  const url = `https://${BLOG}/feeds/posts/default?alt=json&max-results=${n}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`feed ${r.status}`);
  const j = await r.json();
  return j.feed?.entry || [];
}

const consultas = [frase];
if (agrupacion) consultas.push(`${frase} ${agrupacion}`);

const vistos = new Set();
const encontrados = [];
for (const q of consultas) {
  let entradas = [];
  try { entradas = await feed(q); } catch (e) { console.error(`! ${e.message}`); continue; }
  for (const e of entradas) {
    const url = e.link?.find((l) => l.rel === 'alternate')?.href;
    if (!url || vistos.has(url)) continue;
    const titulo = e.title?.$t || '';
    const contenido = ` ${limpia(e.content?.$t || '')} `;
    // La frase completa tiene que estar en el cuerpo, no solo palabras sueltas.
    if (!contenido.includes(` ${limpia(frase)} `)) continue;
    vistos.add(url);
    encontrados.push({
      titulo,
      url,
      fecha: (e.published?.$t || '').slice(0, 10),
      agrupacion: /(comparsa|chirigota|coro|cuarteto)/i.test(titulo) ? 'sí' : '?',
      largo: (e.content?.$t || '').length,
    });
  }
}

if (!encontrados.length) {
  console.log(`✗ Sin resultados para «${frase}»${agrupacion ? ` (${agrupacion})` : ''}.`);
  process.exit(1);
}

console.log(`${encontrados.length} entrada(s) para «${frase}»:\n`);
for (const e of encontrados) {
  console.log(`• ${e.titulo}`);
  console.log(`  ${e.fecha} · ${e.largo} car. · ${e.url}`);
  console.log(`  node scripts/letra-web.mjs "${e.url}" --blogger --desde "${frase}" --salida .cache/letra-x.txt\n`);
}
