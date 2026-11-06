// scripts/auditar-videos-fachada.mjs
//
// Comprueba que las fichas publicadas NO cargan el reproductor de YouTube en el
// HTML: en su lugar va la fachada (miniatura + play) que monta el iframe al
// pulsar. Se pasa DESPUÉS de `npm run build` (necesita dist/).
//
//   npm run auditar:fachada
//
// Falla si queda un iframe de YouTube, si una ficha con vídeo operativo no
// tiene su fachada con el id correcto, su miniatura y su enlace a YouTube, o si
// hay fachadas de más (un vídeo caído no debe pintarla).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const FICHAS = 'src/content/acordes';
const ESTADO_VIDEOS = 'src/data/videos-estado.json';

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

/** Valor de una clave del frontmatter (`video` o `cover`, sin comentarios). */
function campo(md, clave) {
  const m = md.match(new RegExp(`^${clave}:\\s*['"]?([^'"\\n]+)`, 'm'));
  return m ? m[1].trim() : '';
}

function idDe(url) {
  if (!url) return '';
  const m = String(url).match(/(?:embed\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

/** ¿Este HTML lleva un iframe del reproductor de YouTube? */
function tieneIframeYoutube(html) {
  return /<iframe[^>]+src=["'][^"']*(?:youtube\.com\/embed|youtube-nocookie\.com)/i.test(html);
}

function auditarFichas(estadoVideos) {
  const ficheros = readdirSync(FICHAS).filter((f) => f.endsWith('.md'));
  let revisadas = 0;
  let conFachada = 0;
  let paginas = 0;

  for (const fichero of ficheros) {
    const slug = fichero.replace(/\.md$/, '');
    const md = leer(path.join(FICHAS, fichero));
    const html = leer(path.join(DIST, 'acordes', slug, 'index.html'));

    if (!html) {
      error(`${slug}: no hay HTML en dist/acordes/${slug}/index.html`);
      continue;
    }
    revisadas++;

    if (tieneIframeYoutube(html)) {
      error(`${slug}: sigue habiendo un iframe de YouTube en el HTML`);
      continue;
    }

    // Vídeo principal: la fachada solo si está operativo. El cover no se audita
    // (`npm run videos` solo mira el `video:`), así que se asume ok.
    const idVideo = idDe(campo(md, 'video'));
    const videoOk = idVideo && estadoVideos[idVideo]?.estado === 'ok';
    const idCover = idDe(campo(md, 'cover'));

    const esperados = [videoOk ? idVideo : '', idCover].filter(Boolean);
    const facades = html.match(/data-fachada-video/g)?.length ?? 0;

    if (facades !== esperados.length) {
      error(`${slug}: ${facades} fachada(s) en el HTML y se esperaban ${esperados.length}`);
    }

    for (const id of esperados) {
      conFachada++;
      const piezas = [
        [`data-video-id=["']?${id}`, 'el id del vídeo'],
        [`https://i\\.ytimg\\.com/vi/${id}/mqdefault\\.jpg`, 'la miniatura'],
        [`href=["']?https://www\\.youtube\\.com/watch\\?v=${id}`, 'el enlace a YouTube'],
        [`data-iframe-src=["']?https://www\\.youtube-nocookie\\.com/embed/${id}`, 'la URL del reproductor'],
      ];
      for (const [patron, que] of piezas) {
        if (!new RegExp(patron).test(html)) error(`${slug}: falta ${que} (${id})`);
      }
    }

    if (idVideo && !videoOk) {
      if (!html.includes('Vídeo no disponible') && !html.includes('Vídeo en YouTube')) {
        aviso(`${slug}: vídeo ${idVideo} no operativo y sin bloque de estado`);
      }
    }
  }

  // Ninguna página pública debe llevar el reproductor en el HTML.
  for (const ruta of recorrerHtml(DIST)) {
    const html = leer(ruta);
    if (!tieneIframeYoutube(html)) continue;
    paginas++;
    error(`${path.relative(DIST, ruta)}: iframe de YouTube en el HTML`);
  }

  return { revisadas, conFachada, paginas };
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

function main() {
  if (!existsSync(DIST)) {
    console.error(`No existe ${DIST}/. Ejecuta antes: npm run build`);
    process.exitCode = 1;
    return;
  }

  const estadoVideos = JSON.parse(leer(ESTADO_VIDEOS) || '{"videos":{}}').videos || {};
  const { revisadas, conFachada, paginas } = auditarFichas(estadoVideos);

  console.log(`Fichas revisadas: ${revisadas} · fachadas esperadas: ${conFachada}`);
  console.log(`Páginas con iframe de YouTube: ${paginas}`);

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

  console.log('\nFachada de YouTube correcta.');
}

main();
