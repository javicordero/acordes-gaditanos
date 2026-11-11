/**
 * Las seis cuerdas de la guitarra en afinación estándar.
 *
 * Referencias a La4 = 440 Hz. Los valores son los de la afinación estándar
 * (Mi-La-Re-Sol-Si-Mi), la misma que usan los diagramas del glosario.
 */

export interface Cuerda {
  /** Número de cuerda: 6 es la más grave. */
  numero: number;
  /** Nota con octava, como se muestra en el afinador. */
  nota: string;
  /** Nombre de la nota sin octava. */
  nombre: string;
  octava: number;
  /** Frecuencia exacta en Hz. */
  frecuencia: number;
  /** Clase de altura (0 = Do). */
  clase: number;
}

export const CUERDAS: Cuerda[] = [
  { numero: 6, nota: 'Mi2', nombre: 'Mi', octava: 2, frecuencia: 82.41, clase: 4 },
  { numero: 5, nota: 'La2', nombre: 'La', octava: 2, frecuencia: 110.0, clase: 9 },
  { numero: 4, nota: 'Re3', nombre: 'Re', octava: 3, frecuencia: 146.83, clase: 2 },
  { numero: 3, nota: 'Sol3', nombre: 'Sol', octava: 3, frecuencia: 196.0, clase: 7 },
  { numero: 2, nota: 'Si3', nombre: 'Si', octava: 3, frecuencia: 246.94, clase: 11 },
  { numero: 1, nota: 'Mi4', nombre: 'Mi', octava: 4, frecuencia: 329.63, clase: 4 },
];
