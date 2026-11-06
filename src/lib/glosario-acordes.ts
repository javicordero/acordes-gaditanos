/**
 * Metadatos y texto de las páginas individuales del glosario de acordes.
 *
 * Todo lo que hay aquí es puro (sin Astro ni DOM) para poder probarlo desde
 * Node con `node --experimental-strip-types` y para compartirlo con
 * `src/pages/glosario.astro` (índice del glosario).
 *
 * Las páginas se generan con `src/pages/glosario/[acorde].astro` a partir de
 * `src/data/glosario-acordes.json`; no se escribe ningún contenido a mano.
 */

import type { EntradaGlosario, Glosario, PosicionGlosario } from './acordes';

export const ORDEN_RAICES = [
  'Do', 'Do#', 'Reb', 'Re', 'Re#', 'Mib', 'Mi', 'Fa', 'Fa#',
  'Solb', 'Sol', 'Sol#', 'Lab', 'La', 'La#', 'Sib', 'Si',
];

export const ORDEN_SUFIJOS = [
  '', 'm', '5', '6', 'm6', '7', 'm7', 'maj7', 'maj9', '9', 'm9', 'add9', 'madd9',
  '11', '13', 'sus2', 'sus4', 'sus9', 'susb6add9', '7sus4', 'dim', 'dim7', 'aug', 'mmaj7',
  '6add9', '7b5', '7maj5', 'm7b5',
];

/** Nombre del tipo de acorde a partir de su sufijo. */
export const TIPO_NOMBRE: Record<string, string> = {
  '': 'mayor',
  m: 'menor',
  '5': 'quinta',
  '6': 'sexta',
  m6: 'menor sexta',
  '7': 'séptima',
  m7: 'menor séptima',
  maj7: 'séptima mayor',
  maj9: 'novena mayor',
  '9': 'novena',
  m9: 'menor novena',
  add9: 'novena añadida',
  madd9: 'menor con novena añadida',
  '11': 'oncena',
  '13': 'trecena',
  sus2: 'suspendida segunda',
  sus4: 'suspendida cuarta',
  sus9: 'suspendida con novena',
  susb6add9: 'suspendida con b6 y novena',
  '7sus4': 'séptima suspendida',
  dim: 'disminuido',
  dim7: 'disminuido séptima',
  aug: 'aumentado',
  mmaj7: 'menor séptima mayor',
  '6add9': 'sexta con novena',
  '7b5': 'séptima con quinta bemol',
  '7maj5': 'séptima con quinta aumentada',
  m7b5: 'semidisminuido',
};

export function nombreTipo(sufijo: string): string {
  return TIPO_NOMBRE[sufijo] ?? sufijo;
}

/** «Do séptima», «La menor con bajo en Do». */
export function tituloAcorde(entrada: EntradaGlosario): string {
  const base = `${entrada.raiz} ${nombreTipo(entrada.sufijo)}`;
  return entrada.bajo ? `${base} con bajo en ${entrada.bajo}` : base;
}

/* ------------------------------------------------------------------ */
/* Notación inglesa                                                    */
/* ------------------------------------------------------------------ */

const RAIZ_INGLES: Record<string, string> = {
  Do: 'C',
  'Do#': 'C#',
  Reb: 'Db',
  Re: 'D',
  'Re#': 'D#',
  Mib: 'Eb',
  Mi: 'E',
  Fa: 'F',
  'Fa#': 'F#',
  Solb: 'Gb',
  Sol: 'G',
  'Sol#': 'G#',
  Lab: 'Ab',
  La: 'A',
  'La#': 'A#',
  Sib: 'Bb',
  Si: 'B',
};

/** `Do7` → `C7`; `La#m/Sol` → `A#m/G`. El sufijo del glosario se conserva. */
export function notacionInglesa(entrada: EntradaGlosario): string {
  const raiz = RAIZ_INGLES[entrada.raiz] ?? entrada.raiz;
  const bajo = entrada.bajo ? `/${RAIZ_INGLES[entrada.bajo] ?? entrada.bajo}` : '';
  return `${raiz}${entrada.sufijo}${bajo}`;
}

/* ------------------------------------------------------------------ */
/* Notas que suenan                                                    */
/* ------------------------------------------------------------------ */

