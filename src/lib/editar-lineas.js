// Operaciones de estructura del editor de coplas: separar una línea de letra
// en dos (creando su línea de acordes) y juntar la parte izquierda del cursor
// con el verso anterior. Trabajan sobre las tres capas del editor:
//
//   - `lineas`:     texto plano, sin etiquetas (lo que se ve en el textarea)
//   - `registros`:  por línea, [{ etiqueta, abre }] para conservar data-postura
//   - `originales`: por línea, el texto con etiquetas
//
// Devuelven copias nuevas (no mutan las entradas) y la posición del cursor.
// Son puras: no tocan el DOM, así se pueden probar desde Node.

import { clasificar } from './pre-acordes.js';

const tokensDe = (linea) => [...String(linea).matchAll(/\S+/g)]
  .map((m) => ({ token: m[0], col: m.index }));

/** Coloca los tokens en sus columnas. Si dos chocan, se separan un espacio. */
function lineaDe(tokens) {
  let out = '';
  for (const t of tokens) {
    if (t.col > out.length) out += ' '.repeat(t.col - out.length);
    else if (t.col < out.length) out += ' ';
    out += t.token;
  }
  return out;
}

/** Asocia a cada token su etiqueta de apertura (con data-postura si la tenía). */
function conEtiquetas(tokens, registros) {
  const usados = new Map();
  return tokens.map((t) => {
    const n = usados.get(t.token) || 0;
    const r = (registros || []).filter((x) => x.etiqueta === t.token)[n] || null;
    usados.set(t.token, n + 1);
    return { ...t, abre: r ? r.abre : null };
  });
}

/** Reconstruye la línea con etiquetas, conservando la postura de cada acorde. */
function originalDe(tokens) {
  let out = '';
  for (const t of tokens) {
    if (t.col > out.length) out += ' '.repeat(t.col - out.length);
    else if (t.col < out.length) out += ' ';
    out += t.abre ? `${t.abre}</a>`.replace('</a>', `${t.token}</a>`) : t.token;
  }
  return out;
}

const registrosDe = (tokens) => tokens
  .filter((t) => t.abre)
  .map((t) => ({ etiqueta: t.token, abre: t.abre }));

const tipoDe = (lineas, i, conocidos) => clasificar(lineas[i] || '', lineas[i + 1] || '', conocidos).tipo;

/**
 * Inicio y fin de la palabra que contiene la columna `col`. Devuelve null si
 * el cursor está en un espacio (ahí no hay palabra que mover).
 */
export function palabraBajoCursor(linea, col) {
  if (!linea) return null;
  const c = Math.max(0, Math.min(col, linea.length));
  if (c >= linea.length || /\s/.test(linea[c])) return null;
  let ini = c;
  while (ini > 0 && !/\s/.test(linea[ini - 1])) ini--;
  let fin = c;
  while (fin < linea.length && !/\s/.test(linea[fin])) fin++;
  return ini === fin ? null : { ini, fin };
}

/**
 * Separa la línea de letra `i` en la columna `col`.
 *
 * La parte izquierda se queda donde está (con los acordes que empiezan antes
 * de `col`); la derecha baja a una línea nueva y se lleva los acordes que
 * empiezan en `col` o después, restándoles `col` para que queden sobre su
 * sílaba. La línea de acordes de la parte que baja se inserta justo encima.
 */
export function separarLetra({ lineas, registros, originales, conocidos, i, col }) {
  if (tipoDe(lineas, i, conocidos) !== 'letra') {
    return { error: 'Pon el cursor en una línea de letra.' };
  }
  const linea = lineas[i];
  const p = Math.max(0, Math.min(col, linea.length));
  if (p === 0 || p === linea.length) {
    return { error: 'Coloca el cursor dentro de la línea, no en un extremo.' };
  }

  const izq = linea.slice(0, p).replace(/\s+$/, '');
  const der = linea.slice(p);
  if (!izq || !der.trim()) {
    return { error: 'El corte deja una parte vacía.' };
  }
  const hay = i > 0 && tipoDe(lineas, i - 1, conocidos) === 'acordes';
  const cTokens = hay ? conEtiquetas(tokensDe(lineas[i - 1]), registros[i - 1]) : [];
  const quedan = cTokens.filter((t) => t.col < p);
  const bajan = cTokens.filter((t) => t.col >= p).map((t) => ({ ...t, col: t.col - p }));

  const nuevas = [...lineas];
  const nuevosRegs = [...registros];
  const nuevosOrig = [...originales];
  nuevas[i] = izq;
  nuevosRegs[i] = [];
  nuevosOrig[i] = izq;

  if (hay) {
    nuevas[i - 1] = lineaDe(quedan);
    nuevosRegs[i - 1] = registrosDe(quedan);
    nuevosOrig[i - 1] = originalDe(quedan);
  }

  // Solo se crea línea de acordes si había acordes arriba o bajan algunos.
  const conAcordes = hay || bajan.length > 0;
  const inserta = conAcordes ? [lineaDe(bajan), der] : [der];
  const insertaRegs = conAcordes ? [registrosDe(bajan), []] : [[]];
  const insertaOrig = conAcordes ? [originalDe(bajan), der] : [der];
  nuevas.splice(i + 1, 0, ...inserta);
  nuevosRegs.splice(i + 1, 0, ...insertaRegs);
  nuevosOrig.splice(i + 1, 0, ...insertaOrig);

  return {
    lineas: nuevas,
    registros: nuevosRegs,
    originales: nuevosOrig,
    cursor: { linea: i + inserta.length, col: 0 },
  };
}

