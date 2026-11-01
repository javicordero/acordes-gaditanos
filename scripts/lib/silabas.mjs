// Silabeador de español orientado a métrica de coplas.
//
// Para cada verso devuelve las sílabas «reales» (con su posición en el texto)
// y las sílabas «métricas», que son las que se cantan: aplica la sinalefa
// (vocal final + vocal inicial de la palabra siguiente = una sola sílaba).
// Así dos versos con distinto texto pero la misma música tienen el mismo
// número de sílabas métricas y los acordes caen en el mismo sitio.

const FUERTES = new Set('aeoáéóàèò'.split(''));
const DEBILES = new Set('iuüï'.split(''));
const DEBILES_TILDE = new Set('íú'.split(''));
const LETRAS = /[a-záéíóúüñ]/i;

// Grupos de consonantes que no se separan (van juntas a la sílaba siguiente).
const INSEPARABLES = new Set([
  'pr', 'pl', 'br', 'bl', 'fr', 'fl', 'tr', 'dr', 'cr', 'cl', 'gr', 'gl', 'kr', 'kl',
  'ch', 'll', 'rr',
]);

function esVocal(c, i, palabra) {
  if (!c) return false;
  if (FUERTES.has(c) || DEBILES.has(c) || DEBILES_TILDE.has(c)) return true;
  // «y» final cuenta como vocal (hoy, muy, ley)
  if (c === 'y' && i === palabra.length - 1) return true;
  return false;
}

/** Divide una palabra en sílabas. Devuelve [{ texto, inicio, fin, tonica }] con
 *  `inicio`/`fin` relativos a la palabra. */
export function silabearPalabra(original) {
  const p = original.toLowerCase();
  const n = p.length;

  // 1. Marcar vocales, tratando «qu»/«gu» + e/i como consonante la u.
  const vocal = [];
  for (let i = 0; i < n; i++) {
    let v = esVocal(p[i], i, p);
    if (v && p[i] === 'u' && i > 0 && (p[i - 1] === 'q' || (p[i - 1] === 'g' && 'eií'.includes(p[i + 1] || '')))) {
      v = false;
    }
    vocal.push(v);
  }

  // 2. Núcleos: vocales consecutivas, partiendo los hiatos.
  const nucleos = []; // [inicio, fin)
  let i = 0;
  while (i < n) {
    if (!vocal[i]) { i++; continue; }
    let ini = i;
    let fin = i + 1;
    while (fin < n && vocal[fin]) {
      const a = p[fin - 1];
      const b = p[fin];
      const aFuerte = FUERTES.has(a);
      const bFuerte = FUERTES.has(b);
      const hiato =
        (aFuerte && bFuerte) ||
        (aFuerte && DEBILES_TILDE.has(b)) ||
        (DEBILES_TILDE.has(a) && bFuerte) ||
        (DEBILES_TILDE.has(a) && DEBILES_TILDE.has(b)) ||
        (a === b && (a === 'i' || a === 'u')); // «chiita», «duunviro»
      if (hiato) break;
      fin++;
    }
    nucleos.push([ini, fin]);
    i = fin;
  }
  if (nucleos.length === 0) {
    return [{ texto: original, inicio: 0, fin: n, tonica: true }];
  }

  // 3. Reparto de consonantes entre núcleos.
  const cortes = [0]; // inicio de cada sílaba
  for (let k = 0; k < nucleos.length - 1; k++) {
    const finA = nucleos[k][1];
    const iniB = nucleos[k + 1][0];
    const cons = p.slice(finA, iniB);
    const c = cons.length;
    let corte;
    if (c === 0) corte = iniB;
    else if (c === 1) corte = finA; // va a la siguiente
    else if (c === 2) corte = INSEPARABLES.has(cons) ? finA : finA + 1;
    else if (c === 3) corte = INSEPARABLES.has(cons.slice(1)) ? finA + 1 : finA + 2;
    else corte = finA + 2;
    cortes.push(corte);
  }
  cortes.push(n);

  const silabas = [];
  for (let k = 0; k < cortes.length - 1; k++) {
    silabas.push({
      texto: original.slice(cortes[k], cortes[k + 1]),
      inicio: cortes[k],
      fin: cortes[k + 1],
      tonica: false,
    });
  }

  // 4. Sílaba tónica.
  let t = silabas.findIndex((s) => /[áéíóú]/i.test(s.texto));
  if (t < 0) {
    const ultima = p[n - 1];
    const llana = (esVocal(ultima, n - 1, p) && ultima !== 'y') || ultima === 'n' || ultima === 's';
    t = llana ? silabas.length - 2 : silabas.length - 1;
    if (t < 0) t = 0;
  }
  silabas[t].tonica = true;
  return silabas;
}

