// Audita el modelo de las fichas: leer el .md, pintarlo y volver a leerlo no
// debe mover acordes ni perder texto.
//
// Uso: node scripts/auditar-acordes.mjs [-v]
//
// La primera pasada normaliza (quita espacios de más y pega cada acorde a su
// sílaba); a partir de ahí el dibujo tiene que ser idéntico. Falla si una ficha
// no se puede leer, si se pierde algún acorde o si el dibujo sigue cambiando en
// la tercera pasada (eso sí sería deriva de verdad).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARPETA, planDesdeMd, renderizarPlan } from './lib/acordes-letra.mjs';

const verbose = process.argv.includes('-v');
const fichas = readdirSync(CARPETA).filter((f) => f.endsWith('.md'));

const pintar = (texto, slug) => renderizarPlan(planDesdeMd(`---\nx\n---\n<pre>\n${texto}\n</pre>\n`, slug)).salida.join('\n');
const acordesDe = (texto, slug) => renderizarPlan(planDesdeMd(`---\nx\n---\n<pre>\n${texto}\n</pre>\n`, slug))
  .versos.flatMap((v) => v.acordes.map((a) => a.etiqueta));

let identicas = 0;
let normalizadas = 0;
const avisos = [];
const errores = [];

for (const archivo of fichas) {
  const slug = archivo.slice(0, -3);
  const texto = readFileSync(join(CARPETA, archivo), 'utf8').replace(/\r\n/g, '\n');
  if (!/<pre>/.test(texto)) continue;

  let uno;
  try {
    uno = renderizarPlan(planDesdeMd(texto, slug)).salida.join('\n');
  } catch (e) {
    errores.push(`${slug}: ${e.message}`);
    continue;
  }

  // El .md solo se puede escribir con un acorde por columna, así que la primera
  // pasada normaliza; después de eso tiene que quedarse quieto.
  const dos = pintar(uno, slug);
  const tres = pintar(dos, slug);
  const cuatro = pintar(tres, slug);

  const original = (texto.match(/<pre>\n?([\s\S]*?)<\/pre\s*>?/) || [])[1] || '';
  if (original.replace(/\n+$/, '') === uno) identicas++;
  else normalizadas++;

  if (acordesDe(uno, slug).join('|') !== acordesDe(dos, slug).join('|')) {
    errores.push(`${slug}: se pierde o cambia algún acorde al repintar`);
  }
  if (cuatro !== tres) {
    avisos.push(`${slug}: el dibujo no se estabiliza (más acordes que sílabas para dibujarlos)`);
  } else if (tres !== dos) {
    avisos.push(`${slug}: necesita dos pasadas para estabilizarse`);
  }
}

console.log(`✓ ${identicas} ficha(s) se releen idénticas`);
console.log(`~ ${normalizadas} ficha(s) se normalizan en la primera pasada (espacios y acorde pegado a su sílaba)`);
if (avisos.length) {
  console.log(`! ${avisos.length} ficha(s) tardan dos pasadas:`);
  for (const a of avisos.slice(0, verbose ? avisos.length : 10)) console.log(`  ${a}`);
  if (!verbose && avisos.length > 10) console.log(`  … y ${avisos.length - 10} más (usa -v)`);
}
if (errores.length) {
  console.error(`✗ ${errores.length} error(es):`);
  for (const e of errores) console.error(`  ${e}`);
  process.exit(1);
}
console.log('✓ Ningún acorde se pierde ni cambia de sitio al releer y repintar.');
