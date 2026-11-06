/**
 * Índice invertido acorde → coplas del cancionero.
 *
 * Se calcula una sola vez por build (y se reutiliza entre páginas) a partir de
 * los bloques `<pre>` de la colección `acordes`, con el mismo criterio que
 * `acordesDePieza()`: una ficha cuenta una sola vez aunque repita el acorde.
 *
 * Lo usa `src/pages/glosario/[acorde].astro` para el bloque «Coplas que usan
 * este acorde».
 */

import { getCollection } from 'astro:content';
import glosarioJson from '../data/glosario-acordes.json';
import { acordesDePieza, crearIndice, type Glosario } from './acordes';

export interface CoplaConAcorde {
  slug: string;
  pieza: string;
  agrupacion: string;
  year: string;
  date: string;
  letraTitulo?: string;
}

let cache: Map<string, CoplaConAcorde[]> | null = null;

/** `DD/MM/YYYY` → número ordenable. */
function fecha(date: string): number {
  const [dia, mes, anio] = (date || '').split('/').map(Number);
  return (anio ?? 0) * 10000 + (mes ?? 0) * 100 + (dia ?? 0);
}

export async function coplasPorAcorde(): Promise<Map<string, CoplaConAcorde[]>> {
  if (cache) return cache;

  const glosario = (glosarioJson as unknown as { acordes: Glosario }).acordes;
  const indice = crearIndice(glosario);
  const acordes = await getCollection('acordes');
  const mapa = new Map<string, CoplaConAcorde[]>();

  for (const acorde of acordes) {
    const cuerpo = typeof acorde.body === 'string' ? acorde.body : '';
    if (!cuerpo) continue;

    const copla: CoplaConAcorde = {
      slug: acorde.slug,
      pieza: acorde.data.pieza,
      agrupacion: acorde.data.agrupacion,
      year: String(acorde.data.year ?? ''),
      date: acorde.data.date ?? '',
      letraTitulo: acorde.data.letraTitulo,
    };

    for (const { entrada } of acordesDePieza(cuerpo, indice)) {
      const lista = mapa.get(entrada.slug);
      if (lista) {
        lista.push(copla);
      } else {
        mapa.set(entrada.slug, [copla]);
      }
    }
  }

  for (const lista of mapa.values()) {
    lista.sort(
      (a, b) =>
        Number(b.year) - Number(a.year) ||
        fecha(b.date) - fecha(a.date) ||
        a.agrupacion.localeCompare(b.agrupacion, 'es') ||
        a.slug.localeCompare(b.slug, 'es'),
    );
  }

  cache = mapa;
  return mapa;
}
