/**
 * Escapado de texto para HTML.
 *
 * Sirve tanto para texto entre etiquetas como para valores de atributo, así que
 * escapa también las comillas. Se usa desde el panel (`src/scripts/estudio.js`)
 * y lo prueba `npm run auditar:comentarios`.
 *
 * Ojo: en el panel el HTML se monta a base de strings (`innerHTML`), por eso
 * hace falta escapar. En la web pública los comentarios se construyen con
 * `textContent`/`dataset`, que no necesitan escapado (el navegador no parsea el
 * valor); no hay que volver a meter datos del worker en un `innerHTML`.
 *
 * @param {unknown} valor
 * @returns {string}
 */
export function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
