// Orden de las cards en los listados de coplas.
// Un solo criterio, compartido por las páginas de autor y /carnaval/[year].

import { normalizeSlug, normalizeText } from './text.ts';
import { parseSpanishDate, sortByYearDesc } from './date.ts';

/**
 * Orden de los tipos de pieza dentro de una misma agrupación.
 * Se compara con `startsWith` sobre el texto normalizado, así encajan las
 * variantes del cancionero ("Final de popurrí" / "Final de popurri" /
 * "Final de popurí", "Presentación Original", "Pasodoble Inédito"...).
 * Lo que no case va al final, por orden alfabético.
 */
export const ORDEN_PIEZAS = [
  'popurri',
  'final de popur',
  'cuarteta',
  'estribillo',
  'pasodoble',
  'tango',
  'presentacion',
];

/**
 * Tipos de pieza que se ordenan como otro tipo: el `Credo` de Los Peregrinos
 * (Aragón, 2017) y el `Testamento` de El Marqués de Cádiz (2019) cuentan como
 * cuarteta.
 */
const EQUIVALENCIAS_PIEZAS: Record<string, string> = {
  credo: 'cuarteta',
  testamento: 'cuarteta',
};

/** Posición de un tipo de pieza en `ORDEN_PIEZAS`; los desconocidos, al final. */
export function rangoPieza(pieza: string): number {
  const normalizada = normalizeText(pieza ?? '').trim();
  const tipo = EQUIVALENCIAS_PIEZAS[normalizada] ?? normalizada;
  const indice = ORDEN_PIEZAS.findIndex((prefijo) => tipo.startsWith(prefijo));
  return indice === -1 ? ORDEN_PIEZAS.length : indice;
}

/** Comparación alfabética en español, sin tildes ni mayúsculas. */
function compararTexto(a: string, b: string): number {
  return normalizeText(a ?? '')
    .trim()
    .localeCompare(normalizeText(b ?? '').trim(), 'es', { sensitivity: 'base', numeric: true });
}

type FichaOrdenable = {
  slug: string;
  data: {
    year: string;
    agrupacion: string;
    agrupacionSlug?: string;
    pieza: string;
    date: string;
    musicaSlugs?: string[];
    letraSlugs?: string[];
  };
};

/** Slug de la agrupación: evita partir un bloque por mayúsculas o tildes. */
function claveAgrupacion(ficha: FichaOrdenable): string {
  return ficha.data.agrupacionSlug || normalizeSlug(ficha.data.agrupacion ?? '');
}

export type PrioridadAgrupaciones = Map<string, number>;

/**
 * Prioridad de cada autor según su `order` en `src/content/autores`
 * (el mismo orden en que se listan en /autores).
 */
export function prioridadDeAutores(
  autores: { data: { autorSlug: string; order?: number | null } }[],
): Map<string, number> {
  const prioridad = new Map<string, number>();

  autores.forEach((autor) => {
    const { autorSlug, order } = autor.data;
    if (!autorSlug || typeof order !== 'number' || !Number.isFinite(order)) return;
    prioridad.set(autorSlug, order);
  });

  return prioridad;
}

/**
 * Prioridad de cada agrupación: la mejor posición (`order`) de cualquiera de
 * sus autores, música o letra. Las agrupaciones sin autor del listado no entran
 * en el mapa y quedan detrás, ordenadas alfabéticamente.
 */
export function prioridadDeAgrupaciones(
  acordes: FichaOrdenable[],
  prioridadAutores: Map<string, number>,
): PrioridadAgrupaciones {
  const prioridad: PrioridadAgrupaciones = new Map();

  acordes.forEach((acorde) => {
    const ordenes = [...(acorde.data.musicaSlugs ?? []), ...(acorde.data.letraSlugs ?? [])]
      .map((slug) => prioridadAutores.get(slug))
      .filter((orden): orden is number => typeof orden === 'number' && Number.isFinite(orden));

    if (ordenes.length === 0) return;

    const clave = claveAgrupacion(acorde);
    const mejor = Math.min(...ordenes);
    const actual = prioridad.get(clave);

    prioridad.set(clave, actual === undefined ? mejor : Math.min(actual, mejor));
  });

  return prioridad;
}

/**
 * Comparador de las páginas de autor: prioridad de agrupación (si la hay) →
 * agrupación A-Z → tipo de pieza → fecha ↓ → pieza A-Z → slug A-Z.
 */
export function compararFichas(
  a: FichaOrdenable,
  b: FichaOrdenable,
  prioridad?: PrioridadAgrupaciones,
): number {
  return (
    compararPrioridad(a, b, prioridad) ||
    compararAgrupacion(a, b) ||
    compararTipo(a, b) ||
    compararResto(a, b)
  );
}

/**
 * Comparador de /carnaval/[year]: primero el tipo de pieza y, dentro de cada
 * tipo, las agrupaciones destacadas, la agrupación A-Z, la fecha ↓ y el
 * desempate determinista.
 */
export function compararFichasYear(
  a: FichaOrdenable,
  b: FichaOrdenable,
  prioridad?: PrioridadAgrupaciones,
): number {
  return (
    compararTipo(a, b) ||
    compararPrioridad(a, b, prioridad) ||
    compararAgrupacion(a, b) ||
    compararResto(a, b)
  );
}

function compararPrioridad(
  a: FichaOrdenable,
  b: FichaOrdenable,
  prioridad?: PrioridadAgrupaciones,
): number {
  if (!prioridad) return 0;

  const prioridadA = prioridad.get(claveAgrupacion(a)) ?? Number.POSITIVE_INFINITY;
  const prioridadB = prioridad.get(claveAgrupacion(b)) ?? Number.POSITIVE_INFINITY;
  if (prioridadA === prioridadB) return 0;

  return prioridadA - prioridadB;
}

function compararAgrupacion(a: FichaOrdenable, b: FichaOrdenable): number {
  return compararTexto(a.data.agrupacion, b.data.agrupacion);
}

function compararTipo(a: FichaOrdenable, b: FichaOrdenable): number {
  return rangoPieza(a.data.pieza) - rangoPieza(b.data.pieza);
}

/** Fecha ↓ y, para cerrar empates, pieza A-Z y slug A-Z. */
function compararResto(a: FichaOrdenable, b: FichaOrdenable): number {
  return (
    parseSpanishDate(b.data.date).getTime() - parseSpanishDate(a.data.date).getTime() ||
    compararTexto(a.data.pieza, b.data.pieza) ||
    compararTexto(a.slug, b.slug)
  );
}

/**
 * Páginas de autor: año ↓ y, dentro del año, el criterio común.
 * Sin prioridad por autor destacado: todas las cards son del mismo autor.
 */
export function ordenarAcordesAutor<T extends FichaOrdenable>(acordes: readonly T[]): T[] {
  return [...acordes].sort((a, b) => {
    if (a.data.year !== b.data.year) return sortByYearDesc(a.data.year, b.data.year);
    return compararFichas(a, b);
  });
}

/** /carnaval/[year]: un solo año, primero por tipo de pieza. */
export function ordenarAcordesYear<T extends FichaOrdenable>(
  acordes: readonly T[],
  prioridad?: PrioridadAgrupaciones,
): T[] {
  return [...acordes].sort((a, b) => compararFichasYear(a, b, prioridad));
}
