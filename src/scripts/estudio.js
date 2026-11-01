import { initPreAcordes, desenvolver, envolver, montarMd, revisar, clasificar, ANCHO_MAX, columnasLinea, cortePorAncho } from '../lib/pre-acordes.js';
import glosario from '../data/glosario-acordes.json';

initPreAcordes(glosario);

const API = '/estudio/api';
// En `astro dev` el panel trabaja contra los archivos del ordenador (sin PR).
// El servidor lo confirma con `local` en /me: por un túnel o por la IP de la red
// el hostname ya no es localhost, pero el panel sigue en modo local.
let MODO_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
// La ficha abierta lleva su slug en la URL (`/estudio/?ficha=...`), así el botón
// atrás vuelve a la lista en vez de salir del panel. La página es estática: el
// query no rompe nada y permite refrescar sin perder la ficha.
const urlFicha = (slug) => '/estudio/?ficha=' + encodeURIComponent(slug);
const estadoLista = { vista: 'lista' };
let creando = false;
const $ = (id) => document.getElementById(id);
const ta = $('editor');
const capa = $('capa');
const lienzo = $('lienzo');
const hoja = $('hoja');
const regla = $('regla');
// La guía va donde acaba la columna ANCHO_MAX (el CSS deja un 55 de reserva).
regla.style.left = 'calc(14px + ' + ANCHO_MAX + 'ch)';
const aviso = $('aviso');
const sug = $('sug');

let indice = [];
let ficha = null;      // { slug, md, d, pr }
let hist = [];
let futuro = [];
let anterior = '';
let sucio = false;
let sugerencias = [];
let sugSel = 0;
let paneActivo = 'cen';
let zonaFicha = 'acordes';
// Texto del aviso sin marcas, para el tuit (el textarea lleva el de WhatsApp).
let avisoX = '';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hoy = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };

function setEstado(txt, ok) {
  const e = $('cab-estado');
  e.textContent = txt;
  e.className = 'estado' + (ok ? ' ok' : ok === false ? ' mal' : '');
  sucio = ok === false;
}
function mostrarAviso(txt, color) {
  aviso.innerHTML = '<button class="cerrar" id="av-cerrar2">✕</button>' + esc(txt);
  aviso.style.display = 'block';
  aviso.style.borderLeftColor = color || 'var(--acento)';
  $('av-cerrar2').onclick = () => { aviso.style.display = 'none'; };
}
function cerrarAviso() { aviso.style.display = 'none'; }
/** Banda de estado de la ficha local (no tapa el editor). */
function mostrarNotaLocal(txt) {
  $('nota-local-texto').textContent = txt;
  $('nota-local').hidden = false;
}
function cerrarNotaLocal() { $('nota-local').hidden = true; }

