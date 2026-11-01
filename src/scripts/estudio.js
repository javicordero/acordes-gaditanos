import { initPreAcordes, desenvolver, envolver, montarMd, revisar, clasificar } from '../lib/pre-acordes.js';
import glosario from '../data/glosario-acordes.json';

initPreAcordes(glosario);

const API = '/estudio/api';
// En `astro dev` el panel trabaja contra los archivos del ordenador (sin PR).
const MODO_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
// La ficha abierta lleva su slug en la URL (`/estudio/?ficha=...`), así el botón
// atrás vuelve a la lista en vez de salir del panel. La página es estática: el
// query no rompe nada y permite refrescar sin perder la ficha.
const urlFicha = (slug) => '/estudio/?ficha=' + encodeURIComponent(slug);
const estadoLista = { vista: 'lista' };
let creando = false;
const $ = (id) => document.getElementById(id);
const ta = $('editor');
const capa = $('capa');
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

/* ---------------- autenticación ---------------- */
async function quien() {
  const r = await fetch(API + '/me', { headers: { Accept: 'application/json' } });
  if (!r.ok) return null;
  return (await r.json()).login;
}

/* ---------------- lista ---------------- */
let filtroTipo = 'todas';

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Pendiente = borrador, ficha solo local o cualquiera con una PR abierta. */
const esPendiente = (x) => x.zona === 'acordes3' || !!x.enPR || !!x.local;

async function cargarIndice() {
  if (indice.length) return indice;
  const r = await fetch('/indice-busqueda.json');
  const publicadas = (await r.json()).map((x) => ({ ...x, zona: 'acordes' }));
  let borradores = [];
  try {
    const b = await fetch(API + '/lista');
    if (b.ok) borradores = (await b.json()).borradores.map((x) => ({ ...x, zona: x.zona || 'acordes3' }));
  } catch { /* sin borradores */ }
  indice = [...borradores, ...publicadas];
  const dl = $('slugs');
  dl.innerHTML = indice.slice(0, 400).map((x) => '<option value="' + esc(x.slug) + '">' + esc(x.pieza + ' · ' + x.agrupacion + ' · ' + x.year) + '</option>').join('');
  return indice;
}

const marcas = (x) => [
  x.zona === 'acordes3' ? '<span class="marca">BORRADOR</span>' : '',
  x.local ? '<span class="marca local">LOCAL</span>' : '',
  x.enPR ? '<span class="marca pr">EN PR</span>' : '',
].filter(Boolean).join(' ');

function filaLista(x) {
  const boton = (accion, texto, extra) =>
    '<button type="button" class="acc' + (extra || '') + '" data-accion="' + accion + '" data-slug="' + esc(x.slug) + '"' +
      (accion === 'clonar' ? ' title="Crear otra ficha (otra letra) a partir de esta misma música" aria-label="Crear otra ficha a partir de esta música"' : '') +
      '>' + texto + '</button>';

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
      (x.zona === 'acordes3' ? boton('publicar', MODO_LOCAL ? 'Promover' : 'Publicar', ' principal') : '') +
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

  $('q-limpiar').hidden = !$('q').value;
  for (const el of document.querySelectorAll('[data-cuenta]')) {
    const k = el.dataset.cuenta;
    el.textContent = k === 'todas' ? resultado.length : k === 'pendientes' ? pendientes.length : publicadas.length;
  }

  const MAX = 300;
  let pintadas = 0;
  const recorta = (items) => {
    const r = items.slice(0, Math.max(0, MAX - pintadas));
    pintadas += r.length;
    return r;
  };

  let html = '';
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

  $('filas').innerHTML = html;
  $('filas').querySelectorAll('[data-slug]').forEach((b) => {
    const accion = b.dataset.accion || 'editar';
    b.onclick = () => {
      if (accion === 'editar') return abrirFicha(b.dataset.slug);
      if (accion === 'publicar') return publicarDesdeLista(b.dataset.slug, b);
      if (accion === 'clonar') return clonar(b.dataset.slug);
    };
  });

  $('lista-vacio').hidden = resultado.length > 0;
  if (!resultado.length) {
    const q = $('q').value.trim();
    $('lista-vacio').innerHTML = '<b>' + (indice.length ? 'Sin resultados' : 'Cargando…') + '</b>' +
      (indice.length && q ? 'Ninguna ficha casa con «' + esc(q) + '».' : indice.length ? 'No hay fichas todavía: crea la primera.' : '');
  }
  $('lista-tope').hidden = resultado.length <= MAX;
}

