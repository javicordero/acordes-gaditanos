/**
 * Comprueba si un acorde existe en el glosario y, si no existe, sugiere
 * acordes parecidos que sí estén disponibles.
 *
 * Uso:
 *   node --experimental-strip-types scripts/sugerir-acorde.ts "Mi9" ["Re/Fa#" ...]
 *
 * Devuelve código 1 si alguno de los acordes no existe (útil para scripts).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buscarEnIndice,
  crearIndice,
  parsearAcorde,
  type Glosario,
} from '../src/lib/acordes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');

const glosario = (JSON.parse(readFileSync(DATA, 'utf8')) as { acordes: Glosario }).acordes;
const indice = crearIndice(glosario);

const ORDEN_SUFIJOS = [
  '', 'm', '5', '6', 'm6', '7', 'm7', 'maj7', 'maj9', '9', 'm9', 'add9',
  '11', '13', 'sus2', 'sus4', 'sus9', 'susb6add9', '7sus4', 'dim', 'dim7', 'm7b5',
  'aug', '7b5', '7maj5', 'mmaj7', '6add9',
];

const RAIZ_CANONICA: Record<string, string> = {
  do: 'Do', re: 'Re', mi: 'Mi', fa: 'Fa', sol: 'Sol', la: 'La', si: 'Si',
};

const ENARMONICO: Record<string, string> = {
  'Do#': 'Reb', Reb: 'Do#', 'Re#': 'Mib', Mib: 'Re#', 'Fa#': 'Solb',
  Solb: 'Fa#', 'Sol#': 'Lab', Lab: 'Sol#', 'La#': 'Sib', Sib: 'La#',
};

const SUFIJOS_SIMILARES: Record<string, string[]> = {
  '': ['m', '5', 'sus2', 'sus4'],
  m: ['', 'm7', '5'],
  '5': ['', 'm'],
  '6': ['m6', 'maj7', 'add9'],
  m6: ['m7', '6'],
  '7': ['m7', '9', '7sus4', '7b5', '5'],
  m7: ['m', 'm9', 'm7b5', '7'],
  maj7: ['7', 'maj9', '6'],
  '9': ['add9', '7', 'maj9', 'm9'],
  m9: ['m7', 'add9'],
  maj9: ['maj7', '9'],
  add9: ['9', 'sus2', '6', 'sus9'],
  '11': ['7', 'add9', 'sus4'],
  '13': ['9', '7', '6'],
  sus2: ['sus4', 'add9', 'sus'],
  sus4: ['sus2', 'sus', '7sus4'],
  sus9: ['sus2', 'sus4', 'add9'],
  susb6add9: ['sus9', 'sus4', 'add9', 'm6'],
  '7sus4': ['sus4', '7', 'sus2'],
  dim: ['dim7', 'm7b5', 'm'],
  dim7: ['dim', 'm7b5'],
  m7b5: ['dim', 'm7', 'm'],
  aug: ['7maj5', ''],
  '7b5': ['7', 'm7b5'],
  '7maj5': ['aug', '7'],
  mmaj7: ['m7', 'maj7'],
  '6add9': ['6', 'add9', 'maj7'],
};

interface AcordeLeido {
  raiz: string;
  sufijo: string;
  bajo: string | null;
  /** false cuando el sufijo no está en la tabla del parser, pero la raíz sí. */
  estricto: boolean;
}