/* ---------------- autenticación ---------------- */
/** Cuenta y modo (`{ login, local }`), o null si no hay sesión. */
async function quien() {
  try {
    const r = await fetch(API + '/me', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/* ---------------- lista ---------------- */
let filtroTipo = 'todas';
// Coplas que faltan por revisar (cola de `src/data/revision-acordes.json`).
let revision = new Set();

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Pendiente = borrador, ficha solo local o cualquiera con una PR abierta. */
const esPendiente = (x) => x.zona === 'acordes3' || !!x.enPR || !!x.local;
/** Ficha de la cola «Por revisar». */
const porRevisar = (x) => revision.has(x.slug);

async function cargarIndice() {
  if (indice.length) return indice;
  const r = await fetch('/indice-busqueda.json');
  const publicadas = (await r.json()).map((x) => ({ ...x, zona: 'acordes' }));
  let borradores = [];
  try {
    const b = await fetch(API + '/lista');
    if (b.ok) {
      const j = await b.json();
      borradores = j.borradores.map((x) => ({ ...x, zona: x.zona || 'acordes3' }));
      revision = new Set(j.revision || []);
    }
  } catch { /* sin borradores */ }
  indice = [...borradores, ...publicadas];
  const dl = $('slugs');
  dl.innerHTML = indice.slice(0, 400).map((x) => '<option value="' + esc(x.slug) + '">' + esc(x.pieza + ' · ' + x.agrupacion + ' · ' + x.year) + '</option>').join('');
  return indice;
}

const marcas = (x) => [
  x.zona === 'acordes3' ? '<span class="marca">BORRADOR</span>' : '',
  x.local ? '<span class="marca local">LOCAL</span>' : '',
  MODO_LOCAL && x.zona === 'acordes3' && !x.local
    ? '<span class="marca remoto" title="Solo está en GitHub: ábrelo y guárdalo para traerlo al ordenador">EN GITHUB</span>'
    : '',
  x.enPR ? '<span class="marca pr">EN PR</span>' : '',
  porRevisar(x) ? '<span class="marca revisar">POR REVISAR</span>' : '',
].filter(Boolean).join(' ');

function filaLista(x) {
  const boton = (accion, texto, extra) =>
    '<button type="button" class="acc' + (extra || '') + '" data-accion="' + accion + '" data-slug="' + esc(x.slug) + '"' +
      (accion === 'clonar' ? ' title="Crear otra ficha (otra letra) a partir de esta misma música" aria-label="Crear otra ficha a partir de esta música"' : '') +
      '>' + texto + '</button>';
  // En local solo se puede promover lo que está en el disco.
  const puedePublicar = x.zona === 'acordes3' && (!MODO_LOCAL || x.local);

  return '<article class="fila' + (esPendiente(x) ? ' pendiente' : '') + '">' +
    '<button type="button" class="fila-info" data-slug="' + esc(x.slug) + '">' +
      '<span class="f-agr">' + esc(x.agrupacion) + '</span>' +
      '<span class="f-meta">' +
        '<span class="f-year">' + esc(String(x.year || '—')) + '</span>' +
        '<span>' + esc(x.pieza) + '</span>' +
        (x.letraTitulo ? '<span class="f-letra">' + esc(x.letraTitulo) + '</span>' : '') +
        marcas(x) +
      '</span>' +
    '</button>' +
    '<div class="fila-acciones">' +
      boton('editar', 'Editar') +
      (puedePublicar ? boton('publicar', MODO_LOCAL ? 'Promover' : 'Publicar', ' principal') : '') +
      boton('clonar', '＋', ' icono') +
    '</div>' +
  '</article>';
}

function grupoLista(titulo, items, clase) {
  return '<div class="grupo' + (clase ? ' ' + clase : '') + '">' +
    '<span class="grupo-tit">' + esc(titulo) + '</span><i></i><span class="grupo-n">' + items.length + '</span></div>' +
    items.map(filaLista).join('');
}

function pintarLista() {
  const palabras = normalizar($('q').value).split(/\s+/).filter(Boolean);
  const coincide = (x) => {
    if (!palabras.length) return true;
    const t = normalizar([x.slug, x.pieza, x.agrupacion, x.year, x.letraTitulo, x.musica, x.letra].join(' '));
    return palabras.every((w) => t.includes(w));
  };

  const resultado = indice.filter(coincide);
  const pendientes = resultado.filter(esPendiente)
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || a.agrupacion.localeCompare(b.agrupacion, 'es'));
  const publicadas = resultado.filter((x) => !esPendiente(x));
  const revisar = resultado.filter(porRevisar)
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || a.agrupacion.localeCompare(b.agrupacion, 'es'));

  $('q-limpiar').hidden = !$('q').value;
  for (const el of document.querySelectorAll('[data-cuenta]')) {
    const k = el.dataset.cuenta;
    el.textContent = k === 'todas' ? resultado.length
      : k === 'pendientes' ? pendientes.length
      : k === 'publicadas' ? publicadas.length
      : revisar.length;
  }

  const MAX = 300;
  let pintadas = 0;
  const recorta = (items) => {
    const r = items.slice(0, Math.max(0, MAX - pintadas));
    pintadas += r.length;
    return r;
  };

  let html = '';
  if (filtroTipo === 'revisar') {
    if (revisar.length) html += grupoLista('Por revisar', recorta(revisar), 'pend');
  } else {
    if (filtroTipo !== 'publicadas' && pendientes.length) {
      html += grupoLista('Pendientes', recorta(pendientes), 'pend');
    }
    if (filtroTipo !== 'pendientes' && publicadas.length) {
      const porAnio = new Map();
      for (const x of publicadas) {
        const y = String(x.year || 'Sin año');
        if (!porAnio.has(y)) porAnio.set(y, []);
        porAnio.get(y).push(x);
      }
      const anios = [...porAnio.keys()].sort((a, b) => (Number(b) || 0) - (Number(a) || 0) || a.localeCompare(b, 'es'));
      for (const anio of anios) {
        const items = porAnio.get(anio)
          .sort((a, b) => a.agrupacion.localeCompare(b.agrupacion, 'es') || String(a.pieza).localeCompare(String(b.pieza), 'es'));
        html += grupoLista(anio, recorta(items));
      }
    }
  }

  $('filas').innerHTML = html;
  $('filas').querySelectorAll('[data-slug]').forEach((b) => {
    const accion = b.dataset.accion || 'editar';
    b.onclick = () => {
      if (accion === 'editar') return abrirFicha(b.dataset.slug);
      if (accion === 'publicar') return publicarDesdeLista(b.dataset.slug, b);
      if (accion === 'clonar') return clonar(b.dataset.slug);
    };
  });

  const mostradas = filtroTipo === 'revisar' ? revisar.length : resultado.length;
  $('lista-vacio').hidden = mostradas > 0;
  if (!mostradas) {
    const q = $('q').value.trim();
    $('lista-vacio').innerHTML = filtroTipo === 'revisar' && !q && indice.length
      ? '<b>Nada pendiente</b>No queda ninguna copla por revisar.'
      : '<b>' + (indice.length ? 'Sin resultados' : 'Cargando…') + '</b>' +
        (indice.length && q ? 'Ninguna ficha casa con «' + esc(q) + '».' : indice.length ? 'No hay fichas todavía: crea la primera.' : '');
  }
  $('lista-tope').hidden = mostradas <= MAX;
}

/** Vuelve a la lista (el historial lo decide quien llama). */
function mostrarLista() {
  $('vista-editor').hidden = true;
  cerrarNotaLocal();
  $('vista-lista').hidden = false;
  $('b-nueva').hidden = false;
  $('b-letra').hidden = false;
  ['b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar', 'b-revisado'].forEach((id) => { $(id).hidden = true; });
  $('cab-meta').textContent = '';
  setEstado('', true);
  if (indice.length) pintarLista();
}

/** Abre el formulario de ficha nueva (con su entrada en el historial). */
function abrirNueva(empujar = true) {
  const f = $('f-nueva');
  f.reset();
  f.clon.value = '';
  f.pieza.value = 'Pasodoble';
  f.year.value = new Date().getFullYear();
  $('dlg-nueva-titulo').textContent = 'Nueva ficha';
  $('dlg-nueva-nota').innerHTML = 'Se crea como borrador con el bloque de la ficha base. Después cambias la letra y mueves los acordes.';
  const estado = { vista: 'nueva' };
  if (empujar) history.pushState(estado, '', '/estudio/?nueva=1');
  else history.replaceState(estado, '', '/estudio/?nueva=1');
  $('dlg-nueva').showModal();
}

/* ---------------- editor ---------------- */
const pareceAcorde = (t) => {
  const limpio = t.replace(/[()]/g, '');
  if (limpio.length > 14) return false;
  const m = limpio.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(.*)$/i);
  if (!m) return false;
  return /^(maj|min|m|M|dim|aug|sus|add|b|#|\d|\/|º|°)*$/i.test(m[3]);
};
const esAnot = (t) => /^\(.*\)$/.test(t);
const conocidos = new Set();

function tipo(linea, sig) { return clasificar(linea, sig, conocidos).tipo; }

const claseCss = (...cs) => cs.filter(Boolean).join(' ');
const trozo = (txt, cls) => (cls ? '<span class="' + cls + '">' + esc(txt) + '</span>' : esc(txt));

/** Trozos [texto, clase] de una línea; en las de acordes, cada acorde lleva su color. */
function piezasLinea(linea, t) {
  if (t !== 'acordes') return [[linea, '']];
  const piezas = [];
  let ultimo = 0;
  const re = /\S+/g;
  let m;
  while ((m = re.exec(linea))) {
    if (m.index > ultimo) piezas.push([linea.slice(ultimo, m.index), '']);
    const tok = m[0];
    piezas.push([tok, conocidos.has(tok) ? 'ac' : esAnot(tok) ? 'anot' : 'nuevo']);
    ultimo = m.index + tok.length;
  }
  if (ultimo < linea.length) piezas.push([linea.slice(ultimo), '']);
  return piezas;
}

/** HTML de una línea: lo que pasa de ANCHO_MAX va en rojo subrayado. */
function htmlLinea(linea, t) {
  const corte = cortePorAncho(linea);
  let pos = 0;
  let out = '';
  for (const [txt, cls] of piezasLinea(linea, t)) {
    const fin = pos + txt.length;
    if (corte < 0 || fin <= corte) {
      out += trozo(txt, cls);
    } else if (pos >= corte) {
      out += trozo(txt, claseCss(cls, 'pasado'));
    } else {
      const k = corte - pos;
      out += trozo(txt.slice(0, k), cls);
      out += trozo(txt.slice(k), claseCss(cls, 'pasado'));
    }
    pos = fin;
  }
  return out;
}

function pintar() {
  const lineas = ta.value.split('\n');
  capa.innerHTML = lineas.map((l, i) => htmlLinea(l, tipo(l, lineas[i + 1] || ''))).join('\n');
  let max = 0;
  for (const l of lineas) max = Math.max(max, columnasLinea(l));
  maxColumnas = max;
  const meta = $('editor-meta');
  meta.textContent = lineas.length + ' líneas · ' + max + '/' + ANCHO_MAX;
  meta.classList.toggle('mal', max > ANCHO_MAX);
}

function pintarTexto(texto, el) {
  const lineas = texto.split('\n');
  el.innerHTML = lineas.map((l, i) => htmlLinea(l, tipo(l, lineas[i + 1] || ''))).join('\n');
}

/* ---------------- ancho, zoom y cursor ---------------- */
const CLAVE_ZOOM = 'estudio:zoom:v2';
const FUENTE_PRE = 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
let maxColumnas = 0;
let zoomAjustado = false;
// Sin preferencia guardada, en móvil se ajusta solo cuando la ficha cabe en
// ANCHO_MAX columnas pero no a 13 px: así no hay que arrastrar 20-30 px para
// ver el final de la línea. Si el usuario pulsa Ajustar/Ampliar, manda él.
let zoomAuto = true;
try {
  const guardado = localStorage.getItem(CLAVE_ZOOM);
  if (guardado === '1') { zoomAjustado = true; zoomAuto = false; }
  else if (guardado === '0') { zoomAuto = false; }
} catch { /* sin almacenamiento */ }

/** Ancho de un carácter a 13 px (la fuente del editor), medido de verdad. */
function anchoCaracter13() {
  let m = $('medidor-ch');
  if (!m) {
    m = document.createElement('span');
    m.id = 'medidor-ch';
    m.setAttribute('aria-hidden', 'true');
    m.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre';
    hoja.appendChild(m);
  }
  m.style.font = '13px/1.55 ' + FUENTE_PRE;
  m.textContent = '0'.repeat(100);
  return m.getBoundingClientRect().width / 100 || 7.8;
}

/** Tamaño al que caben ANCHO_MAX columnas en el ancho actual (9–13 px). */
function tamAjustado(ch = anchoCaracter13()) {
  const disp = lienzo.clientWidth - 28 - 4;
  if (disp <= 0) return 13;
  const tam = (13 * disp) / (ANCHO_MAX * ch);
  return Math.max(9, Math.min(13, Math.floor(tam * 2) / 2));
}

/** Muestra u oculta «Ajustar» y aplica el tamaño. */
function aplicarZoom() {
  const b = $('b-zoom');
  if (!b) return;
  if (!lienzo.clientWidth) { b.hidden = true; return; }
  const ch = anchoCaracter13();
  const tam = tamAjustado(ch);
  const cabe = tam >= 13; // caben las 55 columnas a 13 px
  const cabeTexto = maxColumnas * ch + 28 <= lienzo.clientWidth;
  if (zoomAuto) {
    zoomAjustado = !cabe && maxColumnas > 0 && maxColumnas <= ANCHO_MAX && !cabeTexto;
  }
  b.hidden = cabe;
  b.textContent = zoomAjustado ? 'Ampliar' : 'Ajustar';
  b.title = zoomAjustado
    ? 'Vuelve a la letra normal'
    : 'Reduce la letra para que quepan las ' + ANCHO_MAX + ' columnas sin arrastrar';
  hoja.style.setProperty('--pre-size', (zoomAjustado && !cabe ? tam : 13) + 'px');
}

/** Deja visible el cursor dentro del scroller (al mover con Alt+flechas o al aceptar una sugerencia). */
function verCaret() {
  if (!lienzo.clientWidth) return;
  const texto = ta.value;
  const pos = ta.selectionStart;
  const ini = texto.lastIndexOf('\n', pos - 1) + 1;
  const ch = (regla.offsetLeft - 14) / ANCHO_MAX;
  if (ch > 0) {
    // Ojo: aquí se cuenta el prefijo tal cual, sin quitar espacios finales
    // (columnasLinea los recorta y daría una columna falsa).
    let col = 0;
    for (const c of texto.slice(ini, pos)) col += c === '\t' ? 4 - (col % 4) : 1;
    const x = 14 + col * ch;
    const margen = 24;
    if (x < lienzo.scrollLeft + margen) lienzo.scrollLeft = Math.max(0, x - margen);
    else if (x > lienzo.scrollLeft + lienzo.clientWidth - margen) lienzo.scrollLeft = x - lienzo.clientWidth + margen;
  }
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
  const fila = texto.slice(0, ini).split('\n').length - 1;
  const y = 12 + fila * lh;
  if (y < lienzo.scrollTop) lienzo.scrollTop = Math.max(0, y - lh);
  else if (y + lh > lienzo.scrollTop + lienzo.clientHeight) lienzo.scrollTop = y + lh - lienzo.clientHeight + lh;
}

async function abrirFicha(slug, empujar = true) {
  try {
    cerrarAviso();
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(slug));
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || 'no se pudo cargar');
    montarEditor(slug, datos.md, null, datos.zona, datos.rama);
    await cargarBase(slug);
    if (empujar) history.pushState({ vista: 'ficha', slug }, '', urlFicha(slug));
    if (MODO_LOCAL) {
      mostrarNotaLocal(datos.local
        ? 'Ficha local: se guarda en el archivo del proyecto, sin PR.' + (datos.desync ? ' En GitHub hay otra versión; esta es la de tu ordenador.' : '')
        : 'Esta ficha está solo en GitHub: al guardar se creará en tu ordenador.');
    } else {
      cerrarNotaLocal();
    }
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Prepara el editor con un `.md` ya cargado (de master o de una rama recién creada). */function montarEditor(slug, md, pr, zona, rama) {
  zonaFicha = zona === 'acordes3' ? 'acordes3' : 'acordes';
  cerrarNotaLocal();
  const d = desenvolver(md);
  conocidos.clear();
  d.registros.flat().forEach((x) => conocidos.add(x.etiqueta));
  ficha = { slug, md, d, pr: pr || null, rama: rama || null };
  anterior = d.texto;
  hist = [];
  futuro = [];
  sucio = false;
  ta.value = d.texto;
  pintarTexto(d.texto, $('ref-izq'));
  pintarDatos(d.frontmatter);
  mostrarBase(false);
  $('cab-meta').textContent = slug;
  $('vista-lista').hidden = true;
  $('vista-editor').hidden = false;
  pintar();
  aplicarZoom();
  ['b-lista', 'b-comprobar', 'b-guardar', 'b-avisos'].forEach((id) => { $(id).hidden = false; });
  $('b-revisado').hidden = !(zonaFicha === 'acordes' && porRevisar({ slug }));
  $('b-revisado').title = 'Guarda, marca la copla como revisada y fusiona la PR';
  $('b-nueva').hidden = true;
  $('b-letra').hidden = true;
  $('b-publicar').hidden = zonaFicha !== 'acordes3';
  $('b-publicar').textContent = MODO_LOCAL ? 'Promover' : 'Publicar';
  $('b-publicar').title = MODO_LOCAL
    ? 'Mueve el borrador a acordes en el proyecto: sin PR y sin publicar en la web'
    : 'Pasa el borrador a acordes y abre la PR';
  if (pr) {
    $('b-pr').hidden = false;
    $('b-fusionar').hidden = false;
    $('b-pr').onclick = () => window.open(pr.url, '_blank');
    setEstado('en PR #' + pr.numero, true);
  } else {
    $('b-pr').hidden = true;
    $('b-fusionar').hidden = true;
    setEstado('guardado', true);
  }
}

/** Muestra u oculta la columna de la ficha base (solo tiene sentido si hay base). */
function mostrarBase(si) {
  const pane = document.querySelector('.pane[data-pane="der"]');
  const tab = document.querySelector('.tabs button[data-pane="der"]');
  if (pane) pane.hidden = !si;
  if (tab) tab.hidden = !si;
  $('cols').classList.toggle('sin-base', !si);
  if (!si) {
    if (pane) pane.classList.remove('activo');
    $('base-sel').innerHTML = '';
    $('ref-der').textContent = '';
    if (paneActivo === 'der') {
      paneActivo = 'cen';
      document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('activo', p.dataset.pane === 'cen'));
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.pane === 'cen'));
    }
  }
}

