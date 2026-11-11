// Operaciones de estructura del editor de coplas: separar una línea de letra
// en dos (creando su línea de acordes), separar un verso del bloque de arriba,
// juntar la parte izquierda del cursor con el verso anterior y reajustar las
// capas cuando se añaden o quitan líneas a mano. Trabajan sobre las tres capas
// del editor:
//
//   - `lineas`:     texto plano, sin etiquetas (lo que se ve en el textarea)
//   - `registros`:  por línea, [{ etiqueta, abre }] para conservar data-postura
//   - `originales`: por línea, el texto con etiquetas
//
// Devuelven copias nuevas (no mutan las entradas) y la posición del cursor.
// Son puras: no tocan el DOM, así se pueden probar desde Node.

import { clasificar, esAcorde, esAnotacion } from './pre-acordes.js';

const tokensDe = (linea) => [...String(linea).matchAll(/\S+/g)]
  .map((m) => ({ token: m[0], col: m.index }));

/** Hueco necesario para poner un token en su columna, sin pegarlo al anterior. */
function hueco(out, col) {
  if (col > out.length) return ' '.repeat(col - out.length);
  if (out.length > 0 && col <= out.length) return ' ';
  return '';
}

/** Coloca los tokens en sus columnas. Si dos chocan, se separan un espacio. */
function lineaDe(tokens) {
  return lineaDeConCol(tokens, null).linea;
}

