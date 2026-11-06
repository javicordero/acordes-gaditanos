// Hubs del cancionero: agrupaciones de fichas por modalidad, tipo de pieza y
// década. Todo lo que se puede razonar sin Astro vive aquí para que las
// páginas, el índice y el auditor usen exactamente lo mismo.

import { normalizeSlug } from './text.ts';
import {
  ordenarAcordesYear,
  tipoPiezaId,
  type PrioridadAgrupaciones,
  type TipoPiezaId,
} from './orden.ts';
import { DECADAS, decadaDe } from './filtros-lista.ts';

export type Eje = 'modalidad' | 'pieza' | 'decada';

/** Lo mínimo que necesita un hub de una ficha del cancionero. */
export interface FichaHub {
  slug: string;
  data: {
    pieza: string;
    agrupacion: string;
    agrupacionSlug?: string;
    year: string;
    date: string;
    letraTitulo?: string;
    modalidad?: string;
    musicaSlugs?: string[];
    letraSlugs?: string[];
  };
}

export interface RangoAnios {
  min: number;
  max: number;
}

export interface Hub<T extends FichaHub = FichaHub> {
  eje: Eje;
  id: string;
  slug: string;
  nombre: string;
  singular: string;
  titulo: string;
  descripcion: string;
  intro: string;
  fichas: T[];
  total: number;
  anios: RangoAnios | null;
  agrupaciones: number;
  porAnio: { year: string; fichas: T[] }[];
}

export interface HubResumen {
  eje: Eje;
  slug: string;
  nombre: string;
  total: number;
  anios: RangoAnios | null;
}

interface ConfigHub {
  id: string;
  slug: string;
  nombre: string;
  singular: string;
  editorial: string;
}

/**
 * Modalidades reconocidas. `chirigota-callejera` se mantiene por si alguna
 * ficha la usa; hoy no hay ninguna en `acordes`.
 */
const MODALIDADES: ConfigHub[] = [
  {
    id: 'comparsa',
    slug: 'comparsas',
    nombre: 'Comparsas',
    singular: 'Comparsa',
    editorial:
      'La comparsa es la modalidad más poética del Carnaval de Cádiz: pasodobles de crítica y homenaje con una puesta en escena cuidada.',
  },
  {
    id: 'chirigota',
    slug: 'chirigotas',
    nombre: 'Chirigotas',
    singular: 'Chirigota',
    editorial:
      'La chirigota es la modalidad del humor y la crítica: tipos, cuplés y pasodobles para hacer reír y pensar.',
  },
  {
    id: 'coro',
    slug: 'coros',
    nombre: 'Coros',
    singular: 'Coro',
    editorial:
      'El coro canta tangos y cuplés con orquesta y es una de las modalidades más reconocibles del Carnaval de Cádiz.',
  },
  {
    id: 'cuarteto',
    slug: 'cuartetos',
    nombre: 'Cuartetos',
    singular: 'Cuarteto',
    editorial:
      'El cuarteto es la modalidad teatral del Carnaval: parodias, cuplés y mucho humor sobre las tablas.',
  },
  {
    id: 'chirigota-callejera',
    slug: 'chirigotas-callejeras',
    nombre: 'Chirigotas callejeras',
    singular: 'Chirigota callejera',
    editorial:
      'Las chirigotas callejeras llevan el humor del Carnaval a la calle, fuera del concurso oficial.',
  },
];

