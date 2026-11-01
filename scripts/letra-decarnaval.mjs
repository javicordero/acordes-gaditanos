// Extrae la letra de una página de letrasdecarnaval.com desde <p id="letra">.
import { writeFileSync } from 'node:fs';

const url = process.argv[2];
const salida = process.argv[3] || '.cache/letra-web.txt';
const html = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const m = html.match(/<p id="letra"[^>]*>([\s\S]*?)<\/p>/);
if (!m) { console.error('no encuentro <p id="letra">'); process.exit(1); }

const ent = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', laquo: '«', raquo: '»',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…',
  mdash: '—', ndash: '–', quot: '"', amp: '&', apos: "'", nbsp: ' ',
  iexcl: '¡', iquest: '¿',
};
const dec = (t) => t
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-zA-Z]+);/g, (x, n) => (ent[n] !== undefined ? ent[n] : x));

const lineas = dec(m[1])
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .split('\n')
  .map((l) => l.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

writeFileSync(salida, `${lineas.join('\n')}\n`);
console.log(`${lineas.length} versos → ${salida}`);
console.log(`primera: ${lineas[0]?.slice(0, 60)}`);
console.log(`última:  ${lineas[lineas.length - 1]?.slice(0, 60)}`);
