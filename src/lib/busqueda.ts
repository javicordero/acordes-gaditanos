// src/lib/busqueda.ts
//
// Motor de búsqueda del cancionero. Sin dependencias y sin DOM: lo usan el
// desplegable de sugerencias del header (vía /indice-busqueda.json) y
// /buscar. La idea es que "guena", "gnagente" o "prada guenagente" encuentren
// la copla aunque no se recuerde el título exacto.
//
// Puntuación: cada palabra de la consulta debe casar en algún campo (si no,
// la ficha se descarta). Se suman puntos por campo con pesos distintos, así
// que coincidir en la agrupación vale mucho más que en el autor.

export interface EntradaIndice {
  slug: string;
  agrupacion: string;
  pieza: string;
  year: string;
  musica: string;
  letra: string;
}

export interface EntradaPreparada extends EntradaIndice {
  /** Texto normalizado donde se busca. */
  nAgrupacion: string;
  nAutores: string;
  nPieza: string;
  /** Palabras sueltas, para premios por inicio de palabra. */
  pAgrupacion: string[];
  pAutores: string[];
  pPieza: string[];
  /** Etiquetas listas para pintar. */
  etiquetaPieza: string;
  etiquetaAutores: string;
  etiquetaMusica: string;
}

export interface ResultadoBusqueda {
  resultados: EntradaPreparada[];
  total: number;
  /** Se rellena solo cuando no hay resultados y hay una agrupación parecida. */
  sugerencia: string | null;
}

const PESOS = {
  agrupacion: 10,
  autores: 6,
  pieza: 5,
  year: 4,
};

const MAX_TOKENS = 5;

/** Minúsculas, sin tildes, sin puntuación y con espacios simples. */
export function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizar(texto: string): string[] {
  const normalizado = normalizar(texto);
  return normalizado ? normalizado.split(' ') : [];
}

/** Etiqueta legible del tipo de pieza (`final de popurri` → `Final de popurrí`). */
export function etiquetaPieza(pieza: string): string {
  const limpia = (pieza || '').trim().replace(/\s+/g, ' ');
  const cuarteta = limpia.match(/^cuarteta\s+"(.+)"$/i);
  if (cuarteta) return `Cuarteta · ${cuarteta[1]}`;

  const normalizada = normalizar(limpia);

  if (/^final de popurr[íi]?$/.test(normalizada)) return 'Final de popurrí';
  if (/^pasodoble$/.test(normalizada)) return 'Pasodoble';
  if (/^presentacion$/.test(normalizada)) return 'Presentación';
  if (/^popurr[íi]$/.test(normalizada)) return 'Popurrí';
  if (/^estribillo$/.test(normalizada)) return 'Estribillo';
  if (/^tango$/.test(normalizada)) return 'Tango';
  if (/^credo$/.test(normalizada)) return 'Credo';
  if (/^testamento$/.test(normalizada)) return 'Testamento';

  return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/** Autores juntos y sin repetir, para la segunda línea de cada sugerencia. */
function etiquetaAutores(musica: string, letra: string): string {
  const nombres = `${musica || ''},${letra || ''}`
    .split(',')
    .map((nombre) => nombre.trim())
    .filter(Boolean);

  return [...new Set(nombres)].join(', ');
}

/** Solo los autores de la música, sin repetir. */
function etiquetaMusica(musica: string): string {
  const nombres = (musica || '')
    .split(',')
    .map((nombre) => nombre.trim())
    .filter(Boolean);

  return [...new Set(nombres)].join(', ');
}

export function preparar(entradas: EntradaIndice[]): EntradaPreparada[] {
  return entradas.map((entrada) => {
    const nAgrupacion = normalizar(entrada.agrupacion);
    const nAutores = normalizar(`${entrada.musica || ''} ${entrada.letra || ''}`);
    const nPieza = normalizar(entrada.pieza);

    return {
      ...entrada,
      nAgrupacion,
      nAutores,
      nPieza,
      pAgrupacion: nAgrupacion.split(' ').filter(Boolean),
      pAutores: nAutores.split(' ').filter(Boolean),
      pPieza: nPieza.split(' ').filter(Boolean),
      etiquetaPieza: etiquetaPieza(entrada.pieza),
      etiquetaAutores: etiquetaAutores(entrada.musica, entrada.letra),
      etiquetaMusica: etiquetaMusica(entrada.musica),
    };
  });
}

/** Distancia de Levenshtein acotada: corta en cuanto supera `maximo`. */
function distancia(a: string, b: string, maximo: number): number {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minimo = i;

    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      const valor = Math.min(actual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + coste);
      actual[j] = valor;
      if (valor < minimo) minimo = valor;
    }

    if (minimo > maximo) return maximo + 1;
    anterior = actual;
  }

  return anterior[b.length];
}

