// Filtros del listado `/lista`.
//
// Todo se resuelve en el navegador sobre las fichas que ya están pintadas: no
// se generan páginas ni URLs nuevas. Aquí vive lo que se puede razonar sin DOM
// (décadas, opciones de cada faceta, el filtro y el ida y vuelta con la URL),
// para que la página, el componente y el auditor usen exactamente lo mismo.

import { normalizeText } from './text.ts';
import { tipoPiezaId, type TipoPiezaId } from './orden.ts';

/** Facetas del filtro. Cada una admite varios valores a la vez. */
export type Faceta = 'pieza' | 'musica' | 'letra' | 'anio' | 'decada';

export interface FiltrosLista {
  pieza: string[];
  musica: string[];
  letra: string[];
  anio: string[];
  decada: string[];
}

export const FILTROS_VACIOS: FiltrosLista = {
  pieza: [],
  musica: [],
  letra: [],
  anio: [],
  decada: [],
};

/** Lo mínimo que necesita el filtro de una ficha, ya normalizado. */
export interface FichaFiltrable {
  slug: string;
  tipo: TipoPiezaId;
  decada: string;
  year: string;
  agrupacion: string;
  musica: string[];
  letra: string[];
}

export interface OpcionFiltro {
  id: string;
  nombre: string;
  total: number;
}

export interface Decada {
  id: string;
  etiqueta: string;
  desde: number;
  hasta: number;
}

/**
 * Décadas del listado. `pre60` recoge lo anterior a 1960 (la copla de 1905 de
 * El Tío de la Tiza y las de los 50); ninguna ficha se queda sin década.
 */
export const DECADAS: Decada[] = [
  { id: 'pre60', etiqueta: 'Pre 60', desde: 0, hasta: 1959 },
  { id: '60s', etiqueta: '60s', desde: 1960, hasta: 1969 },
  { id: '70s', etiqueta: '70s', desde: 1970, hasta: 1979 },
  { id: '80s', etiqueta: '80s', desde: 1980, hasta: 1989 },
  { id: '90s', etiqueta: '90s', desde: 1990, hasta: 1999 },
  { id: '2000s', etiqueta: '2000s', desde: 2000, hasta: 2009 },
  { id: '2010s', etiqueta: '2010s', desde: 2010, hasta: 2019 },
  { id: '2020s', etiqueta: '2020s', desde: 2020, hasta: 2029 },
];

/** Década de un año; lo que no sea un año válido cae en `pre60`. */
export function decadaDe(year: string | number): string {
  const numero = Number(year);
  if (!Number.isFinite(numero)) return 'pre60';
  const encontrada = DECADAS.find((decada) => numero >= decada.desde && numero <= decada.hasta);
  return encontrada ? encontrada.id : 'pre60';
}

/** Etiqueta visible de una década (`90s`, `2000s`, `Pre 60`). */
export function etiquetaDecada(id: string): string {
  return DECADAS.find((decada) => decada.id === id)?.etiqueta ?? id;
}

/** Nombre visible de cada tipo de pieza. */
export const NOMBRE_PIEZA: Record<TipoPiezaId, string> = {
  'final-de-popurri': 'Final de popurrí',
  cuarteta: 'Cuarteta',
  popurri: 'Popurrí',
  estribillo: 'Estribillo',
  presentacion: 'Presentación',
  pasodoble: 'Pasodoble',
  tango: 'Tango',
  otro: 'Otras piezas',
};

/**
 * Orden de las opciones del filtro de pieza: el de siempre para buscar a ojo
 * (presentación, pasodoble, tango…) y no el de las cards. También es la lista
 * de tipos válidos en la URL.
 */
export const ORDEN_OPCIONES_PIEZA: TipoPiezaId[] = [
  'presentacion',
  'pasodoble',
  'tango',
  'estribillo',
  'cuarteta',
  'final-de-popurri',
  'popurri',
];

/** Ficha de la colección con lo que necesita el filtro. */
export interface FichaConDatos {
  slug: string;
  data: {
    pieza: string;
    year: string | number;
    agrupacion: string;
    agrupacionSlug?: string;
    musicaList?: string[];
    musicaSlugs?: string[];
    letraList?: string[];
    letraSlugs?: string[];
  };
}

/** Normaliza una ficha de la colección para poder filtrarla. */
export function aFichaFiltrable(ficha: FichaConDatos): FichaFiltrable {
  return {
    slug: ficha.slug,
    tipo: tipoPiezaId(ficha.data.pieza),
    decada: decadaDe(ficha.data.year),
    year: String(ficha.data.year),
    agrupacion: ficha.data.agrupacionSlug || normalizeText(ficha.data.agrupacion ?? '').trim(),
    musica: ficha.data.musicaSlugs ?? [],
    letra: ficha.data.letraSlugs ?? [],
  };
}

/** ¿Pasa la ficha los filtros? OR dentro de cada faceta, AND entre facetas. */
export function filtrarFicha(ficha: FichaFiltrable, filtros: FiltrosLista): boolean {
  if (filtros.pieza.length && !filtros.pieza.includes(ficha.tipo)) return false;
  if (filtros.musica.length && !filtros.musica.some((slug) => ficha.musica.includes(slug))) return false;
  if (filtros.letra.length && !filtros.letra.some((slug) => ficha.letra.includes(slug))) return false;
  if (filtros.anio.length && !filtros.anio.includes(ficha.year)) return false;
  if (filtros.decada.length && !filtros.decada.includes(ficha.decada)) return false;
  return true;
}

