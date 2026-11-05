// Núcleo del editor de `<pre>`: desenvolver las etiquetas `<a>` para editar el
// bloque como texto y volver a envolverlas al guardar.
//
// Lo usan los dos lados:
//   - el revisor local (`scripts/revisar-acordes.mjs`), desde Node;
//   - el panel `/admin`, desde el navegador.
//
// El glosario se inyecta con `initPreAcordes(json)` para que este módulo no
// dependa de `fs` y pueda viajar al navegador.

import { parsearAcorde, crearIndice, buscarEnIndice } from './acordes.ts';

let INDICE = null;

/** Prepara el glosario (una vez por proceso o página). */
export function initPreAcordes(glosario) {
  INDICE = crearIndice(glosario?.acordes ?? glosario ?? {});
}

/** ¿La etiqueta es un acorde válido? */
export const esAcorde = (t) => parsearAcorde(t) !== null;

/** ¿Tiene diagrama en el glosario? */
export const tieneDiagrama = (t) => (INDICE ? buscarEnIndice(INDICE, t) !== null : false);

/** Anotaciones tipo «(Sorda)» que van en la línea de acordes sin ser acordes. */
export const esAnotacion = (t) => /^\(.*\)$/.test(t);

/** Ancho previsto del bloque `<pre>`: las columnas 1-55 caben, la 56 se marca. */
export const ANCHO_MAX = 55;

/** Columnas visuales de una línea (tabulador = 4, sin contar espacios finales). */
export function columnasLinea(linea) {
  const limpia = String(linea).replace(/\s+$/, '');
  let col = 0;
  for (let i = 0; i < limpia.length; i++) {
    col += limpia[i] === '\t' ? 4 - (col % 4) : 1;
  }
  return col;
}

/**
 * Índice del carácter donde empieza lo que pasa de `max` columnas, o -1 si la
 * línea cabe. Los espacios finales no cuentan (no ensucian el ancho del `<pre>`).
 */
export function cortePorAncho(linea, max = ANCHO_MAX) {
  const limpia = String(linea).replace(/\s+$/, '');
  let col = 0;
  for (let i = 0; i < limpia.length; i++) {
    const salto = limpia[i] === '\t' ? 4 - (col % 4) : 1;
    if (col + salto > max) return i;
    col += salto;
  }
  return -1;
}

const RE_ETIQUETA = /<a([^>]*)>([\s\S]*?)<\/a>/g;

/**
 * Del `.md` al texto del editor. Sustituye cada `<a …>X</a>` por `X` sin tocar
 * los espacios, así las columnas quedan exactamente iguales.
 */
export function desenvolver(md) {
  const limpio = String(md).replace(/\r\n/g, '\n');
  const m = limpio.match(/^([\s\S]*?)<pre>\n?([\s\S]*?)<\/pre\s*>/);
  if (!m) throw new Error('no encuentro <pre>');
  const frontmatter = m[1];
  const cuerpo = m[2].replace(/\n+$/, '');
  const lineas = cuerpo === '' ? [] : cuerpo.split('\n');

  const registros = lineas.map((linea) => {
    const out = [];
    let mm;
    RE_ETIQUETA.lastIndex = 0;
    while ((mm = RE_ETIQUETA.exec(linea))) out.push({ etiqueta: mm[2].trim(), abre: `<a${mm[1]}>` });
    return out;
  });
  const texto = lineas.map((linea) => linea.replace(RE_ETIQUETA, (_, _attrs, etiqueta) => etiqueta));

  return {
    frontmatter,
    texto: texto.join('\n'),
    registros,
    originales: lineas,
    habiaEtiquetas: /<a[\s>]/.test(cuerpo),
  };
}

/** Tipo de línea. `conocidos` son las etiquetas que ya venían en la ficha. */
export function clasificar(linea, siguiente = '', conocidos = new Set()) {
  const crudo = linea.replace(/\s+$/, '');
  if (crudo.trim() === '') return { tipo: 'blanco' };
  if (/^<strong>[\s\S]*<\/strong>$/.test(crudo.trim())) return { tipo: 'meta' };
  const tokens = crudo.trim().split(/\s+/);
  const validos = tokens.filter((t) => esAcorde(t) || esAnotacion(t) || conocidos.has(t));
  // Una línea con solo anotaciones («(Sorda)», «(Pito)»…) es de acordes: van
  // encima de su verso y se envuelven como un acorde más al guardar.
  const soloAnotaciones = tokens.every((t) => esAnotacion(t));
  if (validos.length === tokens.length && (tokens.some((t) => esAcorde(t) || conocidos.has(t)) || soloAnotaciones)) {
    return { tipo: 'acordes', tokens };
  }
  const acordes = tokens.filter((t) => esAcorde(t));
  const ratio = acordes.length / tokens.length;
  const s = siguiente.trim();
  if (acordes.length >= 1 && ratio >= 0.6 && s !== '' && !/^<strong>/.test(s)) {
    return { tipo: 'acordes-sucio', tokens };
  }
  return { tipo: 'letra' };
}

/**
 * Del texto del editor al `<pre>` con etiquetas.
 * Lanza un error con línea y columna si hay un token que no es un acorde.
 */