async function cargarBase(slug, elegida) {
  const actual = indice.find((x) => x.slug === slug);
  if (!actual) return;
  // Bases posibles: cualquier otra ficha de la misma agrupación (mismo año primero).
  const delAnio = (x) => (String(x.year) === String(actual.year) ? 0 : 1);
  const candidatas = indice
    .filter((x) => x.slug !== slug && x.agrupacion === actual.agrupacion)
    .sort((a, b) => delAnio(a) - delAnio(b)
      || (a.pieza === actual.pieza ? 0 : 1) - (b.pieza === actual.pieza ? 0 : 1)
      || String(b.year).localeCompare(String(a.year), 'es')
      || a.slug.localeCompare(b.slug, 'es'));
  if (!candidatas.length) { mostrarBase(false); return; }

  const base = (elegida && candidatas.find((x) => x.slug === elegida))
    || candidatas.find((x) => x.pieza === actual.pieza)
    || candidatas[0];

  const sel = $('base-sel');
  sel.innerHTML = candidatas.map((x) =>
    '<option value="' + esc(x.slug) + '">' +
      esc((x.letraTitulo ? x.letraTitulo + ' · ' : '') + x.year + ' · ' + x.pieza) +
    '</option>').join('');
  sel.value = base.slug;

  try {
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(base.slug));
    const datos = await r.json();
    if (!r.ok) return;
    const d = desenvolver(datos.md);
    pintarTexto(d.texto, $('ref-der'));
    mostrarBase(true);
  } catch { /* sin base */ }
}

