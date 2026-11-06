/**
 * Auditoría del reconocedor de acordes.
 *
 * Comprueba tres cosas:
 *   1. Acordes comunes: la primera lectura es la esperada.
 *   2. Posturas que NO están en el glosario: se reconocen igual, porque el
 *      análisis es por notas (no por una lista de posturas).
 *   3. Recorrido del glosario: cuántas posiciones dan resultado y cuántas
 *      coinciden con el nombre que usa la web (mapa de posturas exactas).
 *
 * Uso: node --experimental-strip-types scripts/auditar-reconocer.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { reconocerAcorde } from '../src/lib/reconocer.ts';
import { mapaPosturas } from '../src/lib/reconocer-glosario.ts';
import type { Glosario } from '../src/lib/acordes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');

const glosario = JSON.parse(readFileSync(DATA, 'utf8')).acordes as Glosario;
const mapa = mapaPosturas(glosario);

const trastesDe = (texto: string): number[] =>
  texto.split(' ').map((valor) => (valor === 'x' ? -1 : Number(valor)));

const comunes: Array<[string, string]> = [
  ['Do', 'x 3 2 0 1 0'],
  ['Lam', 'x 0 2 2 1 0'],
  ['Sol', '3 2 0 0 0 3'],
  ['Mi', '0 2 2 1 0 0'],
  ['Re', 'x x 0 2 3 2'],
  ['Rem', 'x x 0 2 3 1'],
  ['La', 'x 0 2 2 2 0'],
  ['Mim', '0 2 2 0 0 0'],
  ['Fa', '1 3 3 2 1 1'],
  ['Si7', 'x 2 1 2 0 2'],
  ['Do7', 'x 3 2 3 1 0'],
  ['Sol7', '3 2 0 0 0 1'],
  ['Lam7', 'x 0 2 0 1 0'],
  ['Domaj7', 'x 3 2 0 0 0'],
  ['Do/Mi', '0 3 2 0 1 0'],
  ['Resus4', 'x x 0 2 3 3'],
  ['Rem7', 'x x 0 2 1 1'],
];

const inventadas: Array<[string, string]> = [
  ['Lam7', '5 x 5 5 5 x'],
  ['Doadd9', '8 10 12 12 13 12'],
  ['Mi', '12 14 14 13 12 12'],
];

const problemas = [];

for (const [esperado, texto] of comunes) {
  const trastes = trastesDe(texto);
  const resultados = reconocerAcorde(trastes);
  const obtenido = resultados[0]?.nombre ?? 'sin resultado';
  if (obtenido !== esperado) {
    problemas.push(`Común ${esperado} [${texto}] → ${obtenido}`);
  }
}

for (const [esperado, texto] of inventadas) {
  const trastes = trastesDe(texto);
  if (mapa.has(trastes.join(','))) {
    problemas.push(`La postura inventada ${texto} está en el glosario; elige otra`);
    continue;
  }
  const resultados = reconocerAcorde(trastes);
  const obtenido = resultados[0]?.nombre ?? 'sin resultado';
  if (obtenido !== esperado) {
    problemas.push(`Inventada ${esperado} [${texto}] → ${obtenido}`);
  }
}

let total = 0;
let sinResultado = 0;
let coincidenMapa = 0;
const sins = [];

for (const [etiqueta, entrada] of Object.entries(glosario)) {
  for (const posicion of entrada.posiciones) {
    total += 1;
    const clave = posicion.trastes.join(',');
    if (mapa.get(clave)?.etiqueta === etiqueta) coincidenMapa += 1;
    const resultados = reconocerAcorde(posicion.trastes);
    if (!resultados.length) {
      sinResultado += 1;
      sins.push(`${etiqueta} (${clave})`);
      continue;
    }
  }
}

const MINIMO_RESULTADOS = 1326; // 16 posiciones raras no se reconocen hoy.
const MINIMO_MAPA = 960; // Hoy coinciden 970 (72 %).

if (total - sinResultado < MINIMO_RESULTADOS) {
  problemas.push(
    `Solo ${total - sinResultado}/${total} posiciones dan resultado (mínimo ${MINIMO_RESULTADOS})`,
  );
}
if (coincidenMapa < MINIMO_MAPA) {
  problemas.push(
    `Solo ${coincidenMapa}/${total} coinciden con el nombre del glosario (mínimo ${MINIMO_MAPA})`,
  );
}

console.log(`Acordes comunes: ${comunes.length}`);
console.log(`Posturas inventadas (fuera del glosario): ${inventadas.length}`);
console.log(`Posiciones del glosario: ${total}`);
console.log(`  con resultado: ${total - sinResultado}`);
console.log(`  sin resultado: ${sinResultado}`);
console.log(`  nombre del glosario: ${coincidenMapa} (${Math.round((coincidenMapa / total) * 100)} %)`);

if (sins.length) {
  console.log('\nSin resultado (conocidas):');
  for (const sin of sins) console.log(`  - ${sin}`);
}

if (problemas.length) {
  console.log('\nProblemas:');
  for (const problema of problemas) console.log(`  - ${problema}`);
  console.error('\nERROR: el reconocedor ha empeorado.');
  process.exit(1);
}

console.log('\nOK: el reconocedor reconoce los acordes comunes y las posturas fuera del glosario.');