export function envolver(texto, registros = [], originales = []) {
  const lineas = String(texto).replace(/\r\n/g, '\n').split('\n');
  const usados = new Map();
  const salida = [];
  const avisos = [];
  const conocidos = new Set(registros.flat().map((r) => r.etiqueta));
  const desenvuelto = (linea) => linea.replace(RE_ETIQUETA, (_, _a, etiqueta) => etiqueta);
  let acordes = 0;

  lineas.forEach((linea, i) => {
    const sig = lineas[i + 1] ?? '';
    const c = clasificar(linea, sig, conocidos);
    // Una anotación sin envolver («(Sorda)» suelta) no se copia tal cual: se
    // envuelve aunque la línea no haya cambiado, para que salga en azul en la web.
    const conAnotacion = linea.split(/\s+/).some((t) => t && esAnotacion(t));

    // Línea sin tocar: se copia la original tal cual. Así una ficha con etiquetas
    // raras («La7 Re», «(Sorda )») sale idéntica y el editor no la estropea.
    const original = originales[i];
    if (!conAnotacion && original !== undefined && desenvuelto(original) === linea) {
      salida.push(original);
      for (const mm of original.matchAll(RE_ETIQUETA)) {
        if (esAcorde(mm[2].trim()) || conocidos.has(mm[2].trim())) acordes++;
      }
      return;
    }

    if (c.tipo === 'blanco' || c.tipo === 'meta' || c.tipo === 'letra') {
      salida.push(linea);
      return;
    }

    const regex = /\S+/g;
    let out = '';
    let ultimo = 0;
    let mm;
    while ((mm = regex.exec(linea))) {
      out += linea.slice(ultimo, mm.index);
      const token = mm[0];
      if (!esAcorde(token)) {
        if (esAnotacion(token)) {
          // «(Sorda)» y similares no son acordes, pero van en la línea de
          // acordes. Si ya venían envueltas se conserva su etiqueta (y su
          // postura); si no, se envuelven como cualquier acorde nuevo.
          const deLinea = registros[i] || [];
          const gastados = usados.get(`${i}|${token}`) || 0;
          const elegido = deLinea.filter((r) => r.etiqueta === token)[gastados] || null;
          if (elegido) {
            usados.set(`${i}|${token}`, gastados + 1);
            out += `${elegido.abre}</a>`.replace('</a>', `${token}</a>`);
          } else {
            out += `<a>${token}</a>`;
          }
        } else if (c.tipo === 'acordes') {
          throw new Error(`línea ${i + 1}, columna ${mm.index + 1}: «${token}» no es un acorde`);
        } else {
          throw new Error(`línea ${i + 1}, columna ${mm.index + 1}: «${token}» parece un acorde pero no lo es`);
        }
        ultimo = mm.index + token.length;
        continue;
      }

      const deLinea = registros[i] || [];
      const gastados = usados.get(`${i}|${token}`) || 0;
      const candidatos = deLinea.filter((r) => r.etiqueta === token);
      let elegido = candidatos[gastados] || null;
      if (elegido) {
        usados.set(`${i}|${token}`, gastados + 1);
      } else {
        const planos = registros.flat().filter((r) => r.etiqueta === token);
        if (planos.length === 1) elegido = planos[0];
        else if (planos.length > 1) avisos.push(`línea ${i + 1}: «${token}» aparece varias veces; se pone sin postura`);
      }
      out += `${elegido?.abre || '<a>'}</a>`.replace('</a>', `${token}</a>`);
      acordes++;
      ultimo = mm.index + token.length;
    }
    out += linea.slice(ultimo);
    salida.push(out);
  });

  while (salida.length && salida[salida.length - 1] === '') salida.pop();
  return { pre: salida.join('\n'), acordes, avisos };
}

/** Reconstruye el `.md` completo sin tocar el frontmatter. */
export function montarMd(frontmatter, pre) {
  return `${frontmatter}<pre>\n${pre}\n</pre>\n`;
}

/** Avisos de una edición comparada con el texto original. */
export function revisar(texto, originalTexto = '') {
  const avisos = [];
  const errores = [];
  let acordes = 0;
  const sinDiagrama = new Set();

  const lineas = String(texto).replace(/\r\n/g, '\n').split('\n');
  lineas.forEach((linea, i) => {
    const sig = lineas[i + 1] ?? '';
    const c = clasificar(linea, sig);
    if (c.tipo !== 'acordes' && c.tipo !== 'acordes-sucio') return;
    for (const t of c.tokens) {
      if (esAnotacion(t)) continue;
      if (!esAcorde(t)) { errores.push(`línea ${i + 1}: «${t}» no es un acorde`); continue; }
      acordes++;
      if (!tieneDiagrama(t)) sinDiagrama.add(t);
    }
  });

  if (originalTexto) {
    const antes = contarAcordes(originalTexto);
    if (acordes < antes) avisos.push(`se han perdido ${antes - acordes} acorde(s) respecto al original`);
    if (acordes > antes) avisos.push(`hay ${acordes - antes} acorde(s) más que en el original`);
  }
  if (sinDiagrama.size) avisos.push(`sin diagrama en el glosario: ${[...sinDiagrama].join(', ')}`);

  return { avisos, errores, acordes, sinDiagrama: [...sinDiagrama] };
}

export function contarAcordes(texto) {
  let n = 0;
  for (const linea of String(texto).split('\n')) {
    if (clasificar(linea).tipo === 'acordes') n += linea.trim().split(/\s+/).filter(esAcorde).length;
  }
  return n;
}
