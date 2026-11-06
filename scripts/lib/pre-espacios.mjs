// Análisis y limpieza de los espacios que quedan al final de línea dentro de un
// bloque <pre> de una ficha de acordes.
//
// Esos espacios son literales en HTML y no se ven, pero cuentan: `AnchoPreInit`
// mide el `scrollWidth` del <pre> para decidir cuánto encoge la letra, así que
// una cola invisible puede hacer que toda la copla se pinte más pequeña; y el
// editor del panel la cuenta en el límite de 55 columnas. También ensucian el
// diff.
//
// Solo se toca el interior de <pre>…</pre>: la indentación inicial (la
// alineación de los acordes), el frontmatter y el resto del .md quedan intactos.

const COLA = /[ \t]+$/;
const ABRE = /<pre\b/i;
const CIERRA = /<\/pre>/i;

/**
 * Busca las líneas del `<pre>` que acaban en espacios o tabuladores.
 *
 * @param {string} texto contenido completo del .md
 * @returns {{ lineas: Array<{ n: number, cola: number, texto: string }>, total: number, archivo: string }}
 */
export function analizarPre(texto) {
  const lineas = [];
  const filas = String(texto ?? '').split(/\r?\n/);
  let dentro = false;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const cola = (COLA.exec(fila) || [''])[0].length;

    // La línea que abre el <pre> también puede acabar en espacios: forman parte
    // de su contenido (p. ej. `<pre>      `).
    if ((dentro || ABRE.test(fila)) && cola) {
      lineas.push({ n: i + 1, cola, texto: fila.slice(0, -cola) });
    }

    // El estado se actualiza después de mirar la línea, para no tocar lo que
    // queda fuera del bloque.
    if (!dentro && ABRE.test(fila)) dentro = true;
    if (dentro && CIERRA.test(fila)) dentro = false;
  }

  return { lineas, total: lineas.length };
}

/**
 * Quita los espacios y tabuladores al final de cada línea del `<pre>`.
 *
 * @param {string} texto contenido completo del .md
 * @returns {{ texto: string, lineas: Array<{ n: number, cola: number, texto: string }>, total: number }}
 */
export function limpiarPre(texto) {
  const original = String(texto ?? '');
  const { lineas } = analizarPre(original);
  if (!lineas.length) return { texto: original, lineas, total: 0 };

  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const filas = original.split(/\r?\n/);
  for (const { n } of lineas) filas[n - 1] = filas[n - 1].replace(COLA, '');

  return { texto: filas.join(eol), lineas, total: lineas.length };
}
