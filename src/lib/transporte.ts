/**
 * Transporte (transposición) de acordes en notación española.
 *
 * Se trabaja sobre la etiqueta tal y como está escrita en el `<pre>`: se cambia
 * solo la raíz (y el bajo de los acordes con barra) y se conserva el sufijo y el
 * espaciado original, para no alterar la grafía del cancionero.
 *
 * La validación reutiliza `parsearAcorde()` del glosario, de forma que el
 * transportador y los diagramas entienden los acordes igual.
 */

import {
  buscarEnIndice,
  parsearAcorde,
  type EntradaGlosario,
  type Glosario,
  type IndiceGlosario,
} from './acordes';

/** Escala cromática en sostenidos, el orden que usa el cancionero. */
export const ESCALA_CROMATICA = [
  'Do',
  'Do#',
  'Re',
  'Re#',
  'Mi',
  'Fa',
  'Fa#',
  'Sol',
  'Sol#',
  'La',
  'La#',
  'Si',
] as const;

/** Clase de altura (0 = Do) de cada grafía que aparece en el cancionero. */
const CLASE_DE_ALTURA: Record<string, number> = {
  do: 0,
  'do#': 1,
  reb: 1,
  re: 2,
  're#': 3,
  mib: 3,
  mi: 4,
  'mi#': 5,
  fab: 4,
  fa: 5,
  'fa#': 6,
  solb: 6,
  sol: 7,
  'sol#': 8,
  lab: 8,
  la: 9,
  'la#': 10,
  sib: 10,
  si: 11,
  'si#': 0,
  dob: 11,
};

/** Raíz al principio del texto. Conserva los espacios que haya delante. */
const RAIZ = /^(\s*)(do|re|mi|fa|sol|la|si)(#|b)?/i;

/** Cambia la raíz que abre el texto, dejando intacto el resto. */
function transportarRaiz(texto: string, semitonos: number): string {
  const coincidencia = texto.match(RAIZ);
  if (!coincidencia) return texto;

  const grafia = (coincidencia[2]! + (coincidencia[3] ?? '')).toLowerCase();
  const clase = CLASE_DE_ALTURA[grafia];
  if (clase === undefined) return texto;

  const destino = ((clase + semitonos) % 12 + 12) % 12;
  return coincidencia[1]! + ESCALA_CROMATICA[destino] + texto.slice(coincidencia[0]!.length);
}

/** Transporta un único acorde válido (raíz y, si la hay, la nota del bajo). */
function transportarUnAcorde(texto: string, semitonos: number): string {
  const acorde = parsearAcorde(texto);
  if (!acorde) return texto;

  let salida = transportarRaiz(texto, semitonos);

  if (acorde.bajo) {
    const barra = salida.lastIndexOf('/');
    if (barra !== -1) {
      salida = salida.slice(0, barra + 1) + transportarRaiz(salida.slice(barra + 1), semitonos);
    }
  }

  return salida;
}

/** ¿El texto se puede transportar entero (o partido en varios acordes pegados)? */
function esTransportable(texto: string): boolean {
  if (!texto) return false;
  if (parsearAcorde(texto)) return true;

  for (let corte = texto.length - 1; corte > 0; corte--) {
    if (parsearAcorde(texto.slice(0, corte)) && esTransportable(texto.slice(corte))) {
      return true;
    }
  }

  return false;
}

/**
 * Transporta etiquetas con varios acordes pegados sin espacios (`Fa#mSi7`),
 * separándolos por la frontera de nota. Las palabras que no son acordes se
 * dejan tal cual.
 */
function transportarPegados(texto: string, semitonos: number): string {
  if (parsearAcorde(texto)) return transportarUnAcorde(texto, semitonos);

  for (let corte = texto.length - 1; corte > 0; corte--) {
    const cabeza = texto.slice(0, corte);
    const cola = texto.slice(corte);
    if (parsearAcorde(cabeza) && esTransportable(cola)) {
      return transportarUnAcorde(cabeza, semitonos) + transportarPegados(cola, semitonos);
    }
  }

  return texto;
}

/**
 * Transporta la etiqueta de un `<a>` del `<pre>`.
 *
 * - Un acorde: cambia la raíz y el bajo, conserva sufijo y espacios.
 * - Varios acordes separados por espacios: transporta los que lo sean.
 * - Texto que no es un acorde (`(Sorda)`, palabras de la letra…): sin cambios.
 */
export function transportarEtiqueta(texto: string, semitonos: number): string {
  if (!texto || semitonos === 0) return texto;

  const limpio = texto.trim();
  if (!limpio) return texto;

  if (parsearAcorde(limpio)) return transportarUnAcorde(texto, semitonos);

  if (/\s/.test(limpio)) {
    return texto.replace(/\S+/g, (token) => transportarPegados(token, semitonos));
  }

  return transportarPegados(texto, semitonos);
}

/** ¿La etiqueta es un acorde (sin tener en cuenta la transportación)? */
export function esEtiquetaDeAcorde(texto: string): boolean {
  return parsearAcorde(texto) !== null;
}

function tieneClave(mapa: Glosario, clave: string): boolean {
  return Object.prototype.hasOwnProperty.call(mapa, clave);
}

/**
 * Glosario de la pieza ampliado con las 12 transposiciones de cada acorde, para
 * que el popover y el panel de «Acordes usados» tengan diagrama en cualquier tono.
 */
export function mapaGlosarioConTransportes(
  acordesPieza: Array<{ etiqueta: string; entrada: EntradaGlosario }>,
  indice: IndiceGlosario,
): Glosario {
  const mapa: Glosario = {};

  for (const { etiqueta, entrada } of acordesPieza) {
    mapa[etiqueta] = entrada;
  }

  for (const { etiqueta } of acordesPieza) {
    for (let semitonos = 1; semitonos < 12; semitonos++) {
      const transportada = transportarEtiqueta(etiqueta, semitonos);
      if (transportada === etiqueta || tieneClave(mapa, transportada)) continue;

      const entrada = buscarEnIndice(indice, transportada);
      if (entrada) mapa[transportada] = entrada;
    }
  }

  return mapa;
}
