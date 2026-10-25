// src/pages/indice-busqueda.json.ts
//
// Índice ligero para el desplegable de sugerencias del header. Se genera en el
// build como /indice-busqueda.json (~74 KB crudos, ~10 KB comprimido) y el
// navegador solo lo descarga cuando el usuario abre el buscador.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { EntradaIndice } from '../lib/busqueda';

export const GET: APIRoute = async () => {
  const acordes = await getCollection('acordes');

  const entradas: EntradaIndice[] = acordes
    .map((acorde) => ({
      slug: acorde.slug,
      agrupacion: acorde.data.agrupacion,
      pieza: acorde.data.pieza,
      year: acorde.data.year,
      musica: acorde.data.musica || '',
      letra: acorde.data.letra || '',
    }))
    .sort(
      (a, b) =>
        Number(b.year) - Number(a.year) || a.agrupacion.localeCompare(b.agrupacion, 'es'),
    );

  return new Response(JSON.stringify(entradas), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
