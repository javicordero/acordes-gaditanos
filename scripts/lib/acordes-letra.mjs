// Núcleo para aplicar los acordes de una ficha base a una letra nueva.
//
// Una ficha se reduce a un modelo pequeño y reconstruible desde el propio .md:
//
//   palabras:  la letra en orden, tal y como la escribió el usuario
//   cortes:    en qué palabra empieza cada verso (cortes[0] = 0, el último = total)
//   acordes:   etiqueta + `pos`, la sílaba real (contada desde el principio de
//              la letra, sinalefas aparte) sobre la que cae
//   blancos / metas: líneas en blanco y `<strong>Cejilla: 4</strong>` de la base
//
// Con eso `renderizarPlan` pinta el `<pre>` y `scripts/revisar-acordes.mjs`
// puede mover acordes y fronteras de verso sin romper las columnas: los
// acordes van cosidos a la sílaba, no a la línea.
//
// Flujo:
//   1. leerFicha / planDesdeMd: de un .md al modelo.
//   2. tokenizarLetra + alinear (o reparto por cortes): repartir la letra nueva.
//   3. colocar: decidir en qué sílaba cae cada acorde de la base.
//   4. renderizarPlan: del modelo al <pre>.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { analizarVerso, contarReales } from './silabas.mjs';

export const CARPETA = 'src/content/acordes';

/** Parámetros de la alineación (afinados con `scripts/evaluar-acordes.mjs`). */
export const PARAMS = {
  maxPalabras: 32,       // palabras máximas por verso de la base
  costeDif: 1,           // coste por sílaba de diferencia
  costeDifCuad: 0.25,    // coste extra cuadrático (castiga los desajustes grandes)
  unirLinea: 0.4,        // por cada salto de línea de la letra que se funde en un verso
  cortarLinea: 1.5,      // por cada corte en mitad de un verso de la letra
  baseSinUsar: 2,        // por cada verso de la base que no se llega a usar
  ajusteTonica: true,    // (modo 'indice') un acorde sobre sílaba acentuada busca otra acentuada cercana
  modo: 'dp',            // 'dp' = alinea los patrones de acentos del verso; 'indice' = por posición
  costeNoCoincide: 0.8,  // acento frente a no acento
  huecoAtono: 1.5,       // sílaba métrica sin pareja (sin acento)
  huecoTonico: 2.6,      // sílaba métrica sin pareja (con acento)
  pesoDiagonal: 0.08,    // preferencia por no desplazarse mucho
  finDebil: 1.5,         // un verso no suele acabar en palabra átona («de», «la», «que», «y»…)
};

// Palabras que no cierran un verso.
export const PALABRAS_DEBILES = new Set(('el la los las un una unos unas lo le les me te se mi mis tu tus su sus ' +
  'que y e o u ni de del a al en con por sin si como pa pal para entre sobre hasta desde cuando donde porque aunque pero ' +
  'mas pues ya es son era fue ha han he hay').split(' '));

export const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const limpiar = (t) => sinTildes(t).replace(/[^a-zñ]/g, '');

// ---------- lectura de fichas ----------