/** Clase de altura (0 = Do) de cada fundamental del glosario. */
const PC_RAIZ: Record<string, number> = {
  Do: 0,
  'Do#': 1,
  Reb: 1,
  Re: 2,
  'Re#': 3,
  Mib: 3,
  Mi: 4,
  'Mi#': 5,
  Fab: 4,
  Fa: 5,
  'Fa#': 6,
  Solb: 6,
  Sol: 7,
  'Sol#': 8,
  Lab: 8,
  La: 9,
  'La#': 10,
  Sib: 10,
  Si: 11,
  'Si#': 0,
  Dob: 11,
};

/** Afinación estándar (Mi-La-Re-Sol-Si-Mi), de la 6ª a la 1ª cuerda. */
const AFINACION = [4, 9, 2, 7, 11, 4];

const NOTAS_SOSTENIDO = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const NOTAS_BEMOL = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

interface Intervalo {
  /** Grado de la escala: 1, 3, 5, 6, 7, 9, 11, 13. */
  grado: number;
  semitonos: number;
}

const intervalo = (grado: number, semitonos: number): Intervalo => ({ grado, semitonos });

const MAYOR = [intervalo(1, 0), intervalo(3, 4), intervalo(5, 7)];
const MENOR = [intervalo(1, 0), intervalo(3, 3), intervalo(5, 7)];
const SEPTIMA_DOMINANTE = [...MAYOR, intervalo(7, 10)];

/** Notas (grados) que forman cada tipo de acorde del glosario. */
const INTERVALOS: Record<string, Intervalo[]> = {
  '': MAYOR,
  m: MENOR,
  '5': [intervalo(1, 0), intervalo(5, 7)],
  '6': [...MAYOR, intervalo(6, 9)],
  m6: [...MENOR, intervalo(6, 9)],
  '7': SEPTIMA_DOMINANTE,
  m7: [...MENOR, intervalo(7, 10)],
  maj7: [...MAYOR, intervalo(7, 11)],
  maj9: [...MAYOR, intervalo(7, 11), intervalo(9, 14)],
  '9': [...SEPTIMA_DOMINANTE, intervalo(9, 14)],
  m9: [...MENOR, intervalo(7, 10), intervalo(9, 14)],
  add9: [...MAYOR, intervalo(9, 14)],
  madd9: [...MENOR, intervalo(9, 14)],
  '11': [...SEPTIMA_DOMINANTE, intervalo(11, 17)],
  '13': [...SEPTIMA_DOMINANTE, intervalo(13, 21)],
  sus2: [intervalo(1, 0), intervalo(2, 2), intervalo(5, 7)],
  sus4: [intervalo(1, 0), intervalo(4, 5), intervalo(5, 7)],
  sus9: [intervalo(1, 0), intervalo(2, 2), intervalo(5, 7)],
  susb6add9: [
    intervalo(1, 0),
    intervalo(4, 5),
    intervalo(5, 7),
    intervalo(6, 8),
    intervalo(9, 14),
  ],
  '7sus4': [intervalo(1, 0), intervalo(4, 5), intervalo(5, 7), intervalo(7, 10)],
  dim: [intervalo(1, 0), intervalo(3, 3), intervalo(5, 6)],
  dim7: [intervalo(1, 0), intervalo(3, 3), intervalo(5, 6), intervalo(7, 9)],
  aug: [intervalo(1, 0), intervalo(3, 4), intervalo(5, 8)],
  mmaj7: [...MENOR, intervalo(7, 11)],
  '6add9': [...MAYOR, intervalo(6, 9), intervalo(9, 14)],
  '7b5': [intervalo(1, 0), intervalo(3, 4), intervalo(5, 6), intervalo(7, 10)],
  '7maj5': [intervalo(1, 0), intervalo(3, 4), intervalo(5, 8), intervalo(7, 10)],
  m7b5: [intervalo(1, 0), intervalo(3, 3), intervalo(5, 6), intervalo(7, 10)],
};

const LETRAS = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const PC_LETRA = [0, 2, 4, 5, 7, 9, 11];

/** Nombre de una nota respetando la letra que le toca por grado. */
function nombreNota(pc: number, letra: number): string {
  const diferencia = (((pc - (PC_LETRA[letra] ?? 0)) % 12) + 12) % 12;
  const accidente =
    diferencia === 0
      ? ''
      : diferencia === 1
        ? '#'
        : diferencia === 2
          ? '##'
          : diferencia === 11
            ? 'b'
            : diferencia === 10
              ? 'bb'
              : '';
  return `${LETRAS[letra] ?? ''}${accidente}`;
}

