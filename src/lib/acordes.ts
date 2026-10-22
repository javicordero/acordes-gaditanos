/**
 * Utilidades de notación de acordes (solfège español) y acceso al glosario.
 *
 * El glosario (`src/data/glosario-acordes.json`) está generado a partir del
 * glosario público de LaCuerda.net con `scripts/importar-glosario.mjs`.
 */

export interface Cejilla {
  traste: number;
  desde: number;
  hasta: number;
}

export interface PosicionGlosario {
  /** Trastes de la 6ª a la 1ª cuerda. -1 = muda, 0 = al aire, n = traste absoluto. */
  trastes: number[];
  /** Primer traste visible del diagrama. */
  baseTraste: number;
  cejilla: Cejilla | null;
}

export interface EntradaGlosario {
  raiz: string;
  sufijo: string;
  bajo: string | null;
  slug: string;
  posiciones: PosicionGlosario[];
}

export type Glosario = Record<string, EntradaGlosario>;

export interface AcordeParseado {
  raiz: string;
  sufijo: string;
  bajo: string | null;
  /** Símbolo tal y como aparece escrito en la letra. */
  etiqueta: string;
}

const RAIZ = /^(do|re|mi|fa|sol|la|si)([#b]?)/i;
const RAIZ_SOLA = /^(do|re|mi|fa|sol|la|si)([#b]?)$/i;
const CARACTERES_VALIDOS = /^[A-Za-z0-9#/]+$/;

const RAIZ_CANONICA: Record<string, string> = {
  do: 'Do',
  re: 'Re',
  mi: 'Mi',
  fa: 'Fa',
  sol: 'Sol',
  la: 'La',
  si: 'Si',
};

/**
 * Sufijos canónicos. Se conserva la caja porque `m7` (menor séptima) y `M7`
 * (mayor séptima) son acordes distintos.
 */
const SUFIJOS: Record<string, string> = {
  '': '',
  M: '',
  m: 'm',
  '7': '7',
  m7: 'm7',
  M7: 'maj7',
  '7M': 'maj7',
  maj7: 'maj7',
  Maj7: 'maj7',
  MAJ7: 'maj7',
  M9: 'maj9',
  maj9: 'maj9',
  aug: 'aug',
  '+': 'aug',
  dim: 'dim',
  dim7: 'dim7',
  sus: 'sus',
  sus2: 'sus2',
  sus4: 'sus4',
  sus9: 'sus9',
  Sus: 'sus',
  Sus2: 'sus2',
  Sus4: 'sus4',
  Sus9: 'sus9',
  SUS2: 'sus2',
  SUS4: 'sus4',
  '5': '5',
  '6': '6',
  m6: 'm6',
  '9': '9',
  m9: 'm9',
  add9: 'add9',
  add2: 'add9',
  '11': '11',
  '13': '13',
  '6add9': '6add9',
  '7sus4': '7sus4',
  '7maj5': '7maj5',
  mmaj7: 'mmaj7',
  mM7: 'mmaj7',
  m7M: 'mmaj7',
  m7b5: 'm7b5',
  'm7-5': 'm7b5',
  'm7/5': 'm7b5',
  '7b5': '7b5',
  '7-5': '7b5',
  '7/5': '7b5',
};

/** Equivalencias enarmónicas para buscar una misma forma con otra grafía. */
const ENARMONICO: Record<string, string> = {
  'Do#': 'Reb',
  Reb: 'Do#',
  'Re#': 'Mib',
  Mib: 'Re#',
  'Fa#': 'Solb',
  Solb: 'Fa#',
  'Sol#': 'Lab',
  Lab: 'Sol#',
  'La#': 'Sib',
  Sib: 'La#',
  'Si#': 'Do',
  Dob: 'Si',
  'Mi#': 'Fa',
  Fab: 'Mi',
};

function resolverSufijo(texto: string): string | null {
  return Object.prototype.hasOwnProperty.call(SUFIJOS, texto) ? SUFIJOS[texto]! : null;
}

/**
 * Convierte una etiqueta del `<pre>` en un acorde.
 * Devuelve `null` para textos que no son un acorde (letras, "(Sorda)", varios acordes pegados…).
 */
export function parsearAcorde(texto: string): AcordeParseado | null {
  const etiqueta = texto.trim().replace(/[()]/g, '');
  if (!etiqueta || etiqueta.length > 14 || !CARACTERES_VALIDOS.test(etiqueta)) return null;

  const m = etiqueta.match(RAIZ);
  if (!m) return null;

  const raiz = RAIZ_CANONICA[m[1]!.toLowerCase()]! + (m[2] ?? '');
  let resto = etiqueta.slice(m[0]!.length);

  // Semidisminuido y séptima con quinta bemol: "m7/5", "7/5".
  if (resto.endsWith('/5')) {
    const base = resto.slice(0, -2);
    if (base === '7') return { raiz, sufijo: '7b5', bajo: null, etiqueta };
    if (base === 'm7') return { raiz, sufijo: 'm7b5', bajo: null, etiqueta };
    return null;
  }

  if (resto.includes('/')) {
    const [cabeza = '', cola = ''] = resto.split('/');
    // "Mi/add9" se escribe igual que "Miadd9".
    if (/^add[29]$/.test(cola)) {
      resto = cabeza + cola;
    } else {
      const bajoMatch = cola.match(RAIZ_SOLA);
      if (!bajoMatch) return null;
      const sufijo = resolverSufijo(cabeza);
      if (sufijo === null) return null;
      return {
        raiz,
        sufijo,
        bajo: RAIZ_CANONICA[bajoMatch[1]!.toLowerCase()]! + (bajoMatch[2] ?? ''),
        etiqueta,
      };
    }
  }

  const sufijo = resolverSufijo(resto);
  if (sufijo === null) return null;
  return { raiz, sufijo, bajo: null, etiqueta };
}

/** Clave interna de un acorde (sin enarmonías). */
export function claveAcorde(acorde: Pick<AcordeParseado, 'raiz' | 'sufijo' | 'bajo'>): string {
  return `${acorde.raiz}${acorde.sufijo}${acorde.bajo ? '/' + acorde.bajo : ''}`;
}

function slugRaiz(raiz: string): string {
  const m = raiz.match(RAIZ_SOLA);
  if (!m) return raiz.toLowerCase();
  const accidental = m[2] === '#' ? '-sostenido' : m[2] === 'b' ? '-bemol' : '';
  return RAIZ_CANONICA[m[1]!.toLowerCase()]!.toLowerCase() + accidental;
}

/** Identificador estable para anclas: Mi7 → mi7, Sol#m → sol-sostenido-m. */
export function slugAcorde(acorde: Pick<AcordeParseado, 'raiz' | 'sufijo' | 'bajo'>): string {
  const base = slugRaiz(acorde.raiz);
  const conAccidente = /[#b]$/.test(acorde.raiz);
  const cuerpo = conAccidente && acorde.sufijo ? `${base}-${acorde.sufijo.toLowerCase()}` : base + acorde.sufijo.toLowerCase();
  return acorde.bajo ? `${cuerpo}-${slugRaiz(acorde.bajo)}` : cuerpo;
}

export type IndiceGlosario = Map<string, EntradaGlosario>;

/** Índice de búsqueda a partir del JSON del glosario. */
export function crearIndice(glosario: Glosario): IndiceGlosario {
  const indice: IndiceGlosario = new Map();
  for (const entrada of Object.values(glosario)) {
    if (!entrada?.posiciones?.length) continue;
    indice.set(claveAcorde(entrada), entrada);
  }
  return indice;
}

/** Busca un acorde por su etiqueta, admitiendo enarmonías y acordes con bajo. */
export function buscarEnIndice(
  indice: IndiceGlosario,
  etiqueta: string,
): EntradaGlosario | null {
  const acorde = parsearAcorde(etiqueta);
  if (!acorde) return null;

  const directo = indice.get(claveAcorde(acorde));
  if (directo) return directo;

  const equivalente = ENARMONICO[acorde.raiz];
  if (equivalente) {
    const enarmonico = indice.get(claveAcorde({ ...acorde, raiz: equivalente }));
    if (enarmonico) return enarmonico;
  }

  // Si no existe la inversión, se usa la forma base y se conserva el nombre escrito.
  if (acorde.bajo) {
    return buscarEnIndice(indice, acorde.raiz + acorde.sufijo);
  }

  return null;
}

/** Extrae los acordes de los bloques `<pre>` de una pieza, en orden de aparición. */
export function extraerEtiquetasAcordes(cuerpo: string): string[] {
  const etiquetas: string[] = [];
  const bloques = cuerpo.match(/<pre[\s\S]*?<\/pre>/gi) ?? [];
  for (const bloque of bloques) {
    for (const m of bloque.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
      const etiqueta = (m[1] ?? '').trim();
      if (etiqueta) etiquetas.push(etiqueta);
    }
  }
  return etiquetas;
}

/** Devuelve los acordes únicos de una pieza que tienen diagrama. */
export function acordesDePieza(
  cuerpo: string,
  indice: IndiceGlosario,
): Array<{ etiqueta: string; entrada: EntradaGlosario }> {
  const vistos = new Set<string>();
  const acordes: Array<{ etiqueta: string; entrada: EntradaGlosario }> = [];

  for (const etiqueta of extraerEtiquetasAcordes(cuerpo)) {
    const entrada = buscarEnIndice(indice, etiqueta);
    if (!entrada) continue;
    if (vistos.has(entrada.slug)) continue;
    vistos.add(entrada.slug);
    acordes.push({ etiqueta, entrada });
  }

  return acordes;
}
