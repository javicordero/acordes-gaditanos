import { initPreAcordes, desenvolver, envolver, montarMd, revisar, clasificar, ANCHO_MAX, columnasLinea, cortePorAncho } from '../lib/pre-acordes.js';
import { separarLetra, juntarLetra, palabraBajoCursor, moverAcordeLinea } from '../lib/editar-lineas.js';
import glosario from '../data/glosario-acordes.json';

initPreAcordes(glosario);

const API = '/admin/api';
// En `astro dev` el panel trabaja contra los archivos del ordenador (sin PR).
// El servidor lo confirma con `local` en /me: por un túnel o por la IP de la red
// el hostname ya no es localhost, pero el panel sigue en modo local.
let MODO_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
// La ficha abierta lleva su slug en la URL (`/admin/?ficha=...`), así el botón
// atrás vuelve a la lista en vez de salir del panel. La página es estática: el
// query no rompe nada y permite refrescar sin perder la ficha.
const urlFicha = (slug) => '/admin/?ficha=' + encodeURIComponent(slug);
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
let anterior = null;
let sucio = false;
let sugerencias = [];
let sugSel = 0;
let paneActivo = 'cen';
let zonaFicha = 'acordes';
// Texto del aviso sin marcas, para el tuit (el textarea lleva el de WhatsApp).
let avisoX = '';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hoy = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };

/**
 * Instantánea para deshacer: texto y capas con etiquetas. Al separar o juntar
 * cambian los índices de línea, así que no basta con guardar el texto.
 */
function snapshot() {
  return {
    texto: ta.value,
    registros: (ficha?.d?.registros || []).map((r) => r.map((x) => ({ ...x }))),
    originales: [...(ficha?.d?.originales || [])],
  };
}

function restaurar(s) {
  if (!s) return;
  ta.value = s.texto;
  if (ficha) {
    ficha.d.registros = s.registros.map((r) => r.map((x) => ({ ...x })));
    ficha.d.originales = [...s.originales];
  }
  anterior = snapshot();
}

function actualizarDeshacer() {
  const b = $('b-deshacer');
  if (b) b.disabled = !hist.length;
}

function deshacer() {
  if (!hist.length) return;
  futuro.push(snapshot());
  restaurar(hist.pop());
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  actualizarDeshacer();
}

function rehacer() {
  if (!futuro.length) return;
  hist.push(snapshot());
  restaurar(futuro.pop());
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  actualizarDeshacer();
}

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
// Fichas de `acordes` en el ordenador pero aún sin subir a git (solo en local).
let pendientesPublicar = [];

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
      pendientesPublicar = Array.isArray(j.pendientes) ? j.pendientes : [];
    }
  } catch { /* sin borradores */ }
  indice = [...borradores, ...publicadas];
  const dl = $('slugs');
  dl.innerHTML = indice.slice(0, 400).map((x) => '<option value="' + esc(x.slug) + '">' + esc(x.pieza + ' · ' + x.agrupacion + ' · ' + x.year) + '</option>').join('');
  return indice;
}