/** Cuántos filtros hay puestos (para el botón del panel en móvil). */
export function contarFiltrosActivos(filtros: FiltrosLista): number {
  return (
    filtros.pieza.length +
    filtros.musica.length +
    filtros.letra.length +
    filtros.anio.length +
    filtros.decada.length
  );
}

/** Comparación alfabética en español, sin tildes ni mayúsculas. */
function compararNombres(a: string, b: string): number {
  return normalizeText(a).localeCompare(normalizeText(b), 'es', { sensitivity: 'base', numeric: true });
}

/** Opciones de pieza, en el orden del filtro y solo las que tienen coplas. */
export function opcionesPieza(fichas: FichaFiltrable[]): OpcionFiltro[] {
  const totales = new Map<string, number>();
  fichas.forEach((ficha) => totales.set(ficha.tipo, (totales.get(ficha.tipo) ?? 0) + 1));

  const orden: TipoPiezaId[] = [...ORDEN_OPCIONES_PIEZA, 'otro'];
  return orden
    .filter((tipo) => totales.has(tipo))
    .map((tipo) => ({ id: tipo, nombre: NOMBRE_PIEZA[tipo], total: totales.get(tipo) ?? 0 }));
}

/** Opciones de década, de la más antigua a la más reciente. */
export function opcionesDecada(fichas: FichaFiltrable[]): OpcionFiltro[] {
  const totales = new Map<string, number>();
  fichas.forEach((ficha) => totales.set(ficha.decada, (totales.get(ficha.decada) ?? 0) + 1));

  return DECADAS.filter((decada) => totales.has(decada.id)).map((decada) => ({
    id: decada.id,
    nombre: decada.etiqueta,
    total: totales.get(decada.id) ?? 0,
  }));
}

/** Opciones de año, del más reciente al más antiguo. */
export function opcionesAnio(fichas: FichaFiltrable[]): OpcionFiltro[] {
  const totales = new Map<string, number>();
  fichas.forEach((ficha) => totales.set(ficha.year, (totales.get(ficha.year) ?? 0) + 1));

  return [...totales.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([anio, total]) => ({ id: anio, nombre: anio, total }));
}

/**
 * Nombre visible de una entrada del cancionero: cuando el mismo slug aparece
 * escrito de varias formas (`Iván Romero.`, `Kike Remolino`), se queda la más
 * usada.
 */
function nombreMasUsado(variantes: Map<string, number>): string {
  return [...variantes.entries()].sort((a, b) => b[1] - a[1] || compararNombres(a[0], b[0]))[0][0];
}

/**
 * Opciones de autor (música o letra) ordenadas por número de coplas, de más a
 * menos, y A-Z para desempatar. Así lo primero que sale es lo que más hay.
 */
export function opcionesAutores(fichas: FichaConDatos[], tipo: 'musica' | 'letra'): OpcionFiltro[] {
  const grupos = new Map<string, { nombres: Map<string, number>; total: number }>();

  fichas.forEach((ficha) => {
    const slugs = (tipo === 'musica' ? ficha.data.musicaSlugs : ficha.data.letraSlugs) ?? [];
    const nombres = (tipo === 'musica' ? ficha.data.musicaList : ficha.data.letraList) ?? [];

    new Set(slugs).forEach((slug) => {
      if (!slug) return;
      const indice = slugs.indexOf(slug);
      const nombre = (nombres[indice] ?? slug).trim();
      const grupo = grupos.get(slug) ?? { nombres: new Map<string, number>(), total: 0 };
      grupo.nombres.set(nombre, (grupo.nombres.get(nombre) ?? 0) + 1);
      grupo.total += 1;
      grupos.set(slug, grupo);
    });
  });

  return [...grupos.entries()]
    .map(([id, grupo]) => ({ id, nombre: nombreMasUsado(grupo.nombres), total: grupo.total }))
    .sort((a, b) => b.total - a.total || compararNombres(a.nombre, b.nombre));
}

const TIPOS_VALIDOS = new Set<string>([...ORDEN_OPCIONES_PIEZA, 'otro']);

/** Valores válidos de una faceta a partir de un `?pieza=a,b` (o de uno solo). */
function listaValores(valor: string | null, valido: (candidato: string) => boolean): string[] {
  if (!valor) return [];
  return [...new Set(
    valor
      .split(',')
      .map((parte) => parte.trim())
      .filter((parte) => parte && valido(parte)),
  )];
}

/** Filtros a partir de la query (`?pieza=pasodoble,tango&musica=juan-carlos-aragon`). */
export function parsearFiltros(params: URLSearchParams): FiltrosLista {
  return {
    pieza: listaValores(params.get('pieza'), (valor) => TIPOS_VALIDOS.has(valor)),
    musica: listaValores(params.get('musica'), (valor) => valor.length > 0),
    letra: listaValores(params.get('letra'), (valor) => valor.length > 0),
    anio: listaValores(params.get('anio'), (valor) => /^\d{4}$/.test(valor)),
    decada: listaValores(params.get('decada'), (valor) =>
      DECADAS.some((candidata) => candidata.id === valor),
    ),
  };
}

/** Query a partir de los filtros; lo vacío no se escribe. */
export function serializarFiltros(filtros: FiltrosLista): URLSearchParams {
  const params = new URLSearchParams();
  (['pieza', 'musica', 'letra', 'anio', 'decada'] as Faceta[]).forEach((faceta) => {
    if (filtros[faceta].length) params.set(faceta, filtros[faceta].join(','));
  });
  return params;
}
