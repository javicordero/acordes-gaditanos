// scripts/lib/fichas.mjs
//
// Resolver un nombre hablado («pasodoble las ratas manuel», «final de popurri
// los angeles caidos») o un slug a la ficha real del proyecto. Lo usa
// `scripts/subir-ficha.mjs` para las tarjetas de la columna «Subir ficha».
//
// Mira las dos colecciones: `acordes` (publicables) y `acordes3` (borradores).
// Si el mismo slug está en las dos, manda la publicada.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { frontmatterDeTexto, sinTildes } from './aviso.mjs';

const CARPETAS = [
  { carpeta: 'src/content/acordes', borrador: false },
  { carpeta: 'src/content/acordes3', borrador: true },
];

/**
 * Normaliza para comparar: sin tildes, minúsculas, sin puntuación y con un
 * solo espacio entre palabras. `pasodoble-las-ratas` y `Pasodoble Las Ratas`
 * quedan igual.
 */
export function normalizar(texto) {
  return sinTildes(texto)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Todas las fichas de `acordes` y `acordes3` con lo necesario para resolverlas. */
export function listarFichas(raiz = process.cwd()) {
  const porSlug = new Map();

  for (const { carpeta, borrador } of CARPETAS) {
    const dir = join(raiz, carpeta);
    if (!existsSync(dir)) continue;

    for (const archivo of readdirSync(dir)) {
      if (!archivo.endsWith('.md')) continue;
      const slug = archivo.slice(0, -3);
      if (!borrador && porSlug.has(slug)) continue;

      let datos = {};
      try {
        datos = frontmatterDeTexto(readFileSync(join(dir, archivo), 'utf8'));
      } catch {
        continue;
      }
      if (borrador && porSlug.has(slug)) continue; // ya está la publicada

      porSlug.set(slug, {
        slug,
        pieza: datos.pieza || '',
        agrupacion: datos.agrupacion || '',
        year: datos.year || '',
        letraTitulo: datos.letraTitulo || '',
        fraseClave: datos.fraseClave || '',
        borrador,
        ruta: `${carpeta}/${archivo}`,
      });
    }
  }

  return [...porSlug.values()];
}

/** Texto «fuerte» donde se busca: slug, tipo de pieza, agrupación y título de letra. */
function henoFuerte(ficha) {
  return normalizar(
    [ficha.slug.replace(/-/g, ' '), ficha.pieza, ficha.agrupacion, ficha.letraTitulo, ficha.year].join(
      ' ',
    ),
  );
}

/** Título corto de la ficha (pieza + agrupación), sin año. */
function tituloDe(ficha) {
  return normalizar(`${ficha.pieza} ${ficha.agrupacion}`);
}

/** Nombre corto para listar candidatos: `slug · Pieza Agrupación (año)`. */
export function describir(ficha) {
  const titulo = [ficha.pieza, ficha.agrupacion].filter(Boolean).join(' ');
  const year = ficha.year ? ` (${ficha.year})` : '';
  const marca = ficha.borrador ? ' · borrador' : '';
  return `\`${ficha.slug}\` · ${titulo}${year}${marca}`;
}

/**
 * Resuelve una consulta a **una** ficha.
 *
 * - Primero busca por el nombre de la pieza: todas las palabras de la consulta
 *   tienen que aparecer en el slug, el tipo de pieza, la agrupación o el título
 *   de la letra (orden libre, sin tildes ni puntuación). Así «pasodoble las
 *   ratas manuel» casa con `pasodoble-las-ratas-manuel`.
 * - Si no hay nada, prueba con la frase clave (`fraseClave`), pero solo si la
 *   consulta aparece entera y con al menos tres palabras: una palabra suelta
 *   podría publicar una copla que no es.
 * - Si empatan varias (misma pieza y agrupación en dos años, p. ej.), no se
 *   elige a ciegas: se devuelven en `dudosas` para que se pregunte.
 *
 * Devuelve `{ ficha, dudosas }`. `ficha` es `null` si no hay ninguna o si hay
 * dudas.
 */
export function resolverFicha(consulta, fichas = listarFichas()) {
  const q = normalizar(consulta);
  if (!q) return { ficha: null, dudosas: [] };

  const slugs = fichas.filter(
    (f) => f.slug === q.replace(/ /g, '-') || normalizar(f.slug) === q,
  );
  if (slugs.length === 1) return { ficha: slugs[0], dudosas: [] };

  // Las palabras de una sola letra («y», «a») no discriminan nada.
  const palabras = q.split(' ').filter((p) => p.length > 1);

  const porNombre = palabras.length ? buscarPorNombre(q, palabras, fichas) : [];
  if (porNombre.length) return elegir(porNombre);

  // La frase clave solo vale entera y con cuerpo, para no publicar por una
  // palabra suelta («carnavales» aparece en media docena de coplas).
  if (palabras.length >= 3) {
    const porFrase = fichas.filter((f) => normalizar(f.fraseClave).includes(q));
    if (porFrase.length) return elegir(porFrase.map((f) => ({ ficha: f, puntos: palabras.length * 10 })));
  }

  return { ficha: null, dudosas: [] };
}

/** Candidatas por nombre de la pieza, con su puntuación (mayor es mejor). */
function buscarPorNombre(q, palabras, fichas) {
  const puntuadas = [];
  for (const ficha of fichas) {
    const heno = henoFuerte(ficha);
    if (!palabras.every((p) => heno.includes(p))) continue;

    let puntos = palabras.length * 10;
    if (tituloDe(ficha) === q) puntos += 500;
    if (heno.includes(q)) puntos += 100;
    if (!ficha.borrador) puntos += 20;
    puntuadas.push({ ficha, puntos });
  }
  return puntuadas.sort((a, b) => b.puntos - a.puntos);
}

/** Una candidata clara o, si hay empate, la lista para preguntar. */
function elegir(puntuadas) {
  const mejor = puntuadas[0];
  const empatadas = puntuadas.filter((p) => p.puntos === mejor.puntos);
  if (empatadas.length > 1) {
    return { ficha: null, dudosas: empatadas.slice(0, 6).map((p) => p.ficha) };
  }
  return { ficha: mejor.ficha, dudosas: [] };
}
