/**
 * Plugin remark: marca cada acorde del <pre> con una clase según la columna en la
 * que empieza, para que el CSS le aplique un desplazamiento proporcional.
 *
 * El CSS de AcordeCard desplaza los acordes a la derecha para alinearlos con la
 * sílaba de la letra; cuanto más a la izquierda está el acorde, menos falta le
 * hace el empujón. CSS no puede saber la columna, así que se resuelve en build.
 *
 * La columna es la **visible** en el <pre>: los `<a>` y el resto de etiquetas no
 * ocupan sitio, así que en `<a>Sol</a>    <a>Do</a>` el `Do` está en la columna 7,
 * no en la 14. Se recorre el HTML completo (no línea a línea) para que las
 * etiquetas partidas en varias líneas, como el `<pre` de algún archivo, no
 * descoloquen la cuenta.
 *
 * Solo actúa sobre nodos `html` (los <pre> son HTML crudo en el markdown).
 */

/** [columna mínima, columna máxima, clase] */
const TRAMOS = [
  [0, 0, 'acorde-col-0'],
  [1, 10, 'acorde-col-1'],
  [11, 20, 'acorde-col-2'],
  [21, 30, 'acorde-col-3'],
  [31, 45, 'acorde-col-4'],
  [46, Infinity, 'acorde-col-5'],
];

/** Etiquetas de apertura o cierre, o texto suelto entre ellas. */
const TOKEN = /<[^>]*>|[^<]+/g;

function claseDe(columna) {
  const tramo = TRAMOS.find(([min, max]) => columna >= min && columna <= max);
  return (tramo ?? TRAMOS[TRAMOS.length - 1])[2];
}

/** Longitud visible de un texto: cada entidad HTML cuenta como un carácter. */
function longitudVisible(texto) {
  return texto.replace(/&[a-zA-Z#0-9]+;/g, '_').length;
}

/** Columna visible al final de un texto, teniendo en cuenta sus saltos de línea. */
function avanzarColumna(columna, texto) {
  const ultimoSalto = texto.lastIndexOf('\n');
  if (ultimoSalto !== -1) return longitudVisible(texto.slice(ultimoSalto + 1));
  return columna + longitudVisible(texto);
}

/** Añade la clase de columna a cada `<a>` del HTML del <pre>. */
function marcarHtml(html) {
  let columna = 0;
  let salida = '';
  let fin = 0;

  for (const coincidencia of html.matchAll(TOKEN)) {
    const token = coincidencia[0];
    salida += html.slice(fin, coincidencia.index);
    fin = coincidencia.index + token.length;

    if (token.startsWith('<')) {
      const esAcorde = /^<a(?=[\s>])/.test(token);
      if (esAcorde && !/(^|\s)class=/.test(token)) {
        salida += `<a class="${claseDe(columna)}"${token.slice(2, -1)}>`;
      } else {
        salida += token;
      }
      continue;
    }

    salida += token;
    columna = avanzarColumna(columna, token);
  }

  return salida + html.slice(fin);
}

export default function remarkAcordesColumna() {
  return (tree) => {
    const recorrer = (nodo) => {
      if (nodo.type === 'html' && nodo.value.includes('<pre')) {
        nodo.value = marcarHtml(nodo.value);
        return;
      }
      if (nodo.children) nodo.children.forEach(recorrer);
    };
    recorrer(tree);
  };
}
