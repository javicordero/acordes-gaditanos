// Comprueba que el editor de `<pre>` no cambia las fichas: desenvolver el
// bloque y volver a envolverlo tiene que dar exactamente el mismo texto.
//
// Uso: node scripts/auditar-pre.mjs [-v]
//
// Falla si una ficha no se puede desenvolver, si al envolver se pierde o se
// mueve algún acorde o si el bloque cambia (espacios, atributos de postura…).
// Es la red de seguridad del revisor en modo texto.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { desenvolver, envolver } from './lib/pre-acordes.mjs';

const verbose = process.argv.includes('-v');
const CARPETA = 'src/content/acordes';

let iguales = 0;
const distintos = [];
const normalizadas = [];
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

  // Envolver un acorde suelto no es un cambio del editor: es una normalización
  // (el acorde pasa a ser interactivo en la web). Se avisa, pero no bloquea.
  // Solo cuenta como normalización si las etiquetas que ya había se conservan.
  const lineasSueltas = new Set(
    e.avisos
      .map((aviso) => /^línea (\d+): .*sin envolver/.exec(aviso))
      .filter(Boolean)
      .map((m) => Number(m[1])),
  );

  const a = original.split('\n');
  const b = e.pre.split('\n');
  const dif = [];
  let soloNormaliza = true;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;

    if (!lineasSueltas.has(i + 1)) {
      soloNormaliza = false;
    } else {
      const etiquetasAntes = [...a[i].matchAll(/<a[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
      const etiquetasAhora = new Set([...b[i].matchAll(/<a[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]));
      if (!etiquetasAntes.every((t) => etiquetasAhora.has(t))) soloNormaliza = false;
    }

    dif.push(`  L${i + 1}\n   ‹ ${a[i] ?? '(nada)'}\n   › ${b[i] ?? '(nada)'}`);
  }

  if (soloNormaliza) {
    normalizadas.push(`${slug} (${dif.length} línea(s))`);
    continue;
  }

  distintos.push(`${slug} (${dif.length} línea(s))\n${dif.slice(0, verbose ? dif.length : 3).join('\n')}`);
}

console.log(`✓ ${iguales} ficha(s) idénticas al desenvolver y volver a envolver`);
if (normalizadas.length) {
  console.log(`\n~ ${normalizadas.length} ficha(s) normalizan acordes sueltos (se envolverán al abrir el editor):`);
  for (const n of normalizadas) console.log(`  ${n}`);
}
if (distintos.length) {
  console.log(`\n~ ${distintos.length} ficha(s) cambian:`);
  for (const d of distintos.slice(0, verbose ? distintos.length : 8)) console.log(d);
  if (!verbose && distintos.length > 8) console.log(`  … y ${distintos.length - 8} más (usa -v)`);
}
if (errores.length) {
  console.error(`\n✗ ${errores.length} error(es):`);
  for (const e of errores) console.error(`  ${e}`);
  process.exit(1);
}
if (distintos.length) process.exit(1);