/** Sufijos con pinta de acorde aunque el parser no los conozca (maj13, 7#9, madd9…). */
const SUFIJO_TOLERADO = /^(maj|min|dim|aug|sus|add|m|M|\d|#|b|\+|-)+$/;

function leerAcorde(etiqueta: string): AcordeLeido | null {
  const estricto = parsearAcorde(etiqueta);
  if (estricto) return { ...estricto, estricto: true };

  // Lectura tolerante para poder sugerir alternativas a sufijos desconocidos.
  const [izquierda, derecha] = etiqueta.split('/');
  const m = (izquierda ?? '').match(/^(do|re|mi|fa|sol|la|si)([#b]?)(.*)$/i);
  if (!m) return null;
  const sufijo = m[3] ?? '';
  if (!SUFIJO_TOLERADO.test(sufijo)) return null;

  let bajo: string | null = null;
  if (derecha !== undefined) {
    const bm = derecha.match(/^(do|re|mi|fa|sol|la|si)([#b]?)$/i);
    if (!bm) return null;
    bajo = RAIZ_CANONICA[bm[1]!.toLowerCase()]! + (bm[2] ?? '');
  }

  return {
    raiz: RAIZ_CANONICA[m[1]!.toLowerCase()]! + (m[2] ?? ''),
    sufijo,
    bajo,
    estricto: false,
  };
}

function sufijoIndice(sufijo: string): number {
  const i = ORDEN_SUFIJOS.indexOf(sufijo);
  return i === -1 ? ORDEN_SUFIJOS.length : i;
}

function sufijoPreferidoPorParecido(sufijo: string): string[] {
  const s = sufijo.toLowerCase();
  if (s.startsWith('maj') || s.includes('maj')) return ['maj7', 'maj9', '6', '7', 'add9'];
  if (s.startsWith('m')) return ['m', 'm7', 'm9', 'm6', 'm7b5', 'mmaj7'];
  if (s.includes('13')) return ['13', '9', '6', 'maj9'];
  if (s.includes('11')) return ['11', '9', 'sus4', '7'];
  if (s.includes('9')) return ['9', 'add9', '7', 'maj9'];
  if (s.includes('sus')) return ['sus2', 'sus4', 'sus9', '7sus4'];
  if (s.includes('dim')) return ['dim', 'dim7', 'm7b5'];
  if (s.includes('aug') || s.includes('+')) return ['aug', '7maj5', '7'];
  if (s.includes('6')) return ['6', 'm6', 'maj7'];
  if (s.includes('7')) return ['7', 'm7', 'maj7', '9'];
  return ['', 'm', '7', 'm7', '6', 'sus2', 'sus4', 'add9'];
}

function sugerencias(acorde: AcordeLeido, etiqueta: string): string[] {
  const plural = (n: number) => `${n} ${n === 1 ? 'posición' : 'posiciones'}`;

  if (!acorde.estricto) {
    // Sufijo desconocido: proponer variantes de la misma fundamental,
    // empezando por las más parecidas al sufijo escrito.
    const preferidos = sufijoPreferidoPorParecido(acorde.sufijo);
    const disponibles = Object.entries(glosario)
      .filter(([, entrada]) => entrada.raiz === acorde.raiz && !entrada.bajo && entrada.posiciones.length > 0)
      .map(([clave, entrada]) => ({ clave, sufijo: entrada.sufijo }))
      .sort((a, b) => {
        const pa = preferidos.indexOf(a.sufijo);
        const pb = preferidos.indexOf(b.sufijo);
        const ia = pa === -1 ? preferidos.length : pa;
        const ib = pb === -1 ? preferidos.length : pb;
        if (ia !== ib) return ia - ib;
        return sufijoIndice(a.sufijo) - sufijoIndice(b.sufijo);
      });

    const salida: string[] = [];
    const vistos = new Set<string>();
    const añadirOrdenado = (clave: string) => {
      if (vistos.has(clave) || clave === etiqueta) return;
      const entrada = glosario[clave];
      if (!entrada || entrada.posiciones.length === 0) return;
      vistos.add(clave);
      salida.push(`${clave} (${plural(entrada.posiciones.length)})`);
    };

    for (const { clave } of disponibles) añadirOrdenado(clave);

    const enarmonico = ENARMONICO[acorde.raiz];
    if (enarmonico) {
      for (const { sufijo } of disponibles) añadirOrdenado(enarmonico + sufijo);
    }

    return salida.slice(0, 12);
  }

  const candidatos = new Map<string, string>();

  const añadir = (clave: string) => {
    const entrada = glosario[clave];
    if (entrada && entrada.posiciones.length > 0 && clave !== etiqueta) {
      candidatos.set(clave, `${clave} (${plural(entrada.posiciones.length)})`);
    }
  };

  añadir(acorde.raiz + acorde.sufijo);
  for (const [clave, entrada] of Object.entries(glosario)) {
    if (entrada.raiz === acorde.raiz && !entrada.bajo && entrada.posiciones.length > 0) {
      candidatos.set(clave, `${clave} (${plural(entrada.posiciones.length)})`);
    }
  }
  const enarmonico = ENARMONICO[acorde.raiz];
  if (enarmonico) añadir(enarmonico + acorde.sufijo + (acorde.bajo ? '/' + acorde.bajo : ''));
  for (const sufijo of SUFIJOS_SIMILARES[acorde.sufijo] ?? []) {
    añadir(acorde.raiz + sufijo);
    if (enarmonico) añadir(enarmonico + sufijo);
  }

  return [...candidatos.entries()]
    .sort(([claveA, a], [claveB, b]) => {
      const entradaA = glosario[claveA]!;
      const entradaB = glosario[claveB]!;
      const porSufijo = sufijoIndice(entradaA.sufijo) - sufijoIndice(entradaB.sufijo);
      if (porSufijo !== 0) return porSufijo;
      return a.localeCompare(b, 'es');
    })
    .map(([, texto]) => texto)
    .slice(0, 12);
}

const etiquetas = process.argv.slice(2).filter(Boolean);
if (etiquetas.length === 0) {
  console.error('Uso: node --experimental-strip-types scripts/sugerir-acorde.ts "Mi9" ["Re/Fa#" ...]');
  process.exit(1);
}

let faltan = 0;

for (const etiqueta of etiquetas) {
  const acorde = leerAcorde(etiqueta);
  if (!acorde) {
    console.log(`\n${etiqueta}: no parece un acorde (revisa la notación).`);
    faltan += 1;
    continue;
  }

  const encontrado = buscarEnIndice(indice, etiqueta);
  if (encontrado) {
    const n = encontrado.posiciones.length;
    console.log(`\n${etiqueta}: OK (${encontrado.slug}, ${n} ${n === 1 ? 'posición' : 'posiciones'}).`);
    continue;
  }

  faltan += 1;
  console.log(
    `\n${etiqueta}: NO está en el glosario${acorde.estricto ? '' : ` (sufijo "${acorde.sufijo}" no soportado por el parser)`}.`,
  );

  const lista = sugerencias(acorde, etiqueta);
  if (lista.length === 0) {
    console.log('  No hay acordes parecidos en el glosario.');
  } else {
    console.log('  Similares disponibles:');
    for (const sugerencia of lista) console.log(`   - ${sugerencia}`);
  }
}

process.exit(faltan > 0 ? 1 : 0);
