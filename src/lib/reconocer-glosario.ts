/**
 * Posturas exactas del glosario, indexadas por los trastes de las 6 cuerdas.
 *
 * El reconocedor (`src/lib/reconocer.ts`) no necesita este mapa: analiza las
 * notas de cualquier postura. El mapa solo sirve para dos cosas:
 *   1. Mantener el nombre que usa la web cuando la postura ya está en el
 *      glosario (por ejemplo, `Do6` en vez de `Lam/Do`).
 *   2. Enlazar a la página exacta del acorde dibujado.
 */

import { slugAcorde, type Glosario } from './acordes.ts';

export interface PosturaGlosario {
  etiqueta: string;
  slug: string;
}

/** Clave de una postura: los 6 trastes de la 6ª a la 1ª cuerda. */
export function clavePostura(trastes: number[]): string {
  return trastes.join(',');
}

export function mapaPosturas(glosario: Glosario): Map<string, PosturaGlosario> {
  const mapa = new Map<string, PosturaGlosario>();

  for (const [etiqueta, entrada] of Object.entries(glosario)) {
    const slug = slugAcorde(entrada);
    for (const posicion of entrada.posiciones) {
      const clave = clavePostura(posicion.trastes);
      if (!mapa.has(clave)) mapa.set(clave, { etiqueta, slug });
    }
  }

  return mapa;
}

export function posturaDe(
  trastes: number[],
  mapa: Map<string, PosturaGlosario>,
): PosturaGlosario | null {
  return mapa.get(clavePostura(trastes)) ?? null;
}
