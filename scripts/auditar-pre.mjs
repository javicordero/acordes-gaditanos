// Comprueba que el editor de `<pre>` no cambia las fichas: desenvolver el
// bloque y volver a envolverlo tiene que dar exactamente el mismo texto.
//
// Uso: node scripts/auditar-pre.mjs [-v]
//
// Falla si una ficha no se puede desenvolver, si al envolver se pierde o se
// mueve algÃºn acorde o si el bloque cambia (espacios, atributos de posturaâ€¦).
// Es la red de seguridad del revisor en modo texto.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desenvolver, envolver, clasificar } from './lib/pre-acordes.mjs';

const verbose = process.argv.includes('-v');
const CARPETA = 'src/content/acordes';

let iguales = 0;
const distintos = [];
const errores = [];

for (const archivo of readdirSync(CARPETA).filter((f) => f.endsWith('.md'))) {
  const slug = archivo.slice(0, -3);
  const md = readFileSync(join(CARPETA, archivo), 'utf8').replace(/\r\n/g, '\n');
  if (!md.includes('<pre>')) continue;

  let d;
  try {
    d = desenvolver(md);
  } catch (e) {
    errores.push(`${slug}: ${e.message}`);
    continue;
  }

  const original = (md.match(/<pre>\n?([\s\S]*?)<\/pre>/) || [])[1].replace(/\n+$/, '');
  let e;
  try {
    e = envolver(d.texto, d.registros, d.originales);
  } catch (err) {
    errores.push(`${slug}: ${err.message}`);
    continue;
  }

  if (e.pre === original) {
    iguales++;
    continue;
  }

  const a = original.split('\n');
  const b = e.pre.split('\n');
  const dif = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) dif.push(`  L${i + 1}\n   â€¹ ${a[i] ?? '(nada)'}\n   â€º ${b[i] ?? '(nada)'}`);
  }
  distintos.push(`${slug} (${dif.length} lÃ­nea(s))\n${dif.slice(0, verbose ? dif.length : 3).join('\n')}`);
}

console.log(`âœ“ ${iguales} ficha(s) idÃ©nticas al desenvolver y volver a envolver`);
if (distintos.length) {
  console.log(`\n~ ${distintos.length} ficha(s) cambian:`);
  for (const d of distintos.slice(0, verbose ? distintos.length : 8)) console.log(d);
  if (!verbose && distintos.length > 8) console.log(`  â€¦ y ${distintos.length - 8} mÃ¡s (usa -v)`);
}
if (errores.length) {
  console.error(`\nâœ— ${errores.length} error(es):`);
  for (const e of errores) console.error(`  ${e}`);
  process.exit(1);
}
if (distintos.length) process.exit(1);