/** Vuelve a pedir la lista (tras publicar cambia lo pendiente de subir). */
async function recargarIndice() {
  indice = [];
  pendientesPublicar = [];
  await cargarIndice();
  pintarLista();
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

function grupoLista(titulo, items, clase, render = filaLista) {
  return '<div class="grupo' + (clase ? ' ' + clase : '') + '">' +
    '<span class="grupo-tit">' + esc(titulo) + '</span><i></i><span class="grupo-n">' + items.length + '</span></div>' +
    items.map(render).join('');
}

/** Fila de la pestaña «Por publicar» (fichas de acordes sin subir a git). */
function filaPorPublicar(x) {
  const etiqueta = x.estado === 'nueva' ? 'NUEVA'
    : x.estado === 'borrada' ? 'BORRADA'
    : x.estado === 'sin-push' ? 'SIN PUSH'
    : 'MODIFICADA';
  const clase = x.estado === 'nueva' ? 'local' : x.estado === 'sin-push' ? 'pr' : 'remoto';
  const boton = (accion, texto, extra) =>
    '<button type="button" class="acc' + (extra || '') + '" data-accion="' + accion + '" data-slug="' + esc(x.slug) + '">' + texto + '</button>';

  return '<article class="fila pendiente">' +
    '<button type="button" class="fila-info" data-slug="' + esc(x.slug) + '">' +
      '<span class="f-agr">' + esc(x.agrupacion) + '</span>' +
      '<span class="f-meta">' +
        '<span class="f-year">' + esc(String(x.year || '—')) + '</span>' +
        '<span>' + esc(x.pieza) + '</span>' +
        (x.letraTitulo ? '<span class="f-letra">' + esc(x.letraTitulo) + '</span>' : '') +
        '<span class="marca ' + clase + '">' + etiqueta + '</span>' +
        (x.borrador ? '<span class="marca">BORRADOR</span>' : '') +
      '</span>' +
    '</button>' +
    '<div class="fila-acciones">' +
      (x.estado !== 'borrada' ? boton('editar', 'Editar') : '') +
      boton('publicarLocal', x.estado === 'nueva' ? 'Publicar' : 'Subir', ' principal') +
    '</div>' +
  '</article>';
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
  const porPublicar = pendientesPublicar.filter(coincide)
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || String(a.agrupacion).localeCompare(String(b.agrupacion), 'es'));

  $('q-limpiar').hidden = !$('q').value;
  for (const el of document.querySelectorAll('[data-cuenta]')) {
    const k = el.dataset.cuenta;
    el.textContent = k === 'todas' ? resultado.length
      : k === 'pendientes' ? pendientes.length
      : k === 'publicadas' ? publicadas.length
      : k === 'porPublicar' ? porPublicar.length
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
  } else if (filtroTipo === 'porPublicar') {
    if (porPublicar.length) html += grupoLista('Por publicar', recorta(porPublicar), 'pend', filaPorPublicar);
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
      if (accion === 'publicarLocal') return publicarLocal(b.dataset.slug);
      if (accion === 'clonar') return clonar(b.dataset.slug);
    };
  });

  const mostradas = filtroTipo === 'revisar' ? revisar.length
    : filtroTipo === 'porPublicar' ? porPublicar.length
    : resultado.length;
  $('lista-vacio').hidden = mostradas > 0;
  if (!mostradas) {
    const q = $('q').value.trim();
    $('lista-vacio').innerHTML = filtroTipo === 'revisar' && !q && indice.length
      ? '<b>Nada pendiente</b>No queda ninguna copla por revisar.'
      : filtroTipo === 'porPublicar' && !q
        ? (MODO_LOCAL
          ? '<b>Nada pendiente</b>Todo lo que está en <code>acordes</code> ya está subido a git.'
          : '<b>Solo en local</b>Esta pestaña necesita el proyecto abierto con <code>astro dev</code>.')
        : '<b>' + (indice.length ? 'Sin resultados' : 'Cargando…') + '</b>' +
          (indice.length && q ? 'Ninguna ficha casa con «' + esc(q) + '».' : indice.length ? 'No hay fichas todavía: crea la primera.' : '');
  }
  $('lista-tope').hidden = mostradas <= MAX;
}

/** Vuelve a la lista (el historial lo decide quien llama). */
function mostrarLista() {
  ocultarVistas();
  cerrarNotaLocal();
  $('vista-lista').hidden = false;
  $('nav-vistas').hidden = false;
  $('b-nueva').hidden = false;
  $('b-letra').hidden = false;
  ['b-lista', 'b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar', 'b-revisado'].forEach((id) => { $(id).hidden = true; });
  marcarNav('editor');
  $('cab-meta').textContent = '';
  setEstado('', true);
  if (indice.length) pintarLista();
}

/* ---------------- vistas del panel ---------------- */
function ocultarVistas() {
  ['vista-lista', 'vista-editor', 'vista-stats', 'vista-comentarios'].forEach((id) => { $(id).hidden = true; });
}
function marcarNav(vista) {
  const v = vista === 'editor' || vista === 'lista' ? 'editor' : vista;
  document.querySelectorAll('#nav-vistas button').forEach((b) => b.classList.toggle('sel', b.dataset.vista === v));
}
function soloNav() {
  ['b-nueva', 'b-letra', 'b-lista', 'b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar', 'b-revisado'].forEach((id) => { $(id).hidden = true; });
}
function mostrarStats(empujar = true) {
  ocultarVistas();
  $('vista-stats').hidden = false;
  $('nav-vistas').hidden = false;
  marcarNav('stats');
  soloNav();
  $('cab-meta').textContent = '';
  setEstado('', true);
  if (empujar) history.pushState({ vista: 'stats' }, '', '/admin/?vista=stats');
  if (!statsCargadas) cargarStats();
}
function mostrarComentarios(empujar = true) {
  ocultarVistas();
  $('vista-comentarios').hidden = false;
  $('nav-vistas').hidden = false;
  marcarNav('comentarios');
  soloNav();
  $('cab-meta').textContent = '';
  setEstado('', true);
  if (empujar) history.pushState({ vista: 'comentarios' }, '', '/admin/?vista=comentarios');
  if (!peticiones.length) cargarPeticiones();
}