// Monosílabos que en el canto no llevan acento rítmico.
const ATONAS = new Set(('el la los las un una unos unas lo le les me te se nos os mi mis tu tus su sus ' +
  'que y e o u ni de del a al en con por sin so si como pues ' +
  'pa pal to ya ha han he hay es ni nos mas').split(' '));
const sinTilde = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Palabras de un verso con su posición. */
function palabrasDe(linea) {
  const out = [];
  const re = /[A-Za-záéíóúüñÁÉÍÓÚÜÑ]+/g;
  let m;
  while ((m = re.exec(linea))) out.push({ texto: m[0], inicio: m.index });
  return out;
}

const empiezaVocal = (w) => {
  const l = w.toLowerCase().replace(/^h/, '');
  return l.length > 0 && 'aeiouáéíóúü'.includes(l[0]);
};
const terminaVocal = (w) => {
  const l = w.toLowerCase();
  const u = l[l.length - 1];
  return 'aeiouáéíóúüy'.includes(u);
};

/** Analiza un verso. Devuelve:
 *  - reales: sílabas con posición absoluta en el verso
 *  - grupos: sílabas métricas (listas de índices de `reales`)
 *  - tonica: índice del grupo que lleva el último acento
 */
export function analizarVerso(linea) {
  const reales = [];
  const palabras = palabrasDe(linea);
  palabras.forEach((w, wi) => {
    silabearPalabra(w.texto).forEach((s, si, arr) => {
      reales.push({
        texto: s.texto,
        inicio: w.inicio + s.inicio,
        fin: w.inicio + s.fin,
        tonica: s.tonica,
        ritmica: s.tonica && !(arr.length === 1 && ATONAS.has(sinTilde(w.texto)) && !/[áéíóú]/i.test(w.texto)),
        palabra: wi,
        primeraDePalabra: si === 0,
        ultimaDePalabra: si === arr.length - 1,
        palabraTexto: w.texto,
      });
    });
  });

  const grupos = [];
  reales.forEach((s, idx) => {
    if (idx > 0 && s.primeraDePalabra) {
      const prev = reales[idx - 1];
      if (terminaVocal(prev.palabraTexto) && empiezaVocal(s.palabraTexto) && prev.ultimaDePalabra) {
        grupos[grupos.length - 1].push(idx);
        return;
      }
    }
    grupos.push([idx]);
  });

  let ultimaTonica = -1;
  reales.forEach((s, idx) => { if (s.ritmica) ultimaTonica = idx; });
  if (ultimaTonica < 0) reales.forEach((s, idx) => { if (s.tonica) ultimaTonica = idx; });
  const tonica = grupos.findIndex((g) => g.includes(ultimaTonica));

  return { linea, reales, grupos, tonica: Math.max(0, tonica) };
}

/** Índice (grupo, subíndice) de la sílaba que ocupa la columna `col`. */
export function anclaEnColumna(analisis, col) {
  const { reales, grupos } = analisis;
  if (reales.length === 0) return { g: 0, s: 0 };
  let idx = reales.findIndex((s) => col >= s.inicio && col < s.fin);
  if (idx < 0) {
    // en un hueco: la siguiente sílaba; si no hay, la última
    idx = reales.findIndex((s) => s.inicio >= col);
    if (idx < 0) idx = reales.length - 1;
  }
  const g = grupos.findIndex((gr) => gr.includes(idx));
  return { g, s: grupos[g].indexOf(idx) };
}

/** Número de sílabas «reales» de un texto (sin sinalefa). */
export function contarReales(texto) {
  return analizarVerso(texto).reales.length;
}