/* ---------------- mover / editar ---------------- */
function tokenCursor() {
  const texto = ta.value;
  const pos = ta.selectionStart;
  let ini = pos;
  while (ini > 0 && !/\s/.test(texto[ini - 1])) ini--;
  let fin = pos;
  while (fin < texto.length && !/\s/.test(texto[fin])) fin++;
  return { ini, fin, token: texto.slice(ini, fin) };
}

function mover(dir) {
  const texto = ta.value;
  const { ini, fin } = tokenCursor();
  if (ini === fin) return;
  const iniLinea = texto.lastIndexOf('\n', ini - 1) + 1;
  const finLinea = texto.indexOf('\n', fin);
  const fl = finLinea < 0 ? texto.length : finLinea;
  const linea = texto.slice(iniLinea, fl);
  if (tipo(linea) !== 'acordes') return;
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
  const p = iniLinea + (dir < 0 ? a - 1 : a + 1);
  ta.setSelectionRange(p, p);
  ta.focus();
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  verCaret();
}

/* ---------------- guardar / comprobar ---------------- */
/** Frontmatter con los valores que hay ahora mismo en el panel de datos. */
function frontmatterActual() {
  const datos = datosDelEditor();
  return cambiarFrontmatter(ficha.d.frontmatter, {
    pieza: datos.pieza,
    agrupacion: datos.agrupacion,
    year: datos.year,
    musica: datos.musica || null,
    letra: datos.letra || null,
    letraTitulo: datos.letraTitulo || null,
    cejilla: datos.cejilla || null,
    video: datos.video || null,
    img: datos.img,
    fraseClave: datos.fraseClave || null,
    destacada: datos.destacada || null,
    recomendada: datos.recomendada || null,
    cover: datos.cover || null,
    autorCover: datos.autorCover || null,
  });
}

function comprobarObligatorios() {
  const datos = datosDelEditor();
  if (!datos.pieza || !datos.agrupacion) { mostrarAviso('La pieza y la agrupación son obligatorias.', 'var(--mal)'); return false; }
  if (!datos.year) { mostrarAviso('Falta el año.', 'var(--mal)'); return false; }
  if (!datos.img) { mostrarAviso('Falta la imagen: el esquema la exige.', 'var(--mal)'); return false; }
  return true;
}

/** Guarda la ficha en la rama/PR (o en disco). Devuelve la respuesta del servidor. */
async function enviarGuardar(extra = {}) {
  const fm = frontmatterActual();
  const envuelto = envolver(ta.value, ficha.d.registros, ficha.d.originales);
  const md = montarMd(fm, envuelto.pre);
  const r = await fetch(API + '/guardar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: ficha.slug,
      md,
      zona: zonaFicha,
      ...(ficha.rama ? { rama: ficha.rama } : {}),
      ...extra,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'no se pudo guardar');

  ficha.d.frontmatter = fm;
  ficha.md = md;
  ficha.rama = d.rama || (d.local ? null : ficha.rama);
  ficha.pr = d.pr || null;
  // Al guardar en local, el borrador ya existe en el disco: la lista puede
  // ofrecer Promover sin recargar.
  if (d.local && zonaFicha === 'acordes3') {
    const x = indice.find((i) => i.slug === ficha.slug);
    if (x) { x.local = true; x.zona = 'acordes3'; }
  }
  pintarDatos(fm);
  return d;
}