/** Tipos de pieza que tienen hub. El orden es el de la navegación. */
const PIEZAS: ConfigHub[] = [
  {
    id: 'presentacion',
    slug: 'presentaciones',
    nombre: 'Presentaciones',
    singular: 'Presentación',
    editorial:
      'La presentación abre el repertorio y presenta el tipo de la agrupación.',
  },
  {
    id: 'pasodoble',
    slug: 'pasodobles',
    nombre: 'Pasodobles',
    singular: 'Pasodoble',
    editorial:
      'El pasodoble es la pieza central de comparsas y chirigotas: sin estribillo y con una letra de crítica, homenaje o amor a Cádiz.',
  },
  {
    id: 'tango',
    slug: 'tangos',
    nombre: 'Tangos',
    singular: 'Tango',
    editorial:
      'El tango es la pieza habitual de los coros y también aparece en algunas chirigotas.',
  },
  {
    id: 'estribillo',
    slug: 'estribillos',
    nombre: 'Estribillos',
    singular: 'Estribillo',
    editorial: 'El estribillo es la copla que se repite y se corea.',
  },
  {
    id: 'cuarteta',
    slug: 'cuartetas',
    nombre: 'Cuartetas',
    singular: 'Cuarteta',
    editorial:
      'La cuarteta es una copla de cuatro versos que condensa una idea o un remate.',
  },
  {
    id: 'final-de-popurri',
    slug: 'finales-de-popurri',
    nombre: 'Finales de popurrí',
    singular: 'Final de popurrí',
    editorial:
      'El final de popurrí cierra el repertorio con una copla de despedida.',
  },
  {
    id: 'popurri',
    slug: 'popurris',
    nombre: 'Popurrís',
    singular: 'Popurrí',
    editorial:
      'El popurrí mezcla coplas, estribillos y músicas para cerrar la actuación.',
  },
];

/** Modalidad normalizada (`comparsa`, `chirigota`…) o `null` si no se reconoce. */
export function normalizarModalidad(valor?: string | null): string | null {
  const clave = normalizeSlug(valor ?? '');
  if (!clave) return null;
  if (clave === 'comparsa' || clave === 'comparsas') return 'comparsa';
  if (clave === 'chirigota' || clave === 'chrigota' || clave === 'chirigotas') return 'chirigota';
  if (clave === 'coro' || clave === 'coros') return 'coro';
  if (clave === 'cuarteto' || clave === 'cuartetos') return 'cuarteto';
  if (clave === 'chirigota-callejera' || clave === 'chirigotas-callejeras') {
    return 'chirigota-callejera';
  }
  return null;
}

/** `los 90s`, `los 2000s`, `pre 60`. */
export function nombreDecada(id: string): string {
  if (id === 'pre60') return 'pre 60';
  return `los ${id}`;
}

/** `anos-90`, `anos-2000`, `pre-60`. */
export function slugDecada(id: string): string {
  return id === 'pre60' ? 'pre-60' : `anos-${id.replace(/s$/, '')}`;
}

/** Prefijo de ruta de cada eje. */
export function baseDeEje(eje: Eje): string {
  return eje === 'modalidad' ? '/modalidad' : eje === 'pieza' ? '/pieza' : '/decada';
}

/** Nombre del eje para textos (`modalidad`, `tipo de pieza`, `década`). */
export function etiquetaEje(eje: Eje): string {
  return eje === 'modalidad' ? 'modalidad' : eje === 'pieza' ? 'tipo de pieza' : 'década';
}

function agruparPorAnio<T extends FichaHub>(fichas: T[]): { year: string; fichas: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const ficha of fichas) {
    const year = String(ficha.data.year);
    const grupo = grupos.get(year);
    if (grupo) grupo.push(ficha);
    else grupos.set(year, [ficha]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, fichas]) => ({ year, fichas }));
}