/* ---------------- estadísticas ---------------- */
let statsCargadas = false;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-ES');

async function cargarStats() {
  const cont = $('stats-contenido');
  cont.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    const r = await fetch(API + '/stats', { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudieron cargar las estadísticas');
    statsCargadas = true;
    pintarStats(d);
  } catch (e) {
    cont.innerHTML = '<p class="error">' + esc(String(e.message || e)) + '</p>';
  }
}

function tablaStats(titulo, cabeceras, filas, nota) {
  const th = cabeceras.map((c) => {
    const cls = [c.num ? 'num' : '', c.cls || ''].filter(Boolean).join(' ');
    return '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(c.t) + '</th>';
  }).join('');
  const cuerpo = filas.map((fila) => '<tr>' + fila.map((c) => {
    const cls = [c.num ? 'num' : '', c.cls || ''].filter(Boolean).join(' ');
    return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + (c.html || esc(String(c.t))) + '</td>';
  }).join('') + '</tr>').join('');
  return '<section class="stats-bloque"><h3>' + esc(titulo) + (nota ? ' <span class="tabla-nota">' + esc(nota) + '</span>' : '') + '</h3><div class="tabla-scroll"><table class="stats-tabla"><thead><tr>' + th + '</tr></thead><tbody>' + cuerpo + '</tbody></table></div></section>';
}

function pintarStats(d) {
  const history = d.history || [];
  const monthly = d.monthly || [];
  const total = d.total || 0;
  const hoy = history[0]?.count || 0;
  const mediaDia = history.length ? Math.round(history.reduce((s, x) => s + x.count, 0) / history.length) : 0;
  const mesActual = new Date().toISOString().slice(0, 7);
  const meses = monthly.filter((m) => m.month !== '2026-01' && m.month !== mesActual);
  const mediaMes = meses.length ? Math.round(meses.reduce((s, x) => s + x.count, 0) / meses.length) : 0;
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const cards = [
    { label: 'Visitas de hoy', valor: hoy },
    { label: 'Visitas totales', valor: total, total: true },
    { label: 'Media diaria', valor: mediaDia },
    { label: 'Media mensual', valor: mediaMes },
  ];
  const htmlCards = cards.map((c) =>
    '<div class="stat-card' + (c.total ? ' stat-card--total' : '') + '"><span class="stat-label">' + c.label + '</span><span class="stat-valor">' + fmtNum(c.valor) + '</span></div>').join('');
  const filasMes = monthly.map((m) => {
    const [y, mm] = m.month.split('-');
    return [{ t: (nombres[Number(mm) - 1] || m.month) + '/' + y }, { t: fmtNum(m.count), num: true }];
  });
  const filasDia = history.map((x) => [{ t: x.date }, { t: fmtNum(x.count), num: true }]);
  const filasFuente = (d.sources || []).map((x) => [{ t: x.source || '(directo)' }, { t: fmtNum(x.count), num: true }]);
  const paginas = [...(d.pages || [])].sort((a, b) => b.count - a.count);
  const topRutas = paginas.slice(0, 50);
  const filasRuta = topRutas.map((x) => [
    { t: x.path, cls: 'ruta' },
    { t: fmtNum(x.count), num: true },
    { html: '<div class="progress"><span style="width:' + (total ? Math.round((x.count / total) * 100) : 0) + '%"></span></div>', cls: 'progreso' },
  ]);
  $('stats-contenido').innerHTML =
    '<div class="stats-grid">' + htmlCards + '</div>' +
    tablaStats('Visitas por mes', [{ t: 'Mes' }, { t: 'Visitas', num: true }], filasMes) +
    tablaStats('Evolución últimos 30 días', [{ t: 'Fecha' }, { t: 'Visitas', num: true }], filasDia) +
    tablaStats('Fuentes de tráfico', [{ t: 'Origen' }, { t: 'Visitas', num: true }], filasFuente) +
    tablaStats('Rutas más visitadas', [{ t: 'Ruta' }, { t: 'Visitas', num: true }, { t: 'Popularidad', cls: 'progreso' }], filasRuta,
      paginas.length > topRutas.length ? 'top ' + topRutas.length + ' de ' + paginas.length : '');
}

/* ---------------- comentarios / peticiones ---------------- */
let peticiones = [];
let comentariosTodos = [];
const escAttr = (t) => esc(String(t || '')).replace(/"/g, '&quot;');

function fechaCorta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}

async function cargarPeticiones() {
  const cont = $('peticiones');
  cont.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    const r = await fetch(API + '/comentarios?path=' + encodeURIComponent('/pedir-copla'));
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudieron cargar las peticiones');
    comentariosTodos = d.comments || [];
    peticiones = comentariosTodos.filter((c) => !c.parentId);
    pintarPeticiones();
  } catch (e) {
    cont.innerHTML = '<p class="error">' + esc(String(e.message || e)) + '</p>';
  }
}

