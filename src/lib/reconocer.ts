/**
 * Reconocimiento de acordes a partir de una postura en el mástil.
 *
 * Trabaja con clases de altura (0-11) y plantillas de intervalos. Acepta las
 * omisiones habituales en guitarra (5ª, 9ª, 11ª...) siempre que estén las notas
 * que definen el acorde (fundamental, 3ª/4ª y 7ª/6ª/9ª/11ª/13ª cuando toca).
 */

const AFINACION_MIDI = [40, 45, 50, 55, 59, 64]; // 6ª a 1ª cuerda (Mi La Re Sol Si Mi)

const NOTAS = [
  'Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si',
];

const INTERVALOS = [
  '1', 'b2', '2', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7',
];

interface TipoAcorde {
  sufijo: string;
  /** Cómo se escribe el sufijo al mostrar el acorde (si difiere de `sufijo`). */
  nombreSufijo?: string;
  /** Notas que forman el acorde (intervalos desde la fundamental). */
  intervalos: number[];
  /** Notas imprescindibles para poder llamarlo así. */
  requeridos: number[];
}

/**
 * Ordenados de más simple a más complejo (desempate).
 * La 5ª casi nunca es imprescindible, por eso no suele estar en `requeridos`.
 */
const TIPOS: TipoAcorde[] = [
  { sufijo: '', intervalos: [0, 4, 7], requeridos: [0, 4] },
  { sufijo: 'm', intervalos: [0, 3, 7], requeridos: [0, 3] },
  { sufijo: '5', intervalos: [0, 7], requeridos: [0, 7] },
  { sufijo: '7', intervalos: [0, 4, 7, 10], requeridos: [0, 4, 10] },
  { sufijo: 'm7', intervalos: [0, 3, 7, 10], requeridos: [0, 3, 10] },
  { sufijo: 'maj7', intervalos: [0, 4, 7, 11], requeridos: [0, 4, 11] },
  { sufijo: '6', intervalos: [0, 4, 7, 9], requeridos: [0, 4, 9] },
  { sufijo: 'm6', intervalos: [0, 3, 7, 9], requeridos: [0, 3, 9] },
  { sufijo: 'sus2', intervalos: [0, 2, 7], requeridos: [0, 2] },
  { sufijo: 'sus4', intervalos: [0, 5, 7], requeridos: [0, 5] },
  { sufijo: 'sus9', intervalos: [0, 5, 7, 14], requeridos: [0, 5, 2] },
  { sufijo: 'add9', intervalos: [0, 4, 7, 14], requeridos: [0, 4, 2] },
  { sufijo: 'madd9', nombreSufijo: 'm(add9)', intervalos: [0, 3, 7, 14], requeridos: [0, 3, 2] },
  { sufijo: 'add11', intervalos: [0, 4, 7, 17], requeridos: [0, 4, 5] },
  { sufijo: '9', intervalos: [0, 4, 7, 10, 14], requeridos: [0, 4, 10, 2] },
  { sufijo: 'm9', intervalos: [0, 3, 7, 10, 14], requeridos: [0, 3, 10, 2] },
  { sufijo: 'maj9', intervalos: [0, 4, 7, 11, 14], requeridos: [0, 4, 11, 2] },
  { sufijo: 'dim', intervalos: [0, 3, 6], requeridos: [0, 3, 6] },
  { sufijo: 'dim7', intervalos: [0, 3, 6, 9], requeridos: [0, 3, 6, 9] },
  { sufijo: 'm7b5', intervalos: [0, 3, 6, 10], requeridos: [0, 3, 6, 10] },
  { sufijo: 'aug', intervalos: [0, 4, 8], requeridos: [0, 4, 8] },
  { sufijo: '7b5', intervalos: [0, 4, 6, 10], requeridos: [0, 4, 6, 10] },
  { sufijo: '7maj5', intervalos: [0, 4, 8, 10], requeridos: [0, 4, 8, 10] },
  { sufijo: '7sus4', intervalos: [0, 5, 7, 10], requeridos: [0, 5, 10] },
  { sufijo: 'mmaj7', intervalos: [0, 3, 7, 11], requeridos: [0, 3, 11] },
  { sufijo: '6add9', intervalos: [0, 4, 7, 9, 14], requeridos: [0, 4, 9, 2] },
  { sufijo: '7b9', intervalos: [0, 4, 7, 10, 13], requeridos: [0, 4, 10, 1] },
  { sufijo: '7#9', intervalos: [0, 4, 7, 10, 15], requeridos: [0, 4, 10, 3] },
  { sufijo: '11', intervalos: [0, 4, 7, 10, 14, 17], requeridos: [0, 4, 10, 5] },
  { sufijo: '13', intervalos: [0, 4, 7, 10, 14, 17, 21], requeridos: [0, 4, 10, 9] },
];