async function guardar() {
  if (!ficha) return;
  if (!comprobarObligatorios()) return;

  try {
    const d = await enviarGuardar();

    if (d.local) {
      $('b-pr').hidden = true;
      $('b-fusionar').hidden = true;
      setEstado('guardado en local', true);
      const ruta = 'src/content/' + (zonaFicha === 'acordes3' ? 'acordes3' : 'acordes') + '/' + ficha.slug + '.md';
      mostrarAviso('Guardado en ' + ruta + '.\nEn local no se crea PR: el archivo queda escrito en el proyecto.', 'var(--ok)');
      return;
    }

    setEstado('en PR #' + d.pr.numero, true);
    $('b-pr').hidden = false;
    $('b-fusionar').hidden = false;
    $('b-pr').onclick = () => window.open(d.pr.url, '_blank');
    mostrarAviso('Guardado en la rama ' + d.rama + '.\nPR #' + d.pr.numero + ': ' + d.pr.url +
      '\nNetlify está construyendo el preview; en un par de minutos lo tienes en la PR.', 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Guarda, saca la copla de «Por revisar» y (en producción) fusiona la PR. */
async function revisarFicha() {
  if (!ficha) return;
  if (!comprobarObligatorios()) return;
  const seguro = MODO_LOCAL
    ? '¿Marcar esta copla como revisada?\nSe guarda el archivo y sale de «Por revisar». El commit lo haces luego.'
    : '¿Marcar esta copla como revisada?\nSe guarda, se marca y se fusiona la PR: el cambio queda publicado.';
  if (!confirm(seguro)) return;

  try {
    const d = await enviarGuardar({ revisado: true });
    revision.delete(ficha.slug);
    const quedan = d.revision && typeof d.revision.restantes === 'number' ? d.revision.restantes : null;
    const cola = quedan === null ? '' : '\nQuedan ' + quedan + ' por revisar.';

    if (d.local) {
      $('b-revisado').hidden = true;
      setEstado('revisada', true);
      mostrarAviso('Guardada y marcada como revisada.' + cola +
        '\nEn local no se crea PR: el commit lo haces luego (`subir-acorde`).', 'var(--ok)');
      return;
    }

    if (!d.pr) throw new Error('se guardó, pero no hay PR que fusionar');
    const r = await fetch(API + '/fusionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug, ...(d.rama ? { rama: d.rama } : {}) }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('guardada y marcada, pero no se pudo fusionar: ' + (j.error || 'error'));

    $('b-revisado').hidden = true;
    $('b-pr').hidden = true;
    $('b-fusionar').hidden = true;
    setEstado('revisada y fusionada', true);
    mostrarAviso('Revisada y fusionada. Netlify publica en un par de minutos.' + cola +
      (j.url ? '\n' + j.url : ''), 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

async function comprobar() {
  if (!ficha) return;
  try {
    const envuelto = envolver(ta.value, ficha.d.registros, ficha.d.originales);
    const r = revisar(ta.value, ficha.d.texto);
    const avisos = [...envuelto.avisos, ...r.avisos];
    mostrarAviso((avisos.length ? avisos.join('\n') : 'Todo cuadra: ' + envuelto.acordes + ' acordes.') + '\n\n(Mover a PR: "Guardar")', avisos.length ? 'var(--nuevo)' : 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

async function fusionar() {
  if (!ficha || !ficha.pr) return;
  if (!confirm('¿Fusionar la PR #' + ficha.pr.numero + '? Se publicará en la web.')) return;
  try {
    const r = await fetch(API + '/fusionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: ficha.slug, ...(ficha.rama ? { rama: ficha.rama } : {}) }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo fusionar');
    setEstado('fusionada', true);
    mostrarAviso('Fusionada. Netlify publicará en un par de minutos.\n' + (d.url || ''), 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

async function publicar() {
  if (!ficha) return;
  if (sucio) { mostrarAviso('Guarda los cambios antes de publicar (Ctrl+S).', 'var(--nuevo)'); return; }
  if (!confirm(MODO_LOCAL
    ? '¿Promover esta ficha a acordes?\nSolo mueve el archivo en el proyecto: no crea PR ni la publica en la web.'
    : '¿Publicar esta ficha? Se moverá de acordes3 a acordes y, al fusionar, saldrá el aviso.')) return;
  try {
    const r = await fetch(API + '/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug, ...(ficha.rama ? { rama: ficha.rama } : {}) }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    const md = montarMd(ficha.d.frontmatter, envolver(ta.value, ficha.d.registros, ficha.d.originales).pre);
    montarEditor(ficha.slug, md, d.pr, 'acordes', d.rama);
    const x = indice.find((i) => i.slug === ficha.slug);
    if (x) { x.zona = 'acordes'; x.local = false; x.enPR = d.pr ? d.pr.numero : null; }
    if (d.local) {
      setEstado('promovida a acordes', true);
      $('b-publicar').hidden = true;
      mostrarAviso('Promovida a acordes: ' + 'src/content/acordes/' + ficha.slug + '.md.\nEn el proyecto ya cuenta como publicada, pero la web no cambia hasta que hagas commit y push (`subir-acorde`).', 'var(--ok)');
      return;
    }
    setEstado('publicando · PR #' + d.pr.numero, true);
    $('b-publicar').hidden = true;
    mostrarAviso('Publicación en la PR #' + d.pr.numero + ': ' + d.pr.url + '\nAl fusionar, Telegram avisa solo. WhatsApp y X, desde el PC.', 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Publica un borrador desde la propia lista, sin abrir el editor. */
async function publicarDesdeLista(slug, boton) {
  const item = indice.find((i) => i.slug === slug);
  if (MODO_LOCAL && item && !item.local) {
    mostrarAviso('Ese borrador está solo en GitHub: ábrelo, guárdalo para traerlo al ordenador y después podrás promoverlo.', 'var(--nuevo)');
    return;
  }
  if (!confirm(MODO_LOCAL
    ? '¿Promover «' + slug + '» a acordes?\nSolo mueve el archivo en el proyecto: no crea PR ni la publica en la web.'
    : '¿Publicar «' + slug + '»?\nSe moverá de acordes3 a acordes y se abrirá la PR. Al fusionar saldrá el aviso.')) return;
  const antes = boton.textContent;
  boton.disabled = true;
  boton.textContent = '…';
  try {
    const r = await fetch(API + '/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    if (item) { item.zona = 'acordes'; item.local = false; item.enPR = d.pr ? d.pr.numero : null; }
    pintarLista();
    mostrarAviso(d.local
      ? 'Promovida a acordes: «' + slug + '» ya está en src/content/acordes/.\nLa web no cambia hasta que hagas commit y push (`subir-acorde`).'
      : 'Publicada «' + slug + '» en la PR #' + d.pr.numero + '.\nAl fusionar, Telegram avisa solo; WhatsApp y X, desde el PC.\n' + d.pr.url, 'var(--ok)');
  } catch (e) {
    boton.disabled = false;
    boton.textContent = antes;
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/* ---------------- avisos ---------------- */
async function abrirAvisos() {
  if (!ficha) return;
  try {
    // Se manda el frontmatter abierto: el aviso sale aunque la ficha no esté
    // subida, esté en una PR o solo en el ordenador.
    const r = await fetch(API + '/aviso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug, frontmatter: frontmatterActual() }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo componer el aviso');
    $('aviso-meta').textContent = d.titulo;
    $('aviso-texto').value = d.texto;
    avisoX = d.textoX || d.texto;
    $('dlg-aviso').showModal();
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/* ---------------- nueva ficha ---------------- */
/** frontmatter en texto → objeto de campos simples (para rellenar el formulario). */
function leerFrontmatter(fm) {
  const cuerpo = (fm.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const datos = {};
  for (const linea of cuerpo.split('\n')) {
    const m = linea.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    datos[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return datos;
}

/** Vuelca el frontmatter en el formulario de datos del editor. */
function pintarDatos(fmTexto) {
  const fm = leerFrontmatter(fmTexto);
  for (const el of $('f-datos').querySelectorAll('[name]')) el.value = fm[el.name] ?? '';
  actualizarDatos();
}

/** Valores actuales del formulario de datos. */
function datosDelEditor() {
  const d = {};
  for (const el of $('f-datos').querySelectorAll('[name]')) d[el.name] = el.value.trim();
  return d;
}

/** Slug que saldría de los datos del formulario (misma regla que al crear). */
const slugDeDatos = (d) => (d.pieza + '-' + d.agrupacion + (d.letraTitulo ? '-' + d.letraTitulo : ''))
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Resumen del panel de datos. La URL no cambia al editar los campos. */
function actualizarDatos() {
  if (!ficha) return;
  const d = datosDelEditor();
  const el = $('datos-slug');
  el.textContent = (zonaFicha === 'acordes3' ? '/acordes3/' : '/acordes/') + ficha.slug + '/';
  el.title = 'URL de la ficha: no cambia al editar los datos';
  el.classList.remove('mal');
  $('datos-resumen').textContent = [d.pieza, d.agrupacion, d.year].filter(Boolean).join(' · ');
}

/** Abre «Nueva ficha» con todo copiado de otra: solo falta el título de la letra. */
async function clonar(slug) {
  try {
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(slug));
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo leer la ficha');
    const fm = leerFrontmatter(desenvolver(d.md).frontmatter);
    const f = $('f-nueva');
    f.reset();
    f.clon.value = '1';
    f.base.value = slug;
    f.pieza.value = fm.pieza || 'Pasodoble';
    f.agrupacion.value = fm.agrupacion || '';
    f.year.value = fm.year || '';
    f.musica.value = fm.musica || '';
    f.letra.value = fm.letra || '';
    f.cejilla.value = fm.cejilla || '';
    f.video.value = fm.video || '';
    f.img.value = fm.img || '';
    f.letraTitulo.value = '';
    f.fraseClave.value = '';
    $('dlg-nueva-titulo').textContent = 'Otra letra de esta música';
    $('dlg-nueva-nota').innerHTML = 'Todo viene relleno de la ficha original, <b>incluidos los acordes</b>. Escribe el título de la letra nueva y, ya en el editor, cambia la letra encima de los acordes.';
    $('dlg-nueva').showModal();
    f.letraTitulo.focus();
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

function cambiarFrontmatter(fm, cambios) {
  const lineas = fm.replace(/\n+$/, '').split('\n');
  const cierre = lineas.lastIndexOf('---');
  const cuerpo = lineas.slice(1, cierre).filter((l) => l.trim() !== '');
  const valor = (k, v) => {
    if (k === 'date') return k + ': "' + v + '"';
    const s = String(v);
    if (/^[^:#'"&-][^:#]*$/.test(s) && !/\s$/.test(s)) return k + ': ' + s;
    return k + ": '" + s.replace(/'/g, "''") + "'";
  };
  for (const [k, v] of Object.entries(cambios)) {
    const i = cuerpo.findIndex((l) => l.startsWith(k + ':'));
    // `null` borra el campo (p. ej. el título de la letra al copiar una ficha).
    if (v === null) {
      if (i >= 0) cuerpo.splice(i, 1);
      continue;
    }
    if (v === undefined || v === '') continue;
    if (i >= 0) cuerpo[i] = valor(k, v); else cuerpo.push(valor(k, v));
  }
  return '---\n' + cuerpo.join('\n') + '\n---\n';
}

async function crear(e) {
  e.preventDefault();
  const f = new FormData($('f-nueva'));
  const v = (k) => String(f.get(k) || '').trim();
  const base = v('base');
  const clon = v('clon') === '1';
  const pieza = v('pieza') || 'Pasodoble';
  if (!v('agrupacion')) { mostrarAviso('La agrupación es obligatoria.', 'var(--mal)'); return; }
  if (clon && !v('letraTitulo')) {
    mostrarAviso('Escribe el título de la letra nueva: es lo que distingue esta ficha de la original.', 'var(--mal)');
    return;
  }
  const slug = slugDeDatos({ pieza, agrupacion: v('agrupacion'), letraTitulo: v('letraTitulo') });
  if (indice.some((x) => x.slug === slug)) {
    mostrarAviso('Ya existe una ficha con el slug «' + slug + '».\nEscribe un título de letra distinto para diferenciarla.', 'var(--mal)');
    return;
  }
  try {
    // Sin ficha base, la ficha nace vacía: el bloque se pega luego en el editor.
    let bd = { frontmatter: '---\n---\n', pre: '' };
    if (base) {
      const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(base));
      const d = await r.json();
      if (!r.ok) throw new Error('no encuentro la base ' + base);
      const dv = desenvolver(d.md);
      // Se copia el bloque tal cual viene (con sus etiquetas <a> y espacios).
      bd = { frontmatter: dv.frontmatter, pre: dv.originales.join('\n') };
    }
    const fm = cambiarFrontmatter(bd.frontmatter, {
      pieza,
      agrupacion: v('agrupacion'),
      year: v('year'),
      musica: v('musica'),
      letra: v('letra'),
      letraTitulo: v('letraTitulo') || (clon ? null : undefined),
      cejilla: v('cejilla') || undefined,
      video: v('video') || undefined,
      img: v('img') || (base ? undefined : '/og-image.png'),
      fraseClave: clon ? (v('fraseClave') || null) : (v('fraseClave') || undefined),
      date: hoy(),
      // La copia no hereda el sitio en portada ni el destacado de la original.
      ...(clon ? { destacada: null, recomendada: null } : {}),
    });
    const md = montarMd(fm, bd.pre);
    const g = await fetch(API + '/guardar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, md, zona: 'acordes3' }),
    });
    const gd = await g.json();
    if (!g.ok) throw new Error(gd.error || 'no se pudo crear');
    creando = true;
    $('dlg-nueva').close();
    history.replaceState({ vista: 'ficha', slug }, '', urlFicha(slug));
    // La lista tiene que reflejarla sin recargar.
    indice.unshift({
      slug,
      pieza,
      agrupacion: v('agrupacion'),
      year: v('year'),
      letraTitulo: v('letraTitulo'),
      musica: v('musica'),
      letra: v('letra'),
      zona: 'acordes3',
      local: gd.local === true,
      enPR: gd.pr ? gd.pr.numero : null,
    });
    montarEditor(slug, md, gd.pr, 'acordes3', gd.rama);
    mostrarAviso(gd.local
      ? 'Ficha creada en src/content/acordes3/' + slug + '.md.\n' +
        (clon ? 'Ahora cambia la letra nueva encima de los acordes y mueve lo que haga falta.' : 'Ahora pega la letra en el editor y coloca los acordes.')
      : 'Ficha creada en la rama ' + gd.rama + '.\nPR #' + gd.pr.numero + ': ' + gd.pr.url + '\n' +
        (clon ? 'Ahora cambia la letra nueva encima de los acordes y mueve lo que haga falta.' : 'Ahora pega la letra en el editor y coloca los acordes.'), 'var(--ok)');
  } catch (err) {
    mostrarAviso(String(err.message || err), 'var(--mal)');
  }
}

/* ---------------- nueva letra pendiente ---------------- */
/** La base es el pasodoble de esa agrupación (la original, sin letraTitulo). */
function baseDeAgrupacion(agrupacion) {
  const busca = normalizar(agrupacion);
  if (!busca) return '';
  const deLaAgrupacion = indice.filter((x) => normalizar(x.agrupacion) === busca);
  const pasodobles = deLaAgrupacion.filter((x) => /^pasodoble/i.test(x.pieza || ''));
  const elegida = pasodobles.find((x) => !x.letraTitulo) || pasodobles[0] || deLaAgrupacion[0];
  return elegida ? elegida.slug : '';
}

/** Muestra la base que se va a apuntar según la agrupación escrita. */
function pintarBaseLetra() {
  const agrupacion = $('f-letra').agrupacion.value.trim();
  const el = $('letra-base');
  if (!agrupacion) { el.textContent = 'La base será el pasodoble de esa agrupación.'; el.classList.remove('mal'); return; }
  const base = baseDeAgrupacion(agrupacion);
  el.textContent = base
    ? 'Base: ' + base
    : 'No encuentro una ficha de «' + agrupacion + '»: se apunta sin base (?) para resolverla luego.';
  el.classList.toggle('mal', !base);
}

async function anadirLetra(e) {
  e.preventDefault();
  const f = new FormData($('f-letra'));
  const v = (k) => String(f.get(k) || '').trim();
  if (!v('frase') || !v('agrupacion')) {
    mostrarAviso('La frase y la agrupación son obligatorias.', 'var(--mal)');
    return;
  }
  try {
    const r = await fetch(API + '/letra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frase: v('frase'),
        agrupacion: v('agrupacion'),
        base: baseDeAgrupacion(v('agrupacion')),
        fuente: v('fuente'),
        notas: v('notas'),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo añadir');
    $('dlg-letra').close();
    $('f-letra').reset();
    mostrarAviso(d.local
      ? 'Añadida la letra ' + d.n + ' a ' + d.archivo + '.\nMírala con `npm run letras` cuando quieras.'
      : 'Añadida la letra ' + d.n + ' en la PR #' + d.pr.numero + '.\n' + d.pr.url, 'var(--ok)');
  } catch (err) {
    mostrarAviso(String(err.message || err), 'var(--mal)');
  }
}

/* ---------------- sugerencias ---------------- */
function tokenAntesCaret() {
  const texto = ta.value;
  const pos = ta.selectionStart;
  let ini = pos;
  while (ini > 0 && !/\s/.test(texto[ini - 1])) ini--;
  return texto.slice(ini, pos);
}
function abrirSug() {
  const t = tokenAntesCaret();
  if (t.length < 2) return cerrarSug();
  const q = t.toLowerCase();
  const lista = [...conocidos].filter((x) => x.toLowerCase().startsWith(q) && x !== t).slice(0, 8);
  if (!lista.length) return cerrarSug();
  sugerencias = lista;
  sugSel = 0;
  sug.innerHTML = lista.map((x, i) => '<button data-i="' + i + '" class="' + (i === 0 ? 'sel' : '') + '">' + esc(x) + '</button>').join('');
  sug.querySelectorAll('button').forEach((b) => {
    b.onmousedown = (ev) => { ev.preventDefault(); insertarSug(b.textContent); };
  });
  const r = ta.getBoundingClientRect();
  sug.style.left = Math.min(window.innerWidth - 200, r.left + 14) + 'px';
  sug.style.top = (r.top + 40) + 'px';
  sug.style.display = 'block';
}
function cerrarSug() { sug.style.display = 'none'; sug.innerHTML = ''; sugerencias = []; }
function insertarSug(t) {
  const texto = ta.value;
  const pos = ta.selectionStart;
  let ini = pos;
  while (ini > 0 && !/\s/.test(texto[ini - 1])) ini--;
  hist.push(texto);
  ta.value = texto.slice(0, ini) + t + texto.slice(pos);
  const p = ini + t.length;
  ta.setSelectionRange(p, p);
  cerrarSug();
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  verCaret();
}

/* ---------------- eventos ---------------- */
$('q').oninput = () => pintarLista();
$('f-datos').addEventListener('input', () => {
  actualizarDatos();
  sucio = true;
  setEstado('sin guardar', false);
});
$('q-limpiar').onclick = () => { $('q').value = ''; $('q').focus(); pintarLista(); };
$('base-sel').onchange = () => { if (ficha) cargarBase(ficha.slug, $('base-sel').value); };
document.querySelectorAll('#filtros button').forEach((b) => {
  b.onclick = () => {
    filtroTipo = b.dataset.filtro;
    document.querySelectorAll('#filtros button').forEach((x) => x.classList.toggle('sel', x === b));
    pintarLista();
  };
});
$('b-lista').onclick = () => {
  mostrarLista();
  // Si venimos de una ficha, el atrás deja el historial en la lista.
  if (history.state && history.state.vista === 'ficha') history.back();
};
$('b-inicio').onclick = (e) => {
  e.preventDefault();
  const desdeFicha = history.state && history.state.vista === 'ficha';
  mostrarLista();
  cerrarAviso();
  if (desdeFicha) history.back();
  else history.replaceState({ vista: 'lista' }, '', '/estudio/');
};
$('b-nueva').onclick = () => abrirNueva();
$('dlg-nueva').addEventListener('close', () => {
  // Cerrar el formulario (Cancelar, Esc o la ✕) devuelve a la vista anterior.
  if (!creando && history.state && history.state.vista === 'nueva') history.back();
  creando = false;
});
window.addEventListener('popstate', (e) => {
  const st = e.state;
  if (st && st.vista === 'ficha' && st.slug) { abrirFicha(st.slug, false); return; }
  if ($('dlg-nueva').open) $('dlg-nueva').close();
  mostrarLista();
  cerrarAviso();
});
$('n-cancelar').onclick = () => $('dlg-nueva').close();
$('f-nueva').onsubmit = crear;
$('b-letra').onclick = () => { $('f-letra').reset(); pintarBaseLetra(); $('dlg-letra').showModal(); $('f-letra').frase.focus(); };
$('f-letra').addEventListener('input', pintarBaseLetra);
$('l-cancelar').onclick = () => $('dlg-letra').close();
$('f-letra').onsubmit = anadirLetra;
$('b-guardar').onclick = guardar;
$('b-revisado').onclick = revisarFicha;
$('b-comprobar').onclick = comprobar;
$('b-fusionar').onclick = fusionar;
$('b-publicar').onclick = publicar;
$('b-avisos').onclick = abrirAvisos;
$('m-izq').onclick = () => mover(-1);
$('m-der').onclick = () => mover(1);
$('nota-local-cerrar').onclick = cerrarNotaLocal;
$('av-cerrar').onclick = () => $('dlg-aviso').close();
$('av-copiar').onclick = async () => {
  try { await navigator.clipboard.writeText($('aviso-texto').value); $('av-copiar').textContent = 'Copiado'; }
  catch { $('aviso-texto').select(); document.execCommand('copy'); }
};
$('av-tuit').onclick = () => {
  const t = avisoX || $('aviso-texto').value;
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(t.slice(0, 280)), '_blank');
};

document.querySelectorAll('.tabs button').forEach((b) => {
  b.onclick = () => {
    paneActivo = b.dataset.pane;
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('sel', x === b));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('activo', p.dataset.pane === paneActivo));
    if (paneActivo === 'cen') aplicarZoom();
  };
});

$('b-zoom').onclick = () => {
  zoomAuto = false; // el usuario manda a partir de aquí
  zoomAjustado = !zoomAjustado;
  try { localStorage.setItem(CLAVE_ZOOM, zoomAjustado ? '1' : '0'); } catch { /* sin almacenamiento */ }
  aplicarZoom();
  verCaret();
};

let rafAjuste = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(rafAjuste);
  rafAjuste = requestAnimationFrame(() => { aplicarZoom(); verCaret(); });
});

/** En iOS el teclado no encoge el layout: se ajusta el alto con visualViewport. */
function ajustarAltoVisible() {
  const vv = window.visualViewport;
  if (!vv) return;
  if (vv.height < window.innerHeight - 80 && vv.scale === 1) {
    document.documentElement.style.setProperty('--alto-vv', Math.max(320, Math.round(vv.height)) + 'px');
  } else {
    document.documentElement.style.removeProperty('--alto-vv');
  }
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', ajustarAltoVisible);
  ajustarAltoVisible();
}

ta.addEventListener('input', () => {
  hist.push(anterior);
  if (hist.length > 300) hist.shift();
  futuro = [];
  anterior = ta.value;
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  if (tokenAntesCaret().length >= 2) abrirSug(); else cerrarSug();
});
ta.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return mover(-1); }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return mover(1); }
  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return guardar(); }
  if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (!hist.length) return;
    futuro.push(ta.value);
    ta.value = hist.pop();
    sucio = true;
    setEstado('sin guardar', false);
    pintar();
    return;
  }
  if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
    e.preventDefault();
    if (!futuro.length) return;
    hist.push(ta.value);
    ta.value = futuro.pop();
    pintar();
    return;
  }
  if (e.key === 'Escape') return cerrarSug();
  if (sug.style.display === 'block') {
    if (e.key === 'ArrowDown') { e.preventDefault(); sugSel = (sugSel + 1) % sugerencias.length; marcarSug(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); sugSel = (sugSel - 1 + sugerencias.length) % sugerencias.length; marcarSug(); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return insertarSug(sugerencias[sugSel]); }
  }
});
function marcarSug() {
  sug.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === sugSel));
}

window.addEventListener('beforeunload', (e) => {
  if (sucio) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------------- arranque ---------------- */
(async () => {
  const params = new URLSearchParams(location.search);
  const cuenta = await quien();
  if (!cuenta) { $('login').hidden = false; return; } // sin sesión: pantalla de login
  MODO_LOCAL = MODO_LOCAL || cuenta.local === true;
  $('login').hidden = true;
  $('quien').textContent = cuenta.login;
  $('vista-lista').hidden = false;
  $('b-nueva').hidden = false;
  $('b-letra').hidden = false;
  $('cab-meta').textContent = '';
  setEstado('', true);
  await cargarIndice();
  pintarLista();
  // La entrada base del historial es la lista: así el atrás desde una ficha
  // vuelve aquí y no sale del panel.
  history.replaceState(estadoLista, '', '/estudio/');
  if (params.get('ficha')) await abrirFicha(params.get('ficha'));
  else if (params.get('nueva')) abrirNueva();
  $('pie').innerHTML = MODO_LOCAL
    ? '<span title="Sin sesión de GitHub: se usa el token del .env">Modo local · sin sesión</span>'
    : '<a href="/estudio/api/salir">Salir</a>';
})();

