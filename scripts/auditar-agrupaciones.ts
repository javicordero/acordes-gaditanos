/**
 * Auditoría de las páginas de agrupación del glosario.
 *
 * Comprueba que cada selección cumple lo que promete la página:
 *   - los acordes existen y la postura mostrada está entre sus posiciones;
 *   - se cumple el criterio (sin cejilla, con cejilla, primera posición o coplas);
 *   - no hay acordes repetidos ni progresiones con acordes de fuera;
 *   - los metadatos son distintos entre páginas.
 *
 * Si hay build en `dist/`, además revisa el HTML generado: una página por
 * grupo, un solo H1, diagramas y los enlaces desde el glosario y el
 * reconocedor.
 *
 * Uso: npm run auditar:agrupaciones
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  acordesDePieza,
  crearIndice,
  type Glosario,
} from '../src/lib/acordes.ts';
import {
  LISTA_AGRUPACIONES,
  revisarAgrupacion,
} from '../src/lib/agrupaciones-acordes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');
const CONTENT = path.join(ROOT, 'src', 'content', 'acordes');
const DIST = path.join(ROOT, 'dist');

const glosario = JSON.parse(readFileSync(DATA, 'utf8')).acordes as Glosario;

/* ------------------------------------------------------------------ */
/* Coplas por acorde                                                   */
/* ------------------------------------------------------------------ */

/**
 * Mismo criterio que `src/lib/coplas-por-acorde.ts`: una ficha cuenta una sola
 * vez por acorde aunque lo repita, y solo cuenta el cuerpo (sin frontmatter).
 */
function contarCoplas(): Map<string, number> {
  const indice = crearIndice(glosario);
  const cuenta = new Map<string, number>();

  for (const fichero of readdirSync(CONTENT).filter((f) => f.endsWith('.md'))) {
    const texto = readFileSync(path.join(CONTENT, fichero), 'utf8');
    const cuerpo = texto.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    if (!cuerpo.trim()) continue;

    const enFicha = new Set<string>();
    for (const { entrada } of acordesDePieza(cuerpo, indice)) {
      enFicha.add(entrada.slug);
    }
    for (const slug of enFicha) {
      cuenta.set(slug, (cuenta.get(slug) ?? 0) + 1);
    }
  }

  return cuenta;
}

/* ------------------------------------------------------------------ */
/* Datos                                                               */
/* ------------------------------------------------------------------ */

const coplas = contarCoplas();
const problemas: string[] = [];

for (const grupo of LISTA_AGRUPACIONES) {
  problemas.push(...revisarAgrupacion(grupo, { glosario, coplas }));
}

const vistos = new Map<string, string>();
for (const campo of ['slug', 'h1', 'title', 'description'] as const) {
  vistos.clear();
  for (const grupo of LISTA_AGRUPACIONES) {
    const valor = grupo[campo];
    const anterior = vistos.get(valor);
    if (anterior) {
      problemas.push(`${grupo.clave}: ${campo} repetido con ${anterior}`);
    } else {
      vistos.set(valor, grupo.clave);
    }
  }
}

/* ------------------------------------------------------------------ */
/* HTML generado                                                       */
/* ------------------------------------------------------------------ */

let revisadoHtml = false;
const indiceGlosario = path.join(DIST, 'glosario', 'index.html');
const reconocedor = path.join(DIST, 'reconocer-acorde', 'index.html');

if (existsSync(indiceGlosario)) {
  revisadoHtml = true;
  const glosarioHtml = readFileSync(indiceGlosario, 'utf8');
  const reconocedorHtml = existsSync(reconocedor) ? readFileSync(reconocedor, 'utf8') : '';

  for (const grupo of LISTA_AGRUPACIONES) {
    const fichero = path.join(DIST, grupo.slug, 'index.html');
    if (!existsSync(fichero)) {
      problemas.push(`${grupo.clave}: falta dist/${grupo.slug}/index.html`);
      continue;
    }

    const html = readFileSync(fichero, 'utf8');
    const h1s = html.match(/<h1\b/gi)?.length ?? 0;
    const svgs = html.match(/<svg\b/gi)?.length ?? 0;

    if (h1s !== 1) problemas.push(`${grupo.clave}: ${h1s} H1 en el build (debe haber 1)`);
    if (svgs < 8) problemas.push(`${grupo.clave}: ${svgs} diagramas en el build (mínimo 8)`);

    // En Carnaval, el número de coplas que enseña cada tarjeta debe ser el real.
    if (grupo.criterio === 'coplas') {
      const tarjetas = html.split('<li class="agrupacion-acorde"').slice(1);
      if (tarjetas.length !== grupo.acordes.length) {
        problemas.push(
          `${grupo.clave}: ${tarjetas.length} tarjetas en el build (esperadas ${grupo.acordes.length})`,
        );
      }
      for (const tarjeta of tarjetas) {
        const etiqueta = tarjeta.match(/<a[^>]*>([^<]+)<\/a>/)?.[1]?.trim();
        const mostrado = tarjeta.match(/En (\d+) coplas?/)?.[1];
        const entrada = etiqueta ? glosario[etiqueta] : undefined;
        if (!etiqueta || !entrada || mostrado === undefined) {
          problemas.push(`${grupo.clave}: tarjeta sin acorde o sin número de coplas`);
          continue;
        }
        const real = coplas.get(entrada.slug) ?? 0;
        if (Number(mostrado) !== real) {
          problemas.push(
            `${grupo.clave}: ${etiqueta} muestra ${mostrado} coplas y tiene ${real}`,
          );
        }
      }
    }

    if (!glosarioHtml.includes(`/${grupo.slug}/`)) {
      problemas.push(`${grupo.clave}: el glosario no enlaza /${grupo.slug}/`);
    }
    if (reconocedorHtml && !reconocedorHtml.includes(`/${grupo.slug}/`)) {
      problemas.push(`${grupo.clave}: el reconocedor no enlaza /${grupo.slug}/`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Salida                                                              */
/* ------------------------------------------------------------------ */

console.log(`Agrupaciones: ${LISTA_AGRUPACIONES.length}`);
for (const grupo of LISTA_AGRUPACIONES) {
  const coplasMin = grupo.coplasMinimas ? ` · mínimo ${grupo.coplasMinimas} coplas` : '';
  console.log(
    `  ${grupo.clave.padEnd(9)} ${grupo.acordes.length} acordes · ${grupo.criterio}${coplasMin} · /${grupo.slug}/`,
  );
}
console.log(
  revisadoHtml
    ? 'HTML: páginas, H1, diagramas y enlaces revisados en dist/'
    : 'HTML: sin build en dist/, se omite la comprobación de páginas',
);

if (problemas.length) {
  console.error(`\nProblemas (${problemas.length}):`);
  for (const problema of problemas) console.error(`  - ${problema}`);
  console.error('\nERROR: las agrupaciones no cumplen lo que prometen.');
  process.exit(1);
}

console.log('\nOK: las selecciones existen, cumplen su criterio y están enlazadas.');
