// Revisor de fichas en modo texto: se edita el `<pre>` tal cual.
//
// Tres columnas: la ficha original a la izquierda, el editor en el centro y la
// ficha base a la derecha. Los acordes se ven sin las etiquetas `<a>`, encima de
// su sílaba, y se mueven de columna (Alt+←/→). Al guardar se vuelven a envolver
// y se escribe el `.md` sin tocar el frontmatter.
//
// Uso:
//   npm run acordes:revisar -- --slug <slug> [--base <slug>] [--puerto 4324] [--abrir]
//   npm run acordes:revisar -- --slug <slug> --silabas     (revisor antiguo)
//
// El modo texto no adivina: si un token de una línea de acordes no es un acorde,
// no guarda y te dice la línea y la columna. Antes de escribir deja respaldo en
// `.cache/planes/<slug>.bak.md`.

import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import {
  desenvolver, envolver, montarMd, revisar, clasificar, esAcorde, tieneDiagrama,
  ANCHO_MAX, cortePorAncho,
} from './lib/pre-acordes.mjs';
import { leerFicha, hermanasDetalle } from './lib/acordes-letra.mjs';

function leerArgs(argv) {
  const a = {};
  const sueltos = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { sueltos.push(argv[i]); continue; }
    const k = argv[i].slice(2);
    const sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) a[k] = true;
    else { a[k] = sig; i++; }
  }
  a._ = sueltos;
  return a;
}

const args = leerArgs(process.argv.slice(2));

if (args.silabas) {
  await import('./revisar-silabas.mjs');
} else {
  await main();
}

