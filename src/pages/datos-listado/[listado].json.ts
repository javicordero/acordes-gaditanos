import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { contarCoplasAutores } from '../../lib/autores';
import {
  ordenarAcordesYear,
  ordenarAcordesAutor,
  parseSpanishDate,
  prioridadDeAgrupaciones,
  prioridadDeAutores,
  prioridadPorCoplas,
} from '../../lib/index';
import { prepararTarjeta } from '../../lib/tarjeta';

export const getStaticPaths: GetStaticPaths = async () => {
  const acordes = await getCollection('acordes');
  const years = [...new Set(acordes.map((acorde) => acorde.data.year))];
  const contarAutores = (tipo: 'musica' | 'letra') => {
    const totales = new Map<string, number>();
    acordes.forEach(({ data }) => {
      const nombres = tipo === 'musica' ? data.musicaList : data.letraList;
      const slugs = tipo === 'musica' ? data.musicaSlugs : data.letraSlugs;
      (nombres ?? []).forEach((_, i) => {
        const slug = slugs?.[i];
        if (slug) totales.set(slug, (totales.get(slug) ?? 0) + 1);
      });
    });
    return [...totales].filter(([, total]) => total > 24).map(([slug]) => slug);
  };
  const musica = contarAutores('musica');
  const letra = contarAutores('letra');
  return [
    { params: { listado: 'novedades' } },
    ...years.map((year) => ({ params: { listado: `carnaval-${year}` } })),
    ...[...musica].map((slug) => ({ params: { listado: `autor-musica-${slug}` } })),
    ...[...letra].map((slug) => ({ params: { listado: `autor-letra-${slug}` } })),
  ];
};

export const GET: APIRoute = async ({ params }) => {
  const acordes = await getCollection('acordes');
  let ordenados;
  if (params.listado === 'novedades') {
    ordenados = acordes.slice().sort(
      (a, b) => parseSpanishDate(b.data.date).getTime() - parseSpanishDate(a.data.date).getTime(),
    );
  } else if (params.listado!.startsWith('autor-')) {
    const musica = params.listado!.startsWith('autor-musica-');
    const slug = params.listado!.slice(musica ? 'autor-musica-'.length : 'autor-letra-'.length);
    const delAutor = acordes.flatMap((acorde) => {
      const nombres = musica ? acorde.data.musicaList : acorde.data.letraList;
      const slugs = musica ? acorde.data.musicaSlugs : acorde.data.letraSlugs;
      return (nombres ?? []).flatMap((_, i) => slugs?.[i] === slug ? [acorde] : []);
    });
    ordenados = ordenarAcordesAutor(delAutor);
  } else {
    const year = params.listado!.slice('carnaval-'.length);
    const delYear = acordes.filter((acorde) => acorde.data.year === year);
    const autores = await getCollection('autores');
    const prioridad = prioridadDeAgrupaciones(delYear, prioridadDeAutores(autores));
    const coplas = prioridadPorCoplas(acordes, contarCoplasAutores(acordes));
    ordenados = ordenarAcordesYear(delYear, prioridad, coplas);
  }
  const tarjetas = ordenados.slice(24).map(({ slug, data }) =>
    prepararTarjeta({ ...data, slug }),
  );
  return new Response(JSON.stringify(tarjetas), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