function pintarPeticiones() {
  const cont = $('peticiones');
  if (!peticiones.length) {
    cont.innerHTML = '<p class="cargando">No hay peticiones.</p>';
    return;
  }
  const orden = $('orden-peticiones').value;
  const lista = [...peticiones];
  if (orden === 'votos') lista.sort((a, b) => (b.votes || 0) - (a.votes || 0) || new Date(b.date) - new Date(a.date));
  else if (orden === 'fecha') lista.sort((a, b) => new Date(b.date) - new Date(a.date));
  else if (orden === 'autor') lista.sort((a, b) => String(a.author || '').localeCompare(String(b.author || ''), 'es'));
  else lista.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0) || (b.votes || 0) - (a.votes || 0) || new Date(b.date) - new Date(a.date));

  cont.innerHTML = lista.map((c, i) => {
    const respuestas = comentariosTodos.filter((x) => x.parentId === c.id).length;
    const autor = c.author && c.author.trim() ? c.author.trim() : 'Anónimo';
    return '<article class="peticion' + (c.completed ? ' completada' : '') + '" data-id="' + escAttr(c.id) + '">' +
      '<div class="peticion-cab">' +
        '<span class="peticion-rank">#' + (i + 1) + '</span>' +
        '<span>' + fechaCorta(c.date) + '</span>' +
        '<span class="peticion-autor">' + esc(autor) + '</span>' +
        '<span class="peticion-votos">❤ ' + (c.votes || 0) + '</span>' +
        (c.completed ? '<span class="marca">COMPLETADA</span>' : '') +
      '</div>' +
      '<p class="peticion-texto">' + esc(c.content || '') + '</p>' +
      '<div class="peticion-pie">' +
        '<span class="peticion-respuestas">' + (respuestas ? respuestas + ' respuesta' + (respuestas === 1 ? '' : 's') : '') + '</span>' +
        '<div class="peticion-acciones">' +
          '<button type="button" class="completar" data-accion="completar" data-id="' + escAttr(c.id) + '">' + (c.completed ? 'Descompletar' : 'Completar') + '</button>' +
          '<button type="button" data-accion="responder" data-id="' + escAttr(c.id) + '" data-autor="' + escAttr(autor) + '">Responder</button>' +
          '<button type="button" class="peligro" data-accion="eliminar" data-id="' + escAttr(c.id) + '">Eliminar</button>' +
        '</div>' +
      '</div>' +
      '<div class="peticion-respuesta"></div>' +
    '</article>';
  }).join('');
}

async function apiComentarios(metodo, id, cuerpo) {
  const url = API + '/comentarios' + (id ? '?id=' + encodeURIComponent(id) : '');
  const r = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'no se pudo completar la acción');
  return d;
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
  if (empujar) history.pushState(estado, '', '/admin/?nueva=1');
  else history.replaceState(estado, '', '/admin/?nueva=1');
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
  const meta = $('editor-meta');
  meta.textContent = lineas.length + ' líneas · ' + max + '/' + ANCHO_MAX;
  meta.classList.toggle('mal', max > ANCHO_MAX);
  actualizarAcciones();
}

function pintarTexto(texto, el) {
  const lineas = texto.split('\n');
  el.innerHTML = lineas.map((l, i) => htmlLinea(l, tipo(l, lineas[i + 1] || ''))).join('\n');
}

/* ---------------- ancho, zoom y cursor ---------------- */
const CLAVE_ZOOM = 'estudio:zoom:v2';
const FUENTE_PRE = 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
let zoomAjustado = false;
try { zoomAjustado = localStorage.getItem(CLAVE_ZOOM) === '1'; } catch { /* sin almacenamiento */ }

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
function tamAjustado() {
  const disp = lienzo.clientWidth - 28 - 4;
  if (disp <= 0) return 13;
  const tam = (13 * disp) / (ANCHO_MAX * anchoCaracter13());
  return Math.max(9, Math.min(13, Math.floor(tam * 2) / 2));
}

