/**
 * Auditoría de los anuncios de las páginas nuevas.
 *
 * Regla del 11/11/2026: cada página creada en el bloque de guitarra lleva
 * **un solo anuncio manual** (`Anuncio2`, slot 9740119561) y no suma el anuncio
 * global sobre el footer.
 *
 * Se pasa después de `npm run build`.
 *
 * Uso: npm run auditar:anuncios
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const SLOT = '9740119561';

const PAGINAS = [
  { ruta: 'acordes-faciles-guitarra', nombre: 'Acordes fáciles' },
  { ruta: 'acordes-con-cejilla', nombre: 'Acordes con cejilla' },
  { ruta: 'acordes-guitarra-espanola', nombre: 'Guitarra española' },
  { ruta: 'acordes-de-carnaval', nombre: 'Acordes de Carnaval' },
  { ruta: 'transportar-acordes', nombre: 'Transportador' },
  { ruta: 'afinador-guitarra', nombre: 'Afinador' },
  { ruta: 'herramientas', nombre: 'Herramientas' },
];

if (!existsSync(DIST)) {
  console.error('ERROR: no existe dist/. Ejecuta "npm run build" antes de auditar.');
  process.exit(1);
}

const problemas = [];

for (const { ruta, nombre } of PAGINAS) {
  const fichero = path.join(DIST, ruta, 'index.html');
  if (!existsSync(fichero)) {
    problemas.push(`${nombre}: falta dist/${ruta}/index.html`);
    continue;
  }

  const html = readFileSync(fichero, 'utf8');
  const anuncios = html.match(/class="adsbygoogle/gi)?.length ?? 0;
  const slots = [...html.matchAll(/data-ad-slot="(\d+)"/g)].map((m) => m[1]);
  const h1 = html.match(/<h1\b/gi)?.length ?? 0;

  if (h1 !== 1) problemas.push(`${nombre}: ${h1} H1 (debe haber 1)`);
  if (anuncios !== 1) {
    problemas.push(`${nombre}: ${anuncios} anuncios (debe haber 1 manual)`);
  }
  if (slots.length !== 1 || slots[0] !== SLOT) {
    problemas.push(`${nombre}: slots ${slots.join(', ') || 'ninguno'} (se espera ${SLOT})`);
  }
  if (html.includes('anuncio-sobre-footer')) {
    problemas.push(`${nombre}: lleva el anuncio global sobre el footer`);
  }
}

// La página de herramientas tiene que enlazar las cuatro herramientas.
const hub = path.join(DIST, 'herramientas', 'index.html');
if (existsSync(hub)) {
  const html = readFileSync(hub, 'utf8');
  for (const destino of ['/afinador-guitarra/', '/transportar-acordes/', '/reconocer-acorde/', '/glosario/']) {
    if (!html.includes(`href="${destino}"`)) {
      problemas.push(`Herramientas: no enlaza ${destino}`);
    }
  }
}

// Y estar en el menú y en el footer de cualquier página.
const muestra = path.join(DIST, 'glosario', 'index.html');
if (existsSync(muestra)) {
  const html = readFileSync(muestra, 'utf8');
  if (!html.includes('href="/herramientas/"')) {
    problemas.push('Herramientas: no está en el menú o el footer del glosario');
  }
}

// La barra de la ficha tiene que seguir existiendo y llevar al afinador.
const fichas = path.join(DIST, 'acordes');
if (existsSync(fichas)) {
  const candidatas = readdirSync(fichas, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => path.join(fichas, entrada.name, 'index.html'))
    .filter((fichero) => existsSync(fichero));

  const ficha = candidatas
    .map((fichero) => readFileSync(fichero, 'utf8'))
    .find((html) => html.includes('barra-herramientas'));

  if (!ficha) {
    problemas.push('Ficha: falta la barra de herramientas');
  } else if (!ficha.includes('href="/afinador-guitarra/"')) {
    problemas.push('Ficha: la barra no enlaza al afinador');
  }
}

console.log(`Páginas nuevas revisadas: ${PAGINAS.length}`);
console.log(`Anuncio manual esperado: Anuncio2 (slot ${SLOT})`);

if (problemas.length) {
  console.error(`\nProblemas (${problemas.length}):`);
  for (const problema of problemas) console.error(`  - ${problema}`);
  console.error('\nERROR: los anuncios de las páginas nuevas no cumplen la regla.');
  process.exit(1);
}

console.log('\nOK: una página, un anuncio manual; hub y barra de herramientas enlazados.');