function crearHub<T extends FichaHub>(eje: Eje, cfg: ConfigHub, fichas: T[]): Hub<T> {
  const aniosNumeros = fichas
    .map((ficha) => Number(ficha.data.year))
    .filter((year) => Number.isFinite(year));
  const anios = aniosNumeros.length
    ? { min: Math.min(...aniosNumeros), max: Math.max(...aniosNumeros) }
    : null;
  const agrupaciones = new Set(
    fichas.map((ficha) => ficha.data.agrupacionSlug || normalizeSlug(ficha.data.agrupacion)),
  ).size;
  const total = fichas.length;
  const etiqueta = cfg.nombre.toLowerCase();
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const rango = anios
    ? anios.min === anios.max
      ? ` De ${anios.min}.`
      : ` De ${anios.min} a ${anios.max}.`
    : '';
  const periodo = anios
    ? anios.min === anios.max
      ? `en ${anios.min}`
      : `entre ${anios.min} y ${anios.max}`
    : '';
  const nombreDecadaHub = eje === 'decada' ? cfg.nombre : null;
  const titulo =
    eje === 'decada'
      ? `Coplas de ${nombreDecadaHub} - Acordes del Carnaval de Cádiz`
      : `${cfg.nombre} - Acordes del Carnaval de Cádiz`;
  const descripcion = `${plural(total, 'copla', 'coplas')} de ${cfg.singular.toLowerCase()} del Carnaval de Cádiz con acordes de guitarra, ${total === 1 ? 'ordenada' : 'ordenadas'} por año.${rango} ${plural(agrupaciones, 'agrupación', 'agrupaciones')}.`;
  const intro =
    eje === 'decada'
      ? `Coplas estrenadas ${periodo}. Hay ${plural(total, 'ficha', 'fichas')} de ${nombreDecadaHub} en el cancionero. Orden por año y agrupación.`
      : `${cfg.editorial} Hay ${plural(total, 'ficha', 'fichas')} de ${etiqueta} en el cancionero.${rango} Orden por año y agrupación.`;

  return {
    eje,
    id: cfg.id,
    slug: cfg.slug,
    nombre: cfg.nombre,
    singular: cfg.singular,
    titulo,
    descripcion,
    intro,
    fichas,
    total,
    anios,
    agrupaciones,
    porAnio: agruparPorAnio(fichas),
  };
}

/**
 * Construye los tres ejes de hubs a partir de las fichas del cancionero.
 * Los hubs sin fichas se descartan (p. ej. coros o cuartetos si no hay).
 */
export function construirHubs<T extends FichaHub>(
  acordes: readonly T[],
  opciones: { prioridad?: PrioridadAgrupaciones; coplas?: PrioridadAgrupaciones } = {},
): { modalidad: Hub<T>[]; pieza: Hub<T>[]; decada: Hub<T>[] } {
  const ordenar = (fichas: T[]) =>
    ordenarAcordesYear(fichas, opciones.prioridad, opciones.coplas);

  const deModalidad = (id: string) =>
    acordes.filter((ficha) => normalizarModalidad(ficha.data.modalidad) === id);
  const dePieza = (id: string) =>
    acordes.filter((ficha) => tipoPiezaId(ficha.data.pieza) === (id as TipoPiezaId));
  const deDecada = (id: string) =>
    acordes.filter((ficha) => decadaDe(ficha.data.year) === id);

  return {
    modalidad: MODALIDADES.map((cfg) => crearHub('modalidad', cfg, ordenar(deModalidad(cfg.id))))
      .filter((hub) => hub.total > 0),
    pieza: PIEZAS.map((cfg) => crearHub('pieza', cfg, ordenar(dePieza(cfg.id))))
      .filter((hub) => hub.total > 0),
    decada: [...DECADAS].reverse().map((decada) =>
      crearHub('decada', {
        id: decada.id,
        slug: slugDecada(decada.id),
        nombre: nombreDecada(decada.id),
        singular: nombreDecada(decada.id),
        editorial: '',
      }, ordenar(deDecada(decada.id))),
    ).filter((hub) => hub.total > 0),
  };
}

/** Versión ligera de un hub para enlazar entre páginas sin arrastrar fichas. */
export function resumirHub(hub: Hub): HubResumen {
  return {
    eje: hub.eje,
    slug: hub.slug,
    nombre: hub.nombre,
    total: hub.total,
    anios: hub.anios,
  };
}