/** ¿Aparecen las letras de `aguja` en orden dentro de `pajar`? */
function esSubsecuencia(aguja: string, pajar: string): boolean {
  let i = 0;

  for (let j = 0; j < pajar.length && i < aguja.length; j++) {
    if (pajar[j] === aguja[i]) i++;
  }

  return i === aguja.length;
}

/** 0 = no casa. 1 = coincidencia perfecta. */
function puntuarCampo(
  token: string,
  campo: string,
  palabras: string[],
  permitirErratas: boolean,
): number {
  if (!campo) return 0;
  if (campo === token) return 1;
  if (palabras.includes(token)) return 0.95;
  if (palabras.some((palabra) => palabra.startsWith(token))) return 0.85;
  if (campo.startsWith(token)) return 0.8;
  if (campo.includes(token)) return 0.5;

  if (!permitirErratas || token.length < 4) return 0;

  // Una errata de más en palabras cortas, dos en las largas.
  const margen = token.length >= 8 ? 2 : 1;

  if (palabras.some((palabra) => distancia(token, palabra, margen) <= margen)) return 0.45;

  // Subsecuencia solo dentro de una palabra de longitud parecida: si no, en
  // textos largos casi todo acaba "cazando" y el ranking se llena de ruido.
  const cercaDeLaPalabra = palabras.some(
    (palabra) =>
      palabra.length >= token.length &&
      palabra.length <= token.length + 4 &&
      esSubsecuencia(token, palabra),
  );

  return cercaDeLaPalabra ? 0.3 : 0;
}

function puntuarEntrada(entrada: EntradaPreparada, tokens: string[], frase: string): number {
  let total = 0;

  for (const token of tokens) {
    const esAnio = /^\d{4}$/.test(token);

    if (esAnio) {
      // Un año se compara exacto; si no coincide, la ficha no vale por ese token.
      if (entrada.year === token) {
        total += PESOS.year;
        continue;
      }
      return 0;
    }

    const puntuaciones = [
      PESOS.agrupacion * puntuarCampo(token, entrada.nAgrupacion, entrada.pAgrupacion, true),
      PESOS.autores * puntuarCampo(token, entrada.nAutores, entrada.pAutores, true),
      PESOS.pieza * puntuarCampo(token, entrada.nPieza, entrada.pPieza, true),
    ];

    const mejor = Math.max(...puntuaciones);
    if (mejor === 0) return 0;

    total += mejor;
  }

  // Premios por coincidencia global con la agrupación.
  if (entrada.nAgrupacion === frase) total += 60;
  else if (entrada.nAgrupacion.startsWith(frase)) total += 20;

  return total;
}

/**
 * Busca `consulta` en el índice y devuelve las `limite` mejores entradas.
 * `total` es el número de coincidencias, para poder decir "ver los N resultados".
 */
export function buscar(
  entradas: EntradaPreparada[],
  consulta: string,
  limite = 6,
): ResultadoBusqueda {
  const frase = normalizar(consulta);

  if (frase.length < 2) {
    return { resultados: [], total: 0, sugerencia: null };
  }

  const tokens = frase.split(' ').filter(Boolean).slice(0, MAX_TOKENS);

  const puntuadas: { entrada: EntradaPreparada; puntos: number }[] = [];

  for (const entrada of entradas) {
    const puntos = puntuarEntrada(entrada, tokens, frase);
    if (puntos > 0) puntuadas.push({ entrada, puntos });
  }

  puntuadas.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;

    const anioA = Number(a.entrada.year) || 0;
    const anioB = Number(b.entrada.year) || 0;
    if (anioB !== anioA) return anioB - anioA;

    return a.entrada.agrupacion.localeCompare(b.entrada.agrupacion, 'es');
  });

  return {
    resultados: puntuadas.slice(0, limite).map((item) => item.entrada),
    total: puntuadas.length,
    sugerencia: puntuadas.length === 0 ? sugerir(entradas, frase) : null,
  };
}

/** "Quizá quisiste decir": agrupación más parecida a toda la consulta. */
function sugerir(entradas: EntradaPreparada[], frase: string): string | null {
  if (frase.length < 4) return null;

  let mejor: { agrupacion: string; distancia: number } | null = null;

  for (const entrada of entradas) {
    const d = distancia(frase, entrada.nAgrupacion, 3);
    if (d <= 3 && (!mejor || d < mejor.distancia)) {
      mejor = { agrupacion: entrada.agrupacion, distancia: d };
    }
    if (d === 0) break;
  }

  return mejor?.agrupacion ?? null;
}