/** Muestra u oculta «Ajustar» y aplica el tamaño. */
function aplicarZoom() {
  const b = $('b-zoom');
  if (!b) return;
  if (!lienzo.clientWidth) { b.hidden = true; return; }
  const tam = tamAjustado();
  const cabe = tam >= 13;
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
  hist = [];
  futuro = [];
  actualizarDeshacer();
  sucio = false;
  ta.value = d.texto;
  anterior = snapshot();
  pintarTexto(d.texto, $('ref-izq'));
  pintarDatos(d.frontmatter);
  mostrarBase(false);
  $('cab-meta').textContent = slug;
  ocultarVistas();
  $('vista-editor').hidden = false;
  $('nav-vistas').hidden = true;
  marcarNav('editor');
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
  hist.push(snapshot());
  if (hist.length > 300) hist.shift();
  actualizarDeshacer();
  futuro = [];
  ta.value = texto.slice(0, iniLinea) + nueva + texto.slice(fl);
  anterior = snapshot();
  const p = iniLinea + (dir < 0 ? a - 1 : a + 1);
  ta.setSelectionRange(p, p);
  ta.focus();
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  verCaret();
}

/* ---------------- separar / juntar versos ---------------- */
/** Línea y columna (carácter) del cursor. */
function cursorLineaCol() {
  const pos = ta.selectionStart;
  const antes = ta.value.slice(0, pos);
  const linea = antes.split('\n').length - 1;
  const ini = antes.lastIndexOf('\n') + 1;
  return { linea, col: pos - ini };
}

/** Índice absoluto en el textarea de una línea y columna. */
function posicionDe(linea, col) {
  const lineas = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < linea && i < lineas.length; i++) pos += lineas[i].length + 1;
  return Math.min(pos + col, ta.value.length);
}

function aplicarEdicion(r) {
  if (r.error) { mostrarAviso(r.error, 'var(--nuevo)'); return; }
  hist.push(snapshot());
  if (hist.length > 300) hist.shift();
  actualizarDeshacer();
  futuro = [];
  ta.value = r.lineas.join('\n');
  ficha.d.registros = r.registros;
  ficha.d.originales = r.originales;
  anterior = snapshot();
  sucio = true;
  setEstado('sin guardar', false);
  const pos = posicionDe(r.cursor.linea, r.cursor.col);
  ta.setSelectionRange(pos, pos);
  ta.focus();
  pintar();
  verCaret();
}

