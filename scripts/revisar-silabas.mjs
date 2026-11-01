// Revisor local de una ficha de acordes.
//
// Levanta una página en localhost para retocar el cifrado de una ficha ya
// escrita (generada o hecha a mano): mover cada acorde de sílaba, juntar o
// partir versos y deshacer. Guarda reescribiendo el .md con las columnas bien
// puestas; no toca el frontmatter.
//
// Uso:
//   npm run acordes:revisar -- --slug pasodoble-los-colgaos-cinco-anos
//   npm run acordes:revisar -- --slug pasodoble-la-azotea-la-carta --base pasodoble-la-azotea
//
// Opciones:
//   --slug <slug>      Ficha de src/content/acordes (también vale como primer argumento suelto).
//   --base <slug>      Ficha de la misma música para marcar los versos descuadrados.
//   --puerto <n>       4324 por defecto (el 4321 es del usuario).
//   --abrir            Abre el navegador.
//
// El modelo es el del .md: palabras, cortes de verso y `pos` de cada acorde
// (sílaba real contada desde el principio). Mover un acorde es cambiar su pos;
// juntar o partir versos es añadir o quitar un corte. El .md se regenera entero,
// así que nunca queda desalineado.

import http from 'node:http';
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import {
  leerFicha, leerLetra, alinear, emparejarVersos, renderizarPlan, hermanasDetalle, prefijos,
} from './lib/acordes-letra.mjs';

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
const slug = String(args.slug || args._[0] || '').replace(/\.md$/, '');
if (!slug) {
  console.error('Uso: npm run acordes:revisar -- --slug <slug> [--base <slug>] [--puerto 4324]');
  process.exit(1);
}
const puerto = Number(args.puerto || 4324);

