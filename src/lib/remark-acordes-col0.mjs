/**
 * Plugin remark: marca con la clase `acorde-col0` los acordes que empiezan en la
 * columna 0 del bloque <pre> de los .md.
 *
 * El CSS de AcordeCard desplaza todos los acordes 7px a la derecha para
 * alinearlos con la letra; los que están en la columna 0 no deben desplazarse.
 * CSS no puede detectar la columna, así que la marca se resuelve en build.
 *
 * Solo actúa sobre nodos `html` (los <pre> son HTML crudo en el markdown) y solo
 * sobre `<a>` sin espacios delante, por lo que los acordes indentados no cambian.
 */
const CLASE = 'acorde-col0';

export default function remarkAcordesCol0() {
  return (tree) => {
    const recorrer = (nodo) => {
      if (nodo.type === 'html' && nodo.value.includes('<pre')) {
        nodo.value = nodo.value.replace(/^<a([^>]*)>/gm, (coincidencia, atributos) =>
          /(^|\s)class=/.test(atributos)
            ? coincidencia
            : `<a${atributos} class="${CLASE}">`,
        );
        return;
      }
      if (nodo.children) nodo.children.forEach(recorrer);
    };
    recorrer(tree);
  };
}