/**
 * Notas que forman el acorde (`Do7` → Do, Mi, Sol, Sib), escritas según el
 * grado que ocupan. Si el sufijo no está en la tabla se derivan de los trastes.
 */
export function notasDelAcorde(entrada: EntradaGlosario): string[] {
  const grados = INTERVALOS[entrada.sufijo];
  const letraRaiz = LETRAS.indexOf(entrada.raiz.replace(/[#b]/g, ''));
  const pcRaiz = PC_RAIZ[entrada.raiz];

  let notas: string[];
  if (grados && letraRaiz >= 0 && pcRaiz !== undefined) {
    notas = grados.map(({ grado, semitonos }) => {
      const pc = (pcRaiz + semitonos) % 12;
      const letra = (letraRaiz + grado - 1) % 7;
      return nombreNota(pc, letra);
    });
  } else {
    // Sufijo desconocido: notas que suenan de verdad en los trastes.
    const clases = new Set<number>();
    for (const posicion of entrada.posiciones) {
      posicion.trastes.forEach((traste, cuerda) => {
        if (traste < 0) return;
        clases.add((((AFINACION[cuerda] ?? 0) + traste) % 12 + 12) % 12);
      });
    }

    const sostenidos = entrada.raiz.includes('#');
    const nombres = sostenidos ? NOTAS_SOSTENIDO : NOTAS_BEMOL;
    notas = [...clases].sort((a, b) => a - b).map((pc) => nombres[pc] ?? '');
  }

  // En una inversión el bajo forma parte de lo que suena.
  if (entrada.bajo && !notas.includes(entrada.bajo)) {
    notas = [entrada.bajo, ...notas];
  }

  return notas;
}

/* ------------------------------------------------------------------ */
/* Digitación                                                          */
/* ------------------------------------------------------------------ */

export interface CuerdaDigitacion {
  /** 6 (grave) a 1 (aguda). */
  cuerda: number;
  estado: 'muda' | 'aire' | 'traste';
  traste?: number;
  /** La nota la pisa la cejilla, no un dedo suelto. */
  cejilla?: boolean;
}

export interface DescripcionPosicion {
  resumen: string;
  cuerdas: CuerdaDigitacion[];
}

const ordinal = (cuerda: number) => `${cuerda}ª`;

function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function rangoCejilla(desde: number, hasta: number): string {
  const primera = 6 - desde;
  const ultima = 6 - hasta;
  if (desde === 0 && hasta === 5) return 'todas las cuerdas';
  if (primera === ultima) return `la ${ordinal(primera)} cuerda`;
  return `de la ${ordinal(primera)} a la ${ordinal(ultima)} cuerda`;
}

/** Frase de digitación y tabla de cuerdas de una posición. */
export function describirPosicion(posicion: PosicionGlosario): DescripcionPosicion {
  const cejilla = posicion.cejilla;
  const cuerdas: CuerdaDigitacion[] = posicion.trastes.map((traste, indice) => {
    const cuerda = 6 - indice;
    if (traste < 0) return { cuerda, estado: 'muda' };
    if (traste === 0) return { cuerda, estado: 'aire' };
    const cubierta =
      !!cejilla &&
      traste === cejilla.traste &&
      indice >= cejilla.desde &&
      indice <= cejilla.hasta;
    return { cuerda, estado: 'traste', traste, cejilla: cubierta };
  });

  const frases: string[] = [];

  if (cejilla) {
    frases.push(
      `Cejilla en el traste ${cejilla.traste} (${rangoCejilla(cejilla.desde, cejilla.hasta)})`,
    );
  }

  const pisadas = cuerdas.filter((c) => c.estado === 'traste' && !c.cejilla);
  if (pisadas.length > 0) {
    frases.push(
      `Pisa ${enumerar(pisadas.map((c) => `la ${ordinal(c.cuerda)} cuerda en el traste ${c.traste}`))}`,
    );
  }

  const alAire = cuerdas.filter((c) => c.estado === 'aire');
  if (alAire.length > 0) {
    const lista = enumerar(alAire.map((c) => ordinal(c.cuerda)));
    frases.push(
      alAire.length === 1
        ? `La cuerda ${lista} suena al aire`
        : `Las cuerdas ${lista} suenan al aire`,
    );
  }

  const mudas = cuerdas.filter((c) => c.estado === 'muda');
  if (mudas.length > 0) {
    const lista = enumerar(mudas.map((c) => ordinal(c.cuerda)));
    frases.push(
      mudas.length === 1
        ? `No se toca la ${lista} cuerda`
        : `No se tocan las cuerdas ${lista}`,
    );
  }

  if (frases.length === 0) frases.push('Todas las cuerdas suenan al aire');

  return { resumen: `${frases.join('. ')}.`, cuerdas };
}

/* ------------------------------------------------------------------ */
/* Acordes relacionados                                                */
/* ------------------------------------------------------------------ */

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
};

export interface AcordeRelacionado {
  etiqueta: string;
  entrada: EntradaGlosario;
}

export interface Relacionados {
  mismaRaiz: AcordeRelacionado[];
  mismoSufijo: AcordeRelacionado[];
  enarmonico: AcordeRelacionado[];
}

const rankSufijo = (sufijo: string) => {
  const indice = ORDEN_SUFIJOS.indexOf(sufijo);
  return indice === -1 ? ORDEN_SUFIJOS.length : indice;
};

/**
 * Enlaces internos de una página de acorde: otros acordes de la misma
 * fundamental, el mismo tipo en otras fundamentales y la grafía enarmónica.
 */
export function acordesRelacionados(
  glosario: Glosario,
  entrada: EntradaGlosario,
  maxMismaRaiz = 14,
): Relacionados {
  const entradas = Object.entries(glosario).filter(([, otra]) => otra.posiciones.length > 0);

  const mismaRaiz = entradas
    .filter(([, otra]) => otra.raiz === entrada.raiz && otra.slug !== entrada.slug)
    .sort(
      (a, b) =>
        rankSufijo(a[1].sufijo) - rankSufijo(b[1].sufijo) ||
        a[1].sufijo.localeCompare(b[1].sufijo, 'es') ||
        (a[1].bajo ?? '').localeCompare(b[1].bajo ?? '', 'es'),
    )
    .slice(0, maxMismaRaiz)
    .map(([etiqueta, otra]) => ({ etiqueta, entrada: otra }));

  const equivalente = ENARMONICO[entrada.raiz];
  const mismoSufijo = ORDEN_RAICES.flatMap((raiz) => {
    if (raiz === entrada.raiz || raiz === equivalente) return [];
    const encontrada = entradas.find(
      ([, otra]) =>
        otra.raiz === raiz &&
        otra.sufijo === entrada.sufijo &&
        (otra.bajo ?? '') === (entrada.bajo ?? ''),
    );
    return encontrada ? [{ etiqueta: encontrada[0], entrada: encontrada[1] }] : [];
  });

  const enarmonico = equivalente
    ? entradas
        .filter(
          ([, otra]) =>
            otra.raiz === equivalente &&
            otra.sufijo === entrada.sufijo &&
            (otra.bajo ?? '') === (entrada.bajo ?? ''),
        )
        .map(([etiqueta, otra]) => ({ etiqueta, entrada: otra }))
        .slice(0, 1)
    : [];

  return { mismaRaiz, mismoSufijo, enarmonico };
}

/* ------------------------------------------------------------------ */
/* Títulos                                                            */
/* ------------------------------------------------------------------ */

/**
 * Título de la pestaña, con las dos notaciones y el «cómo tocarlo» cuando
 * caben. Se prueban de más a menos completo y se queda el primero que no pase
 * de `MAX_TITULO` caracteres (para no comerse el corte de Google).
 */
export function tituloSeoAcorde(
  etiqueta: string,
  ingles: string,
  max = 68,
  marca = ' - Acordes Gaditanos',
): string {
  const candidatos = [
    `Acorde ${etiqueta} (${ingles}) en guitarra: cómo tocarlo${marca}`,
    `Acorde ${etiqueta} (${ingles}) en guitarra${marca}`,
    `Acorde ${etiqueta} en guitarra: cómo tocarlo${marca}`,
    `Acorde ${etiqueta} en guitarra${marca}`,
  ];
  return candidatos.find((titulo) => titulo.length <= max) ?? candidatos[candidatos.length - 1]!;
}