/** Separa la letra en el cursor y crea la línea de acordes de la parte que baja. */
function separar() {
  if (!ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const { linea, col } = cursorLineaCol();
  const lineas = ta.value.split('\n');
  const t = tipo(lineas[linea] || '', lineas[linea + 1] || '');
  if (t === 'acordes' || t === 'acordes-sucio') return moverAcorde(1);
  if (t !== 'letra') return mostrarAviso('Pon el cursor en una línea de letra o de acordes.', 'var(--nuevo)');
  const palabra = palabraBajoCursor(lineas[linea], col);
  aplicarEdicion(separarLetra({
    lineas,
    registros: ficha.d.registros,
    originales: ficha.d.originales,
    conocidos,
    i: linea,
    col: palabra ? palabra.ini : col,
  }));
}

/** Junta con el verso anterior lo que queda a la izquierda del cursor. */
function juntar() {
  if (!ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const { linea, col } = cursorLineaCol();
  const lineas = ta.value.split('\n');
  const t = tipo(lineas[linea] || '', lineas[linea + 1] || '');
  if (t === 'acordes' || t === 'acordes-sucio') return moverAcorde(-1);
  if (t !== 'letra') return mostrarAviso('Pon el cursor en una línea de letra o de acordes.', 'var(--nuevo)');
  const palabra = palabraBajoCursor(lineas[linea], col);
  aplicarEdicion(juntarLetra({
    lineas,
    registros: ficha.d.registros,
    originales: ficha.d.originales,
    conocidos,
    i: linea,
    col: palabra ? palabra.fin : col,
  }));
}

/** Mueve el acorde bajo el cursor a la línea de acordes siguiente o anterior. */
function moverAcorde(dir) {
  if (!ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const { linea, col } = cursorLineaCol();
  aplicarEdicion(moverAcordeLinea({
    lineas: ta.value.split('\n'),
    registros: ficha.d.registros,
    originales: ficha.d.originales,
    conocidos,
    i: linea,
    col,
    dir,
  }));
}

/** Cambia el title de los botones según si el cursor está en acordes o en letra. */
function actualizarAcciones() {
  if (!ficha) return;
  const { linea } = cursorLineaCol();
  const lineas = ta.value.split('\n');
  const enAcordes = ['acordes', 'acordes-sucio'].includes(tipo(lineas[linea] || '', lineas[linea + 1] || ''));
  $('b-separar').title = enAcordes
    ? 'Bajar el acorde a la línea de acordes siguiente (Alt+Enter)'
    : 'Separar por palabras: la palabra del cursor baja a una línea nueva (Alt+Enter)';
  $('b-juntar').title = enAcordes
    ? 'Subir el acorde a la línea de acordes anterior (Alt+Retroceso)'
    : 'Juntar por palabras: la palabra del cursor sube al verso anterior (Alt+Retroceso)';
}

function estructuraOk() {
  const n = ta.value.split('\n').length;
  return !!ficha && ficha.d.registros.length === n && ficha.d.originales.length === n;
}

function avisoEstructura() {
  mostrarAviso('La estructura de líneas no cuadra (¿has añadido un salto de línea a mano?). Deshaz ese cambio o guarda y vuelve a abrir la ficha.', 'var(--mal)');
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

/* ---------------- publicar en local ---------------- */
let avisoSlug = null;

async function publicarLocal(slug) {
  const item = pendientesPublicar.find((x) => x.slug === slug);
  if (!item) return;

  const avisa = item.estado === 'nueva' || (item.estado === 'sin-push' && item.cambio === 'nueva');
  const que = item.estado === 'nueva'
    ? 'Se publica en la web (Telegram avisa solo). Al terminar podrás copiar el aviso para WhatsApp y X.'
    : item.estado === 'borrada'
      ? 'Se sube la eliminación. No hay aviso.'
      : item.estado === 'sin-push'
        ? 'Se suben los commits que ya están hechos.' + (avisa ? ' Al ser nueva, al terminar podrás copiar el aviso.' : ' No hay aviso.')
        : 'Se suben los cambios. No hay aviso.';
  const nombre = item.pieza ? item.pieza + ' · ' + item.agrupacion : slug;
  if (!confirm('¿Publicar «' + nombre + '»?\n\n' + que)) return;

  try {
    const r = await fetch(API + '/publicar-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: [slug], sinAviso: false }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    abrirPublicacion(d.id, d.plan);
    seguirPublicacion(d.id);
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Plan que devuelve el servidor antes de lanzar el trabajo. */
function textoPlan(plan) {
  const items = (plan && plan.items) || [];
  if (!items.length) return 'Sin cambios.';
  return items.map((x) => {
    const nombre = [x.pieza, x.agrupacion].filter(Boolean).join(' · ') || x.slug;
    const cola = x.fecha ? 'fecha ' + x.fecha + ' · ' : '';
    return '<b>' + esc(nombre) + '</b><br>' + cola + (x.avisar ? 'aviso disponible para copiar' : 'sin aviso');
  }).join('<br><br>');
}

function abrirPublicacion(id, plan) {
  avisoSlug = null;
  $('publicar-avisos').hidden = true;
  $('publicar-plan').innerHTML = textoPlan(plan);
  $('publicar-log').textContent = '';
  if (!$('dlg-publicar').open) $('dlg-publicar').showModal();
}

/** Sigue el trabajo en segundo plano y refresca la lista al terminar. */
async function seguirPublicacion(id) {
  while (true) {
    await new Promise((listo) => setTimeout(listo, 2000));
    let d;
    try {
      const r = await fetch(API + '/publicar-local?id=' + encodeURIComponent(id));
      if (!r.ok) throw new Error('no se pudo leer el estado');
      d = await r.json();
    } catch (e) {
      $('publicar-log').textContent += '\n' + String(e.message || e);
      return;
    }

    if (Array.isArray(d.lineas)) {
      const texto = d.lineas.map((l) => (l.nivel === 'error' ? '✖ ' : '') + (l.msg || '')).join('\n');
      if (texto && $('publicar-log').textContent !== texto) {
        $('publicar-log').textContent = texto;
        $('publicar-log').scrollTop = $('publicar-log').scrollHeight;
      }
    }

    if (d.estado && d.estado !== 'ejecutando') {
      const ok = d.estado === 'ok';
      $('publicar-log').textContent += '\n' + (ok ? '✔ Publicado.' : '✖ ' + (d.error || 'falló'));

      // Si hay fichas nuevas, el aviso queda listo para copiar a WhatsApp y X.
      const avisos = ok && d.resumen && Array.isArray(d.resumen.avisos) ? d.resumen.avisos : [];
      if (avisos.length) {
        avisoSlug = avisos[0];
        $('publicar-avisos').hidden = false;
        $('publicar-avisos').textContent = avisos.length === 1 ? 'Copiar aviso' : 'Copiar avisos';
        if (!$('dlg-publicar').open) $('dlg-publicar').showModal();
      }

      await recargarIndice();
      mostrarAviso(ok
        ? (avisos.length ? 'Publicado. Pulsa «Copiar aviso» para WhatsApp y X.' : 'Publicado.')
        : 'Falló la publicación: ' + (d.error || 'mira el registro'),
      ok ? 'var(--ok)' : 'var(--mal)');
      return;
    }
  }
}

/** Si se recarga la página con un trabajo en marcha, lo retoma. */
async function reanudarPublicacion() {
  try {
    const r = await fetch(API + '/publicar-local?ultimo=1');
    if (!r.ok) return;
    const d = await r.json();
    if (d && d.estado === 'ejecutando' && d.id) {
      abrirPublicacion(d.id, d.plan);
      seguirPublicacion(d.id);
    }
  } catch { /* sin trabajo */ }
}

/** Compone y abre el aviso de una ficha ya publicada, para copiarlo. */
async function abrirAvisosSlug(slug) {
  try {
    const r = await fetch(API + '/aviso?slug=' + encodeURIComponent(slug));
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo componer el aviso');
    $('aviso-meta').textContent = d.titulo;
    $('aviso-texto').value = d.texto;
    avisoX = d.textoX || d.texto;
    $('dlg-publicar').close();
    $('dlg-aviso').showModal();
  } catch (e) {
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
  // El popover cuelga del lienzo visible, no del textarea: al scrollear a los
  // lados el textarea se sale de la pantalla y el popover aparecía en negativo.
  const r = lienzo.getBoundingClientRect();
  sug.style.left = Math.max(8, Math.min(window.innerWidth - 200, r.left + 14)) + 'px';
  sug.style.top = Math.max(8, Math.min(window.innerHeight - 220, r.top + 40)) + 'px';
  sug.style.display = 'block';
}
function cerrarSug() { sug.style.display = 'none'; sug.innerHTML = ''; sugerencias = []; }
function insertarSug(t) {
  const texto = ta.value;
  const pos = ta.selectionStart;
  let ini = pos;
  while (ini > 0 && !/\s/.test(texto[ini - 1])) ini--;
  hist.push(snapshot());
  if (hist.length > 300) hist.shift();
  actualizarDeshacer();
  futuro = [];
  ta.value = texto.slice(0, ini) + t + texto.slice(pos);
  anterior = snapshot();
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
document.querySelectorAll('#nav-vistas button').forEach((b) => {
  b.onclick = () => {
    const v = b.dataset.vista;
    if (v === 'editor') {
      mostrarLista();
      history.pushState({ vista: 'lista' }, '', '/admin/');
    } else if (v === 'stats') {
      mostrarStats();
    } else {
      mostrarComentarios();
    }
  };
});
$('b-stats-refrescar').onclick = () => cargarStats();
$('b-comentarios-refrescar').onclick = () => cargarPeticiones();
$('orden-peticiones').onchange = () => pintarPeticiones();
$('peticiones').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-accion]');
  if (!b) return;
  const id = b.dataset.id;
  const accion = b.dataset.accion;
  const card = b.closest('.peticion');
  try {
    if (accion === 'completar') {
      const c = peticiones.find((x) => x.id === id);
      if (!c) return;
      await apiComentarios('PATCH', id, { completed: !c.completed });
      await cargarPeticiones();
    } else if (accion === 'eliminar') {
      if (!confirm('¿Eliminar esta petición y todas sus respuestas?')) return;
      await apiComentarios('DELETE', id);
      await cargarPeticiones();
    } else if (accion === 'responder') {
      const caja = card.querySelector('.peticion-respuesta');
      if (caja.innerHTML) { caja.innerHTML = ''; return; }
      caja.innerHTML = '<div class="respuesta-form"><textarea maxlength="1000" placeholder="Respondiendo a ' + escAttr(b.dataset.autor) + '…"></textarea><div class="acciones"><button type="button" data-accion="cancelar">Cancelar</button><button type="button" class="principal" data-accion="enviar" data-id="' + escAttr(id) + '">Enviar</button></div></div>';
      caja.querySelector('textarea').focus();
    } else if (accion === 'cancelar') {
      card.querySelector('.peticion-respuesta').innerHTML = '';
    } else if (accion === 'enviar') {
      const caja = card.querySelector('.peticion-respuesta');
      const texto = caja.querySelector('textarea').value.trim();
      if (!texto) return;
      await apiComentarios('POST', null, { path: '/pedir-copla', author: '', content: texto, parentId: id });
      await cargarPeticiones();
    }
  } catch (err) {
    mostrarAviso(String(err.message || err), 'var(--mal)');
  }
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
  else history.replaceState({ vista: 'lista' }, '', '/admin/');
};
$('b-nueva').onclick = () => abrirNueva();
$('dlg-nueva').addEventListener('close', () => {
  // Cerrar el formulario (Cancelar, Esc o la ✕) devuelve a la vista anterior.
  if (!creando && history.state && history.state.vista === 'nueva') history.back();
  creando = false;
});
window.addEventListener('popstate', (e) => {
  const st = e.state;
  if (st && st.vista === 'stats') { mostrarStats(false); return; }
  if (st && st.vista === 'comentarios') { mostrarComentarios(false); return; }
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
$('nota-local-cerrar').onclick = cerrarNotaLocal;
$('av-cerrar').onclick = () => $('dlg-aviso').close();
$('publicar-cerrar').onclick = () => $('dlg-publicar').close();
$('publicar-avisos').onclick = () => { if (avisoSlug) abrirAvisosSlug(avisoSlug); };
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
  zoomAjustado = !zoomAjustado;
  try { localStorage.setItem(CLAVE_ZOOM, zoomAjustado ? '1' : '0'); } catch { /* sin almacenamiento */ }
  aplicarZoom();
  verCaret();
};
$('b-separar').onclick = separar;
$('b-juntar').onclick = juntar;
$('b-deshacer').onclick = deshacer;

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
  actualizarDeshacer();
  futuro = [];
  anterior = snapshot();
  sucio = true;
  setEstado('sin guardar', false);
  pintar();
  if (tokenAntesCaret().length >= 2) abrirSug(); else cerrarSug();
});
ta.addEventListener('focus', () => {
  // Al escribir, el panel de Datos estorba: se pliega y deja más alto el editor.
  const datos = $('datos');
  if (datos && datos.open) datos.open = false;
});
ta.addEventListener('pointerdown', () => {
  const datos = $('datos');
  if (datos && datos.open) datos.open = false;
});
ta.addEventListener('click', actualizarAcciones);
ta.addEventListener('keyup', actualizarAcciones);
document.addEventListener('selectionchange', actualizarAcciones);
ta.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return mover(-1); }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return mover(1); }
  if (e.altKey && e.key === 'Enter') { e.preventDefault(); return separar(); }
  if (e.altKey && e.key === 'Backspace') { e.preventDefault(); return juntar(); }
  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return guardar(); }
  if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    return deshacer();
  }
  if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
    e.preventDefault();
    return rehacer();
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

/* Arrastre horizontal a mano: en móvil el textarea se queda el gesto y mueve
   el cursor en vez de desplazar el lienzo. Se lo quitamos cuando el gesto es
   claramente horizontal y movemos el scroll nosotros. */
let toque = null;
ta.addEventListener('touchstart', (e) => {
  toque = e.touches.length === 1
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY, scroll: lienzo.scrollLeft, horizontal: false }
    : null;
}, { passive: true });
ta.addEventListener('touchmove', (e) => {
  if (!toque || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - toque.x;
  const dy = e.touches[0].clientY - toque.y;
  if (!toque.horizontal) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
    toque.horizontal = true;
  }
  e.preventDefault();
  lienzo.scrollLeft = toque.scroll - dx;
}, { passive: false });
const finToque = () => { toque = null; };
ta.addEventListener('touchend', finToque, { passive: true });
ta.addEventListener('touchcancel', finToque, { passive: true });

window.addEventListener('beforeunload', (e) => {
  if (sucio) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------------- arranque ---------------- */
(async () => {
  const params = new URLSearchParams(location.search);
  const cuenta = await quien();
  if (!cuenta) { $('login').hidden = false; return; } // sin sesión: pantalla de login
  MODO_LOCAL = MODO_LOCAL || cuenta.local === true;
  document.body.classList.toggle('modo-local', MODO_LOCAL);
  $('login').hidden = true;
  $('nav-vistas').hidden = false;
  $('quien').textContent = cuenta.login;
  $('vista-lista').hidden = false;
  $('b-nueva').hidden = false;
  $('b-letra').hidden = false;
  $('cab-meta').textContent = '';
  setEstado('', true);
  await cargarIndice();
  pintarLista();
  $('f-por-publicar').hidden = !MODO_LOCAL;
  if (MODO_LOCAL) reanudarPublicacion();
  // La entrada base del historial es la lista: así el atrás desde una ficha
  // vuelve aquí y no sale del panel.
  history.replaceState(estadoLista, '', '/admin/');
  const vista = params.get('vista');
  if (vista === 'stats') mostrarStats();
  else if (vista === 'comentarios') mostrarComentarios();
  else if (params.get('ficha')) await abrirFicha(params.get('ficha'));
  else if (params.get('nueva')) abrirNueva();
  $('pie').innerHTML = MODO_LOCAL
    ? '<span title="Sin sesión de GitHub: se usa el token del .env">Modo local · sin sesión</span>'
    : '<a href="/admin/api/salir">Salir</a>';
})();

