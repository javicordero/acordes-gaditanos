// Normalización del contenido de las fichas: tipo de pieza y modalidad.
//
// Lo usan el schema de las colecciones (src/content/config.ts), la migración
// (scripts/normalizar-contenido.ts) y el auditor (scripts/auditar-contenido.ts),
// para que los tres apliquen exactamente el mismo criterio. Es puro: no toca
// Astro ni el disco.

import { normalizeSlug, normalizeText } from './text.ts';

/**
 * Tipos de pieza reconocidos y su forma canónica. La clave va sin tildes y se
 * compara por palabras, con el último token como prefijo, así encajan las
 * variantes del cancionero:
 *
 *   Final de Popurrí / Final de popurri / Final de popurí → Final de popurrí
 *   pasodoble                                             → Pasodoble
 *   presentación                                          → Presentación
 *
 * `final de popur` va antes que `popurri` para no quedarse con el prefijo corto.
 */
const TIPOS_PIEZA: Array<[string, string]> = [
  ['final de popur', 'Final de popurrí'],
  ['presentacion', 'Presentación'],
  ['pasodoble', 'Pasodoble'],
  ['cuarteta', 'Cuarteta'],
  ['estribillo', 'Estribillo'],
  ['tango', 'Tango'],
  ['popurri', 'Popurrí'],
  ['credo', 'Credo'],
  ['testamento', 'Testamento'],
];

/**
 * Calificadores conocidos, que se escriben en minúscula (adjetivo). Lo que no
 * esté aquí se deja como venga: `Pasodoble Noly` y `Pasodoble Original` (que
 * distingue dos coplas distintas del mismo año) se quedan tal cual.
 */
const CALIFICADORES: Array<[string, string]> = [
  ['original', 'original'],
  ['inedito', 'inédito'],
];

/** Modalidades canónicas, por clave normalizada. */
const MODALIDADES: Record<string, string> = {
  comparsa: 'Comparsa',
  comparsas: 'Comparsa',
  chirigota: 'Chirigota',
  chirigotas: 'Chirigota',
  chrigota: 'Chirigota',
  coro: 'Coro',
  coros: 'Coro',
  cuarteto: 'Cuarteto',
  cuartetos: 'Cuarteto',
  'chirigota-callejera': 'Chirigota callejera',
  'chirigotas-callejeras': 'Chirigota callejera',
};

/** Las cinco modalidades que admite una ficha. */
export const MODALIDADES_CANONICAS: readonly string[] = [
  'Comparsa',
  'Chirigota',
  'Coro',
  'Cuarteto',
  'Chirigota callejera',
];

/** Texto partido en palabras, sin tildes salvo la ñ y sin puntuación. */
function palabrasClave(texto: string): string[] {
  return normalizeText(texto)
    .split(/\s+/)
    .map((palabra) => palabra.replace(/[^a-z0-9ñ]/g, ''))
    .filter(Boolean);
}

/** Trocea `pieza` en base + calificador + título entrecomillado. */
function trocearPieza(valor: string): {
  palabras: string[];
  titulo: string;
  corte: number;
} {
  const limpio = (valor || '').trim();
  const corte = limpio.indexOf('"');
  const sinTitulo = corte === -1 ? limpio : limpio.slice(0, corte).trim();
  return {
    palabras: sinTitulo.split(/\s+/).filter(Boolean),
    titulo: corte === -1 ? '' : limpio.slice(corte).trim(),
    corte,
  };
}

/** Base reconocida de la pieza y cuántas palabras ocupa, o `null`. */
function buscarBase(palabras: string[]): { canonico: string; consumidas: number } | null {
  const claves = palabras.map((palabra) => palabrasClave(palabra).join(''));

  for (const [base, canonico] of TIPOS_PIEZA) {
    const buscadas = base.split(' ');
    if (buscadas.length > claves.length) continue;

    const encaja = buscadas.every((buscada, indice) => {
      // El último token de la base vale como prefijo (popurr…), el resto exacto.
      return indice === buscadas.length - 1
        ? claves[indice].startsWith(buscada)
        : claves[indice] === buscada;
    });

    if (encaja) return { canonico, consumidas: buscadas.length };
  }

  return null;
}

/**
 * Tipo de pieza en su forma canónica. Conserva el título entrecomillado
 * (`Cuarteta "Castigo divino"`) y, si lo hay, el calificador
 * (`Pasodoble inédito`). Lo que no reconoce se devuelve sin tocar.
 */
export function normalizarPieza(valor: string): string {
  const { palabras, titulo } = trocearPieza(valor);
  const base = buscarBase(palabras);
  if (!base) return (valor || '').trim();

  const resto = palabras.slice(base.consumidas).join(' ');
  return [base.canonico, normalizarCalificador(resto), titulo].filter(Boolean).join(' ');
}

