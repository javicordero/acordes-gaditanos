import { getCollection } from 'astro:content';
import { contarCoplasAutores } from './autores';
import { construirHubs } from './hubs';
import { prioridadDeAgrupaciones, prioridadDeAutores, prioridadPorCoplas } from './orden';

/**
 * Carga el cancionero y devuelve los tres ejes de hubs ya ordenados como en
 * `/carnaval` y `/lista` (autores destacados → coplas → agrupación → tipo).
 */
export async function cargarHubs() {
  const acordes = await getCollection('acordes');
  const autores = await getCollection('autores');
  const prioridad = prioridadDeAgrupaciones(acordes, prioridadDeAutores(autores));
  const coplas = prioridadPorCoplas(acordes, contarCoplasAutores(acordes));
  return construirHubs(acordes, { prioridad, coplas });
}