/** Separa el frontmatter y el `<pre>` en items: blanco | meta | verso | instrumental. */
export function parsearPre(texto) {
  const limpio = String(texto).replace(/\r\n/g, '\n');
  let m = limpio.match(/^([\s\S]*?)<pre>\n?([\s\S]*?)<\/pre\s*>/);
  if (!m) {
    // Fichas antiguas con el <pre> sin cerrar: se lee hasta el final.
    m = limpio.match(/^([\s\S]*?)<pre>\n?([\s\S]*)$/);
    if (!m) throw new Error('no encuentro <pre>');
  }
  const frontmatter = m[1];
  const cuerpo = m[2].replace(/\n+$/, '');
  const lineas = cuerpo === '' ? [] : cuerpo.split('\n');
  const items = [];
  const re = /(<a[^>]*>)([\s\S]*?)<\/a>|([^<]+)/g;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (l.trim() === '') { items.push({ tipo: 'blanco' }); continue; }
    if (/^<strong>[\s\S]*<\/strong>$/.test(l.trim())) { items.push({ tipo: 'meta', texto: l.trim() }); continue; }
    if (/<a[ >]/.test(l)) {
      const acordes = [];
      let visible = '';
      let mm;
      re.lastIndex = 0;
      while ((mm = re.exec(l))) {
        if (mm[2] !== undefined) {
          acordes.push({ col: visible.length, etiqueta: mm[2], abre: mm[1] });
          visible += mm[2];
        } else visible += mm[3];
      }
      const verso = (lineas[i + 1] ?? '').replace(/\s+$/, '');
      const siguienteEsAcorde = /<a[ >]/.test(verso);
      if (!siguienteEsAcorde) i++;
      // Línea de acordes sin letra debajo (introducciones, dos líneas de acordes
      // seguidas): se copia tal cual.
      if (!verso.trim() || siguienteEsAcorde) items.push({ tipo: 'instrumental', texto: l.replace(/\s+$/, '') });
      else items.push({ tipo: 'verso', acordes, verso });
    } else if (l.trim()) {
      items.push({ tipo: 'verso', acordes: [], verso: l.replace(/\s+$/, '') });
    }
  }
  return { frontmatter, items };
}

/** Prefijo de sílabas reales por palabra: prefijo[k] = sílabas de las palabras [0, k). */
export function prefijos(palabras) {
  const p = [0];
  for (const w of palabras) p.push(p[p.length - 1] + contarReales(w.texto));
  return p;
}

/** Índice de la sílaba real que ocupa la columna `col` (o la más cercana). */
function realEnColumna(an, col) {
  if (!an.reales.length) return 0;
  let idx = an.reales.findIndex((s) => col >= s.inicio && col < s.fin);
  if (idx < 0) idx = an.reales.findIndex((s) => s.inicio >= col);
  if (idx < 0) idx = an.reales.length - 1;
  return idx;
}

/** (grupo, subíndice) de la sílaba real `idx`; es lo que necesita `colocar`. */
function grupoDe(an, idx) {
  const g = an.grupos.findIndex((gr) => gr.includes(idx));
  if (g < 0) return { g: 0, s: 0 };
  return { g, s: Math.max(0, an.grupos[g].indexOf(idx)) };
}

/**
 * Del texto de una ficha al modelo completo.
 * Acepta también `.md` en acordes2 (acordes sin envolver: se leen como letra).
 */
export function planDesdeMd(texto, slug = '') {
  const { frontmatter, items } = parsearPre(texto);
  const palabras = [];
  const cortes = [];
  const blancos = [];
  const metas = [];
  const propios = [];
  let v = 0;

  for (const it of items) {
    if (it.tipo === 'blanco') { blancos.push(v); continue; }
    if (it.tipo === 'meta' || it.tipo === 'instrumental') {
      metas.push({ antesDe: v, texto: it.texto });
      continue;
    }
    cortes.push(palabras.length);
    it.palabraInicio = palabras.length;
    const ws = it.verso.split(/\s+/).filter(Boolean);
    ws.forEach((w, i) => {
      palabras.push({ texto: w, linea: v, inicioLinea: i === 0, finLinea: i === ws.length - 1 });
      // Mayúscula en mitad de verso: nombre propio (se conserva al recomponer).
      if (i > 0 && /^[A-ZÁÉÍÓÚÜÑ]/.test(w)) propios.push(sinTildes(w.replace(/[^A-Za-záéíóúüñ]/g, '')));
    });
    it.an = analizarVerso(it.verso);
    it.largo = it.an.tonica + 1;
    it.anclas = [];
    v++;
  }
  cortes.push(palabras.length);
  const prefijo = prefijos(palabras);

  const acordes = [];
  const versos = [];
  for (const it of items) {
    if (it.tipo !== 'verso') continue;
    const base = prefijo[it.palabraInicio] ?? 0;
    for (const ac of it.acordes) {
      const idx = realEnColumna(it.an, ac.col);
      const pos = base + idx;
      it.anclas.push({ ...ac, ...grupoDe(it.an, idx), pos });
      acordes.push({ etiqueta: ac.etiqueta, abre: ac.abre, pos });
    }
    versos.push(it);
  }

  return {
    slug, frontmatter, items, versos,
    palabras, cortes, acordes, blancos, metas, propios, prefijo,
    nVersos: cortes.length - 1,
  };
}