async function main() {
  const slug = String(args.slug || args._[0] || '').replace(/\.md$/, '');
  if (!slug) {
    console.error('Uso: npm run acordes:revisar -- --slug <slug> [--base <slug>] [--puerto 4324]');
    process.exit(1);
  }
  const puerto = Number(args.puerto || process.env.PUERTO || 4324);

  let ficha;
  try {
    ficha = leerFicha(slug);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  let d;
  try {
    d = desenvolver(ficha.texto);
  } catch (e) {
    console.error(`❌ ${slug}: ${e.message}`);
    process.exit(1);
  }

  const campo = (k) => (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(d.frontmatter)?.[1] || '').trim().replace(/^['"]|['"]$/g, '');
  const titulo = campo('letraTitulo') || campo('pieza');
  const meta = [campo('pieza'), campo('agrupacion'), campo('year')].filter(Boolean).join(' · ');

  // ---------- base de referencia ----------
  function elegirBase() {
    if (args.base) {
      try { return leerFicha(String(args.base)); } catch { return null; }
    }
    const otras = hermanasDetalle(slug).slugs.filter((s) => s !== slug);
    for (const s of otras) {
      try { return leerFicha(s); } catch { /* siguiente */ }
    }
    return null;
  }
  const base = elegirBase();
  let baseTexto = null;
  if (base) {
    try { baseTexto = desenvolver(base.texto).texto; } catch { baseTexto = null; }
  }

  // ---------- etiquetas conocidas (para el color y las sugerencias) ----------
  const etiquetas = new Set(Object.keys(JSON.parse(readFileSync('src/data/glosario-acordes.json', 'utf8')).acordes));
  const CARPETA = 'src/content/acordes';
  for (const f of readdirSync(CARPETA).filter((x) => x.endsWith('.md'))) {
    for (const mm of readFileSync(join(CARPETA, f), 'utf8').matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)) {
      const t = mm[1].trim();
      if (t) etiquetas.add(t);
    }
  }
  for (const r of d.registros.flat()) etiquetas.add(r.etiqueta);
  const sugerencias = [...etiquetas].sort((a, b) => a.localeCompare(b, 'es'));

  // ---------- pintado del texto para las referencias ----------
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const spanHtml = (txt, cls) => (cls ? `<span class="${cls}">${esc(txt)}</span>` : esc(txt));

  /** HTML de una línea, con lo que pasa de ANCHO_MAX en rojo subrayado. */
  function htmlLinea(linea, tipo) {
    const corte = cortePorAncho(linea);
    const piezas = [];
    if (tipo === 'acordes' || tipo === 'acordes-sucio') {
      let ultimo = 0;
      for (const mm of linea.matchAll(/\S+/g)) {
        if (mm.index > ultimo) piezas.push([linea.slice(ultimo, mm.index), '']);
        const t = mm[0];
        piezas.push([t, /^\(.*\)$/.test(t) ? 'anot' : (etiquetas.has(t) ? 'ac' : 'nuevo')]);
        ultimo = mm.index + t.length;
      }
      if (ultimo < linea.length) piezas.push([linea.slice(ultimo), '']);
    } else {
      piezas.push([linea, '']);
    }
    let pos = 0;
    let out = '';
    for (const [txt, cls] of piezas) {
      const fin = pos + txt.length;
      if (corte < 0 || fin <= corte) out += spanHtml(txt, cls);
      else if (pos >= corte) out += spanHtml(txt, cls ? cls + ' pasado' : 'pasado');
      else {
        const k = corte - pos;
        out += spanHtml(txt.slice(0, k), cls);
        out += spanHtml(txt.slice(k), cls ? cls + ' pasado' : 'pasado');
      }
      pos = fin;
    }
    return out;
  }

  function pintar(texto) {
    const lineas = String(texto).split('\n');
    const conocido = new Set(etiquetas);
    return lineas.map((linea, i) => {
      const c = clasificar(linea, lineas[i + 1] || '', conocido);
      return htmlLinea(linea, c.tipo);
    }).join('\n');
  }

  // ---------- página ----------
  const datos = {
    slug,
    titulo,
    meta,
    base: base ? base.slug : null,
    total: d.texto.split('\n').length,
    etiquetas: sugerencias,
    ancho: ANCHO_MAX,
  };

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Editar ${slug}</title>
<style>
  :root { --tinta:#1d1a16; --papel:#fbf8f1; --suave:#8a8175; --linea:#e2dacb; --acento:#b4552b; --ok:#3d7a4a; --nuevo:#b07d12; --mal:#b3261e; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin:0; background:var(--papel); color:var(--tinta); font:14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; display:flex; flex-direction:column; }
  header { flex:0 0 auto; border-bottom:1px solid var(--linea); padding:8px 14px; display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0; font-weight:650; }
  .meta { color:var(--suave); font-size:12.5px; }
  .barra { display:flex; gap:8px; align-items:center; margin-left:auto; }
  button { font:inherit; font-size:12.5px; padding:4px 10px; border:1px solid var(--linea); background:#fff; color:var(--tinta); border-radius:6px; cursor:pointer; }
  button:hover { border-color:var(--acento); color:var(--acento); }
  button.principal { background:var(--acento); border-color:var(--acento); color:#fff; }
  button.principal:hover { color:#fff; filter:brightness(1.08); }
  .estado { font-size:12px; color:var(--suave); }
  .estado.ok { color:var(--ok); }
  .estado.mal { color:var(--mal); }
  main { flex:1 1 0; display:grid; grid-template-columns: 1fr 1.35fr 1fr; min-height:0; overflow:hidden; }
  section { min-width:0; min-height:0; overflow:hidden; display:flex; flex-direction:column; border-right:1px solid var(--linea); }
  section:last-child { border-right:0; }
  .cab { padding:6px 12px; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--suave); border-bottom:1px solid var(--linea); display:flex; gap:8px; }
  .cab b { color:var(--tinta); font-weight:600; letter-spacing:0; text-transform:none; font-size:12px; }
  .cab .mal { color:var(--mal); }
  #ancho-meta { margin-left:auto; font-variant-numeric:tabular-nums; }
  .lienzo { position:relative; flex:1 1 auto; min-height:0; overflow:hidden; }
  section.editor { min-height: 340px; }
  pre, textarea {
    margin:0; padding:14px 16px; border:0; width:100%; height:100%;
    font:13.5px/1.55 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    white-space:pre; overflow:auto; tab-size:4;
  }
  pre { color:var(--tinta); }
  textarea {
    position:absolute; inset:0; resize:none; background:transparent; color:transparent;
    caret-color:var(--acento); outline:none;
  }
  textarea::selection { background:rgba(180,85,43,.22); }
  #capa { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
  /* Guía del ancho previsto: la columna 56 empieza justo aquí. Se desplaza con
     el scroll del textarea (el JS le pone transform). */
  #regla { position:absolute; top:0; bottom:0; left:calc(16px + 55ch); width:0; border-left:1px dashed rgba(180,85,43,.42); pointer-events:none; font:13.5px/1.55 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; }
  .ac { color:var(--acento); }
  .nuevo { color:var(--nuevo); text-decoration:underline dotted; }
  .anot, .mal { color:var(--suave); }
  .mal { color:var(--mal); text-decoration:underline wavy; }
  /* Lo que pasa de la columna 55: rojo y subrayado (no hay salto de línea). */
  .pasado { color:var(--mal); text-decoration:underline; text-underline-offset:2px; }
  footer { flex:0 0 auto; border-top:1px solid var(--linea); padding:5px 14px; font-size:11.5px; color:var(--suave); display:flex; gap:14px; flex-wrap:wrap; }
  kbd { font:11px ui-monospace, monospace; border:1px solid var(--linea); border-bottom-width:2px; border-radius:4px; padding:0 4px; background:#fff; }
  #sug { position:absolute; z-index:10; background:#fff; border:1px solid var(--linea); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.12); padding:4px; display:none; max-height:220px; overflow:auto; }
  #sug button { display:block; width:100%; text-align:left; border:0; border-radius:5px; padding:3px 8px; font:12.5px ui-monospace, monospace; background:transparent; }
  #sug button:hover, #sug button.sel { background:#f2e3d8; color:var(--acento); }
  .aviso { position:absolute; left:14px; right:14px; bottom:12px; background:#fff; border:1px solid var(--linea); border-left:4px solid var(--acento); border-radius:6px; padding:8px 10px; font-size:12.5px; display:none; white-space:pre-wrap; }
  @media (max-width: 1100px) {
    main { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
    section.ref { max-height: 26vh; }
    section.editor { min-height: 62vh; }
  }
</style>
</head>
<body>
<header>
  <h1 id="titulo"></h1>
  <span class="meta" id="meta"></span>
  <span class="estado" id="estado">guardado</span>
  <div class="barra">
    <button id="b-comprobar">Comprobar</button>
    <button id="b-deshacer" title="Ctrl+Z">Deshacer</button>
    <button id="b-rehacer" title="Ctrl+Y">Rehacer</button>
    <button id="b-guardar" class="principal" title="Ctrl+S">Guardar</button>
  </div>
</header>
<main>
  <section class="ref">
    <div class="cab"><b>Original</b><span>la ficha tal como está</span></div>
    <pre id="ref-izq">${pintar(d.texto)}</pre>
  </section>
  <section class="editor">
    <div class="cab"><b>Editor</b><span>acordes encima de la letra · Alt+←/→ los mueve una columna</span><span id="ancho-meta"></span></div>
    <div class="lienzo">
      <pre id="capa"></pre>
      <textarea id="editor" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <div id="regla" aria-hidden="true"></div>
      <div id="sug"></div>
      <div class="aviso" id="aviso"></div>
    </div>
  </section>
  <section>
    <div class="cab"><b>Base</b><span id="base-nombre"></span></div>
    <pre id="ref-der">${baseTexto ? pintar(baseTexto) : 'Sin ficha base para comparar.'}</pre>
  </section>
</main>
<footer>
  <span><kbd>Alt</kbd>+<kbd>←</kbd><kbd>→</kbd> mover acorde una columna</span>
  <span><kbd>Ctrl</kbd>+<kbd>S</kbd> guardar</span>
  <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer</span>
  <span><kbd>Esc</kbd> cerrar sugerencias</span>
</footer>
<script>
const DATOS = ${JSON.stringify(datos)};
const INICIAL = ${JSON.stringify(d.texto)};
const CONOCIDOS = new Set(DATOS.etiquetas);

const ta = document.getElementById('editor');
const capa = document.getElementById('capa');
const regla = document.getElementById('regla');
regla.style.left = 'calc(16px + ' + DATOS.ancho + 'ch)';
const estado = document.getElementById('estado');
const aviso = document.getElementById('aviso');
const sug = document.getElementById('sug');
const refIzq = document.getElementById('ref-izq');
const refDer = document.getElementById('ref-der');

document.getElementById('titulo').textContent = DATOS.titulo;
document.getElementById('meta').textContent = DATOS.meta;
document.getElementById('base-nombre').textContent = DATOS.base ? DATOS.base : 'sin base';

ta.value = INICIAL;

let hist = [];
let futuro = [];
let anterior = INICIAL;
let sucio = false;
let indiceSug = 0;
let tokensSug = [];

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function pareceAcorde(t) {
  const limpio = t.replace(/[()]/g, '');
  const m = limpio.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(.*)$/i);
  if (!m) return false;
  if (limpio.length > 14) return false;
  return /^(maj|min|m|M|dim|aug|sus|add|b|#|\\d|\\/|º|°)*$/i.test(m[3]);
}
function esAnotacion(t) { return /^\\(.*\\)$/.test(t); }
function tipoLinea(linea, siguiente) {
  const crudo = linea.replace(/\\s+$/, '');
  if (!crudo.trim()) return 'blanco';
  if (/^<strong>[\\s\\S]*<\\/strong>$/.test(crudo.trim())) return 'meta';
  const tokens = crudo.trim().split(/\\s+/);
  const validos = tokens.filter(function (t) { return pareceAcorde(t) || esAnotacion(t) || CONOCIDOS.has(t); });
  const tiene = tokens.some(function (t) { return pareceAcorde(t) || CONOCIDOS.has(t); });
  if (validos.length === tokens.length && tiene) return 'acordes';
  return 'letra';
}
const ANCHO = DATOS.ancho;
function claseCss() {
  return Array.prototype.filter.call(arguments, Boolean).join(' ');
}
function spanHtml(txt, cls) {
  return cls ? '<span class="' + cls + '">' + esc(txt) + '</span>' : esc(txt);
}
function columnasLinea(linea) {
  const limpia = linea.replace(/\\s+$/, '');
  let col = 0;
  for (let i = 0; i < limpia.length; i++) col += limpia[i] === '\\t' ? 4 - (col % 4) : 1;
  return col;
}
function cortePorAncho(linea) {
  const limpia = linea.replace(/\\s+$/, '');
  let col = 0;
  for (let i = 0; i < limpia.length; i++) {
    const salto = limpia[i] === '\\t' ? 4 - (col % 4) : 1;
    if (col + salto > ANCHO) return i;
    col += salto;
  }
  return -1;
}
function htmlLinea(linea, tipo) {
  const corte = cortePorAncho(linea);
  const piezas = [];
  if (tipo === 'acordes') {
    let ultimo = 0;
    const re = /\\S+/g;
    let m;
    while ((m = re.exec(linea))) {
      if (m.index > ultimo) piezas.push([linea.slice(ultimo, m.index), '']);
      const t = m[0];
      let cls = 'ac';
      if (esAnotacion(t) && !CONOCIDOS.has(t)) cls = 'anot';
      else if (!CONOCIDOS.has(t)) cls = 'nuevo';
      piezas.push([t, cls]);
      ultimo = m.index + t.length;
    }
    if (ultimo < linea.length) piezas.push([linea.slice(ultimo), '']);
  } else {
    piezas.push([linea, '']);
  }
  let pos = 0;
  let out = '';
  for (let i = 0; i < piezas.length; i++) {
    const txt = piezas[i][0];
    const cls = piezas[i][1];
    const fin = pos + txt.length;
    if (corte < 0 || fin <= corte) out += spanHtml(txt, cls);
    else if (pos >= corte) out += spanHtml(txt, claseCss(cls, 'pasado'));
    else {
      const k = corte - pos;
      out += spanHtml(txt.slice(0, k), cls);
      out += spanHtml(txt.slice(k), claseCss(cls, 'pasado'));
    }
    pos = fin;
  }
  return out;
}
function pintarEditor() {
  const lineas = ta.value.split('\\n');
  let html = '';
  for (let i = 0; i < lineas.length; i++) {
    html += htmlLinea(lineas[i], tipoLinea(lineas[i], lineas[i + 1] || '')) + '\\n';
  }
  capa.innerHTML = html;
  capa.scrollTop = ta.scrollTop;
  capa.scrollLeft = ta.scrollLeft;
  let max = 0;
  for (let i = 0; i < lineas.length; i++) max = Math.max(max, columnasLinea(lineas[i]));
  const meta = document.getElementById('ancho-meta');
  meta.textContent = max + '/' + ANCHO;
  meta.className = max > ANCHO ? 'mal' : '';
}

function marcarSucio() {
  sucio = true;
  estado.textContent = 'sin guardar';
  estado.className = 'estado';
}
function fijarEstado(txt, ok) {
  estado.textContent = txt;
  estado.className = 'estado' + (ok ? ' ok' : ' mal');
  sucio = !ok;
}

function mover(dir) {
  const texto = ta.value;
  const pos = ta.selectionStart;
  let ini = pos;
  while (ini > 0 && !/\\s/.test(texto[ini - 1])) ini--;
  let fin = pos;
  while (fin < texto.length && !/\\s/.test(texto[fin])) fin++;
  if (ini === fin) return;

  const iniLinea = texto.lastIndexOf('\\n', ini - 1) + 1;
  const finLinea = texto.indexOf('\\n', fin);
  const fl = finLinea < 0 ? texto.length : finLinea;
  const linea = texto.slice(iniLinea, fl);
  if (tipoLinea(linea) !== 'acordes') return;

  const a = ini - iniLinea;
  const b = fin - iniLinea;
  let nueva = null;
  if (dir < 0) {
    if (a === 0 || linea[a - 1] !== ' ') return;
    nueva = linea.slice(0, a - 1) + linea.slice(a, b) + ' ' + linea.slice(b);
  } else {
    if (b >= linea.length || linea[b] !== ' ') return;
    nueva = linea.slice(0, a) + ' ' + linea.slice(a, b) + linea.slice(b + 1);
  }
  if (nueva === linea) return;

  hist.push(texto);
  if (hist.length > 300) hist.shift();
  futuro = [];
  ta.value = texto.slice(0, iniLinea) + nueva + texto.slice(fl);
  const nuevaPos = iniLinea + (dir < 0 ? a - 1 : a + 1);
  ta.setSelectionRange(nuevaPos, nuevaPos);
  marcarSucio();
  pintarEditor();
}

function deshacer() {
  if (!hist.length) return;
  futuro.push(ta.value);
  ta.value = hist.pop();
  marcarSucio();
  pintarEditor();
}
function rehacer() {
  if (!futuro.length) return;
  hist.push(ta.value);
  ta.value = futuro.pop();
  marcarSucio();
  pintarEditor();
}

async function enviar(ruta) {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: ta.value }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.errores && d.errores.join('\\n')) || d.error || 'error');
  return d;
}

async function comprobar() {
  try {
    const d = await enviar('/comprobar');
    aviso.style.display = 'block';
    aviso.style.borderLeftColor = d.avisos.length ? '#b07d12' : '#3d7a4a';
    aviso.textContent = (d.avisos.length ? d.avisos.join('\\n') : 'Todo cuadra: ' + d.acordes + ' acordes, sin avisos.');
  } catch (e) {
    aviso.style.display = 'block';
    aviso.style.borderLeftColor = '#b3261e';
    aviso.textContent = e.message;
  }
}

async function guardar() {
  try {
    const d = await enviar('/guardar');
    fijarEstado('guardado · ' + d.acordes + ' acordes', true);
    aviso.style.display = 'block';
    aviso.style.borderLeftColor = d.avisos.length ? '#b07d12' : '#3d7a4a';
    aviso.textContent = d.avisos.length ? d.avisos.join('\\n') : 'Guardado. ' + d.acordes + ' acordes.';
  } catch (e) {
    aviso.style.display = 'block';
    aviso.style.borderLeftColor = '#b3261e';
    aviso.textContent = e.message;
    fijarEstado('no se ha guardado', false);
  }
}

/* ---------- sugerencias de acordes ---------- */
function tokenActual() {
  const texto = ta.value;
  const pos = ta.selectionStart;
  let ini = pos;
  while (ini > 0 && !/\\s/.test(texto[ini - 1])) ini--;
  const token = texto.slice(ini, pos);
  const iniLinea = texto.lastIndexOf('\\n', ini - 1) + 1;
  const finLinea = texto.indexOf('\\n', pos);
  const linea = texto.slice(iniLinea, finLinea < 0 ? texto.length : finLinea);
  return { ini, token, linea };
}
function cerrarSug() { sug.style.display = 'none'; sug.innerHTML = ''; tokensSug = []; }
function abrirSug() {
  const { token, linea } = tokenActual();
  if (token.length < 2 || tipoLinea(linea) !== 'acordes') return cerrarSug();
  const q = token.toLowerCase();
  const encontrados = DATOS.etiquetas.filter(function (t) { return t.toLowerCase().indexOf(q) === 0 && t !== token; }).slice(0, 8);
  if (!encontrados.length) return cerrarSug();
  tokensSug = encontrados;
  indiceSug = 0;
  sug.innerHTML = '';
  encontrados.forEach(function (t, i) {
    const b = document.createElement('button');
    b.textContent = t;
    b.className = i === 0 ? 'sel' : '';
    b.onmousedown = function (ev) { ev.preventDefault(); insertarSug(t); };
    sug.appendChild(b);
  });
  const r = ta.getBoundingClientRect();
  sug.style.left = (r.left + 16) + 'px';
  sug.style.top = (r.top + 44) + 'px';
  sug.style.display = 'block';
}
function insertarSug(t) {
  const { ini, token } = tokenActual();
  const texto = ta.value;
  hist.push(texto);
  ta.value = texto.slice(0, ini) + t + texto.slice(ini + token.length);
  const p = ini + t.length;
  ta.setSelectionRange(p, p);
  cerrarSug();
  marcarSucio();
  pintarEditor();
}

/* ---------- eventos ---------- */
ta.addEventListener('input', function () {
  hist.push(anterior);
  if (hist.length > 300) hist.shift();
  futuro = [];
  anterior = ta.value;
  marcarSucio();
  pintarEditor();
  const { token, linea } = tokenActual();
  if (token.length >= 2 && tipoLinea(linea) === 'acordes') abrirSug();
  else cerrarSug();
});
ta.addEventListener('scroll', function () {
  capa.scrollTop = ta.scrollTop;
  capa.scrollLeft = ta.scrollLeft;
  regla.style.transform = 'translateX(' + (-ta.scrollLeft) + 'px)';
});
ta.addEventListener('keydown', function (e) {
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return mover(-1); }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return mover(1); }
  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return guardar(); }
  if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); return deshacer(); }
  if (e.ctrlKey && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) { e.preventDefault(); return rehacer(); }
  if (e.key === 'Escape') return cerrarSug();
  if (sug.style.display === 'block') {
    if (e.key === 'ArrowDown') { e.preventDefault(); indiceSug = (indiceSug + 1) % tokensSug.length; marcarSug(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); indiceSug = (indiceSug - 1 + tokensSug.length) % tokensSug.length; marcarSug(); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return insertarSug(tokensSug[indiceSug]); }
  }
});
function marcarSug() {
  const bs = sug.querySelectorAll('button');
  bs.forEach(function (b, i) { b.className = i === indiceSug ? 'sel' : ''; });
}

document.getElementById('b-comprobar').onclick = comprobar;
document.getElementById('b-guardar').onclick = guardar;
document.getElementById('b-deshacer').onclick = deshacer;
document.getElementById('b-rehacer').onclick = rehacer;

/* scroll sincronizado de las referencias */
let sincronizar = true;
ta.addEventListener('scroll', function () {
  if (!sincronizar) return;
  const total = ta.scrollHeight - ta.clientHeight;
  if (total <= 0) return;
  const ratio = ta.scrollTop / total;
  [refIzq, refDer].forEach(function (p) {
    p.scrollTop = ratio * (p.scrollHeight - p.clientHeight);
  });
});

pintarEditor();
</script>
</body>
</html>`;

  // ---------- servidor ----------
  const leerCuerpo = (req) => new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 4e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });

  const servidor = http.createServer(async (req, res) => {
    const responderA = (codigo, obj) => {
      res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(obj));
    };
    try {
      if (req.method === 'GET' && req.url.startsWith('/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'POST' && (req.url === '/comprobar' || req.url === '/guardar')) {
        const cuerpo = await leerCuerpo(req);
        const texto = String(cuerpo.texto ?? '');
        let envuelto;
        try {
          envuelto = envolver(texto, d.registros, d.originales);
        } catch (e) {
          return responderA(422, { error: e.message, errores: [e.message] });
        }
        const r = revisar(texto, d.texto);
        if (r.errores.length) return responderA(422, { error: r.errores[0], errores: r.errores });

        const avisos = [...envuelto.avisos, ...r.avisos];

        // Ida y vuelta: lo que se va a escribir tiene que releerse igual.
        const md = montarMd(d.frontmatter, envuelto.pre);
        let estable = true;
        try { estable = desenvolver(md).texto === texto; } catch { estable = false; }
        if (!estable) avisos.push('aviso: al releer el bloque cambia el texto (revisa espacios raros)');

        if (req.url === '/comprobar') {
          return responderA(200, { acordes: envuelto.acordes, avisos });
        }

        try {
          mkdirSync('.cache/planes', { recursive: true });
          if (existsSync(ficha.ruta)) copyFileSync(ficha.ruta, join('.cache/planes', `${slug}.bak.md`));
        } catch { /* el respaldo es un extra */ }
        writeFileSync(ficha.ruta, md);
        try { d = desenvolver(md); } catch { /* se queda el modelo anterior */ }
        console.error(`✅ Guardado ${ficha.ruta} (${envuelto.acordes} acordes)`);
        return responderA(200, { guardado: ficha.ruta, acordes: envuelto.acordes, avisos });
      }

      responderA(404, { error: 'no encontrado' });
    } catch (e) {
      console.error(e);
      responderA(500, { error: String(e.message || e) });
    }
  });

  servidor.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`❌ El puerto ${puerto} está ocupado. Usa --puerto 4325.`);
      process.exit(1);
    }
    throw e;
  });

  servidor.listen(puerto, '127.0.0.1', () => {
    const url = `http://localhost:${puerto}/`;
    console.error(`Editando ${ficha.ruta}`);
    console.error(`  ${d.texto.split('\n').length} líneas · ${titulo}${base ? ` · base ${base.slug}` : ' (sin base)'}`);
    console.error(`  ${url}`);
    console.error('  Ctrl+C para cerrar.');
    if (args.abrir) exec(`start "" "${url}"`);
  });
}
