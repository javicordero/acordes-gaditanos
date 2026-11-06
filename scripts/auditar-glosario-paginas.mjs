/**
 * Auditoría de las páginas individuales del glosario (/glosario/<acorde>/).
 *
 * Se pasa DESPUÉS de `npm run build`. Comprueba que:
 *   - hay una página por cada acorde del glosario con posiciones;
 *   - cada página tiene un solo <h1>, un <title> y al menos un diagrama SVG;
 *   - no hay páginas de acordes que no existan en el JSON.
 *
 * Uso: node scripts/auditar-glosario-paginas.mjs
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');
const DIST = path.join(ROOT, 'dist', 'glosario');

const glosario = JSON.parse(readFileSync(DATA, 'utf8')).acordes;
const esperados = new Map(
  Object.entries(glosario)
    .filter(([, entrada]) => Array.isArray(entrada.posiciones) && entrada.posiciones.length > 0)
    .map(([etiqueta, entrada]) => [entrada.slug, etiqueta]),
);

if (!existsSync(DIST)) {
  console.error(`ERROR: no existe ${DIST}. Ejecuta "npm run build" antes de auditar.`);
  process.exit(1);
}

const paginas = readdirSync(DIST, { withFileTypes: true })
  .filter((entrada) => entrada.isDirectory())
  .map((entrada) => entrada.name);

const faltan = [];
const sobran = paginas.filter((slug) => !esperados.has(slug));

const problemas = [];
let conCoplas = 0;

for (const [slug, etiqueta] of esperados) {
  const fichero = path.join(DIST, slug, 'index.html');
  if (!existsSync(fichero)) {
    faltan.push(slug);
    continue;
  }

  const html = readFileSync(fichero, 'utf8');
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    (m[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  );
  const svgs = html.match(/<svg\b/gi)?.length ?? 0;
  const titulo = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const coplas = /class="coplas__resumen"/.test(html);
  if (coplas) conCoplas += 1;

  if (h1s.length !== 1) {
    problemas.push(`${etiqueta} (${slug}): ${h1s.length} H1 (debe haber 1)`);
  } else if (!h1s[0].includes(`Acorde ${etiqueta}`)) {
    problemas.push(`${etiqueta} (${slug}): el H1 no es el del acorde`);
  }
  if (svgs === 0) problemas.push(`${etiqueta} (${slug}): sin diagramas SVG`);
  if (!titulo) problemas.push(`${etiqueta} (${slug}): sin <title>`);
}

console.log(`Acordes con posiciones: ${esperados.size}`);
console.log(`Páginas generadas: ${paginas.length}`);
console.log(`Páginas con bloque de coplas: ${conCoplas}`);
console.log(`Faltan: ${faltan.length}`);
console.log(`Sobran: ${sobran.length}`);

if (faltan.length) {
  console.log('\nSin página:');
  for (const slug of faltan.slice(0, 20)) {
    console.log(`  - ${slug} (${esperados.get(slug) ?? 'desconocido'})`);
  }
}

if (sobran.length) {
  console.log('\nPáginas que no están en el glosario:');
  for (const slug of sobran.slice(0, 20)) {
    console.log(`  - ${slug}`);
  }
}

if (problemas.length) {
  console.log('\nCon problemas:');
  for (const problema of problemas.slice(0, 40)) {
    console.log(`  - ${problema}`);
  }
}

if (faltan.length || sobran.length || problemas.length) {
  console.error('\nERROR: las páginas del glosario no están completas.');
  process.exit(1);
}

console.log('\nOK: las páginas del glosario están completas.');