/** Como `lineaDe`, pero devuelve también la columna donde empieza `objetivo`. */
function lineaDeConCol(tokens, objetivo) {
  let out = '';
  let col = 0;
  for (const t of tokens) {
    out += hueco(out, t.col);
    if (t === objetivo) col = out.length;
    out += t.token;
  }
  return { linea: out, col };
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

/**
 * Reconstruye la línea con etiquetas, conservando la postura de cada acorde.
 * Con `envolverTodos`, los acordes y las anotaciones («(Sorda)») sin registro
 * se envuelven con un `<a>` normal: así `envolver()` puede copiar la línea tal
 * cual.
 */
function originalDe(tokens, envolverTodos = false) {
  let out = '';
  for (const t of tokens) {
    out += hueco(out, t.col);
    const abre = t.abre || (envolverTodos && (esAcorde(t.token) || esAnotacion(t.token)) ? '<a>' : null);
    out += abre ? `${abre}</a>`.replace('</a>', `${t.token}</a>`) : t.token;
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
  if (p === 0) {
    return { error: 'El cursor está al principio de la línea: ponlo antes de la palabra que quieres bajar.' };
  }
  if (p === linea.length) {
    return { error: 'El cursor está al final de la línea: ponlo antes de las palabras que quieres bajar.' };
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
 * Separa el verso `i` del bloque de arriba: le crea su propia línea de
 * acordes (vacía) justo encima. Así deja de compartir la línea de acordes del
 * verso anterior y se le pueden bajar acordes. Las tres capas crecen a la vez
 * para que la estructura siga cuadrando. El cursor se queda al principio de la
 * letra, ya una fila más abajo.
 */
export function separarVerso({ lineas, registros, originales, conocidos, i }) {
  if (tipoDe(lineas, i, conocidos) !== 'letra') {
    return { error: 'Pon el cursor en una línea de letra.' };
  }
  if (i > 0) {
    const arriba = tipoDe(lineas, i - 1, conocidos);
    if (arriba === 'acordes' || arriba === 'acordes-sucio') {
      return { error: 'Este verso ya tiene su línea de acordes encima.' };
    }
    if (arriba === 'blanco') {
      return { error: 'Este verso ya está separado del de arriba.' };
    }
  }

  const nuevas = [...lineas];
  const nuevosRegs = [...registros];
  const nuevosOrig = [...originales];
  nuevas.splice(i, 0, '');
  nuevosRegs.splice(i, 0, []);
  nuevosOrig.splice(i, 0, '');

  return {
    lineas: nuevas,
    registros: nuevosRegs,
    originales: nuevosOrig,
    cursor: { linea: i + 1, col: 0 },
    separado: true,
  };
}

const sinEtiquetas = (linea) => String(linea ?? '').replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1');

/**
 * Vuelve a cuadrar las capas de etiquetas cuando el texto gana o pierde líneas
 * a mano (Enter, borrar un salto, pegar varias líneas). Casa cada línea nueva
 * con la vieja que tenía exactamente el mismo texto; las que no casan (las que
 * acabas de partir o juntar) se quedan sin etiquetas, y `envolver()` las
 * envuelve al guardar. Devuelve cuántas líneas de acordes se han quedado sin
 * etiqueta, para poder avisar.
 */
export function realinearEstructura({ lineas, registros = [], originales = [], conocidos = new Set() }) {
  const set = conocidos instanceof Set ? conocidos : new Set(conocidos || []);
  registros.flat().forEach((r) => set.add(r.etiqueta));
  const viejas = originales.map(sinEtiquetas);
  const usadas = new Set();
  const nuevosRegs = [];
  const nuevosOrig = [];
  let perdidas = 0;

  lineas.forEach((linea, j) => {
    let k = -1;
    for (let m = 0; m < viejas.length; m++) {
      if (!usadas.has(m) && viejas[m] === linea) { k = m; break; }
    }
    if (k >= 0) {
      usadas.add(k);
      nuevosRegs.push((registros[k] || []).map((x) => ({ ...x })));
      nuevosOrig.push(originales[k]);
      return;
    }
    nuevosRegs.push([]);
    nuevosOrig.push('');
    const t = clasificar(linea, lineas[j + 1] || '', set).tipo;
    if ((t === 'acordes' || t === 'acordes-sucio') && String(linea).trim() !== '') perdidas++;
  });

  return { registros: nuevosRegs, originales: nuevosOrig, perdidas };
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
    // Si el verso venía separado del de arriba con un blanco, se va con él:
    // así no queda una línea vacía suelta al juntar.
    if (iFinal > 0 && tipoDe(nuevas, iFinal - 1, conocidos) === 'blanco') {
      nuevas.splice(iFinal - 1, 1);
      nuevosRegs.splice(iFinal - 1, 1);
      nuevosOrig.splice(iFinal - 1, 1);
      iFinal--;
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

/**
 * ¿La línea `j` hace de línea de acordes? Vale una línea de acordes normal,
 * una «sucia» (acordes con algún token raro) y una línea vacía que está justo
 * encima de una letra (la línea de acordes de un verso sin acordes).
 */
export function esLineaAcordes(lineas, j, conocidos) {
  const t = tipoDe(lineas, j, conocidos);
  if (t === 'acordes' || t === 'acordes-sucio') return true;
  return t === 'blanco' && tipoDe(lineas, j + 1, conocidos) === 'letra';
}

/**
 * Mueve el acorde bajo el cursor a la siguiente (`dir > 0`) o anterior
 * (`dir < 0`) línea de acordes, al final del todo. Conserva su data-postura.
 */
export function moverAcordeLinea({ lineas, registros, originales, conocidos, i, col, dir }) {
  const tipoOrigen = tipoDe(lineas, i, conocidos);
  if (tipoOrigen !== 'acordes' && tipoOrigen !== 'acordes-sucio') {
    return { error: 'Pon el cursor en una línea de acordes.' };
  }
  const tokens = conEtiquetas(tokensDe(lineas[i]), registros[i]);
  const elegido = tokens.find((t) => col >= t.col && col <= t.col + t.token.length) || null;
  if (!elegido) return { error: 'Pon el cursor sobre un acorde.' };
  if (!esAcorde(elegido.token) && !esAnotacion(elegido.token)) {
    return { error: `«${elegido.token}» no es un acorde.` };
  }

  let destino = -1;
  if (dir > 0) {
    for (let j = i + 1; j < lineas.length; j++) {
      if (esLineaAcordes(lineas, j, conocidos)) { destino = j; break; }
    }
  } else {
    for (let j = i - 1; j >= 0; j--) {
      if (esLineaAcordes(lineas, j, conocidos)) { destino = j; break; }
    }
  }
  if (destino < 0) {
    return { error: dir > 0 ? 'No hay otra línea de acordes debajo.' : 'No hay otra línea de acordes arriba.' };
  }

  const quedan = tokens.filter((t) => t !== elegido);
  const destinoTokens = conEtiquetas(tokensDe(lineas[destino]), registros[destino]);
  const ultimo = destinoTokens[destinoTokens.length - 1];
  const colNueva = ultimo ? ultimo.col + ultimo.token.length + 1 : 0;
  const movido = { ...elegido, col: colNueva };
  const nuevosDestino = [...destinoTokens, movido];

  const nuevas = [...lineas];
  const nuevosRegs = [...registros];
  const nuevosOrig = [...originales];

  nuevas[i] = lineaDe(quedan);
  nuevosRegs[i] = registrosDe(quedan);
  nuevosOrig[i] = originalDe(quedan);

  nuevas[destino] = lineaDe(nuevosDestino);
  nuevosRegs[destino] = registrosDe(nuevosDestino);
  nuevosOrig[destino] = originalDe(nuevosDestino);

  return {
    lineas: nuevas,
    registros: nuevosRegs,
    originales: nuevosOrig,
    cursor: { linea: destino, col: colNueva },
  };
}

/**
 * Pone o quita la postura de una ocurrencia concreta de un acorde.
 *
 * `indice` es la k-ésima aparición de `etiqueta` **dentro de la línea**, no el
 * índice global de `registros`: es el mismo criterio que usan `conEtiquetas()`
 * y `envolver()` al reasociar las etiquetas. Actualiza `registros[i]` y también
 * la etiqueta de `originales[i]`, porque `envolver()` copia la línea original
 * tal cual cuando el texto no ha cambiado.
 *
 * Si el acorde todavía no tiene `<a>` (se acaba de escribir), se crea el
 * registro; al guardar, `envolver()` lo detecta como suelto y lo envuelve.
 */
export function fijarPostura({ registros = [], originales = [], i, etiqueta, indice = 0, postura = null }) {
  if (!Number.isInteger(i) || i < 0) return { error: 'La línea no existe.' };

  const regs = registros.map((linea) => (linea || []).map((r) => ({ ...r })));
  const origs = [...originales];
  const lineaRegs = regs[i] || (regs[i] = []);
  const candidatos = lineaRegs.filter((r) => r.etiqueta === etiqueta);
  const k = Math.max(0, Math.trunc(Number(indice) || 0));
  const texto = postura || null;

  // Acorde nuevo (total o parcialmente sin envolver): se crean los registros
  // que falten hasta la ocurrencia pedida. Al guardar, `envolver()` los
  // reasocia en orden y envuelve los que aún estaban sueltos.
  if (k >= candidatos.length) {
    if (!texto) return { registros: regs, originales: origs, noop: true };
    for (let n = candidatos.length; n < k; n++) lineaRegs.push({ etiqueta, abre: '<a>' });
    lineaRegs.push({ etiqueta, abre: abreConPostura('<a>', texto) });
    return { registros: regs, originales: origs };
  }

  const reg = candidatos[k];
  reg.abre = abreConPostura(reg.abre, texto);
  origs[i] = reemplazarEtiqueta(origs[i], etiqueta, k, reg.abre);
  return { registros: regs, originales: origs };
}

/** Quita `data-postura` de una etiqueta de apertura sin tocar otros atributos. */
function abreSinPostura(abre) {
  return String(abre || '<a>')
    .replace(/\s+data-postura\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\s+>/, '>');
}

/** Pone (o quita, con `postura = null`) `data-postura` en una etiqueta de apertura. */
function abreConPostura(abre, postura) {
  const limpio = abreSinPostura(abre);
  if (!postura) return limpio;
  const valor = String(postura).replace(/"/g, '&quot;');
  return limpio.replace(/>$/, ` data-postura="${valor}">`);
}

/** Sustituye la k-ésima etiqueta `<a>` de la línea cuya etiqueta coincide. */
function reemplazarEtiqueta(original, etiqueta, indice, abre) {
  if (typeof original !== 'string') return original;
  let n = 0;
  return original.replace(/<a([^>]*)>([\s\S]*?)<\/a>/g, (todo, _attrs, texto) => {
    if (texto.trim() !== etiqueta) return todo;
    const i = n++;
    return i === indice ? abre + texto + '</a>' : todo;
  });
}

/**
 * Mueve el acorde que empieza en la columna `col` de la línea `i` a la
 * columna `destino.col` de la línea `destino.linea`. Es la operación del
 * arrastre: el destino puede ser cualquier punto de una línea de acordes.
 * Conserva la etiqueta de apertura (y su `data-postura`) del acorde movido.
 */
export function moverAcordeA({ lineas, registros, originales, conocidos, i, col, destino }) {
  const tipoOrigen = tipoDe(lineas, i, conocidos);
  if (tipoOrigen !== 'acordes' && tipoOrigen !== 'acordes-sucio') {
    return { error: 'Esa línea no es de acordes.' };
  }

  const tokensOrigen = conEtiquetas(tokensDe(lineas[i]), registros[i]);
  const elegido = tokensOrigen.find((t) => col >= t.col && col < t.col + t.token.length) || null;
  if (!elegido) return { error: 'No hay ningún acorde en ese punto.' };
  if (!esAcorde(elegido.token) && !esAnotacion(elegido.token)) {
    return { error: `«${elegido.token}» no es un acorde.` };
  }

  const j = Number(destino?.linea);
  if (!Number.isInteger(j) || j < 0 || j >= lineas.length) {
    return { error: 'Esa línea no existe.' };
  }
  if (!esLineaAcordes(lineas, j, conocidos)) {
    return { error: 'Los acordes solo se pueden soltar en una línea de acordes.' };
  }

  // Soltar sobre el mismo acorde no cambia nada.
  if (j === i && destino.col >= elegido.col && destino.col <= elegido.col + elegido.token.length) {
    return { error: 'El acorde ya está ahí.', noop: true };
  }

  const base = j === i
    ? tokensOrigen.filter((t) => t !== elegido)
    : conEtiquetas(tokensDe(lineas[j]), registros[j]);

  let colDestino = Math.max(0, Math.trunc(Number(destino.col) || 0));
  colDestino = Math.min(colDestino, (lineas[j] || '').length);

  // Si la columna cae dentro de otro token, se coloca antes o después según
  // la mitad: así no se parte ningún acorde.
  const choque = base.find((t) => colDestino > t.col && colDestino < t.col + t.token.length);
  if (choque) {
    const mitad = choque.col + choque.token.length / 2;
    colDestino = colDestino < mitad ? choque.col : choque.col + choque.token.length + 1;
  }

  const movido = { ...elegido, col: colDestino };
  const tokensDestino = [...base, movido];
  // A igual columna, el acorde movido va delante: se inserta antes del token
  // que ya estaba en esa posición.
  tokensDestino.sort((a, b) => a.col - b.col || (a === movido ? -1 : b === movido ? 1 : 0));

  const nuevas = [...lineas];
  const nuevosRegs = [...registros];
  const nuevosOrig = [...originales];

  if (j === i) {
    const { linea, col: colFinal } = lineaDeConCol(tokensDestino, movido);
    nuevas[i] = linea;
    nuevosRegs[i] = registrosDe(tokensDestino);
    nuevosOrig[i] = originalDe(tokensDestino, true);
    return {
      lineas: nuevas,
      registros: nuevosRegs,
      originales: nuevosOrig,
      cursor: { linea: i, col: colFinal },
    };
  }

  const quedan = tokensOrigen.filter((t) => t !== elegido);
  nuevas[i] = lineaDe(quedan);
  nuevosRegs[i] = registrosDe(quedan);
  nuevosOrig[i] = originalDe(quedan, true);

  const { linea, col: colFinal } = lineaDeConCol(tokensDestino, movido);
  nuevas[j] = linea;
  nuevosRegs[j] = registrosDe(tokensDestino);
  nuevosOrig[j] = originalDe(tokensDestino, true);

  return {
    lineas: nuevas,
    registros: nuevosRegs,
    originales: nuevosOrig,
    cursor: { linea: j, col: colFinal },
  };
}
