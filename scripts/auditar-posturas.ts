/**
 * Auditoría de las posturas predeterminadas de las fichas.
 *
 * Cada `<a data-postura="…">Acorde</a>` de una ficha debe apuntar a una
 * posición que exista de verdad en `src/data/glosario-acordes.json`. Si no
 * existe, el popover cae en silencio a la primera posición y el diagrama deja
 * de enseñar la postura que se quería.
 *
 * Uso: npm run auditar:posturas
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  buscarEnIndice,
  crearIndice,
  indicePostura,
} from '../src/lib/acordes.ts';
import type { Glosario } from '../src/lib/acordes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');
const DIRS = [
  path.join(ROOT, 'src', 'content', 'acordes'),
  path.join(ROOT, 'src', 'content', 'borradores'),
];

const datos = JSON.parse(readFileSync(DATA, 'utf8')) as { acordes: Glosario };
const indice = crearIndice(datos.acordes);

const POSTURA = /<a\b([^>]*\bdata-postura\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*)>([\s\S]*?)<\/a>/gi;

interface Fallo {
  fichero: string;
  etiqueta: string;
  postura: string;
  motivo: string;
}

const fallos: Fallo[] = [];
const ficherosConPosturas = new Set<string>();
let total = 0;

for (const dir of DIRS) {
  const ficheros = readdirSync(dir).filter((f) => f.endsWith('.md'));

  for (const fichero of ficheros) {
    const ruta = path.join(dir, fichero);
    const texto = readFileSync(ruta, 'utf8');

    for (const m of texto.matchAll(POSTURA)) {
      total += 1;
      ficherosConPosturas.add(ruta);

      const postura = (m[2] ?? m[3] ?? '').trim();
      const etiqueta = (m[4] ?? '').replace(/<[^>]+>/g, '').trim();
      const entrada = buscarEnIndice(indice, etiqueta);

      if (!entrada) {
        fallos.push({
          fichero: path.relative(ROOT, ruta),
          etiqueta,
          postura,
          motivo: 'el acorde no existe en el glosario',
        });
        continue;
      }

      if (indicePostura(entrada, postura) === null) {
        fallos.push({
          fichero: path.relative(ROOT, ruta),
          etiqueta,
          postura,
          motivo: 'la postura no está entre las posiciones del acorde',
        });
      }
    }
  }
}

console.log(
  `data-postura: ${total} referencias en ${ficherosConPosturas.size} fichas`,
);

if (fallos.length) {
  console.error(`\nFallos (${fallos.length}):`);
  for (const fallo of fallos) {
    console.error(
      `  - ${fallo.fichero}: <a data-postura="${fallo.postura}">${fallo.etiqueta}</a> → ${fallo.motivo}`,
    );
  }
  process.exit(1);
}

console.log('Todas las posturas apuntan a una posición existente.');