/** Vuelve a la lista (el historial lo decide quien llama). */
function mostrarLista() {
  $('vista-editor').hidden = true;
  $('vista-lista').hidden = false;
  $('b-nueva').hidden = false;
  $('b-letra').hidden = false;
  ['b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar'].forEach((id) => { $(id).hidden = true; });
  $('cab-meta').textContent = '';
  setEstado('', true);
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

function pintar() {
  const texto = ta.value;
  const lineas = texto.split('\n');
  let html = '';
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const t = tipo(l, lineas[i + 1] || '');
    if (t !== 'acordes') { html += esc(l) + '\n'; continue; }
    let out = '';
    let ultimo = 0;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(l))) {
      out += esc(l.slice(ultimo, m.index));
      out += '<span class="' + (conocidos.has(m[0]) ? 'ac' : esAnot(m[0]) ? 'anot' : 'nuevo') + '">' + esc(m[0]) + '</span>';
      ultimo = m.index + m[0].length;
    }
    html += out + esc(l.slice(ultimo)) + '\n';
  }
  capa.innerHTML = html;
  capa.scrollTop = ta.scrollTop;
  capa.scrollLeft = ta.scrollLeft;
}

function pintarTexto(texto, el) {
  const lineas = texto.split('\n');
  el.innerHTML = lineas.map((l, i) => {
    const t = tipo(l, lineas[i + 1] || '');
    if (t !== 'acordes') return esc(l);
    let out = '';
    let ultimo = 0;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(l))) {
      out += esc(l.slice(ultimo, m.index));
      out += '<span class="' + (conocidos.has(m[0]) ? 'ac' : esAnot(m[0]) ? 'anot' : 'nuevo') + '">' + esc(m[0]) + '</span>';
      ultimo = m.index + m[0].length;
    }
    return out + esc(l.slice(ultimo));
  }).join('\n');
}

async function abrirFicha(slug, empujar = true) {
  try {
    cerrarAviso();
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(slug));
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || 'no se pudo cargar');
    montarEditor(slug, datos.md, null, datos.zona, datos.rama);
    await cargarBase(slug);
    pintar();
    if (empujar) history.pushState({ vista: 'ficha', slug }, '', urlFicha(slug));
    if (MODO_LOCAL) {
      mostrarAviso(datos.local
        ? 'Ficha local: al guardar se escribe en el archivo del proyecto, sin PR.' + (datos.desync ? '\nEn GitHub hay otra versión; esta es la de tu ordenador.' : '')
        : 'Esta ficha está solo en GitHub: al guardar se creará el archivo en tu ordenador.', 'var(--acento)');
    }
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Prepara el editor con un `.md` ya cargado (de master o de una rama recién creada). */function montarEditor(slug, md, pr, zona, rama) {
  zonaFicha = zona === 'acordes3' ? 'acordes3' : 'acordes';
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
  $('editor-meta').textContent = d.texto.split('\n').length + ' líneas';
  $('vista-lista').hidden = true;
  $('vista-editor').hidden = false;
  ['b-lista', 'b-comprobar', 'b-guardar', 'b-avisos'].forEach((id) => { $(id).hidden = false; });
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

async function guardar() {
  if (!ficha) return;
  const datos = datosDelEditor();
  if (!datos.pieza || !datos.agrupacion) { mostrarAviso('La pieza y la agrupación son obligatorias.', 'var(--mal)'); return; }
  if (!datos.year) { mostrarAviso('Falta el año.', 'var(--mal)'); return; }
  if (!datos.img) { mostrarAviso('Falta la imagen: el esquema la exige.', 'var(--mal)'); return; }

  try {
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
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo guardar');

    ficha.d.frontmatter = fm;
    ficha.md = md;
    ficha.rama = d.rama || (d.local ? null : ficha.rama);
    ficha.pr = d.pr || null;
    pintarDatos(fm);

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
    const x = indice.find((i) => i.slug === slug);
    if (x) { x.zona = 'acordes'; x.enPR = d.pr ? d.pr.numero : null; }
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
$('b-comprobar').onclick = comprobar;
$('b-fusionar').onclick = fusionar;
$('b-publicar').onclick = publicar;
$('b-avisos').onclick = abrirAvisos;
$('m-izq').onclick = () => mover(-1);
$('m-der').onclick = () => mover(1);
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
  };
});

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
ta.addEventListener('scroll', () => {
  capa.scrollTop = ta.scrollTop;
  capa.scrollLeft = ta.scrollLeft;
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
  const login = await quien();
  if (!login) return; // se queda la pantalla de login
  $('login').hidden = true;
  $('quien').textContent = login;
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
  $('pie').innerHTML = '<a href="/estudio/api/salir">Salir</a>';
})();