export interface AcordeReconocido {
  raiz: string;
  sufijo: string;
  bajo: string | null;
  /** Nombre completo en notación española (p. ej. Sim7b5, Do/Mi). */
  nombre: string;
  /** Notas distintas que suenan, de grave a agudo. */
  notas: string[];
  /** Notas con su intervalo respecto a la fundamental (Do (1), Mi (3)…). */
  analisis: string[];
  /** Notas de la plantilla que no suenan (5ª, 9ª…). */
  omitidas: string[];
  /** true si suenan todas las notas de la plantilla. */
  exacto: boolean;
}

function aConjunto(intervalos: number[]): Set<number> {
  return new Set(intervalos.map((i) => ((i % 12) + 12) % 12));
}

/**
 * Reconoce los acordes que encajan con una postura.
 * `trastes` son 6 valores de la 6ª a la 1ª cuerda: -1 muda, 0 al aire, n traste.
 * Devuelve los candidatos ordenados: el primero es el más probable.
 */
export function reconocerAcorde(trastes: number[]): AcordeReconocido[] {
  const sonando: number[] = [];
  let bajo: number | null = null;

  trastes.forEach((traste, i) => {
    if (traste < 0 || i >= AFINACION_MIDI.length) return;
    const pc = (AFINACION_MIDI[i]! + traste) % 12;
    sonando.push(pc);
    if (bajo === null) bajo = pc;
  });

  const conjuntoNotas = new Set(sonando);
  if (conjuntoNotas.size < 2) return [];

  const notas = [...conjuntoNotas].map((pc) => NOTAS[pc]!);
  const candidatos: Array<AcordeReconocido & { rank: number[] }> = [];

  for (let raiz = 0; raiz < 12; raiz += 1) {
    for (let orden = 0; orden < TIPOS.length; orden += 1) {
      const tipo = TIPOS[orden]!;
      const plantilla = new Set(tipo.intervalos.map((i) => (i + raiz) % 12));

      // No puede sonar nada que no pertenezca al acorde.
      let encaja = true;
      for (const pc of conjuntoNotas) {
        if (!plantilla.has(pc)) {
          encaja = false;
          break;
        }
      }
      if (!encaja) continue;

      // Deben estar las notas imprescindibles.
      for (const intervalo of tipo.requeridos) {
        if (!conjuntoNotas.has((intervalo + raiz) % 12)) {
          encaja = false;
          break;
        }
      }
      if (!encaja) continue;

      const faltantes = plantilla.size - conjuntoNotas.size;
      const raizNombre = NOTAS[raiz]!;
      const esBajo = bajo === raiz;
      const bajoNombre = bajo !== null ? NOTAS[bajo]! : null;
      const nombre =
        raizNombre +
        (tipo.nombreSufijo ?? tipo.sufijo) +
        (bajo !== null && !esBajo ? `/${bajoNombre}` : '');

      const analisis = [...conjuntoNotas].map((pc) => {
        const intervalo = ((pc - raiz) % 12 + 12) % 12;
        return `${NOTAS[pc]!} (${INTERVALOS[intervalo]})`;
      });

      const omitidas = [...plantilla]
        .filter((pc) => !conjuntoNotas.has(pc))
        .map((pc) => {
          const intervalo = ((pc - raiz) % 12 + 12) % 12;
          return INTERVALOS[intervalo]!;
        });

      candidatos.push({
        raiz: raizNombre,
        sufijo: tipo.sufijo,
        bajo: bajo !== null && !esBajo ? bajoNombre : null,
        nombre,
        notas,
        analisis,
        omitidas,
        exacto: faltantes === 0,
        rank: [faltantes, esBajo ? 0 : 1, tipo.intervalos.length, orden],
      });
    }
  }

  const vistos = new Set<string>();
  const unicos = candidatos.filter((c) => {
    if (vistos.has(c.nombre)) return false;
    vistos.add(c.nombre);
    return true;
  });

  unicos.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i += 1) {
      const diferencia = a.rank[i]! - b.rank[i]!;
      if (diferencia !== 0) return diferencia;
    }
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return unicos.map(({ rank, ...acorde }) => acorde);
}