/**
 * Junta con el verso anterior la parte de la línea `i` que queda a la
 * izquierda del cursor. Si el cursor está en la columna 0, se junta la línea
 * entera (así el botón deshace un separado). La parte derecha se queda en la
 * línea actual; si no queda nada, la línea desaparece.
 */
export function juntarLetra({ lineas, registros, originales, conocidos, i, col }) {
  if (tipoDe(lineas, i, conocidos) !== 'letra') {
    return { error: 'Pon el cursor en una línea de letra.' };
  }
  const linea = lineas[i];
  if (linea.trim() === '') return { error: 'La línea está vacía.' };

  const cActual = i > 0 && tipoDe(lineas, i - 1, conocidos) === 'acordes' ? i - 1 : -1;
  let prev = cActual >= 0 ? cActual - 1 : i - 1;
  while (prev >= 0 && tipoDe(lineas, prev, conocidos) === 'blanco') prev--;
  if (prev < 0 || tipoDe(lineas, prev, conocidos) !== 'letra') {
    return { error: 'No hay un verso de letra justo encima.' };
  }
  const cPrev = prev > 0 && tipoDe(lineas, prev - 1, conocidos) === 'acordes' ? prev - 1 : -1;

  const p = Math.max(0, Math.min(col, linea.length));
  let todo = p === 0;
  let izq = (todo ? linea : linea.slice(0, p)).replace(/\s+$/, '');
  if (!izq) { todo = true; izq = linea.trimEnd(); }
  let der = todo ? '' : linea.slice(p);
  // El espacio que separaba la parte que sube de la que se queda no debe
  // quedar como sangría en la línea de abajo.
  let recorte = 0;
  if (!todo) {
    recorte = der.length - der.trimStart().length;
    der = der.slice(recorte);
  }

  const P = lineas[prev].replace(/\s+$/, '');
  const sep = P && izq ? ' ' : '';
  const nuevaP = P + sep + izq;
  const joinCol = P.length + sep.length;

  const actualTokens = cActual >= 0 ? conEtiquetas(tokensDe(lineas[cActual]), registros[cActual]) : [];
  const suben = actualTokens
    .filter((t) => todo || t.col < p)
    .map((t) => ({ ...t, col: t.col + joinCol }));
  const quedan = todo
    ? []
    : actualTokens.filter((t) => t.col >= p).map((t) => ({ ...t, col: t.col - p - recorte }));

  const nuevas = [...lineas];
  const nuevosRegs = [...registros];
  const nuevosOrig = [...originales];

  let prevFinal = prev;
  let cPrevFinal = cPrev;
  let cActualFinal = cActual;
  let iFinal = i;

  // Si el verso anterior no tenía línea de acordes y hay acordes que suben,
  // se crea justo encima. Eso desplaza los índices posteriores.
  if (cPrev < 0 && suben.length) {
    nuevas.splice(prev, 0, lineaDe(suben));
    nuevosRegs.splice(prev, 0, registrosDe(suben));
    nuevosOrig.splice(prev, 0, originalDe(suben));
    prevFinal = prev + 1;
    cPrevFinal = prev;
    cActualFinal = cActual >= 0 ? cActual + 1 : -1;
    iFinal = i + 1;
    suben.length = 0;
  }

  // Letra del verso anterior.
  nuevas[prevFinal] = nuevaP;
  nuevosRegs[prevFinal] = [];
  nuevosOrig[prevFinal] = nuevaP;

  // Acordes que suben, mezclados con los que ya tenía el verso anterior.
  if (suben.length) {
    const base = cPrevFinal >= 0 ? conEtiquetas(tokensDe(nuevas[cPrevFinal]), nuevosRegs[cPrevFinal]) : [];
    const todos = [...base, ...suben].sort((a, b) => a.col - b.col);
    if (cPrevFinal >= 0) {
      nuevas[cPrevFinal] = lineaDe(todos);
      nuevosRegs[cPrevFinal] = registrosDe(todos);
      nuevosOrig[cPrevFinal] = originalDe(todos);
    }
  }

  if (der === '') {
    // Se quitan la letra actual y su línea de acordes.
    if (cActualFinal >= 0) {
      nuevas.splice(cActualFinal, 1);
      nuevosRegs.splice(cActualFinal, 1);
      nuevosOrig.splice(cActualFinal, 1);
      if (iFinal > cActualFinal) iFinal--;
    }
    nuevas.splice(iFinal, 1);
    nuevosRegs.splice(iFinal, 1);
    nuevosOrig.splice(iFinal, 1);
  } else {
    nuevas[iFinal] = der;
    nuevosRegs[iFinal] = [];
    nuevosOrig[iFinal] = der;
    if (cActualFinal >= 0) {
      nuevas[cActualFinal] = lineaDe(quedan);
      nuevosRegs[cActualFinal] = registrosDe(quedan);
      nuevosOrig[cActualFinal] = originalDe(quedan);
    }
  }

  return {
    lineas: nuevas,
    registros: nuevosRegs,
    originales: nuevosOrig,
    cursor: { linea: prevFinal, col: joinCol },
  };
}