/** Lee una ficha de `carpeta` por slug. */
export function leerFicha(slug, carpeta = CARPETA) {
  const ruta = join(carpeta, `${slug}.md`);
  if (!existsSync(ruta)) throw new Error(`No existe ${ruta}`);
  const texto = readFileSync(ruta, 'utf8');
  let plan;
  try {
    plan = planDesdeMd(texto, slug);
  } catch (e) {
    throw new Error(`${slug}: ${e.message}`);
  }
  return { ...plan, ruta, texto };
}

// Compatibilidad con los nombres antiguos.
export const leerBase = (slug, carpeta) => leerFicha(slug, carpeta);

const campo = (fm, k) => (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)?.[1] || '').trim().replace(/^['"]|['"]$/g, '');

/**
 * Fichas de la misma música que `slug`: misma pieza, agrupación y año, y además
 * la misma autoría de música (dos pasodobles del mismo grupo y año pueden ser
 * canciones distintas; sin esa comprobación se generaría algo plausible y falso).
 */
export function hermanasDetalle(slug, carpeta = CARPETA) {
  const base = leerFicha(slug, carpeta);
  const clave = ['pieza', 'agrupacion', 'year'].map((k) => sinTildes(campo(base.frontmatter, k))).join('|');
  const musicaBase = sinTildes(campo(base.frontmatter, 'musica'));
  const slugs = [];
  const avisos = [];
  for (const f of readdirSync(carpeta).filter((f) => f.endsWith('.md')).sort()) {
    const s = f.slice(0, -3);
    if (s === slug) continue;
    const ruta = join(carpeta, f);
    let ficha;
    try { ficha = leerFicha(s, carpeta); } catch { continue; }
    if (!ficha.texto.includes('<pre>')) continue;
    const k = ['pieza', 'agrupacion', 'year'].map((c) => sinTildes(campo(ficha.frontmatter, c))).join('|');
    if (k !== clave) continue;
    const musica = sinTildes(campo(ficha.frontmatter, 'musica'));
    if (musicaBase && musica && musica !== musicaBase) {
      avisos.push(`${s}: misma pieza y año, pero otra música («${campo(ficha.frontmatter, 'musica')}»); no la uso como base.`);
      continue;
    }
    slugs.push(s);
  }
  return { slugs: [slug, ...slugs], avisos };
}

export const hermanas = (slug, carpeta) => hermanasDetalle(slug, carpeta).slugs;

// ---------- letra nueva ----------

/**
 * Convierte el texto pegado en palabras con sus cortes.
 *
 * Marcas:
 *   `---` (sola en una línea)  corta entre líneas.
 *   `|` (dentro de una línea)  corta entre palabras.
 *   `-` (sola en una línea)    salta un verso de la base sin gastar letra.
 *
 * Los cortes son `duros`: obligan a empezar un verso de la base. Los saltos de
 * línea normales son blandos (la alineación puede unir varias líneas).
 */
export function leerLetra(texto) {
  const crudas = String(texto).replace(/^\ufeff/, '').replace(/\r\n/g, '\n').split('\n');
  const palabras = [];
  let saltosIniciales = 0;
  let linea = 0;

  const ultimaDura = () => { if (palabras.length) palabras[palabras.length - 1].duro = true; };

  for (const cruda of crudas) {
    const l = cruda.trim();
    if (!l) continue;
    if (/^-{3,}$/.test(l)) { ultimaDura(); continue; }
    if (l === '-') {
      if (!palabras.length) { saltosIniciales++; continue; }
      ultimaDura();
      palabras[palabras.length - 1].salto = true;
      continue;
    }
    const antes = palabras.length;
    l.split('|').forEach((parte, idx) => {
      if (idx > 0) ultimaDura();
      const ws = parte.trim().split(/\s+/).filter(Boolean);
      ws.forEach((w, i) => palabras.push({
        texto: w,
        linea,
        inicioLinea: i === 0,
        finLinea: i === ws.length - 1,
        duro: false,
      }));
    });
    if (palabras.length > antes) linea++;
  }

  const prefijo = prefijos(palabras);
  const propios = new Set();
  palabras.forEach((p) => {
    if (!p.inicioLinea && /^[A-ZÁÉÍÓÚÜÑ]/.test(p.texto)) propios.add(sinTildes(p.texto.replace(/[^A-Za-záéíóúüñ]/g, '')));
  });
  return {
    lineas: crudas,
    palabras, prefijo, propios, saltosIniciales,
    nLineas: linea,
    hayCortes: palabras.some((p) => p.duro || p.salto) || saltosIniciales > 0,
  };
}

/** Igual que antes, pero sin marcas: solo palabras. */
export function tokenizarLetra(lineas, extraPropios = []) {
  const tok = leerLetra(lineas.join('\n'));
  for (const p of extraPropios) tok.propios.add(p.toLowerCase());
  return tok;
}

/** Texto de un tramo de palabras [a, b): las que abren línea van en minúscula
 *  salvo la primera del tramo, nombres propios, «Ay» y tras signo de cierre. */
export function textoTramo(tok, a, b) {
  const out = [];
  for (let i = a; i < b; i++) {
    let w = tok.palabras[i].texto;
    if (i > a && tok.palabras[i].inicioLinea) {
      const previa = tok.palabras[i - 1].texto;
      const limpia = sinTildes(w.replace(/[^A-Za-záéíóúüñÁÉÍÓÚÜÑ]/g, ''));
      const conserva = /[.!?¡¿]\s*$/.test(previa) || tok.propios.has(limpia) || limpia === 'ay' || limpia === 'ayy';
      if (!conserva) w = w.charAt(0).toLowerCase() + w.slice(1);
    }
    out.push(w);
  }
  return out.join(' ');
}

// ---------- reparto ----------

/** Reparto manual: `tamanos` = líneas de la letra por verso de la base (`-` = saltar). */
export function repartoManual(tamanos, tok, nT) {
  const inicios = [];
  tok.palabras.forEach((p, i) => { if (p.inicioLinea) inicios[p.linea] = i; });
  inicios.push(tok.palabras.length);
  const asignacion = [];
  let l = 0;
  for (const t of tamanos) {
    if (t === null || t === '-' || t === 0) { asignacion.push(null); continue; }
    const ini = inicios[l];
    const fin = inicios[l + t];
    if (ini === undefined || fin === undefined) throw new Error(`El reparto ${tamanos.join(',')} no encaja con las ${tok.lineas.length} líneas de la letra.`);
    asignacion.push([ini, fin]);
    l += t;
  }
  if (l !== tok.nLineas) throw new Error(`El reparto gasta ${l} líneas y la letra tiene ${tok.nLineas}.`);
  while (asignacion.length < nT) asignacion.push(null);
  if (asignacion.length > nT) throw new Error(`El reparto pide ${asignacion.length} versos y la base tiene ${nT}.`);
  return { asignacion, coste: 0, usados: asignacion.filter(Boolean).length };
}

/** Reparto por los cortes duros del .txt (`---`, `|`, `-`). */
export function repartoPorCortes(tok, nT) {
  const asignacion = [];
  for (let k = 0; k < (tok.saltosIniciales || 0); k++) asignacion.push(null);
  let ini = 0;
  tok.palabras.forEach((p, i) => {
    if (p.duro) { asignacion.push([ini, i + 1]); ini = i + 1; }
    if (p.salto) asignacion.push(null);
  });
  if (ini < tok.palabras.length) asignacion.push([ini, tok.palabras.length]);
  while (asignacion.length && asignacion[asignacion.length - 1] === null) asignacion.pop();
  if (asignacion.length > nT) {
    throw new Error(`La letra pide ${asignacion.length} versos y la base solo tiene ${nT}. Quita algún «---» o usa una base con más versos.`);
  }
  while (asignacion.length < nT) asignacion.push(null);
  return { asignacion, coste: 0, usados: asignacion.filter(Boolean).length };
}

/**
 * Empareja los versos de una ficha con los de la base por número de sílabas.
 * Sirve para marcar los descuadrados aunque las dos fichas no tengan el mismo
 * número de versos (lo normal: cada transcripción corta en un sitio distinto).
 * Devuelve, por cada verso de la ficha, el índice del verso de la base o null.
 */
export function emparejarVersos(largosBase, largosFicha, params = PARAMS) {
  const n = largosBase.length;
  const m = largosFicha.length;
  const INF = 1e9;
  const gap = params.baseSinUsar;
  const f = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
  const from = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  f[0][0] = 0;
  for (let i = 1; i <= n; i++) { f[i][0] = f[i - 1][0] + gap; from[i][0] = 1; }
  for (let j = 1; j <= m; j++) { f[0][j] = f[0][j - 1] + gap; from[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const diag = f[i - 1][j - 1] + Math.abs(largosBase[i - 1] - largosFicha[j - 1]);
    const arr = f[i - 1][j] + gap;
    const izq = f[i][j - 1] + gap;
    if (diag <= arr && diag <= izq) { f[i][j] = diag; from[i][j] = 0; }
    else if (arr <= izq) { f[i][j] = arr; from[i][j] = 1; }
    else { f[i][j] = izq; from[i][j] = 2; }
  }
  const mapa = new Array(m).fill(null);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const t = from[i][j];
    if (i > 0 && j > 0 && t === 0) { mapa[j - 1] = i - 1; i--; j--; }
    else if (i > 0 && (t === 1 || j === 0)) i--;
    else j--;
  }
  return mapa;
}

/** Alineación automática: reparte las palabras entre los versos de la base por métrica. */
export function alinear(versosBase, tok, params = PARAMS) {
  const nT = versosBase.length;
  const nW = tok.palabras.length;
  const INF = 1e9;
  const f = Array.from({ length: nT + 1 }, () => new Float64Array(nW + 1).fill(INF));
  const from = Array.from({ length: nT + 1 }, () => new Int32Array(nW + 1));
  f[0][0] = 0;

  const cacheLargo = new Map();
  const largo = (a, b) => {
    const k = a * 100000 + b;
    let v = cacheLargo.get(k);
    if (v === undefined) { v = analizarVerso(textoTramo(tok, a, b)).tonica + 1; cacheLargo.set(k, v); }
    return v;
  };

  for (let j = 1; j <= nT; j++) {
    for (let w = 1; w <= nW; w++) {
      for (let m = 1; m <= Math.min(params.maxPalabras, w); m++) {
        const a = w - m;
        if (f[j - 1][a] >= INF) continue;
        const dif = Math.abs(largo(a, w) - versosBase[j - 1].largo);
        let c = f[j - 1][a] + dif * params.costeDif + dif * dif * params.costeDifCuad;
        // fronteras
        if (!tok.palabras[a].inicioLinea) c += params.cortarLinea;
        if (!tok.palabras[w - 1].finLinea) c += params.cortarLinea;
        // palabra átona al final del verso (salvo que el verso de la letra ya acabe ahí)
        if (PALABRAS_DEBILES.has(limpiar(tok.palabras[w - 1].texto)) && !(tok.palabras[w - 1].finLinea && w - a === 1)) c += params.finDebil;
        // líneas fundidas dentro del tramo
        for (let i = a + 1; i < w; i++) if (tok.palabras[i].inicioLinea) c += params.unirLinea;
        // una interjección suelta («Ay») abre el verso siguiente, no cierra este
        if (w < nW && tok.palabras[w - 1].finLinea && tok.palabras[w - 1].inicioLinea && /^ayy?[,!.]*$/i.test(tok.palabras[w - 1].texto)) c += 50;
        if (c < f[j][w]) { f[j][w] = c; from[j][w] = m; }
      }
    }
  }
  let mejorJ = -1, mejor = INF;
  for (let j = 1; j <= nT; j++) {
    const c = f[j][nW] + (nT - j) * params.baseSinUsar;
    if (c < mejor) { mejor = c; mejorJ = j; }
  }
  if (mejorJ < 0) return null;
  const tramos = [];
  let w = nW;
  for (let j = mejorJ; j >= 1; j--) { const m = from[j][w]; tramos.unshift([w - m, w]); w -= m; }
  const asignacion = tramos.concat(Array(nT - tramos.length).fill(null));
  return { tramos, asignacion, coste: mejor, usados: mejorJ, largo };
}

// ---------- colocación de acordes ----------

const acento = (an) => an.grupos.map((g) => (g.some((ix) => an.reales[ix].ritmica) ? 1 : 0));

/** Alinea los grupos métricos del verso base con los del nuevo (hasta la última
 *  tónica de cada uno). Devuelve, para cada grupo base, el grupo nuevo equivalente. */
function alinearAcentos(anBase, anNuevo, params) {
  const A = acento(anBase).slice(0, anBase.tonica + 1);
  const B = acento(anNuevo).slice(0, anNuevo.tonica + 1);
  const n = A.length, m = B.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const T = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  const hueco = (x) => (x ? params.huecoTonico : params.huecoAtono);
  for (let i = 1; i <= n; i++) { D[i][0] = D[i - 1][0] + hueco(A[i - 1]); T[i][0] = 1; }
  for (let j = 1; j <= m; j++) { D[0][j] = D[0][j - 1] + hueco(B[j - 1]); T[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const diag = D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : params.costeNoCoincide) + params.pesoDiagonal * Math.abs((i - 1) - (j - 1));
    const arr = D[i - 1][j] + hueco(A[i - 1]);
    const izq = D[i][j - 1] + hueco(B[j - 1]);
    if (diag <= arr && diag <= izq) { D[i][j] = diag; T[i][j] = 0; }
    else if (arr <= izq) { D[i][j] = arr; T[i][j] = 1; }
    else { D[i][j] = izq; T[i][j] = 2; }
  }
  const mapa = new Array(n).fill(-1);
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const t = T[i][j];
    if (i > 0 && j > 0 && t === 0) { mapa[i - 1] = j - 1; i--; j--; }
    else if (i > 0 && (t === 1 || j === 0)) i--;
    else j--;
  }
  // grupos base sin pareja: el siguiente emparejado (o el anterior)
  for (let k = n - 1, sig = -1; k >= 0; k--) { if (mapa[k] >= 0) sig = mapa[k]; else if (sig >= 0) mapa[k] = sig; }
  for (let k = 0, ant = 0; k < n; k++) { if (mapa[k] >= 0) ant = mapa[k]; else mapa[k] = ant; }
  return mapa;
}

/** Coloca los acordes del verso base `versoBase` sobre el verso nuevo `an`. */
function colocar(versoBase, an, basePos, params) {
  const tNuevo = an.tonica;
  const tViejo = versoBase.an.tonica;
  const n = an.grupos.length;
  const out = [];
  const mapa = params.modo === 'dp' ? alinearAcentos(versoBase.an, an, params) : null;
  for (const ac of versoBase.anclas) {
    let g = ac.g ?? 0;
    if (mapa && g <= tViejo) g = mapa[g];
    else if (g > tViejo) g = tNuevo + (g - tViejo);
    g = Math.max(0, Math.min(n - 1, g));
    let s = ac.s ?? 0;
    // ¿el acorde base está sobre una sílaba con acento rítmico?
    const idxBase = versoBase.an.grupos[ac.g]?.[Math.min(ac.s ?? 0, (versoBase.an.grupos[ac.g]?.length ?? 1) - 1)];
    const baseAcentuada = idxBase !== undefined && versoBase.an.reales[idxBase]?.ritmica;
    if (!mapa && params.ajusteTonica && baseAcentuada && n > 0) {
      const esAcentuado = (gg) => an.grupos[gg]?.some((ix) => an.reales[ix].ritmica);
      if (!esAcentuado(g)) {
        if (esAcentuado(g - 1) && g - 1 >= 0) { g = g - 1; s = 99; }
        else if (esAcentuado(g + 1) && g + 1 < n) { g = g + 1; s = 99; }
      }
      if (s === 99) {
        const grupo = an.grupos[g];
        s = Math.max(0, grupo.findIndex((ix) => an.reales[ix].ritmica));
      }
    }
    const grupo = an.grupos[g] || [0];
    const idx = grupo[Math.min(s, grupo.length - 1)];
    const real = an.reales[idx];
    out.push({
      col: real ? real.inicio : 0,
      etiqueta: ac.etiqueta,
      abre: ac.abre,
      pos: basePos + idx,
    });
  }
  return out.sort((a, b) => a.col - b.col);
}

/** Columnas definitivas: si dos acordes se pisan, el segundo se empuja a la derecha.
 *  Dos acordes no pueden compartir columna: el .md solo sabe expresar una. */
export function resolverColumnas(colocados) {
  const cs = colocados.map((c) => ({ ...c })).sort((a, b) => a.col - b.col);
  let fin = -1;
  for (const c of cs) {
    if (c.col <= fin) c.col = fin + 1;
    fin = c.col + c.etiqueta.length;
  }
  return cs;
}

function lineaDeAcordes(colocados) {
  let linea = '';
  let visible = 0;
  for (const c of colocados) {
    linea += ' '.repeat(Math.max(0, c.col - visible)) + `${c.abre}${c.etiqueta}</a>`;
    visible = c.col + c.etiqueta.length;
  }
  return linea;
}

// ---------- del modelo al <pre> ----------

/** Sanea los cortes: ordenados, sin duplicados, de 0 al total de palabras. */
function sanearCortes(cortes, total) {
  const limpios = [...new Set(cortes.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n < total))];
  limpios.sort((a, b) => a - b);
  return [0, ...limpios, total];
}