/** Calificador con su forma canónica (`inédito`, `original`); el resto, igual. */
export function normalizarCalificador(valor: string): string {
  const limpio = (valor || '').trim();
  if (!limpio) return '';
  const clave = palabrasClave(limpio).join('');
  const encontrado = CALIFICADORES.find(([nombre]) => nombre === clave);
  return encontrado ? encontrado[1] : limpio;
}

/** Tipo base de la pieza: `Final de popurrí`, `Pasodoble`, `Cuarteta`… */
export function tipoBasePieza(valor: string): string {
  const { palabras } = trocearPieza(valor);
  return buscarBase(palabras)?.canonico ?? '';
}

/** Calificador de la pieza (`inédito`, `original`, `Noly`), sin el tipo base. */
export function calificadorPieza(valor: string): string {
  const { palabras } = trocearPieza(valor);
  const base = buscarBase(palabras);
  return base ? normalizarCalificador(palabras.slice(base.consumidas).join(' ')) : '';
}

/**
 * Modalidad en su forma canónica (`Chrigota` → `Chirigota`). Un valor
 * desconocido se devuelve tal cual para que el auditor lo pueda señalar; las
 * fichas sin modalidad devuelven `undefined`.
 */
export function etiquetaModalidad(valor?: string | null): string | undefined {
  const limpio = (valor ?? '').trim();
  if (!limpio) return undefined;

  const encontrada = MODALIDADES[normalizeSlug(limpio)];
  return encontrada ?? limpio;
}

/** `true` si la modalidad (ya normalizada) es una de las cinco conocidas. */
export function esModalidadCanonica(valor?: string | null): boolean {
  const etiqueta = etiquetaModalidad(valor);
  return !!etiqueta && MODALIDADES_CANONICAS.includes(etiqueta);
}

/**
 * Grafía buena de cada agrupación que aparece escrita de varias formas en el
 * cancionero (el slug es el mismo, así que la URL no cambia). Solo están las
 * que tenían más de una: el resto se deja como venga.
 */
const AGRUPACIONES: Record<string, string> = {
  'el-cementerio': 'El Cementerio',
  'er-chele-vara': 'Er Chele Vara',
  'la-banda-del-capitan-veneno': 'La banda del Capitán Veneno',
  'la-carcel-vieja': 'La Cárcel Vieja',
  'la-chusma-selecta': 'La Chusma Selecta',
  'la-consentida': 'La Consentida',
  'la-eternidad': 'La Eternidad',
  'la-gaditanissima': 'La Gaditaníssima',
  'la-oveja-negra': 'La Oveja Negra',
  'los-angeles-caidos': 'Los Ángeles Caídos',
  'los-burritos': 'Los Burritos',
  'los-equilibristas': 'Los Equilibristas',
  'los-inhumanos': 'Los Inhumanos',
  'los-luceros': 'Los Luceros',
  'los-mafiosos': 'Los Mafiosos',
  'los-peregrinos': 'Los Peregrinos',
  'los-regaera': 'Los Regaera',
  'los-sumisos': 'Los Sumisos',
  'oh-capitan-my-capitan': 'Oh Capitán, My Capitán',
  'pa-religion-la-mia': 'Pa religión, la mía',
};

/** Nombre de la agrupación en su grafía buena; el resto, tal cual. */
export function normalizarAgrupacion(valor: string): string {
  const limpio = (valor ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) return limpio;
  return AGRUPACIONES[normalizeSlug(limpio)] ?? limpio;
}

/**
 * Autores que son la misma persona con otro nombre. Unificarlos cambia la URL
 * de su página, así que van uno a uno y a mano. (`Manolo` y `Manolín Santander`
 * son personas distintas: no se tocan.)
 */
const ALIAS_AUTORES: Record<string, string> = {
  angelluissilvabenzo: 'Ángel Luis Silva',
  germangarciarendon: 'Germán Rendón',
  juanmanuelromerobey: 'Juanma Romero Bey',
};

/** Clave de un autor: sin tildes, sin puntuación y sin punto final. */
function claveAutor(nombre: string): string {
  return normalizeText(nombre)
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Nombre canónico del autor: quita el punto final, los espacios de más y
 * resuelve los alias de `ALIAS_AUTORES`. Las variantes solo de tildes
 * (`German Rendón`) no se pueden arreglar sin diccionario: las señala el
 * auditor y las unifica la migración por la forma más usada.
 */
export function normalizarAutor(nombre: string): string {
  const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').trim();
  return ALIAS_AUTORES[claveAutor(limpio)] ?? limpio;
}
