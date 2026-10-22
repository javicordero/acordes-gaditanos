/**
 * Auditoría de cobertura del glosario de acordes.
 *
 * Recorre todas las piezas de la colección `acordes`, extrae los acordes de los
 * bloques <pre> y comprueba que todos tienen diagrama.
 *
 * Uso: node --experimental-strip-types scripts/auditar-glosario.ts
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  buscarEnIndice,
  crearIndice,
  extraerEtiquetasAcordes,
  parsearAcorde,
} from '../src/lib/acordes.ts';
import type { Glosario } from '../src/lib/acordes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'src', 'content', 'acordes');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');

const datos = JSON.parse(readFileSync(DATA, 'utf8')) as { acordes: Glosario };
const indice = crearIndice(datos.acordes);

const ficheros = readdirSync(DIR).filter((f) => f.endsWith('.md'));
const sinDiagrama = new Map<string, number>();
const noAcordes = new Map<string, number>();
const acordesUsados = new Set<string>();
let totalEtiquetas = 0;

for (const fichero of ficheros) {
  const cuerpo = readFileSync(path.join(DIR, fichero), 'utf8');
  const etiquetas = extraerEtiquetasAcordes(cuerpo);
  totalEtiquetas += etiquetas.length;

  for (const etiqueta of etiquetas) {
    if (!parsearAcorde(etiqueta)) {
      noAcordes.set(etiqueta, (noAcordes.get(etiqueta) ?? 0) + 1);
      continue;
    }

    if (!buscarEnIndice(indice, etiqueta)) {
      sinDiagrama.set(etiqueta, (sinDiagrama.get(etiqueta) ?? 0) + 1);
      continue;
    }
    acordesUsados.add(etiqueta);
  }
}

const ordenar = (mapa: Map<string, number>) => [...mapa.entries()].sort((a, b) => b[1] - a[1]);

console.log(`Piezas analizadas: ${ficheros.length}`);
console.log(`Apariciones de acordes: ${totalEtiquetas}`);
console.log(`Acordes distintos con diagrama: ${acordesUsados.size}`);
console.log(`Acordes distintos sin diagrama: ${sinDiagrama.size}`);
console.log(`Etiquetas que no son acordes: ${noAcordes.size}`);

if (sinDiagrama.size) {
  console.log('\nSin diagrama:');
  for (const [etiqueta, veces] of ordenar(sinDiagrama)) {
    console.log(`  - ${etiqueta} (${veces})`);
  }
}

if (noAcordes.size) {
  console.log('\nNo reconocidas como acorde (no interactivas):');
  for (const [etiqueta, veces] of ordenar(noAcordes).slice(0, 25)) {
    console.log(`  - "${etiqueta}" (${veces})`);
  }
}

if (sinDiagrama.size) {
  console.error('\nERROR: hay acordes válidos sin diagrama.');
  process.exit(1);
}

console.log('\nOK: todos los acordes válidos tienen diagrama.');
