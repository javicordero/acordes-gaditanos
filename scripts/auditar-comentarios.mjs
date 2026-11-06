// Red de seguridad del XSS almacenado en los comentarios.
//
// Comprueba dos cosas que se rompieron juntas:
//
//   1. `escaparHtml()` (src/lib/escape.js) escapa también las comillas, así que
//      sirve tanto para texto entre etiquetas como para valores de atributo.
//      Se usa en el panel (`src/scripts/estudio.js`).
//   2. El componente público (`CommentsSection.astro`) no mete datos del
//      worker dentro de un `innerHTML`: los comentarios se crean con
//      `textContent`/`dataset`, que el navegador no parsea. Aquí se vigila que
//      nadie vuelva a interpolar `${…}` en un `innerHTML` ni a escapar a mano.
//
// Uso: npm run auditar:comentarios

import { readFileSync } from 'node:fs';
import { escaparHtml } from '../src/lib/escape.js';

let errores = 0;
let comprobaciones = 0;

function comprobar(nombre, condicion, detalle = '') {
  comprobaciones++;
  if (condicion) return;
  console.error(`✗ ${nombre}${detalle ? `: ${detalle}` : ''}`);
  errores++;
}

/** Deshace el escapado para comprobar que el texto vuelve a ser el original. */
function desescapar(texto) {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// 1. El escapador
// ---------------------------------------------------------------------------

const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '</span><script>alert(1)</script>',
  '" onmouseover="alert(1)',
  "' onfocus='alert(1)",
  '"><script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
  'O\'Brien',
  'Ana & Luis <3',
  'a < b && c > d',
  '<'.repeat(500),
  '',
];

for (const payload of PAYLOADS) {
  const salida = escaparHtml(payload);
  comprobar(
    'escaparHtml deja marcas crudas',
    !/[<>"']/.test(salida),
    `${JSON.stringify(payload)} → ${JSON.stringify(salida)}`,
  );
  comprobar(
    'escaparHtml no se puede deshacer',
    desescapar(salida) === payload,
    `${JSON.stringify(salida)} → ${JSON.stringify(desescapar(salida))}`,
  );
}

comprobar(
  'escaparHtml escapa los cinco caracteres',
  escaparHtml('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;',
  escaparHtml('&<>"\''),
);
comprobar('escaparHtml tolera null', escaparHtml(null) === '');
comprobar('escaparHtml tolera undefined', escaparHtml(undefined) === '');

// ---------------------------------------------------------------------------
// 2. El componente público: nada de datos dentro de un innerHTML
// ---------------------------------------------------------------------------

const COMPONENTE = 'src/components/comments/CommentsSection.astro';
const componente = readFileSync(COMPONENTE, 'utf8');

// Un `innerHTML` con `${…}` es exactamente el fallo que se corrigió: el
// navegador parsea el nombre del autor y lo ejecuta. `innerHTML = ''` para
// vaciar la lista sí está permitido.
for (const coincidencia of componente.matchAll(/innerHTML\s*=\s*`([^`]*)`/gs)) {
  comprobar(
    `${COMPONENTE}: innerHTML con datos interpolados`,
    !coincidencia[1].includes('${'),
    coincidencia[1].trim().slice(0, 80),
  );
}

comprobar(
  `${COMPONENTE}: vuelve a escapar a mano`,
  !/escapeHtml\s*\(/.test(componente),
  'el nombre y el contenido van con textContent/dataset',
);

comprobar(
  `${COMPONENTE}: el nombre del autor no pasa por textContent`,
  /autor\.appendChild\(document\.createTextNode\(displayName\)\)/.test(componente),
);

// ---------------------------------------------------------------------------
// 3. El panel usa el escapador compartido
// ---------------------------------------------------------------------------

const PANEL = 'src/scripts/estudio.js';
const panel = readFileSync(PANEL, 'utf8');

comprobar(
  `${PANEL}: no importa el escapador compartido`,
  /import\s*{\s*escaparHtml\s*}\s*from\s*'\.\.\/lib\/escape\.js'/.test(panel),
);
comprobar(
  `${PANEL}: sigue con un escapador propio`,
  !/const esc\s*=\s*\(/.test(panel),
  'hay que usar escaparHtml()',
);

if (errores) {
  console.error(`\n✗ ${errores} de ${comprobaciones} comprobaciones han fallado.`);
  process.exit(1);
}

console.log(`✓ ${comprobaciones} comprobaciones de escapado de comentarios.`);
