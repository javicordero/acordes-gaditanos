// src/pages/indice-tarjetas.json.ts
//
// Catálogo que usa /buscar para pintar las cards en el navegador, en vez de
// traerlas todas renderizadas en el HTML (eran 3,8 MB). Se genera en el build
// con la misma lógica que `Card.astro` (`prepararTarjeta`) y en el mismo orden
// en que se pintaban los resultados: año ↓ y fecha ↓.
//
// El `Cache-Control` está en `public/_headers`.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { parseSpanishDate, sortByYearDesc } from '../lib/index';
import { prepararTarjeta, type CatalogoTarjeta } from '../lib/tarjeta';

export const GET: APIRoute = async () => {
  const acordes = await getCollection('acordes');

  const entradas: CatalogoTarjeta[] = acordes
    .slice()
    .sort((a, b) => {
      if (a.data.year !== b.data.year) return sortByYearDesc(a.data.year, b.data.year);
      return parseSpanishDate(b.data.date).getTime() - parseSpanishDate(a.data.date).getTime();
    })
    .map((acorde) => ({
      ...prepararTarjeta({
        slug: acorde.slug,
        agrupacion: acorde.data.agrupacion,
        pieza: acorde.data.pieza,
        year: acorde.data.year,
        img: acorde.data.img,
        letraTitulo: acorde.data.letraTitulo,
        musica: acorde.data.musica,
        letra: acorde.data.letra,
        musicaList: acorde.data.musicaList,
        letraList: acorde.data.letraList,
        musicaSlugs: acorde.data.musicaSlugs,
        letraSlugs: acorde.data.letraSlugs,
        musicaSlug: acorde.data.musicaSlug,
        letraSlug: acorde.data.letraSlug,
      }),
      musica: acorde.data.musica || '',
      letra: acorde.data.letra || '',
    }));

  return new Response(JSON.stringify(entradas), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