/**
 * Pinta el `<pre>` desde el modelo y devuelve un informe por verso.
 * Es la única función que genera HTML: la usan el CLI y el revisor.
 */
export function renderizarPlan(plan) {
  const palabras = plan.palabras || [];
  const prefijo = prefijos(palabras);
  const total = prefijo[prefijo.length - 1];
  const cortes = sanearCortes(plan.cortes || [0], palabras.length);
  const largosBase = plan.largosBase || [];
  const tok = { palabras, prefijo, propios: new Set(plan.propios || []) };
  const blancos = plan.blancos || [];
  const metas = plan.metas || [];
  const acordes = (plan.acordes || []).map((a, i) => ({ ...a, i: a.i ?? i }));
  const avisos = [];

  // Acordes fuera de rango: se llevan al último verso para no perderlos.
  const usados = new Set();
  const salida = [];
  const versos = [];
  const nVersos = cortes.length - 1;

  for (let v = 0; v < nVersos; v++) {
    for (const _b of blancos.filter((x) => x === v)) salida.push('');
    for (const m of metas.filter((x) => x.antesDe === v)) salida.push(m.texto);

    const a = cortes[v];
    const b = cortes[v + 1];
    const texto = textoTramo(tok, a, b);
    const an = analizarVerso(texto);
    const desde = prefijo[a];
    const hasta = prefijo[b];
    const colocados = [];
    for (const ac of acordes) {
      if (ac.pos < desde || ac.pos >= hasta) continue;
      const idx = Math.min(ac.pos - desde, Math.max(0, an.reales.length - 1));
      const real = an.reales[idx];
      colocados.push({
        col: real?.inicio ?? 0,
        etiqueta: ac.etiqueta,
        abre: ac.abre,
        pos: ac.pos,
        i: ac.i,
        silaba: real?.texto ?? '',
      });
      usados.add(ac.i);
    }
    const resueltos = resolverColumnas(colocados);
    if (resueltos.length) salida.push(lineaDeAcordes(resueltos));
    salida.push(texto);

    // Palabras del verso con su offset en `texto` (para el revisor).
    const ws = texto.split(' ');
    let p = 0;
    const palabrasVerso = ws.map((w, k) => {
      const o = { i: a + k, ini: p, fin: p + w.length };
      p += w.length + 1;
      return o;
    });

    const largoBase = largosBase[v] ?? null;
    versos.push({
      n: v + 1,
      texto,
      largo: an.tonica + 1,
      largoBase,
      dif: largoBase === null ? null : an.tonica + 1 - largoBase,
      acordes: resueltos.map((c) => ({ i: c.i, col: c.col, etiqueta: c.etiqueta, pos: c.pos, silaba: c.silaba })),
      palabras: palabrasVerso,
      blancos: blancos.filter((x) => x === v).length,
      metas: metas.filter((x) => x.antesDe === v).map((m) => m.texto),
    });
  }

  // Cola: líneas en blanco y marcas después del último verso.
  for (const _b of blancos.filter((x) => x >= nVersos)) salida.push('');
  for (const m of metas.filter((x) => x.antesDe >= nVersos)) salida.push(m.texto);

  const huerfanos = acordes.filter((a) => !usados.has(a.i));
  if (huerfanos.length) {
    avisos.push(`${huerfanos.length} acorde(s) fuera de la letra: ${huerfanos.map((a) => a.etiqueta).join(' ')}.`);
    // Se colocan al final del último verso para no perderlos.
    const ultimo = versos[versos.length - 1];
    if (ultimo) {
      const extra = resolverColumnas(huerfanos.map((a) => ({ col: 9999, etiqueta: a.etiqueta, abre: a.abre, pos: total - 1, i: a.i })));
      const linea = lineaDeAcordes(extra);
      salida.splice(salida.length - 1, 0, linea);
    }
  }

  while (salida.length && salida[salida.length - 1] === '') salida.pop();
  return { salida, versos, avisos, total, acordes };
}