let ficha;
try {
  ficha = leerFicha(slug);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

const TOTAL = prefijos(ficha.palabras).pop();
const campo = (k) => (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(ficha.frontmatter)?.[1] || '').trim().replace(/^['"]|['"]$/g, '');
const titulo = campo('letraTitulo');
const meta = [campo('pieza'), campo('agrupacion'), campo('year')].filter(Boolean).join(' · ');

// ---------- base para marcar los versos descuadrados ----------

function elegirBase() {
  if (args.base) {
    try { return leerFicha(String(args.base)); } catch { return null; }
  }
  const candidatas = hermanasDetalle(slug).slugs.filter((s) => s !== slug);
  if (!candidatas.length) return null;
  const tok = leerLetra(ficha.versos.map((v) => v.verso).join('\n'));
  let mejor = null;
  for (const c of candidatas) {
    let b;
    try { b = leerFicha(c); } catch { continue; }
    const alin = alinear(b.versos, tok);
    if (alin && (!mejor || alin.coste < mejor.coste)) mejor = { base: b, coste: alin.coste };
  }
  return mejor?.base ?? null;
}

const base = elegirBase();
let largosBase = null;
if (base) {
  const mapa = emparejarVersos(base.versos.map((v) => v.largo), ficha.versos.map((v) => v.largo));
  largosBase = mapa.map((i) => (i === null ? null : base.versos[i].largo));
}

let modelo = {
  cortes: ficha.cortes.slice(),
  acordes: ficha.acordes.map((a, i) => ({ ...a, i })),
};

// ---------- render ----------

function sanear(mod) {
  const cortes = (Array.isArray(mod.cortes) ? mod.cortes : [])
    .map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < ficha.palabras.length);
  const acordes = (Array.isArray(mod.acordes) ? mod.acordes : []).map((a, i) => ({
    etiqueta: String(a.etiqueta || ''),
    abre: String(a.abre || '<a>'),
    pos: Math.max(0, Math.min(TOTAL - 1, Math.round(Number(a.pos) || 0))),
    i: Number.isInteger(a.i) ? a.i : i,
  }));
  return { cortes: [0, ...new Set(cortes)].sort((x, y) => x - y), acordes };
}

function pintar(mod) {
  const plan = {
    palabras: ficha.palabras,
    cortes: mod.cortes,
    acordes: mod.acordes,
    blancos: ficha.blancos,
    metas: ficha.metas,
    largosBase,
    propios: ficha.propios,
  };
  const r = renderizarPlan(plan);
  return {
    salida: r.salida,
    versos: r.versos,
    avisos: r.avisos,
    total: r.total,
    cortes: plan.cortes,
    acordes: r.acordes,
    nAcordes: mod.acordes.length,
    malos: r.versos.filter((v) => v.dif !== null && Math.abs(v.dif) > 1).map((v) => v.n),
  };
}

let ultimo = pintar(modelo);

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ---------- página ----------

const datos = {
  slug,
  titulo,
  meta,
  base: base ? base.slug : null,
  conBase: Boolean(largosBase),
  total: TOTAL,
  nPalabras: ficha.palabras.length,
};
const inicio = {
  modelo: { cortes: modelo.cortes, acordes: modelo.acordes },
  render: ultimo,
};

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisar ${slug}</title>
<style>
  :root { --tinta:#1d1a16; --papel:#fbf8f1; --suave:#8a8175; --linea:#e2dacb; --acento:#b4552b; --ok:#3d7a4a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--papel); color:var(--tinta); font:15px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
  header { position:sticky; top:0; z-index:5; background:var(--papel); border-bottom:1px solid var(--linea); padding:10px 18px; }
  .fila { display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
  h1 { font-size:16px; margin:0; font-weight:650; }
  .meta { color:var(--suave); font-size:13px; }
  .barra { display:flex; gap:8px; align-items:center; min-height:38px; margin-top:6px; flex-wrap:wrap; }
  button { font:inherit; font-size:13px; padding:5px 11px; border:1px solid var(--linea); background:#fff; color:var(--tinta); border-radius:7px; cursor:pointer; }
  button:hover { border-color:var(--acento); color:var(--acento); }
  button:disabled { opacity:.35; cursor:default; }
  button.principal { background:var(--acento); border-color:var(--acento); color:#fff; }
  button.principal:hover { color:#fff; filter:brightness(1.08); }
  button.peligro:hover { border-color:#b3261e; color:#b3261e; }
  .estado { font-size:12px; color:var(--suave); margin-left:auto; }
  .estado.ok { color:var(--ok); }
  main { padding:26px 18px 120px; }
  .verso { margin:0 0 12px; padding:2px 8px; border-left:3px solid transparent; border-radius:4px; }
  .verso.con-blanco { margin-top:28px; }
  .verso:hover { border-left-color:var(--linea); }
  .cab { font:11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; color:var(--suave); margin-bottom:2px; user-select:none; }
  .cab.mal { color:var(--acento); font-weight:700; }
  .meta-linea { font-size:12px; color:var(--suave); text-transform:uppercase; letter-spacing:.06em; }
  .linea { font:15px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space:pre; overflow-x:auto; }
  .linea.acordes { color:var(--acento); min-height:1.55em; }
  .ac { cursor:pointer; border-radius:3px; padding:0 1px; }
  .ac:hover { background:#f2e3d8; }
  .ac.sel { background:var(--acento); color:#fff; }
  .pal { cursor:pointer; border-radius:3px; }
  .pal:hover { background:#efe7d8; }
  .pal.sel { background:#eadfc8; }
  .pal.inicio { border-bottom:2px solid var(--acento); }
  footer { position:fixed; left:0; right:0; bottom:0; background:var(--papel); border-top:1px solid var(--linea); padding:7px 18px; font-size:12px; color:var(--suave); }
  kbd { font:11px ui-monospace, monospace; border:1px solid var(--linea); border-bottom-width:2px; border-radius:4px; padding:0 4px; background:#fff; }
  .ayuda { display:flex; gap:14px; flex-wrap:wrap; }
</style>
</head>
<body>
<header>
  <div class="fila">
    <h1 id="titulo"></h1>
    <span class="meta" id="meta"></span>
    <span class="estado" id="estado"></span>
  </div>
  <div class="barra" id="barra"></div>
</header>
<main id="main"></main>
<footer>
  <div class="ayuda">
    <span><kbd>←</kbd><kbd>→</kbd> mover acorde</span>
    <span><kbd>Supr</kbd> borrar acorde</span>
    <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> deshacer</span>
    <span><kbd>Ctrl</kbd>+<kbd>S</kbd> guardar</span>
    <span><kbd>Esc</kbd> quitar selección</span>
  </div>
</footer>
<script>
const DATOS = ${JSON.stringify(datos)};
const INICIO = ${JSON.stringify(inicio)};

let modelo = INICIO.modelo;
let ultimo = INICIO.render;
let sel = null;
let historial = [];
let sucio = false;

const $ = (id) => document.getElementById(id);
const main = $('main');
const barra = $('barra');

async function peticion(ruta) {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cortes: modelo.cortes, acordes: modelo.acordes }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

function fijarEstado(txt, ok) {
  const e = $('estado');
  e.textContent = txt;
  e.className = 'estado' + (ok ? ' ok' : '');
}

function pintar(d) {
  ultimo = d;
  main.innerHTML = '';
  const inicio = new Set(d.versos.map((v) => v.palabras[0] && v.palabras[0].i).filter((x) => x !== undefined));
  for (const v of d.versos) {
    const bloque = document.createElement('div');
    bloque.className = 'verso' + (v.blancos ? ' con-blanco' : '');
    const cab = document.createElement('div');
    cab.className = 'cab' + (v.dif !== null && Math.abs(v.dif) > 1 ? ' mal' : '');
    cab.textContent = '#' + v.n + ' · ' + v.largo + 's' +
      (v.dif !== null ? ' (base ' + v.largoBase + 's, ' + (v.dif > 0 ? '+' : '') + v.dif + ')' : '');
    bloque.appendChild(cab);
    for (const m of v.metas) {
      const linea = document.createElement('div');
      linea.className = 'linea meta-linea';
      linea.textContent = m;
      bloque.appendChild(linea);
    }
    const lc = document.createElement('div');
    lc.className = 'linea acordes';
    let vis = 0;
    for (const a of v.acordes) {
      lc.appendChild(document.createTextNode(' '.repeat(Math.max(0, a.col - vis))));
      const s = document.createElement('span');
      s.className = 'ac' + (sel && sel.tipo === 'acorde' && sel.i === a.i ? ' sel' : '');
      s.dataset.i = a.i;
      s.title = a.etiqueta + ' sobre «' + a.silaba + '»';
      s.textContent = a.etiqueta;
      lc.appendChild(s);
      vis = a.col + a.etiqueta.length;
    }
    const lt = document.createElement('div');
    lt.className = 'linea texto';
    let prev = 0;
    for (const w of v.palabras) {
      if (w.ini > prev) lt.appendChild(document.createTextNode(v.texto.slice(prev, w.ini)));
      const s = document.createElement('span');
      s.className = 'pal' + (sel && sel.tipo === 'palabra' && sel.i === w.i ? ' sel' : '') + (inicio.has(w.i) ? ' inicio' : '');
      s.dataset.i = w.i;
      s.textContent = v.texto.slice(w.ini, w.fin);
      lt.appendChild(s);
      prev = w.fin;
    }
    if (prev < v.texto.length) lt.appendChild(document.createTextNode(v.texto.slice(prev)));
    bloque.append(lc, lt);
    main.appendChild(bloque);
  }
  const n = d.versos.length;
  $('titulo').textContent = (DATOS.meta ? DATOS.meta + ' · ' : '') + (DATOS.titulo || DATOS.slug);
  $('meta').textContent = n + ' versos · ' + d.nAcordes + ' acordes' +
    (DATOS.conBase ? ' · base ' + DATOS.base : '') +
    (d.malos.length ? ' · ⚠️ descuadrados: ' + d.malos.join(', ') : '');
  fijarEstado(sucio ? 'sin guardar' : 'guardado', !sucio);
  if (d.avisos && d.avisos.length) fijarEstado(d.avisos.join(' '), false);
  pintarBarra();
}

function boton(txt, fn, clase, desactivado) {
  const b = document.createElement('button');
  b.textContent = txt;
  if (clase) b.className = clase;
  b.disabled = Boolean(desactivado);
  b.onclick = fn;
  return b;
}

function pintarBarra() {
  barra.innerHTML = '';
  if (sel && sel.tipo === 'acorde') {
    const a = modelo.acordes.find((x) => x.i === sel.i);
    if (!a) { sel = null; return pintarBarra(); }
    const et = document.createElement('span');
    et.innerHTML = 'Acorde <b>' + a.etiqueta + '</b> · ';
    barra.appendChild(et);
    barra.appendChild(boton('◀ sílaba', () => mover(-1)));
    barra.appendChild(boton('sílaba ▶', () => mover(1)));
    barra.appendChild(boton('borrar', borrar, 'peligro'));
    return;
  }
  if (sel && sel.tipo === 'palabra') {
    const i = sel.i;
    const esInicio = ultimo.versos.some((v) => v.palabras[0] && v.palabras[0].i === i);
    const texto = textoPalabra(i);
    const et = document.createElement('span');
    et.innerHTML = 'Palabra <b>' + texto + '</b> · ';
    barra.appendChild(et);
    barra.appendChild(boton('empezar verso aquí', () => cortar(i), null, esInicio));
    barra.appendChild(boton('unir con el de arriba', () => unir(i), null, !esInicio || i === 0));
    return;
  }
  const p = document.createElement('span');
  p.className = 'meta';
  p.textContent = 'Pincha un acorde para moverlo o una palabra para cortar el verso.';
  barra.appendChild(p);
  barra.appendChild(boton('deshacer', deshacer, null, !historial.length));
  barra.appendChild(boton('guardar', guardar, 'principal'));
}

function textoPalabra(i) {
  for (const v of ultimo.versos) for (const w of v.palabras) if (w.i === i) return v.texto.slice(w.ini, w.fin);
  return '';
}

function instantanea() {
  return JSON.stringify({ cortes: modelo.cortes, acordes: modelo.acordes });
}

async function mutar(fn) {
  const antes = instantanea();
  fn();
  try {
    const d = await peticion('/render');
    historial.push(antes);
    if (historial.length > 100) historial.shift();
    modelo.cortes = d.cortes;
    modelo.acordes = d.acordes;
    sucio = true;
    pintar(d);
  } catch (e) {
    console.error(e);
    fijarEstado('error: ' + e.message, false);
  }
}

function mover(delta) {
  if (!sel || sel.tipo !== 'acorde') return;
  const a = modelo.acordes.find((x) => x.i === sel.i);
  if (!a) return;
  const nueva = Math.max(0, Math.min(DATOS.total - 1, a.pos + delta));
  if (nueva === a.pos) return;
  mutar(() => { a.pos = nueva; });
}

function borrar() {
  if (!sel || sel.tipo !== 'acorde') return;
  const i = sel.i;
  sel = null;
  mutar(() => { modelo.acordes = modelo.acordes.filter((x) => x.i !== i); });
}

function cortar(indicePalabra) {
  if (indicePalabra <= 0 || indicePalabra >= DATOS.nPalabras) return;
  if (modelo.cortes.includes(indicePalabra)) return;
  sel = null;
  mutar(() => { modelo.cortes = [...modelo.cortes, indicePalabra].sort((a, b) => a - b); });
}

function unir(indicePalabra) {
  const v = ultimo.versos.find((x) => x.palabras[0] && x.palabras[0].i === indicePalabra);
  if (!v) return;
  const corte = indicePalabra;
  sel = null;
  mutar(() => { modelo.cortes = modelo.cortes.filter((c) => c !== corte); });
}

function deshacer() {
  if (!historial.length) return;
  const antes = JSON.parse(historial.pop());
  modelo.cortes = antes.cortes;
  modelo.acordes = antes.acordes;
  sel = null;
  sucio = true;
  peticion('/render').then((d) => {
    modelo.cortes = d.cortes;
    modelo.acordes = d.acordes;
    pintar(d);
  });
}

async function guardar() {
  try {
    const d = await peticion('/guardar');
    modelo.cortes = d.cortes;
    modelo.acordes = d.acordes;
    sucio = false;
    pintar(d);
    fijarEstado('guardado en ' + d.guardado, true);
  } catch (e) {
    fijarEstado('error al guardar: ' + e.message, false);
  }
}

main.addEventListener('click', (e) => {
  const ac = e.target.closest('.ac');
  if (ac) { sel = { tipo: 'acorde', i: Number(ac.dataset.i) }; pintar(ultimo); return; }
  const pal = e.target.closest('.pal');
  if (pal) { sel = { tipo: 'palabra', i: Number(pal.dataset.i) }; pintar(ultimo); return; }
  sel = null;
  pintar(ultimo);
});

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); return deshacer(); }
  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return guardar(); }
  if (e.key === 'Escape') { sel = null; return pintar(ultimo); }
  if (sel && sel.tipo === 'acorde') {
    if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); borrar(); }
  }
});

pintar(ultimo);
</script>
</body>
</html>`;

// ---------- servidor ----------

const servidor = http.createServer(async (req, res) => {
  const responder = (codigo, obj) => {
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  try {
    if (req.method === 'GET' && req.url.startsWith('/')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'POST' && req.url === '/render') {
      const cuerpo = await leerCuerpo(req);
      const limpio = sanear(cuerpo);
      modelo = limpio;
      return responder(200, pintar(limpio));
    }
    if (req.method === 'POST' && req.url === '/guardar') {
      const cuerpo = await leerCuerpo(req);
      const limpio = sanear(cuerpo);
      const d = pintar(limpio);
      try {
        mkdirSync('.cache/planes', { recursive: true });
        if (existsSync(ficha.ruta)) copyFileSync(ficha.ruta, join('.cache/planes', `${slug}.bak.md`));
      } catch { /* el respaldo es un extra */ }
      writeFileSync(ficha.ruta, `${ficha.frontmatter}<pre>\n${d.salida.join('\n')}\n</pre>\n`);
      modelo = limpio;
      console.error(`✅ Guardado ${ficha.ruta} (${d.nAcordes} acordes, ${d.versos.length} versos)`);
      return responder(200, { ...d, guardado: ficha.ruta });
    }
    responder(404, { error: 'no encontrado' });
  } catch (e) {
    console.error(e);
    responder(500, { error: String(e.message || e) });
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
  console.error(`Revisando ${ficha.ruta}`);
  console.error(`  ${ficha.nVersos} versos · ${ficha.acordes.length} acordes${base ? ` · base ${base.slug}` : ''}${largosBase ? '' : ' (sin base: no marco los descuadrados)'}`);
  console.error(`  ${url}`);
  console.error('  Ctrl+C para cerrar.');
  if (args.abrir) exec(`start "" "${url}"`);
});
