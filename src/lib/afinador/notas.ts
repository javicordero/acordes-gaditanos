/**
 * Conversión de frecuencia a nota y desviación en cents.
 *
 * Se trabaja con la escala cromática en sostenidos, la misma que usa el resto
 * del sitio, y con La4 = 440 Hz.
 */

import { CUERDAS, type Cuerda } from './cuerdas.ts';

export const NOTAS = [
  'Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si',
];

export const LA4 = 440;

/** Rango razonable de una guitarra: de Mi2 (82 Hz) a Mi6 (1.318 Hz). */
const MIDI_MINIMO = 40;
const MIDI_MAXIMO = 88;

export interface NotaDetectada {
  midi: number;
  nombre: string;
  octava: number;
  /** Desviación respecto a la nota exacta, de −50 a +50. */
  cents: number;
  /** Frecuencia medida. */
  frecuencia: number;
  /** Frecuencia exacta de la nota. */
  objetivo: number;
}

export interface CuerdaCercana {
  cuerda: Cuerda;
  /** Desviación respecto a la cuerda, de −50 a +50. */
  cents: number;
  /** Distancia absoluta en cents. */
  distancia: number;
}

/** Convierte una frecuencia en la nota más cercana. `null` si no es válida. */
export function notaDesdeFrecuencia(frecuencia: number): NotaDetectada | null {
  if (!Number.isFinite(frecuencia) || frecuencia <= 0) return null;

  const exacto = 69 + 12 * Math.log2(frecuencia / LA4);
  const midi = Math.round(exacto);
  if (midi < MIDI_MINIMO || midi > MIDI_MAXIMO) return null;

  const cents = Math.round((exacto - midi) * 100);
  return {
    midi,
    nombre: NOTAS[((midi % 12) + 12) % 12]!,
    octava: Math.floor(midi / 12) - 1,
    cents,
    frecuencia,
    objetivo: LA4 * Math.pow(2, (midi - 69) / 12),
  };
}

/**
 * Cuerda más cercana a una nota. Solo se devuelve si está a menos de un cuarto
 * de tono (60 cents): así no se etiqueta como «6ª cuerda» una nota que no lo es.
 */
export function cuerdaMasCercana(nota: NotaDetectada): CuerdaCercana | null {
  let mejor: Cuerda | null = null;
  let distancia = Infinity;

  for (const cuerda of CUERDAS) {
    const cents = 1200 * Math.log2(nota.frecuencia / cuerda.frecuencia);
    if (Math.abs(cents) < Math.abs(distancia)) {
      distancia = cents;
      mejor = cuerda;
    }
  }

  if (!mejor || Math.abs(distancia) > 60) return null;

  return {
    cuerda: mejor,
    cents: Math.round(distancia),
    distancia: Math.round(Math.abs(distancia)),
  };
}

/** Texto con signo para los cents: `+12`, `−7`, `0`. */
export function textoCents(cents: number): string {
  if (cents > 0) return `+${cents}`;
  if (cents < 0) return `−${Math.abs(cents)}`;
  return '0';
}