// ---------- generación ----------

/**
 * Pone los acordes de `base` sobre la letra `tok` según el reparto `alin`.
 * Devuelve también el modelo (`plan`) para poder retocarlo con el revisor.
 */
export function generar(base, tok, alin, params = PARAMS) {
  const palabras = tok.palabras.map((p) => ({
    texto: p.texto, linea: p.linea, inicioLinea: p.inicioLinea, finLinea: p.finLinea,
  }));
  const cortes = [0];
  const acordes = [];
  const blancos = [];
  const metas = [];
  const largosBase = [];
  const avisos = [];
  let vBase = 0;
  let usados = 0;

  for (const it of base.items) {
    if (it.tipo === 'blanco') { blancos.push(usados); continue; }
    if (it.tipo === 'meta' || it.tipo === 'instrumental') { metas.push({ antesDe: usados, texto: it.texto }); continue; }
    const tramo = alin.asignacion[vBase] || null;
    vBase++;
    if (!tramo) continue;
    const [a, b] = tramo;
    if (a !== cortes[cortes.length - 1]) {
      throw new Error(`Reparto no contiguo en el verso ${vBase} de la base (palabra ${a}, se esperaba ${cortes[cortes.length - 1]}).`);
    }
    const texto = textoTramo(tok, a, b);
    const an = analizarVerso(texto);
    for (const c of colocar(it, an, tok.prefijo[a], params)) {
      acordes.push({ etiqueta: c.etiqueta, abre: c.abre, pos: c.pos });
    }
    cortes.push(b);
    largosBase.push(it.largo);
    usados++;
  }

  const cubiertas = cortes[cortes.length - 1];
  if (cubiertas < palabras.length) {
    avisos.push(`Sobran ${palabras.length - cubiertas} palabra(s) al final de la letra; se pegan al último verso. Revisa los cortes.`);
    cortes[cortes.length - 1] = palabras.length;
  }
  if (base.versos.length > usados) {
    avisos.push(`La letra acaba antes que la base: ${base.versos.length - usados} verso(s) de la base sin usar.`);
  }

  const plan = {
    palabras, cortes, acordes, blancos, metas, largosBase, propios: [...tok.propios], prefijo: tok.prefijo,
  };
  const { salida, versos, avisos: avisosRender } = renderizarPlan(plan);
  return { salida, versos, plan, avisos: [...avisos, ...avisosRender] };
}
