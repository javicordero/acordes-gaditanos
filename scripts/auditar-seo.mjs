// scripts/auditar-seo.mjs
//
// Comprueba lo que la web añade al SEO técnico:
//   1. `VideoObject` en las fichas cuyo vídeo está operativo (y del que la
//      auditoría conoce la fecha de subida).
//   2. `lastmod` real en el sitemap, sacado del frontmatter.
//
// Se pasa DESPUÉS de `npm run build` (necesita dist/).
//
//   npm run auditar:seo
//
// Sale con código 1 si algo no cuadra.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const FICHAS = 'src/content/acordes';
const ESTADO_VIDEOS = 'src/data/videos-estado.json';
const SITEMAP = path.join(DIST, 'sitemap-0.xml');

const errores = [];
const avisos = [];

function error(mensaje) {
  errores.push(mensaje);
}

function aviso(mensaje) {
  avisos.push(mensaje);
}

function leer(ruta) {
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    return '';
  }
}

/** Todos los objetos JSON-LD de una página, aplanados. */
function datosEstructurados(html) {
  const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const objetos = [];

  for (const [, texto] of bloques) {
    try {
      const datos = JSON.parse(texto);
      const lista = Array.isArray(datos) ? datos : [datos];
      for (const objeto of lista) {
        if (Array.isArray(objeto['@graph'])) objetos.push(...objeto['@graph']);
        else objetos.push(objeto);
      }
    } catch {
      error('JSON-LD que no parsea');
    }
  }

  return objetos;
}

function fechaDe(texto) {
  const m = texto.match(/^date:\s*['"]?(\d{2})[-/](\d{2})[-/](\d{4})/m);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function idVideoDe(texto) {
  const m = texto.match(/^video:\s*['"]?([^'"\n]+)/m);
  if (!m) return '';
  const id = m[1].match(/(?:embed\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return id ? id[1] : '';
}

function auditarFichas(estadoVideos) {
  const ficheros = readdirSync(FICHAS).filter((f) => f.endsWith('.md'));
  const sitemap = leer(SITEMAP);
  let revisadas = 0;
  let conVideo = 0;

  for (const fichero of ficheros) {
    const slug = fichero.replace(/\.md$/, '');
    // Dos slugs llevan tilde/ñ en el nombre del archivo: en las URLs van
    // codificados, así que se comparan codificados.
    const slugUrl = encodeURIComponent(slug);
    const md = leer(path.join(FICHAS, fichero));
    const html = leer(path.join(DIST, 'acordes', slug, 'index.html'));

    if (!html) {
      error(`${slug}: no hay HTML en dist/acordes/${slug}/index.html`);
      continue;
    }
    revisadas++;

    // VideoObject
    const idVideo = idVideoDe(md);
    const video = idVideo ? estadoVideos[idVideo] : null;
    const esperaVideo = Boolean(video && video.estado === 'ok' && video.fecha);

    if (esperaVideo) {
      conVideo++;
      const objetos = datosEstructurados(html);
      const videoObjeto = objetos.find((o) => o['@type'] === 'VideoObject');

      if (!videoObjeto) {
        error(`${slug}: vídeo operativo (${idVideo}) sin VideoObject`);
      } else if (
        !videoObjeto.name ||
        !videoObjeto.description ||
        !videoObjeto.thumbnailUrl ||
        !videoObjeto.uploadDate
      ) {
        error(`${slug}: VideoObject incompleto`);
      }
    }

    // lastmod del sitemap
    const iso = fechaDe(md);
    if (iso) {
      const bloque = sitemap.match(
        new RegExp(`<url>\\s*<loc>[^<]*/acordes/${slugUrl}/</loc>([\\s\\S]*?)</url>`),
      );
      if (!bloque) aviso(`${slug}: no aparece en el sitemap`);
      else if (!bloque[1].includes(`<lastmod>${iso}`)) {
        error(`${slug}: lastmod del sitemap distinto de ${iso}`);
      }
    }
  }

  return { revisadas, conVideo };
}

function auditarSitemap() {
  if (!existsSync(SITEMAP)) {
    error('No existe dist/sitemap-0.xml');
    return;
  }
  if (!leer(SITEMAP).includes('<lastmod>')) error('El sitemap no lleva ningún lastmod');
}

// Rutas que no entran en la comprobación de H1: privadas, borradores, listas
// internas, el buscador y los formateadores (ocultos por el middleware).
const RUTAS_SIN_H1 = [
  'admin',
  'estudio',
  'acordes2',
  'acordes3',
  'lista2',
  'formateadores',
  'buscar',
];

function esPaginaH1Publica(relativa, html) {
  const primera = relativa.split(path.sep)[0];
  if (RUTAS_SIN_H1.includes(primera)) return false;
  // Las páginas noindex quedan fuera del objetivo SEO (privadas, borradores...).
  if (/<meta\s+name=['"]robots['"][^>]*content=['"][^'"]*noindex/i.test(html)) return false;
  return true;
}

function recorrerHtml(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...recorrerHtml(ruta));
    else if (entrada.isFile() && entrada.name.endsWith('.html')) salida.push(ruta);
  }
  return salida;
}

function auditarH1() {
  let revisadas = 0;

  for (const fichero of recorrerHtml(DIST)) {
    const relativa = path.relative(DIST, fichero);
    const html = leer(fichero);
    if (!esPaginaH1Publica(relativa, html)) continue;
    revisadas++;

    const h1s = html.match(/<h1\b/gi)?.length ?? 0;
    if (h1s !== 1) error(`${relativa}: ${h1s} H1 (debe haber exactamente 1)`);

    if (/class=['"][^'"]*\bseo-(?:title|text)\b/i.test(html)) {
      error(`${relativa}: queda un bloque oculto .seo-title/.seo-text`);
    }
    if (/left:\s*-9999px/i.test(html)) {
      error(`${relativa}: queda texto oculto con left:-9999px`);
    }
  }

  return revisadas;
}

function main() {
  if (!existsSync(DIST)) {
    console.error(`No existe ${DIST}/. Ejecuta antes: npm run build`);
    process.exitCode = 1;
    return;
  }

  const estadoVideos = JSON.parse(leer(ESTADO_VIDEOS) || '{"videos":{}}').videos || {};

  const { revisadas, conVideo } = auditarFichas(estadoVideos);
  auditarSitemap();
  const paginasH1 = auditarH1();

  console.log(`Fichas revisadas: ${revisadas} · con VideoObject esperado: ${conVideo}`);
  console.log(`Páginas públicas revisadas de H1: ${paginasH1}`);

  if (avisos.length) {
    console.log(`\nAvisos (${avisos.length}):`);
    for (const mensaje of avisos.slice(0, 20)) console.log(`  ~ ${mensaje}`);
    if (avisos.length > 20) console.log(`  … y ${avisos.length - 20} más`);
  }

  if (errores.length) {
    console.error(`\nErrores (${errores.length}):`);
    for (const mensaje of errores.slice(0, 40)) console.error(`  ✗ ${mensaje}`);
    if (errores.length > 40) console.error(`  … y ${errores.length - 40} más`);
    process.exitCode = 1;
    return;
  }

  console.log('\nSEO técnico correcto.');
}

main();
