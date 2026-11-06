// Fechas de modificación para el sitemap.
//
// @astrojs/sitemap no sabe nada del contenido: si no se le dice lo contrario,
// escribe el `lastmod` del build (o ninguno). Aquí se lee el frontmatter de las
// fichas para dar a cada URL la fecha real de alta/corrección.
//
// Se lee con una expresión regular a propósito: este módulo lo carga
// astro.config.mjs antes de que existan las content collections, así que no
// puede usar `getCollection` ni el parseo de Astro. Solo se llama en el build
// (dentro de `serialize`), no en `astro dev`.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIR_FICHAS = 'src/content/acordes';

function aFecha(texto) {
  const partes = String(texto || '').split(/[/-]/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [dia, mes, anio] = partes;
  if (!anio || !mes || !dia) return null;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * Mapa ruta → fecha para el `lastmod` del sitemap:
 *   /acordes/<slug>/   fecha del frontmatter de la ficha
 *   /, /novedades/     la ficha más reciente
 *   /carnaval/<año>/   la ficha más reciente de ese año
 */
export function fechasSitemap() {
  const fechas = new Map();
  let ultimaGlobal = 0;
  const ultimaPorAnio = new Map();

  let ficheros = [];
  try {
    ficheros = readdirSync(DIR_FICHAS).filter((f) => f.endsWith('.md'));
  } catch {
    return fechas;
  }

  for (const fichero of ficheros) {
    const slug = fichero.replace(/\.md$/, '');
    let texto = '';
    try {
      texto = readFileSync(path.join(DIR_FICHAS, fichero), 'utf8');
    } catch {
      continue;
    }

    const coincidencia = texto.match(/^date:\s*['"]?(\d{2}[-/]\d{2}[-/]\d{4})/m);
    const fecha = coincidencia ? aFecha(coincidencia[1]) : null;
    if (!fecha) continue;

    fechas.set(`/acordes/${encodeURIComponent(slug)}/`, fecha);

    const marca = fecha.getTime();
    if (marca > ultimaGlobal) ultimaGlobal = marca;

    const anio = (texto.match(/^year:\s*(\d{4})/m) || [])[1];
    if (anio) {
      const anterior = ultimaPorAnio.get(anio) || 0;
      if (marca > anterior) ultimaPorAnio.set(anio, marca);
    }
  }

  if (ultimaGlobal) {
    const fecha = new Date(ultimaGlobal);
    fechas.set('/', fecha);
    fechas.set('/novedades/', fecha);
  }

  for (const [anio, marca] of ultimaPorAnio) {
    fechas.set(`/carnaval/${anio}/`, new Date(marca));
  }

  return fechas;
}
