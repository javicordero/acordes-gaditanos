// Front del panel /admin: lista, editor, vista previa, avisos y publicación.
//
// Lo monta `src/pages/admin.astro`. Las funciones de `/admin/api/*` son las que
// hablan con GitHub o con el disco; aquí solo se pinta y se pide. El flujo está
// en `docs/operativa/panel-admin.md`.
//
// Invariantes que se rompen al editar:
//   - El HTML se monta por strings: escapa siempre con `escaparHtml()`.
//   - `MODO_LOCAL` lo confirma `/me` (`local: true`); el hostname es solo la pista.
//   - La pestaña activa se guarda en `sessionStorage` y se recupera al volver de «Ver».
//   - Las pestañas se deciden con `esPorRevisar`/`esBorrador`/`esPorPublicar`/`esPublicada`.
//   - Revisado ✓ (marca; en local también promueve) y Promover (promueve y marca) hacen cosas distintas en producción.

import { initPreAcordes, desenvolver, envolver, montarMd, revisar, clasificar, ANCHO_MAX, columnasLinea, cortePorAncho, esAcorde, esAnotacion } from '../lib/pre-acordes.js';
import { separarLetra, separarVerso, juntarLetra, palabraBajoCursor, moverAcordeLinea, moverAcordeA, esLineaAcordes, realinearEstructura } from '../lib/editar-lineas.js';
import { puedeSubir, dividirLote, enTandas, avisa as avisaFicha } from '../lib/panel-lote.js';
import { escaparHtml } from '../lib/escape.js';
import { avisosPasodoblesSinTitulo } from '../lib/alertas-letra-titulo.js';
import { normalizarAgrupacion } from '../lib/contenido.ts';
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
const sugLista = $('sug-lista');

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
// Autores y agrupaciones que ya existen en el cancionero, para sugerirlos.
let autoresConocidos = [];
let agrupacionesConocidas = [];
// Texto del aviso sin marcas, para el tuit (el textarea lleva el de WhatsApp).
let avisoX = '';

// Escapa texto y comillas: vale tanto entre etiquetas como dentro de un
// atributo. `escAttr` se mantiene como alias porque los atributos del panel van
// con comillas dobles y así no se escapa dos veces la comilla.
const esc = escaparHtml;
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

/** Qué explica cada pestaña (se pinta bajo los botones, también en móvil). */
const LEYENDAS = {
  todas: 'Todo el cancionero. Cada ficha está en una sola pestaña de las de abajo.',
  revisar: 'Ya están en la web y les falta el repaso a mano. <b>Revisado ✓</b> las saca de la cola.',
  borradores: 'Aún no están en la web. <b>Revisado ✓</b> las marca y, si es un borrador, lo promueve para poder subirlo.',
  porPublicar: 'En <code>acordes</code>, con cambios que la web aún no tiene: sin commit (se suben) o en una PR abierta (se fusiona).',
  publicadas: 'Ya están en la web y revisadas.',
  otraweb: 'Importadas de otra web, con los acordes todavía sin envolver. <b>A borradores</b> las pasa a la pestaña <b>Borradores</b> para revisarlas en el editor.',
};

/**
 * Cambia la pestaña de la lista y la recuerda en la sesión: al abrir una vista
 * previa y volver con «atrás», la página se recarga y se recupera la pestaña.
 */
function aplicarFiltro(tipo) {
  // La pestaña de borradores se llamaba `pendientes` antes de separar la
  // revisión; si viene guardada con el nombre viejo, se traduce.
  if (tipo === 'pendientes') tipo = 'borradores';
  const b = tipo && document.querySelector('#filtros button[data-filtro="' + tipo + '"]');
  if (!b || b.hidden) return;
  filtroTipo = tipo;
  document.querySelectorAll('#filtros button').forEach((x) => x.classList.toggle('sel', x === b));
  const leyenda = $('leyenda-filtro');
  if (leyenda) leyenda.innerHTML = LEYENDAS[tipo] || '';
  try { sessionStorage.setItem('admin-filtro', tipo); } catch { /* sin almacenamiento */ }
  pintarLista();
}
// Coplas que faltan por revisar (cola de `src/data/revision-acordes.json`).
let revision = new Set();
// Fichas de `acordes` en el ordenador pero aún sin subir a git (solo en local).
let pendientesPublicar = [];
// Fichas de la colección provisional `otraweb` (importadas del cancionero, con
// los acordes sin envolver). Solo en local: se pasan a borradores desde el panel.
let importados = [];
let sinSubirClaves = new Set();
// Tipo de cada ficha pendiente de subir: `nueva` (aún no en git), `modificada`,
// `borrada` o `sin-push` (commit local sin push). Una publicada y modificada en
// el ordenador ya está en la web: lo que falta es el commit.
let estadoPendiente = new Map();
// Selección de «Por publicar» para subir varias fichas de una vez. `loteVisibles`
// son las filas pintadas (las de la pestaña, recortadas a 300): «Seleccionar
// todo» no marca fichas que no se ven.
let seleccion = new Set();
let loteVisibles = [];

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Ficha de la cola «Por revisar». */
const porRevisar = (x) => revision.has(x.slug);
/** Está en `acordes` en el ordenador pero todavía no en git. */
const sinSubir = (x) => sinSubirClaves.has(x.slug);
/** En `acordes` y ya en git: está en la web. */
const enGit = (x) => x.zona === 'acordes' && !sinSubir(x);
/** Ficha de `acordes` con una PR abierta: la web todavía no lleva el cambio. */
const enPRPublicar = (x) => x.zona === 'acordes' && Boolean(x.enPR);

/**
 * Fecha de alta siguiente: un día después de la última publicada en git.
 * Se calcula con el índice de acordes (que ya trae `date`) y se manda a
 * `/publicar`; así el botón no usa la fecha de hoy, que puede quedar por
 * detrás de las últimas fichas y sacarlas de novedades.
 */
function fechaSiguiente() {
  const fechas = indice
    .filter((x) => x.zona === 'acordes' && x.date)
    .map((x) => {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(x.date));
      return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : NaN;
    })
    .filter((n) => Number.isFinite(n));
  if (!fechas.length) return hoy();
  const d = new Date(Math.max(...fechas));
  d.setUTCDate(d.getUTCDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
}

/** Cuerpo de `/publicar` con la fecha siguiente ya calculada. */
function cuerpoPublicar(slug, extra = {}) {
  return JSON.stringify({ slug, fecha: fechaSiguiente(), ...extra });
}

/** Lo que hay que hacer con una ficha pendiente, en corto: `nueva` | `modificada` | `borrada`. */
const tipoPendiente = (x) => (x.estado === 'sin-push' ? x.cambio || 'modificada' : x.estado);
/** La ficha pendiente aún no está en git (no está en la web). */
const esNuevaPendiente = (slug) => estadoPendiente.get(slug) === 'nueva';

/** Deja el estado de lo que falta subir (lo comparten la carga y el refresco). */
function fijarPendientes(lista) {
  pendientesPublicar = Array.isArray(lista) ? lista : [];
  sinSubirClaves = new Set(pendientesPublicar.map((x) => x.slug));
  estadoPendiente = new Map(pendientesPublicar.map((x) => [x.slug, tipoPendiente(x)]));
}

/** Aviso no bloqueante al publicar pasodobles con título de letra. */
function textoAvisosLetraTitulo(slugs, cambios = []) {
  const catalogo = new Map(indice.map((x) => [x.slug, x]));
  for (const x of pendientesPublicar) catalogo.set(x.slug, { ...catalogo.get(x.slug), ...x });
  for (const x of cambios) catalogo.set(x.slug, { ...catalogo.get(x.slug), ...x });
  const avisos = avisosPasodoblesSinTitulo([...catalogo.values()], slugs);
  return avisos.map((aviso) =>
    '⚠️ ' + aviso.agrupacion + ': «' + aviso.titulo + '» tiene letraTitulo, pero también falta en ' +
    aviso.faltan.map((x) => x.slug).join(', ') + '.',
  ).join('\n');
}

function confirmarPublicacion(mensaje, slugs, cambios = []) {
  const aviso = textoAvisosLetraTitulo(slugs, cambios);
  return confirm(mensaje + (aviso ? '\n\n' + aviso + '\n\nPuedes continuar igualmente.' : ''));
}

// Las cuatro categorías, excluyentes: cada ficha cae en una sola pestaña.
//   sin revisar + en git  → Por revisar
//   sin revisar + sin git → Borradores (solo si además es nueva: una publicada que
//                           se ha modificado en local ya está en la web y va a Por publicar)
//   revisada    + sin git → Por publicar
//   revisada    + en git  → Publicadas
// «Sin git» vale para lo modificado en el ordenador y para lo que está en una PR
// abierta (una corrección hecha desde el móvil); una PR manda sobre «Por revisar»,
// porque lo que queda es publicarla.
const esPorRevisar = (x) => enGit(x) && porRevisar(x) && !enPRPublicar(x);
const esPorPublicar = (x) => enPRPublicar(x) ||
  (sinSubir(x) && !(porRevisar(x) && esNuevaPendiente(x.slug)));
const esBorrador = (x) => x.zona === 'borradores' || (sinSubir(x) && porRevisar(x) && esNuevaPendiente(x.slug));
const esPublicada = (x) => enGit(x) && !porRevisar(x) && !enPRPublicar(x);
/** Ficha pendiente de algo: se pinta con el fondo destacado. */
const esPendiente = (x) => esBorrador(x) || esPorRevisar(x) || esPorPublicar(x);

async function cargarIndice() {
  if (indice.length) return indice;
  // Sin caché: el panel necesita el `date` recién construido para calcular
  // la fecha siguiente al publicar.
  const r = await fetch('/indice-busqueda.json', { cache: 'no-cache' });
  const publicadas = (await r.json()).map((x) => ({ ...x, zona: 'acordes' }));
  let borradores = [];
  try {
    const b = await fetch(API + '/lista');
    if (b.ok) {
      const j = await b.json();
      borradores = j.borradores.map((x) => ({ ...x, zona: x.zona || 'borradores' }));
      importados = (j.otraweb || []).map((x) => ({ ...x, zona: 'otraweb', local: true }));
      revision = new Set(j.revision || []);
      fijarPendientes(j.pendientes);
    }
  } catch { /* sin borradores */ }
  // Una misma ficha puede venir de `/lista` (con `zona`, `local` y la PR) y del
  // índice del build: se queda una sola, con los datos de la API y el texto
  // (música, letra) del índice, que es el que usa el buscador.
  const porSlug = new Map();
  for (const x of borradores) porSlug.set(x.slug, x);
  for (const x of publicadas) {
    const api = porSlug.get(x.slug);
    porSlug.set(x.slug, api
      ? { ...x, ...api, musica: api.musica || x.musica, letra: api.letra || x.letra }
      : x);
  }
  indice = [...porSlug.values()];
  cargarSugerencias();
  const dl = $('slugs');
  dl.innerHTML = indice.slice(0, 400).map((x) => '<option value="' + esc(x.slug) + '">' + esc(x.pieza + ' · ' + x.agrupacion + ' · ' + x.year) + '</option>').join('');
  return indice;
}

/** Junta los autores de música/letra y las agrupaciones que ya aparecen en las fichas. */
function cargarSugerencias() {
  const autores = new Set();
  const agrupaciones = new Set();
  for (const x of indice) {
    const agrupacion = normalizarAgrupacion(String(x.agrupacion || '').trim());
    if (agrupacion) agrupaciones.add(agrupacion);
    for (const campo of [x.musica, x.letra]) {
      for (const nombre of String(campo || '').split(',')) {
        const limpio = nombre.trim();
        if (limpio) autores.add(limpio);
      }
    }
  }
  autoresConocidos = [...autores].sort((a, b) => a.localeCompare(b, 'es'));
  agrupacionesConocidas = [...agrupaciones].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Vuelve a pedir la lista (tras publicar cambia lo pendiente de subir). */
async function recargarIndice() {
  indice = [];
  pendientesPublicar = [];
  importados = [];
  sinSubirClaves = new Set();
  estadoPendiente = new Map();
  // Lo seleccionado puede haberse publicado: no se arrastra a la lista nueva.
  seleccion.clear();
  loteVisibles = [];
  await cargarIndice();
  pintarLista();
}

/**
 * Refresca solo lo que cambia al editar una ficha: la cola de revisión, lo que hay
 * en el ordenador sin subir y las PRs abiertas de fichas ya publicadas. Es lo que
 * hace que una ficha modificada pase a «Por publicar» al guardarla, sin recargar la
 * página ni volver a pedir la lista entera a GitHub.
 */
async function refrescarPendientes() {
  try {
    const r = await fetch(API + '/lista?solo=pendientes');
    if (!r.ok) return;
    const j = await r.json();
    revision = new Set(j.revision || []);
    fijarPendientes(j.pendientes);
    // Las PRs abiertas: se marcan en el índice (o se añaden si aún no estaban) para
    // que la ficha cuente como pendiente de publicar.
    for (const p of j.prs || []) {
      const i = indice.findIndex((x) => x.slug === p.slug);
      if (i >= 0) Object.assign(indice[i], { zona: 'acordes', enPR: p.enPR, rama: p.rama });
      else indice.push({ ...p, zona: 'acordes' });
    }
    if (indice.length) pintarLista();
  } catch { /* sin red: se queda el estado que ya había */ }
}

/** La PR ya está fusionada: la ficha deja de estar pendiente de publicar en la lista. */
function quitarPR(slug) {
  const x = indice.find((i) => i.slug === slug);
  if (x) { delete x.enPR; x.rama = null; }
  if (indice.length) pintarLista();
}

const marcas = (x) => [
  x.zona === 'borradores' ? '<span class="marca">BORRADOR</span>' : '',
  x.local ? '<span class="marca local">LOCAL</span>' : '',
  MODO_LOCAL && x.zona === 'borradores' && !x.local
    ? '<span class="marca remoto" title="Solo está en GitHub: ábrelo y guárdalo para traerlo al ordenador">EN GITHUB</span>'
    : '',
  x.enPR ? '<span class="marca pr">EN PR</span>' : '',
  porRevisar(x) ? '<span class="marca revisar">SIN REVISAR</span>' : '',
  x.incompleta === 'sinLetra' ? '<span class="marca sinletra" title="El bloque de la letra está vacío">SIN LETRA</span>' : '',
  x.incompleta === 'sinAcordes' ? '<span class="marca sinacordes" title="La letra no tiene ningún acorde">SIN ACORDES</span>' : '',
].filter(Boolean).join(' ');

function filaLista(x) {
  const boton = (accion, texto, extra, titulo) =>
    '<button type="button" class="acc' + (extra || '') + '" data-accion="' + accion + '" data-slug="' + esc(x.slug) + '"' +
      (titulo ? ' title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '"' : '') +
      '>' + texto + '</button>';
  // El avance va en la fila: «Revisado ✓» saca la ficha de la cola y, si es un
  // borrador, lo promueve (en local). «Publicar» solo en las ya promovidas.
  const avanza = esPorRevisar(x) || esBorrador(x);
  const puedePublicar = esPorPublicar(x) && (!MODO_LOCAL || sinSubir(x));

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
      (avanza ? boton('revisar', 'Revisado ✓', ' revisado', x.zona === 'borradores' ? 'Marca la ficha como revisada y la promueve a acordes' : 'Marca la ficha como revisada') : '') +
      (puedePublicar ? boton('publicarLocal', 'Publicar', ' principal') : '') +
      boton('editar', 'Editar') +
      boton('clonar', '＋', ' icono', 'Crear otra ficha (otra letra) a partir de esta misma música') +
    '</div>' +
  '</article>';
}

function grupoLista(titulo, items, clase, render = filaLista) {
  return '<div class="grupo' + (clase ? ' ' + clase : '') + '">' +
    '<span class="grupo-tit">' + esc(titulo) + '</span><i></i><span class="grupo-n">' + items.length + '</span></div>' +
    items.map(render).join('');
}

/**
 * Fila de la pestaña «Por publicar»: lo que está en `acordes` pero la web todavía no
 * tiene. O son cambios del ordenador sin commit (`NUEVA`, `MODIFICADA`, `BORRADA`,
 * `SIN PUSH`, se suben desde aquí) o una PR abierta (`EN PR`, se publica fusionándola).
 */
function filaPorPublicar(x, conSel = false) {
  const conPR = Boolean(x.enPR);
  const etiqueta = conPR ? 'EN PR'
    : x.estado === 'nueva' ? 'NUEVA'
    : x.estado === 'borrada' ? 'BORRADA'
    : x.estado === 'sin-push' ? 'SIN PUSH'
    : 'MODIFICADA';
  const clase = conPR || x.estado === 'sin-push' ? 'pr' : x.estado === 'nueva' ? 'local' : 'remoto';
  const boton = (accion, texto, extra) =>
    '<button type="button" class="acc' + (extra || '') + '" data-accion="' + accion + '" data-slug="' + esc(x.slug) + '">' + texto + '</button>';
  // Vista previa: la ficha ya está en `acordes` en el disco, así que `astro dev`
  // la pinta en su URL (con barra final, que es la que sirve la web). Se abre en
  // la misma pestaña: «atrás» devuelve al panel. Una ficha borrada no tiene nada
  // que enseñar, y una que está en una PR no está en el disco: se mira en la PR.
  const ver = conPR || x.estado === 'borrada' || x.cambio === 'borrada' ? ''
    : '<a class="acc boton" href="/acordes/' + encodeURIComponent(x.slug) + '/"' +
      ' title="Ver la ficha como está ahora en el ordenador (vuelve con «atrás»)">Ver</a>';

  // Casilla solo en la pestaña «Por publicar»: en «Todas» la barra de lote no
  // tiene sentido y el resto de pestañas no se suben desde aquí.
  const casilla = conSel && puedeSubir(x, MODO_LOCAL)
    ? '<input type="checkbox" class="fila-sel" data-sel value="' + esc(x.slug) + '"' +
      (seleccion.has(x.slug) ? ' checked' : '') +
      ' aria-label="Seleccionar ' + esc([x.pieza, x.agrupacion].filter(Boolean).join(' · ')) + '">'
    : '';

  return '<article class="fila pendiente' + (casilla ? ' con-sel' : '') + '">' +
    casilla +
    '<button type="button" class="fila-info" data-slug="' + esc(x.slug) + '">' +
      '<span class="f-agr">' + esc(x.agrupacion) + '</span>' +
      '<span class="f-meta">' +
        '<span class="f-year">' + esc(String(x.year || '—')) + '</span>' +
        '<span>' + esc(x.pieza) + '</span>' +
        (x.letraTitulo ? '<span class="f-letra">' + esc(x.letraTitulo) + '</span>' : '') +
        '<span class="marca ' + clase + '">' + etiqueta + '</span>' +
        (revision.has(x.slug) ? '<span class="marca revisar">SIN REVISAR</span>' : '') +
        (x.borrador ? '<span class="marca" title="Estaba en borradores y se ha promovido: falta publicarla">PROMOVIDA</span>' : '') +
      '</span>' +
    '</button>' +
    '<div class="fila-acciones">' +
      ver +
      (x.estado !== 'borrada' ? boton('editar', 'Editar') : '') +
      (conPR
        ? boton('fusionarPr', 'Publicar', ' principal')
        : boton('publicarLocal', x.estado === 'nueva' ? 'Publicar' : 'Subir', ' principal')) +
    '</div>' +
  '</article>';
}

/**
 * Fila de la pestaña «Otra web»: una ficha importada del cancionero que aún no
 * está en borradores. Los acordes van sin envolver, así que se revisa en su
 * vista previa y se pasa a `borradores` con **A borradores**.
 */
function filaImportada(x) {
  const info = 'data-accion="verOtraweb" data-slug="' + esc(x.slug) + '"';
  return '<article class="fila pendiente">' +
    '<button type="button" class="fila-info" ' + info + '>' +
      '<span class="f-agr">' + esc(x.agrupacion) + '</span>' +
      '<span class="f-meta">' +
        '<span class="f-year">' + esc(String(x.year || '—')) + '</span>' +
        '<span>' + esc(x.pieza) + '</span>' +
        (x.letraTitulo ? '<span class="f-letra">' + esc(x.letraTitulo) + '</span>' : '') +
        '<span class="marca local">OTRAWEB</span>' +
        (x.incompleta === 'sinLetra' ? '<span class="marca sinletra" title="El bloque de la letra está vacío">SIN LETRA</span>' : '') +
      '</span>' +
    '</button>' +
    '<div class="fila-acciones">' +
      '<a class="acc boton" href="/otraweb/' + encodeURIComponent(x.slug) + '/"' +
        ' title="Ver la ficha tal como está (vuelve con «atrás»)">Ver</a>' +
      '<button type="button" class="acc principal" data-accion="aBorradores" data-slug="' + esc(x.slug) + '"' +
        ' title="Envuelve los acordes y mueve la ficha a borradores para revisarla">A borradores</button>' +
    '</div>' +
  '</article>';
}

/** Orden de una pestaña: año de más nuevo a más viejo y agrupación A-Z. */
const porAnioYAgra = (a, b) =>
  (Number(b.year) || 0) - (Number(a.year) || 0) ||
  String(a.agrupacion).localeCompare(String(b.agrupacion), 'es') ||
  String(a.pieza).localeCompare(String(b.pieza), 'es');

/**
 * «Por publicar» va primero por lo que hay que hacer: las modificadas (una
 * corrección de algo ya publicado) delante, después las nuevas, las de commits
 * sin push y, al final, las borradas.
 */
const rangoEstado = (x) => {
  const e = x.estado === 'sin-push' ? (x.cambio || 'modificada') : x.estado;
  return e === 'modificada' ? 0 : e === 'nueva' ? 1 : e === 'borrada' ? 3 : 2;
};

/** Barra de lote: solo en «Por publicar» y sobre lo que hay pintado. */
function pintarLote() {
  const barra = $('lote');
  if (!barra) return;
  // Slugs que ya no están en la pestaña (se publicaron, cambió la búsqueda…).
  const enTabla = new Set(loteVisibles.map((x) => x.slug));
  for (const s of [...seleccion]) if (!enTabla.has(s)) seleccion.delete(s);

  const visible = filtroTipo === 'porPublicar' && loteVisibles.length > 0;
  barra.hidden = !visible;
  if (!visible) return;

  const n = seleccion.size;
  $('lote-n').textContent = n
    ? n + ' seleccionada' + (n === 1 ? '' : 's') + ' de ' + loteVisibles.length
    : 'Ninguna seleccionada';
  const publicar = $('lote-publicar');
  publicar.disabled = n === 0;
  publicar.textContent = n > 1 ? 'Publicar (' + n + ')' : 'Publicar';
  $('lote-limpiar').disabled = n === 0;
  $('lote-todo').textContent = n > 0 && n === loteVisibles.length ? 'Quitar todo' : 'Seleccionar todo';
}

function pintarLista() {
  const palabras = normalizar($('q').value).split(/\s+/).filter(Boolean);
  const coincide = (x) => {
    if (!palabras.length) return true;
    const t = normalizar([x.slug, x.pieza, x.agrupacion, x.year, x.letraTitulo, x.musica, x.letra].join(' '));
    return palabras.every((w) => t.includes(w));
  };

  const resultado = indice.filter(coincide);
  const revisar = resultado.filter(esPorRevisar).sort(porAnioYAgra);
  // Los borradores a medias, primero: son los que hay que tocar.
  const borradores = resultado.filter(esBorrador).sort(porAnioYAgra);
  const borradoresCompletos = borradores.filter((x) => !x.incompleta);
  const borradoresAMedias = borradores.filter((x) => x.incompleta);
  const publicadas = resultado.filter(esPublicada);
  // «Otra web»: lo importado del cancionero que aún no se ha pasado a borradores.
  // Vive aparte del índice (no está en la web ni en la cola de revisión).
  const importadas = importados.filter(coincide).sort(porAnioYAgra);
  // «Por publicar»: lo que está en `acordes` pero la web aún no tiene. En local, los
  // cambios del ordenador sin commit; en cualquier modo, las PRs abiertas (una
  // corrección guardada desde el móvil). Una ficha que esté en las dos solo sale una
  // vez: manda la del ordenador, que es la que se puede subir desde aquí.
  const porPublicar = [];
  const yaEsta = new Set();
  for (const x of [
    ...pendientesPublicar.filter((x) => coincide(x) && (!revision.has(x.slug) || !esNuevaPendiente(x.slug))),
    ...resultado.filter(enPRPublicar),
  ]) {
    if (yaEsta.has(x.slug)) continue;
    yaEsta.add(x.slug);
    porPublicar.push(x);
  }
  porPublicar.sort((a, b) => rangoEstado(a) - rangoEstado(b) || porAnioYAgra(a, b));

  $('q-limpiar').hidden = !$('q').value;
  const cuentas = {
    todas: resultado.length,
    revisar: revisar.length,
    borradores: borradores.length,
    porPublicar: porPublicar.length,
    publicadas: publicadas.length,
    otraweb: importadas.length,
  };
  for (const el of document.querySelectorAll('[data-cuenta]')) {
    el.textContent = cuentas[el.dataset.cuenta] ?? 0;
  }
  // Tira del flujo: los tres pasos y la revisión, cada uno como atajo.
  const pasos = $('pasos');
  if (pasos) {
    const flecha = '<span class="flecha" aria-hidden="true">→</span>';
    const paso = (k, texto) => '<button type="button" data-paso="' + k + '">' + texto +
      ' <b data-cuenta="' + k + '">' + (cuentas[k] || 0) + '</b></button>';
    pasos.innerHTML = paso('revisar', 'Por revisar') + flecha + paso('borradores', 'Borradores') +
      flecha + paso('porPublicar', 'Por publicar') + flecha + paso('publicadas', 'Publicadas');
    pasos.querySelectorAll('[data-paso]').forEach((b) => { b.onclick = () => aplicarFiltro(b.dataset.paso); });
  }

  const MAX = 300;
  // La selección solo existe en «Por publicar», y sobre lo que de verdad se
  // pinta: «Seleccionar todo» no marca fichas que no se ven.
  loteVisibles = filtroTipo === 'porPublicar' ? porPublicar.slice(0, MAX) : [];
  let pintadas = 0;
  const recorta = (items) => {
    const r = items.slice(0, Math.max(0, MAX - pintadas));
    pintadas += r.length;
    return r;
  };

  const grupos = [];
  if (filtroTipo === 'todas') {
    if (revisar.length) grupos.push({ titulo: 'Por revisar', items: revisar, clase: 'pend' });
    if (borradores.length) grupos.push({ titulo: 'Borradores', items: [...borradoresAMedias, ...borradoresCompletos], clase: 'pend' });
    if (porPublicar.length) grupos.push({ titulo: 'Por publicar', items: porPublicar, clase: 'pend', render: (x) => filaPorPublicar(x, filtroTipo === 'porPublicar') });
    if (publicadas.length) {
      const porAnio = new Map();
      for (const x of publicadas) {
        const y = String(x.year || 'Sin año');
        if (!porAnio.has(y)) porAnio.set(y, []);
        porAnio.get(y).push(x);
      }
      const anios = [...porAnio.keys()].sort((a, b) => (Number(b) || 0) - (Number(a) || 0) || a.localeCompare(b, 'es'));
      for (const anio of anios) {
        grupos.push({ titulo: anio, items: porAnio.get(anio).sort(porAnioYAgra) });
      }
    }
  } else if (filtroTipo === 'revisar') {
    grupos.push({ titulo: 'Por revisar', items: revisar, clase: 'pend' });
  } else if (filtroTipo === 'borradores') {
    grupos.push({ titulo: 'Borradores a medias', items: borradoresAMedias, clase: 'pend' });
    grupos.push({ titulo: 'Borradores', items: borradoresCompletos, clase: 'pend' });
  } else if (filtroTipo === 'porPublicar') {
    grupos.push({ titulo: 'Por publicar', items: porPublicar, clase: 'pend', render: (x) => filaPorPublicar(x, filtroTipo === 'porPublicar') });
  } else if (filtroTipo === 'publicadas') {
    const porAnio = new Map();
    for (const x of publicadas) {
      const y = String(x.year || 'Sin año');
      if (!porAnio.has(y)) porAnio.set(y, []);
      porAnio.get(y).push(x);
    }
    const anios = [...porAnio.keys()].sort((a, b) => (Number(b) || 0) - (Number(a) || 0) || a.localeCompare(b, 'es'));
    for (const anio of anios) grupos.push({ titulo: anio, items: porAnio.get(anio).sort(porAnioYAgra) });
  } else if (filtroTipo === 'otraweb') {
    grupos.push({ titulo: 'Otra web · pendientes de pasar a borradores', items: importadas, clase: 'pend', render: filaImportada });
  }

  let html = '';
  let mostradas = 0;
  let total = 0;
  for (const g of grupos) {
    if (!g.items.length) continue;
    total += g.items.length;
    const items = recorta(g.items);
    mostradas += items.length;
    html += grupoLista(g.titulo, items, g.clase, g.render);
  }

  $('filas').innerHTML = html;
  $('filas').querySelectorAll('[data-slug]').forEach((b) => {
    const accion = b.dataset.accion || 'editar';
    b.onclick = () => {
      if (accion === 'editar') return abrirFicha(b.dataset.slug);
      if (accion === 'publicar') return publicarDesdeLista(b.dataset.slug, b);
      if (accion === 'publicarLocal') return pedirPublicar(b.dataset.slug);
      if (accion === 'fusionarPr') return fusionarDesdeLista(b.dataset.slug, b);
      if (accion === 'revisar') return revisarDesdeLista(b.dataset.slug, b);
      if (accion === 'clonar') return clonar(b.dataset.slug);
      if (accion === 'verOtraweb') return (location.href = '/otraweb/' + encodeURIComponent(b.dataset.slug) + '/');
      if (accion === 'aBorradores') return pasarABorradores(b.dataset.slug, b);
    };
  });
  // Casillas de «Por publicar»: marcar no repinta la lista (perdería el foco).
  $('filas').querySelectorAll('input[data-sel]').forEach((c) => {
    c.onchange = () => {
      if (c.checked) seleccion.add(c.value);
      else seleccion.delete(c.value);
      pintarLote();
    };
  });
  pintarLote();

  $('lista-vacio').hidden = mostradas > 0;
  if (!mostradas) {
    const q = $('q').value.trim();
    $('lista-vacio').innerHTML = q
      ? '<b>Sin resultados</b>Ninguna ficha casa con «' + esc(q) + '».'
      : !indice.length
        ? '<b>Cargando…</b>'
        : filtroTipo === 'revisar'
          ? '<b>Nada pendiente</b>No queda ninguna copla por revisar.'
          : filtroTipo === 'borradores'
            ? '<b>Nada en borradores</b>No hay fichas sin publicar.'
            : filtroTipo === 'porPublicar'
              ? (MODO_LOCAL
                ? '<b>Nada pendiente</b>Todo lo que está en <code>acordes</code> ya está subido a git y sin PR abierta.'
                : '<b>Nada pendiente</b>No hay ninguna PR abierta de una ficha publicada.')
              : filtroTipo === 'publicadas'
                ? '<b>Nada publicado</b>Todavía no hay fichas en la web.'
                : filtroTipo === 'otraweb'
                  ? '<b>Nada en Otra web</b>No queda ninguna ficha importada sin pasar a borradores.'
                  : '<b>Sin fichas</b>No hay nada todavía: crea la primera.';
  }
  $('lista-tope').hidden = total <= MAX;
}

/** Vuelve a la lista (el historial lo decide quien llama). */
function mostrarLista() {
  ocultarVistas();
  cerrarNotaLocal();
  $('vista-lista').hidden = false;
  $('nav-vistas').hidden = false;
  $('b-nueva').hidden = false;
  $('b-letra').hidden = false;
  ['b-lista', 'b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar', 'b-revisado', 'b-preview'].forEach((id) => { $(id).hidden = true; });
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
  ['b-nueva', 'b-letra', 'b-lista', 'b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar', 'b-revisado', 'b-preview'].forEach((id) => { $(id).hidden = true; });
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
  if (statsFuente === 'cf') cargarCloudflare();
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
// Fechas de alta por ruta (`public/rutas-fechas.json`, lo genera
// `scripts/rutas-fechas.ts`). La media empieza en `INICIO_CONTADOR`: el worker
// no tiene datos anteriores.
const INICIO_CONTADOR = '2026-01-19';
let statsData = null;
let statsPaginas = [];
let statsFechas = null;
let rutasFiltro = '';
let rutasExcluir = '';
let rutasOrden = 'visitas';
let rutasOrdenDir = 'desc';
const fmtNum = (n) => Number(n || 0).toLocaleString('es-ES');

async function cargarFechasRutas() {
  if (statsFechas) return statsFechas;
  try {
    const r = await fetch('/rutas-fechas.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('no se pudo leer el registro de fechas');
    statsFechas = await r.json();
  } catch {
    statsFechas = { desde: INICIO_CONTADOR, rutas: {}, patrones: {} };
  }
  return statsFechas;
}

async function cargarStats() {
  const cont = $('stats-contenido');
  cont.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    statsFechas = null;
    const [r] = await Promise.all([
      fetch(API + '/stats', { cache: 'no-store' }),
      cargarFechasRutas(),
    ]);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudieron cargar las estadísticas');
    statsCargadas = true;
    pintarStats(d);
  } catch (e) {
    cont.innerHTML = '<p class="error">' + esc(String(e.message || e)) + '</p>';
  }
}

/** Ruta normalizada igual que las claves del registro (con barra final). */
function normalizarRuta(ruta) {
  let r = String(ruta || '');
  if (!r.startsWith('/')) r = '/' + r;
  if (!r.endsWith('/')) r += '/';
  return r;
}

const sinTildes = (texto) =>
  String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Fecha de alta de una ruta: exacta y, si no, la del patrón más largo. */
function fechaDeRuta(ruta) {
  const registro = statsFechas || {};
  const clave = normalizarRuta(ruta);
  if (registro.rutas && registro.rutas[clave]) return registro.rutas[clave];
  if (registro.rutas && registro.rutas[ruta]) return registro.rutas[ruta];
  const patrones = registro.patrones || {};
  let mejor = '';
  for (const prefijo of Object.keys(patrones)) {
    if (clave.startsWith(prefijo) && prefijo.length > mejor.length) mejor = prefijo;
  }
  return mejor ? patrones[mejor] : '';
}

/** Inicio del contador: lo dice el registro y, si no, la constante. */
const desdeContador = () => (statsFechas && statsFechas.desde) || INICIO_CONTADOR;

/** Días transcurridos desde el alta (o desde el inicio del contador). */
function diasDeRuta(fecha) {
  const desde = desdeContador();
  const inicio = fecha && fecha > desde ? fecha : desde;
  const hoyIso = new Date().toISOString().slice(0, 10);
  const ms = Date.parse(hoyIso + 'T00:00:00Z') - Date.parse(inicio + 'T00:00:00Z');
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

const fechaCortaIso = (iso) => (iso || '').split('-').reverse().join('/');

/** Cabecera ordenable de la tabla de rutas. */
function cabeceraRutas() {
  const cols = [
    { id: 'ruta', t: 'Ruta', num: false },
    { id: 'visitas', t: 'Visitas', num: true },
    { id: 'media', t: 'Media/día', num: true, nota: 'Visitas por día desde el alta (o desde el 19/01/2026)' },
  ];
  const th = cols.map((c) => {
    const activa = rutasOrden === c.id;
    const aria = activa ? (rutasOrdenDir === 'asc' ? 'ascending' : 'descending') : 'none';
    const flecha = activa
      ? ' <span class="stats-flecha">' + (rutasOrdenDir === 'asc' ? '▲' : '▼') + '</span>'
      : '';
    return '<th' + (c.num ? ' class="num"' : '') + ' aria-sort="' + aria + '"' +
      (c.nota ? ' title="' + esc(c.nota) + '"' : '') + '>' +
      '<button type="button" class="stats-th-orden" data-orden="' + c.id + '">' + c.t + flecha + '</button>' +
    '</th>';
  }).join('');
  return '<tr>' + th + '<th class="progreso">Popularidad</th></tr>';
}

/** Repinta solo la tabla de rutas, para no perder el foco al filtrar. */
function pintarRutas() {
  const cuerpo = $('stats-rutas-cuerpo');
  if (!cuerpo || !statsData) return;

  $('stats-rutas-cabeceras').innerHTML = cabeceraRutas();

  const incluye = sinTildes(rutasFiltro.trim());
  const excluye = sinTildes(rutasExcluir.trim());
  const hayFiltro = Boolean(incluye || excluye);
  const filtradas = statsPaginas.filter((x) => {
    const ruta = sinTildes(x.path);
    return (!incluye || ruta.includes(incluye)) && (!excluye || !ruta.includes(excluye));
  });

  const conMedia = filtradas.map((x) => {
    const fecha = fechaDeRuta(x.path);
    return {
      ...x,
      fecha,
      media: fecha ? Number(x.count || 0) / diasDeRuta(fecha) : null,
    };
  });

  const ordenadas = conMedia.slice().sort((a, b) => {
    if (rutasOrden === 'ruta') {
      return a.path.localeCompare(b.path, 'es') * (rutasOrdenDir === 'asc' ? 1 : -1);
    }
    if (rutasOrden === 'media') {
      // Las rutas sin fecha no tienen media: siempre al final.
      if (a.media == null && b.media == null) return 0;
      if (a.media == null) return 1;
      if (b.media == null) return -1;
      return (a.media - b.media) * (rutasOrdenDir === 'asc' ? 1 : -1);
    }
    return (Number(a.count) - Number(b.count)) * (rutasOrdenDir === 'asc' ? 1 : -1);
  });

  const tope = hayFiltro ? 300 : 100;
  const visibles = ordenadas.slice(0, tope);
  const total = statsData.total || 0;

  cuerpo.innerHTML = visibles.length
    ? visibles.map((x) => {
      const media = x.media == null
        ? ''
        : x.media.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const alto = total ? Math.round((x.count / total) * 100) : 0;
      const desde = desdeContador();
      const titulo = x.fecha
        ? ' title="Alta: ' + fechaCortaIso(x.fecha) +
          (x.fecha < desde ? ' · media desde ' + fechaCortaIso(desde) : '') +
          ' · ' + diasDeRuta(x.fecha) + ' días"'
        : ' title="Sin fecha de alta registrada"';
      return '<tr>' +
        '<td class="ruta">' + esc(x.path) + '</td>' +
        '<td class="num">' + fmtNum(x.count) + '</td>' +
        '<td class="num media"' + titulo + '>' + (media ? media + '/día' : '—') + '</td>' +
        '<td class="progreso"><div class="progress"><span style="width:' + alto + '%"></span></div></td>' +
      '</tr>';
    }).join('')
    : '<tr><td colspan="4" class="stats-vacio">' +
      (hayFiltro ? 'Ninguna ruta coincide con los filtros.' : 'Sin rutas.') +
    '</td></tr>';

  const visitas = filtradas.reduce((s, x) => s + Number(x.count || 0), 0);
  const resumen = hayFiltro
    ? fmtNum(filtradas.length) + ' ruta' + (filtradas.length === 1 ? '' : 's') +
      ' · ' + fmtNum(visitas) + ' visitas' +
      (excluye ? ' · sin «' + rutasExcluir.trim() + '»' : '') +
      (filtradas.length > tope ? ' · mostrando ' + tope : '')
    : 'Top ' + visibles.length + ' de ' + fmtNum(statsPaginas.length) + ' rutas';
  $('stats-rutas-resumen').textContent = resumen;
  $('stats-rutas-limpiar').hidden = !rutasFiltro;
  $('stats-rutas-excluir-limpiar').hidden = !rutasExcluir;
}

function bloqueRutas() {
  return '<section class="stats-bloque">' +
    '<h3>Rutas más visitadas <span class="tabla-nota">Media por día desde el alta</span></h3>' +
    '<div class="buscador stats-buscar">' +
      '<svg class="lupa" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>' +
      '<input id="stats-rutas-q" type="search" placeholder="Filtrar rutas (glosa, autor, carnaval…)…" autocomplete="off" aria-label="Filtrar rutas">' +
      '<button id="stats-rutas-limpiar" class="limpiar" type="button" aria-label="Limpiar el filtro" hidden>✕</button>' +
    '</div>' +
    '<div class="buscador stats-buscar stats-buscar--excluir">' +
      '<svg class="lupa" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>' +
      '<input id="stats-rutas-excluir" type="search" placeholder="Excluir rutas (ej. acordes)…" autocomplete="off" aria-label="Excluir rutas" title="Quita las rutas que contengan este texto">' +
      '<button id="stats-rutas-excluir-limpiar" class="limpiar" type="button" aria-label="Limpiar la exclusión" hidden>✕</button>' +
    '</div>' +
    '<p class="stats-resumen" id="stats-rutas-resumen" aria-live="polite"></p>' +
    '<div class="tabla-scroll"><table class="stats-tabla"><thead id="stats-rutas-cabeceras"></thead><tbody id="stats-rutas-cuerpo"></tbody></table></div>' +
  '</section>';
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

  // Una fila por ruta; si el worker repitiera alguna, se suman las visitas.
  const porRuta = new Map();
  for (const x of (d.pages || [])) {
    const ruta = normalizarRuta(x.path);
    porRuta.set(ruta, (porRuta.get(ruta) || 0) + Number(x.count || 0));
  }
  statsPaginas = [...porRuta.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count);

  statsData = d;
  $('stats-contenido').innerHTML =
    '<div class="stats-grid">' + htmlCards + '</div>' +
    tablaStats('Visitas por mes', [{ t: 'Mes' }, { t: 'Visitas', num: true }], filasMes) +
    tablaStats('Evolución últimos 30 días', [{ t: 'Fecha' }, { t: 'Visitas', num: true }], filasDia) +
    tablaStats('Fuentes de tráfico', [{ t: 'Origen' }, { t: 'Visitas', num: true }], filasFuente) +
    bloqueRutas();

  const q = $('stats-rutas-q');
  q.value = rutasFiltro;
  q.oninput = () => { rutasFiltro = q.value; pintarRutas(); };
  $('stats-rutas-limpiar').onclick = () => {
    rutasFiltro = '';
    q.value = '';
    pintarRutas();
    q.focus();
  };
  const qx = $('stats-rutas-excluir');
  qx.value = rutasExcluir;
  qx.oninput = () => { rutasExcluir = qx.value; pintarRutas(); };
  $('stats-rutas-excluir-limpiar').onclick = () => {
    rutasExcluir = '';
    qx.value = '';
    pintarRutas();
    qx.focus();
  };
  $('stats-rutas-cabeceras').onclick = (e) => {
    const b = e.target.closest('button[data-orden]');
    if (!b) return;
    const col = b.dataset.orden;
    if (rutasOrden === col) {
      rutasOrdenDir = rutasOrdenDir === 'asc' ? 'desc' : 'asc';
    } else {
      rutasOrden = col;
      rutasOrdenDir = col === 'ruta' ? 'asc' : 'desc';
    }
    pintarRutas();
  };
  pintarRutas();
}

/* ---------------- Cloudflare Web Analytics ---------------- */
// Segunda fuente de estadísticas: RUM de Cloudflare, sin bots y muestreado.
// Sirve para lo que D1 no guarda: fuente por ruta, país, dispositivo y
// tendencia diaria. No cuadra con el contador propio y no se deben sumar.
let statsFuente = 'd1';
// 'hoy' (00:00 → ahora) o un número de días.
let cfDias = 'hoy';
let cfData = null;
let cfCargando = false;
let cfFiltro = '';
let cfRutas = [];

function mostrarFuenteStats(fuente) {
  statsFuente = fuente === 'cf' ? 'cf' : 'd1';
  document.querySelectorAll('#stats-fuentes button').forEach((b) => {
    const sel = b.dataset.stats === statsFuente;
    b.classList.toggle('sel', sel);
    b.setAttribute('aria-selected', sel ? 'true' : 'false');
  });
  $('stats-contenido').hidden = statsFuente !== 'd1';
  $('cf-contenido').hidden = statsFuente !== 'cf';
  if (statsFuente === 'cf') cargarCloudflare();
}

function etiquetaFuente(fuente) {
  if (!fuente) return '(directo)';
  if (/^(www\.)?acordesgaditanos\.com$/i.test(fuente)) return '(interno)';
  // Se quita `www.` solo para mostrarlo: el dato original no se toca.
  return fuente.replace(/^www\./i, '');
}

/** Etiqueta corta para la columna de la tabla de rutas. */
function etiquetaFuenteCorta(fuente) {
  const f = etiquetaFuente(fuente);
  // En la tabla se envuelve en paréntesis con el número: (directo - 4).
  if (f === '(directo)') return 'directo';
  if (f === '(interno)') return 'interno';
  if (/google\./i.test(f)) return 'Google';
  if (/blogspot\./i.test(f)) return 'blog';
  if (/bing\./i.test(f)) return 'Bing';
  if (/yahoo\./i.test(f)) return 'Yahoo';
  if (/duckduckgo\./i.test(f)) return 'DuckDuckGo';
  if (/brave\./i.test(f)) return 'Brave';
  if (/facebook\./i.test(f)) return 'Facebook';
  if (/instagram\./i.test(f)) return 'Instagram';
  if (/youtube\./i.test(f)) return 'YouTube';
  if (/chatgpt\.|openai\./i.test(f)) return 'ChatGPT';
  if (/perplexity\./i.test(f)) return 'Perplexity';
  if (/linkedin\./i.test(f)) return 'LinkedIn';
  if (/ecosia\./i.test(f)) return 'Ecosia';
  if (/qwant\./i.test(f)) return 'Qwant';
  if (f === 't.co') return 'X';
  return f;
}

/**
 * Fuentes externas primero, luego directo y al final la navegación interna.
 * Se ocultan previews de Netlify y localhost (no son tráfico real).
 */
function ordenarFuentes(fuentes) {
  const peso = (f) => {
    if (!f.fuente) return 1;
    if (/^(www\.)?acordesgaditanos\.com$/i.test(f.fuente)) return 2;
    return 0;
  };
  return [...(fuentes || [])]
    .filter((f) => !/\.netlify\.app$/i.test(f.fuente) && !/^localhost/i.test(f.fuente))
    .sort((a, b) => peso(a) - peso(b) || b.paginas - a.paginas);
}

const notaFuentes = '<p class="cf-nota" style="padding:6px 12px">(directo) e (interno) se miden en páginas vistas: una navegación interna no abre una visita nueva.</p>';

const barraHtml = (valor, total) =>
  '<div class="progress"><span style="width:' +
  (total && valor ? Math.max(1, Math.round((valor / total) * 100)) : 0) +
  '%"></span></div>';

const tarjetasCf = (cards) => cards.map((c) =>
  '<div class="stat-card' + (c.total ? ' stat-card--total' : '') + '">' +
    '<span class="stat-label">' + esc(c.label) + '</span>' +
    '<span class="stat-valor">' + (typeof c.valor === 'number' ? fmtNum(c.valor) : esc(String(c.valor))) + '</span>' +
  '</div>').join('');

const muestreoTexto = (valor) =>
  Number(valor) > 1.05
    ? '×' + Number(valor).toLocaleString('es-ES', { maximumFractionDigits: 1 })
    : '—';

function comparativaCf(d, esHoy = false) {
  if (!statsData || !Array.isArray(statsData.history) || !statsData.history.length) {
    return '<p class="cf-comparativa">No se pudo cargar nuestro contador para comparar.</p>';
  }

  let d1;
  let etiqueta;
  if (esHoy) {
    // daily_stats guarda hoy en la primera posición (orden por fecha DESC).
    d1 = Number(statsData.history[0].count || 0);
    etiqueta = 'Hoy';
  } else {
    if (cfDias !== 30) {
      return '<p class="cf-comparativa">La comparación con nuestro contador solo está a 30 días: D1 no guarda histórico por ruta. Cambia el periodo a 30 días.</p>';
    }
    d1 = statsData.history.reduce((s, x) => s + Number(x.count || 0), 0);
    etiqueta = 'Últimos 30 días';
  }

  const cf = Number((d.total && d.total.paginas) || 0);
  const dif = d1 ? Math.round(((cf - d1) / d1) * 100) : null;
  const difTexto = dif == null ? '—' : (dif > 0 ? '+' : '') + fmtNum(dif) + '%';
  return '<p class="cf-comparativa"><strong>' + etiqueta + ':</strong> nuestro contador <b>' + fmtNum(d1) +
    '</b> páginas vistas · Cloudflare <b>' + fmtNum(cf) + '</b> páginas vistas · diferencia <b>' +
    difTexto + '</b>.<br>' +
    '<span class="cf-nota">No comparable al 100 %: D1 cuenta cada petición del tracker; Cloudflare excluye bots, muestrea y solo cuenta navegadores reales.</span></p>';
}

async function cargarCloudflare(forzar = false) {
  if (cfCargando) return;
  const periodo = String(cfDias);
  if (!forzar && cfData && String(cfData.periodo) === periodo) {
    pintarCloudflare(cfData);
    return;
  }

  const cont = $('cf-contenido');
  const esHoy = cfDias === 'hoy';
  cont.innerHTML = '<p class="cargando">Cargando ' + (esHoy ? 'las visitas de hoy' : 'Cloudflare') + '…</p>';
  cfCargando = true;

  try {
    const consulta = esHoy
      ? 'vista=hoy&limite=3000'
      : 'vista=resumen&dias=' + cfDias + '&limite=3000';
    const tareas = [fetch(API + '/cf-analytics?' + consulta, { cache: 'no-cache' })];

    // El contador propio hace falta para la comparación; se pide una sola vez.
    if (!statsData) tareas.push(fetch(API + '/stats', { cache: 'no-store' }));

    const [r, rd1] = await Promise.all(tareas);
    if (rd1 && rd1.ok) {
      try { statsData = await rd1.json(); } catch { /* sin comparación */ }
    }

    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo cargar Cloudflare');
    if (d.configurado === false) {
      pintarCloudflareSinConfig(d);
      return;
    }

    d.periodo = cfDias;
    cfData = d;
    pintarCloudflare(d);
  } catch (e) {
    cont.innerHTML = '<p class="error">' + esc(String(e.message || e)) + '</p>';
  } finally {
    cfCargando = false;
  }
}

function pintarCloudflareSinConfig(d) {
  const faltan = Array.isArray(d.faltan) ? d.faltan : [];
  $('cf-contenido').innerHTML =
    '<section class="stats-bloque">' +
      '<h3>Cloudflare sin configurar</h3>' +
      '<div class="cf-comparativa">' +
        '<p>Faltan variables en el servidor: ' + faltan.map((x) => '<code>' + esc(x) + '</code>').join(', ') + '.</p>' +
        '<p>Crea un token con <strong>Account Analytics: Read</strong> y guárdalo en Netlify como ' +
        '<code>CLOUDFLARE_API_TOKEN</code>. La cuenta y el siteTag van en ' +
        '<code>CLOUDFLARE_ACCOUNT_ID</code> y <code>CLOUDFLARE_WA_SITE_TAG</code>.</p>' +
      '</div>' +
    '</section>';
}

function mapaD1() {
  const mapa = new Map();
  if (!statsData || !Array.isArray(statsData.pages)) return mapa;
  for (const x of statsData.pages) {
    const ruta = normalizarRuta(x.path);
    mapa.set(ruta, (mapa.get(ruta) || 0) + Number(x.count || 0));
  }
  return mapa;
}

function pintarCfRutas() {
  const cuerpo = $('cf-rutas-cuerpo');
  if (!cuerpo || !cfData) return;

  const consulta = sinTildes(cfFiltro.trim());
  const filtradas = consulta
    ? cfRutas.filter((x) => sinTildes(x.ruta).includes(consulta))
    : cfRutas;
  const visibles = filtradas.slice(0, 300);
  const d1 = mapaD1();

  // ruta → fuentes; se pinta la principal sin abrir el detalle.
  const fuentesPorRuta = new Map();
  for (const f of (cfData.fuentesRutas || [])) {
    const ruta = normalizarRuta(f.ruta);
    const lista = fuentesPorRuta.get(ruta) || [];
    lista.push(f);
    fuentesPorRuta.set(ruta, lista);
  }

  cuerpo.innerHTML = visibles.length
    ? visibles.map((x) => {
      const totalD1 = d1.get(normalizarRuta(x.ruta));
      const listaFuentes = ordenarFuentes(fuentesPorRuta.get(normalizarRuta(x.ruta)) || []);
      // Se agrupan las variantes con la misma etiqueta corta (google.com y
      // google.es son «Google»), y se dejan las externas antes que directo/interno.
      const porEtiqueta = new Map();
      for (const f of listaFuentes) {
        const etiqueta = etiquetaFuenteCorta(f.fuente);
        porEtiqueta.set(etiqueta, (porEtiqueta.get(etiqueta) || 0) + f.paginas);
      }
      const top3 = [...porEtiqueta.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const fuentesHtml = top3.map(([etiqueta, paginas]) =>
        '<span class="cf-fuente">(' + esc(etiqueta) + ' - ' + fmtNum(paginas) + ')</span>'
      ).join(' ');
      return '<tr>' +
        '<td class="ruta">' + esc(x.ruta) + '</td>' +
        '<td class="num">' + fmtNum(x.paginas) + '</td>' +
        '<td class="num">' + fmtNum(x.visitas) + '</td>' +
        '<td class="num cf-d1"' + (totalD1 == null ? ' title="No está en nuestro contador"' : ' title="Total desde 19/01/2026; ventana distinta a Cloudflare"') + '>' +
          (totalD1 == null ? '—' : fmtNum(totalD1)) +
        '</td>' +
        '<td class="fuente">' + (top3.length ? fuentesHtml : '—') + '</td>' +
        '<td class="cf-accion"><button type="button" class="cf-ver" data-ruta="' + esc(x.ruta) + '">Fuentes</button></td>' +
      '</tr>';
    }).join('')
    : '<tr><td colspan="6" class="stats-vacio">' +
      (consulta ? 'Ninguna ruta coincide con «' + esc(cfFiltro.trim()) + '».' : 'Sin rutas.') +
    '</td></tr>';

  const visitas = filtradas.reduce((s, x) => s + x.visitas, 0);
  const paginas = filtradas.reduce((s, x) => s + x.paginas, 0);
  const resumen = (consulta
    ? fmtNum(filtradas.length) + ' ruta' + (filtradas.length === 1 ? '' : 's')
    : 'Top ' + visibles.length + ' de ' + fmtNum(cfRutas.length)) +
    ' · ' + fmtNum(visitas) + ' visitas · ' + fmtNum(paginas) + ' páginas';
  $('cf-rutas-resumen').textContent = resumen;
  $('cf-rutas-limpiar').hidden = !cfFiltro;
}

function pintarCloudflare(d) {
  const total = d.total || { paginas: 0, visitas: 0, muestreo: 1 };
  const esHoy = d.hoy === true || cfDias === 'hoy';
  const dias = esHoy ? 1 : (Number(d.dias) || cfDias);
  cfRutas = [...(d.rutas || [])].sort((a, b) => b.visitas - a.visitas || b.paginas - a.paginas);

  const cards = tarjetasCf([
    { label: esHoy ? 'Visitas hoy' : 'Visitas', valor: total.visitas, total: true },
    { label: esHoy ? 'Páginas hoy' : 'Páginas vistas', valor: total.paginas },
    { label: esHoy ? 'Rutas hoy' : 'Rutas listadas', valor: cfRutas.length },
    { label: 'Muestreo', valor: muestreoTexto(total.muestreo) },
  ]);

  const botonesPeriodo = [['hoy', 'Hoy'], [7, '7 días'], [30, '30 días'], [90, '90 días']]
    .map(([valor, texto]) => {
      const sel = String(cfDias) === String(valor);
      return '<button type="button" data-cf-dias="' + valor + '"' + (sel ? ' class="sel"' : '') + '>' + texto + '</button>';
    }).join('');

  const periodo =
    '<section class="stats-bloque">' +
      '<h3>Cloudflare Web Analytics <span class="tabla-nota">' +
        (esHoy ? 'Hoy · 00:00 → ahora' : esc(d.desde + ' → ' + d.hasta)) +
      '</span></h3>' +
      '<div class="cf-periodo">' +
        botonesPeriodo +
        '<span class="cf-nota">Excluye bots y muestrea.</span>' +
        '<a class="cf-enlace" href="https://dash.cloudflare.com/c350ca865e93a9071b87a15239bda479/web-analytics/overview?siteTag~in=86a0b04f8b5c4819b665abea1cca1161&excludeBots=Yes" target="_blank" rel="noopener">Abrir en Cloudflare ↗</a>' +
      '</div>' +
      comparativaCf(d, esHoy) +
    '</section>';

  const fuentes = ordenarFuentes(d.fuentes);
  const totalFuentes = fuentes.reduce((s, x) => s + x.paginas, 0);
  const filasFuentes = fuentes.map((x) => [
    { t: etiquetaFuente(x.fuente), cls: 'fuente' },
    { t: fmtNum(x.paginas), num: true },
    { t: fmtNum(x.visitas), num: true },
    { html: barraHtml(x.paginas, totalFuentes), cls: 'progreso' },
  ]);
  const tablaFuentes = tablaStats(
    'Fuentes de tráfico (Cloudflare)',
    [{ t: 'Fuente' }, { t: 'Páginas', num: true }, { t: 'Visitas', num: true }, { t: 'Popularidad', cls: 'progreso' }],
    filasFuentes,
  ) + (filasFuentes.length ? notaFuentes : '');

  const tablaRutas =
    '<section class="stats-bloque">' +
      '<h3>Rutas ' + (esHoy ? 'de hoy' : '(Cloudflare)') + ' <span class="tabla-nota">' +
        (esHoy ? '00:00 → ahora' : esc(dias + ' días')) +
      '</span></h3>' +
      '<div class="buscador stats-buscar">' +
        '<svg class="lupa" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>' +
        '<input id="cf-rutas-q" type="search" placeholder="Filtrar rutas (glosa, autor, carnaval…)…" autocomplete="off" aria-label="Filtrar rutas de Cloudflare">' +
        '<button id="cf-rutas-limpiar" class="limpiar" type="button" aria-label="Limpiar el filtro" hidden>✕</button>' +
      '</div>' +
      '<p class="stats-resumen" id="cf-rutas-resumen" aria-live="polite"></p>' +
      '<div class="tabla-scroll"><table class="stats-tabla stats-tabla--rutas-cf"><thead><tr>' +
        '<th>Ruta</th>' +
        '<th class="num">Páginas</th>' +
        '<th class="num">Visitas</th>' +
        '<th class="num cf-d1" title="Total desde 19/01/2026; ventana distinta a Cloudflare">D1 total</th>' +
        '<th class="fuente" title="Páginas vistas por fuente, de mayor a menor">Fuente</th>' +
        '<th class="cf-accion">Fuentes</th>' +
      '</tr></thead><tbody id="cf-rutas-cuerpo"></tbody></table></div>' +
    '</section>';

  const filasDiario = (d.diario || []).map((x) => [
    { t: fechaCortaIso(x.dia) },
    { t: fmtNum(x.paginas), num: true },
    { t: fmtNum(x.visitas), num: true },
  ]);
  const filasPaises = (d.paises || []).map((x) => [
    { t: x.pais || '—' },
    { t: fmtNum(x.paginas), num: true },
  ]);
  const filasDispositivos = (d.dispositivos || []).map((x) => [
    { t: x.tipo || '—' },
    { t: fmtNum(x.paginas), num: true },
  ]);

  $('cf-contenido').innerHTML =
    '<div class="stats-grid">' + cards + '</div>' +
    periodo +
    tablaRutas +
    tablaFuentes +
    tablaStats('Evolución diaria (Cloudflare)', [{ t: 'Día' }, { t: 'Páginas', num: true }, { t: 'Visitas', num: true }], filasDiario) +
    '<div class="cf-grid">' +
      tablaStats('Países', [{ t: 'País' }, { t: 'Páginas', num: true }], filasPaises) +
      tablaStats('Dispositivos', [{ t: 'Tipo' }, { t: 'Páginas', num: true }], filasDispositivos) +
    '</div>';

  document.querySelectorAll('#cf-contenido [data-cf-dias]').forEach((b) => {
    b.onclick = () => {
      const valor = b.dataset.cfDias;
      const nuevo = valor === 'hoy' ? 'hoy' : Number(valor);
      if (!nuevo || String(nuevo) === String(cfDias)) return;
      cfDias = nuevo;
      cargarCloudflare(true);
    };
  });

  const q = $('cf-rutas-q');
  q.value = cfFiltro;
  q.oninput = () => { cfFiltro = q.value; pintarCfRutas(); };
  $('cf-rutas-limpiar').onclick = () => {
    cfFiltro = '';
    q.value = '';
    pintarCfRutas();
    q.focus();
  };
  $('cf-rutas-cuerpo').onclick = (e) => {
    const b = e.target.closest('button[data-ruta]');
    if (b) abrirCfRuta(b.dataset.ruta);
  };
  pintarCfRutas();
}

async function abrirCfRuta(ruta) {
  const dlg = $('dlg-cf-ruta');
  $('cf-ruta-titulo').textContent = ruta;
  $('cf-ruta-cuerpo').innerHTML = '<p class="cargando">Cargando…</p>';
  if (!dlg.open) dlg.showModal();

  try {
    const periodo = cfDias === 'hoy' ? '&hoy=1' : '&dias=' + cfDias;
    const r = await fetch(API + '/cf-analytics?vista=ruta&ruta=' + encodeURIComponent(ruta) + periodo, { cache: 'no-cache' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo cargar la ruta');
    pintarCfRuta(d);
  } catch (e) {
    $('cf-ruta-cuerpo').innerHTML = '<p class="error">' + esc(String(e.message || e)) + '</p>';
  }
}

function pintarCfRuta(d) {
  const total = d.total || { paginas: 0, visitas: 0, muestreo: 1 };
  const esHoy = d.hoy === true || cfDias === 'hoy';
  const dias = esHoy ? 1 : (Number(d.dias) || cfDias);
  const periodoTexto = esHoy
    ? 'Hoy · 00:00 → ahora'
    : esc(d.desde) + ' → ' + esc(d.hasta) + ' · ' + esc(String(dias)) + ' días';
  const media = (Number(total.visitas || 0) / Math.max(1, dias)).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const d1 = mapaD1().get(normalizarRuta(d.ruta));

  const cards = tarjetasCf([
    { label: 'Visitas', valor: total.visitas, total: true },
    { label: 'Páginas vistas', valor: total.paginas },
    { label: 'Media/día', valor: media + '/día' },
    { label: 'Muestreo', valor: muestreoTexto(total.muestreo) },
  ]);

  const fuentes = ordenarFuentes(d.fuentes);
  const totalFuentes = fuentes.reduce((s, x) => s + x.paginas, 0);
  const filasFuentes = fuentes.map((x) => [
    { t: etiquetaFuente(x.fuente), cls: 'fuente' },
    { t: fmtNum(x.paginas), num: true },
    { t: fmtNum(x.visitas), num: true },
    { html: barraHtml(x.paginas, totalFuentes), cls: 'progreso' },
  ]);
  const filasDiario = (d.diario || []).map((x) => [
    { t: fechaCortaIso(x.dia) },
    { t: fmtNum(x.paginas), num: true },
    { t: fmtNum(x.visitas), num: true },
  ]);
  const filasPaises = (d.paises || []).map((x) => [
    { t: x.pais || '—' },
    { t: fmtNum(x.paginas), num: true },
  ]);
  const filasDispositivos = (d.dispositivos || []).map((x) => [
    { t: x.tipo || '—' },
    { t: fmtNum(x.paginas), num: true },
  ]);
  const filasNavegadores = (d.navegadores || []).map((x) => [
    { t: x.navegador || '—' },
    { t: fmtNum(x.paginas), num: true },
  ]);

  $('cf-ruta-cuerpo').innerHTML =
    '<p class="cf-ruta-meta">' + periodoTexto + ' · ' +
      'D1 total: ' + (d1 == null ? '—' : fmtNum(d1)) + ' · ' +
      '<a href="' + esc(d.ruta) + '" target="_blank" rel="noopener">Abrir la página ↗</a></p>' +
    '<div class="stats-grid">' + cards + '</div>' +
    tablaStats('Fuentes de tráfico', [{ t: 'Fuente' }, { t: 'Páginas', num: true }, { t: 'Visitas', num: true }, { t: 'Popularidad', cls: 'progreso' }], filasFuentes) +
    (filasFuentes.length ? notaFuentes : '') +
    tablaStats('Evolución diaria', [{ t: 'Día' }, { t: 'Páginas', num: true }, { t: 'Visitas', num: true }], filasDiario) +
    '<div class="cf-grid">' +
      tablaStats('Países', [{ t: 'País' }, { t: 'Páginas', num: true }], filasPaises) +
      tablaStats('Dispositivos', [{ t: 'Tipo' }, { t: 'Páginas', num: true }], filasDispositivos) +
    '</div>' +
    tablaStats('Navegadores', [{ t: 'Navegador' }, { t: 'Páginas', num: true }], filasNavegadores);
}

/* ---------------- comentarios / peticiones ---------------- */
let peticiones = [];
let comentariosTodos = [];
const escAttr = escaparHtml;

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
  else if (orden === 'fecha') lista.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0) || new Date(b.date) - new Date(a.date));
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
  f.base.value = '';
  f.base.dataset.auto = '1';
  f.base.dataset.autoSlug = '';
  cancelarRellenoBase();
  $('dlg-nueva-titulo').textContent = 'Nueva ficha';
  $('dlg-nueva-nota').innerHTML = 'Se crea como borrador. Si la agrupación ya existe, toma de su ficha el año, la modalidad, la imagen, los autores y el vídeo. El bloque de la letra y la cejilla no se copian.';
  pintarBaseNueva();
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
    document.body.appendChild(m);
  }
  m.style.font = '13px/1.55 ' + FUENTE_PRE;
  m.textContent = '0'.repeat(100);
  return m.getBoundingClientRect().width / 100 || 7.8;
}

/** Ancho útil del editor: si la pestaña Editor está oculta, el de la pestaña activa. */
function anchoEditor() {
  if (lienzo.clientWidth) return lienzo.clientWidth;
  const activo = document.querySelector('.pane.activo');
  return activo ? activo.clientWidth : $('cols').clientWidth;
}

/** Tamaño al que caben ANCHO_MAX columnas en el ancho actual (9–13 px). */
function tamAjustado(ancho = anchoEditor()) {
  const disp = ancho - 28 - 4;
  if (disp <= 0) return 13;
  const tam = (13 * disp) / (ANCHO_MAX * anchoCaracter13());
  return Math.max(9, Math.min(13, Math.floor(tam * 2) / 2));
}

/** Muestra u oculta «Ajustar» y aplica el tamaño a las tres columnas. */
function aplicarZoom() {
  const botones = [$('b-zoom'), ...document.querySelectorAll('.b-zoom-pane')].filter(Boolean);
  const ancho = anchoEditor();
  if (!ancho) {
    botones.forEach((b) => { b.hidden = true; });
    return;
  }
  const tam = tamAjustado(ancho);
  const cabe = tam >= 13;
  for (const b of botones) {
    b.hidden = cabe;
    b.textContent = zoomAjustado ? 'Ampliar' : 'Ajustar';
    b.title = zoomAjustado
      ? 'Vuelve a la letra normal en Editor y Base'
      : 'Reduce la letra de Editor y Base para que quepan las ' + ANCHO_MAX + ' columnas';
  }
  $('cols').style.setProperty('--pre-size', (zoomAjustado && !cabe ? tam : 13) + 'px');
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
  zonaFicha = zona === 'borradores' ? 'borradores' : 'acordes';
  cerrarNotaLocal();
  cerrarSug();
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
  // Vista previa: en local también para los borradores (`/borradores/`). En
  // producción un borrador no está en el build, así que solo se ofrece si la
  // ficha ya está en `acordes`.
  $('b-preview').hidden = zonaFicha === 'borradores' && !MODO_LOCAL;
  $('b-preview').title = 'Ver «' + slug + '» como la pinta la web (en otra pestaña)';
  $('b-revisado').hidden = !porRevisar({ slug });
  $('b-revisado').title = zonaFicha === 'borradores'
    ? 'Guarda, marca la copla como revisada y la promueve a acordes'
    : 'Guarda, marca la copla como revisada y fusiona la PR';
  $('b-nueva').hidden = true;
  $('b-letra').hidden = true;
  $('b-publicar').hidden = zonaFicha !== 'borradores';
  $('b-publicar').textContent = MODO_LOCAL ? 'Promover' : 'Publicar';
  $('b-publicar').title = MODO_LOCAL
    ? 'Mueve el borrador a acordes y lo marca revisado: sin PR y sin publicar en la web'
    : 'Pasa el borrador a acordes, lo marca revisado y abre la PR';
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

/** Marca la columna de la ficha base: con ficha la pinta; sin ella deja el hueco vacío. */
function mostrarBase(si) {
  const pane = document.querySelector('.pane[data-pane="der"]');
  const tab = document.querySelector('.tabs button[data-pane="der"]');
  // En escritorio la columna de Base se queda aunque no haya con qué comparar
  // (gris, sin select): así el Editor no cambia de ancho entre fichas.
  // En móvil se oculta, que ahí cada columna es una pestaña.
  if (pane) {
    pane.classList.toggle('vacia', !si);
    pane.title = si ? '' : 'No hay otra ficha de la misma agrupación con la que comparar';
  }
  if (tab) tab.hidden = !si;
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
  if (!candidatas.length) { mostrarBase(false); aplicarZoom(); return; }

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
    aplicarZoom();
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
  cerrarSug();
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

// Última posición buena del cursor dentro del editor. Al pulsar un botón el
// foco se va de él y algunos navegadores (iOS) devuelven la selección en 0.
let cursorUltimo = null;

/** Guarda el cursor mientras el textarea tenga el foco. */
function recordarCursor() {
  if (!ficha || document.activeElement !== ta) return;
  const { linea, col } = cursorLineaCol();
  const lineas = ta.value.split('\n');
  if (linea < 0 || linea >= lineas.length) return;
  cursorUltimo = { linea, col: Math.min(col, lineas[linea].length) };
}

/** Cursor para separar/juntar: el actual, o el último bueno si el botón se llevó el foco. */
function cursorDeAccion() {
  const lineas = ta.value.split('\n');
  const acotar = (p) => {
    if (!p || p.linea < 0 || p.linea >= lineas.length) return null;
    return { linea: p.linea, col: Math.max(0, Math.min(p.col, lineas[p.linea].length)) };
  };
  if (document.activeElement === ta) return acotar(cursorLineaCol());
  return acotar(cursorUltimo);
}

/** Índice absoluto en el textarea de una línea y columna. */
function posicionDe(linea, col) {
  const lineas = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < linea && i < lineas.length; i++) pos += lineas[i].length + 1;
  return Math.min(pos + col, ta.value.length);
}

/**
 * Si el texto ha ganado o perdido líneas a mano (Enter, borrar un salto, pegar
 * varias), vuelve a cuadrar las capas de etiquetas. Sin esto, `estructuraOk()`
 * falla y separar/juntar/mover dejan de funcionar hasta reabrir la ficha.
 */
function reajustarEstructura() {
  if (!ficha) return;
  const lineas = ta.value.split('\n');
  if (ficha.d.registros.length === lineas.length && ficha.d.originales.length === lineas.length) return;
  const r = realinearEstructura({
    lineas,
    registros: ficha.d.registros,
    originales: ficha.d.originales,
    conocidos,
  });
  ficha.d.registros = r.registros;
  ficha.d.originales = r.originales;
  if (r.perdidas) {
    mostrarAviso('Se ha reajustado la estructura de líneas.\nRevisa la postura de los acordes de las líneas nuevas.', 'var(--nuevo)');
  }
}

function aplicarEdicion(r, enfocar = true) {
  if (r.error) { mostrarAviso(r.error, 'var(--nuevo)'); return; }
  cerrarAviso();
  cerrarSug();
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
  if (enfocar) ta.focus();
  pintar();
  verCaret();
}

/** Separa la letra en el cursor y crea la línea de acordes de la parte que baja. */
function separar() {
  if (!ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const pos = cursorDeAccion();
  if (!pos) return mostrarAviso('Toca primero la línea de letra donde quieres cortar.', 'var(--nuevo)');
  const { linea, col } = pos;
  const lineas = ta.value.split('\n');
  const t = tipo(lineas[linea] || '', lineas[linea + 1] || '');
  if (t === 'acordes' || t === 'acordes-sucio') return moverAcorde(1, pos);
  if (t !== 'letra') return mostrarAviso('Pon el cursor en una línea de letra o de acordes.', 'var(--nuevo)');
  const palabra = palabraBajoCursor(lineas[linea], col);
  const corte = palabra ? palabra.ini : col;
  // Al principio de la línea no hay nada que se quede arriba: el verso se
  // despega del bloque de arriba con su propia línea de acordes vacía.
  if (corte === 0) {
    aplicarEdicion(separarVerso({
      lineas,
      registros: ficha.d.registros,
      originales: ficha.d.originales,
      conocidos,
      i: linea,
    }));
    return;
  }
  aplicarEdicion(separarLetra({
    lineas,
    registros: ficha.d.registros,
    originales: ficha.d.originales,
    conocidos,
    i: linea,
    col: corte,
  }));
}

/** Junta con el verso anterior lo que queda a la izquierda del cursor. */
function juntar() {
  if (!ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const pos = cursorDeAccion();
  if (!pos) return mostrarAviso('Toca primero la línea de letra que quieres juntar.', 'var(--nuevo)');
  const { linea, col } = pos;
  const lineas = ta.value.split('\n');
  const t = tipo(lineas[linea] || '', lineas[linea + 1] || '');
  if (t === 'acordes' || t === 'acordes-sucio') return moverAcorde(-1, pos);
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
function moverAcorde(dir, pos = null) {
  if (!ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const { linea, col } = pos || cursorDeAccion() || cursorLineaCol();
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

/* ---------------- arrastrar acordes ---------------- */
// En táctil hay que mantener pulsado un acorde ~350 ms para «levantarlo»; así
// no se confunde con el scroll ni con colocar el cursor. Con ratón basta con
// arrastrar unos píxeles. El destino es siempre una línea de acordes.
const LARGO_TOQUE = 350;
const UMBRAL_ARRASTRE = 8;

let arrastre = null;
let raton = null;
let toque = null;
let toqueLargo = null;
let fantasma = null;
let bandaDestino = null;
let lineaDestino = null;
let rafScroll = 0;
let ignorarClick = false;

/** Métricas reales del textarea: padding, alto de línea y ancho de carácter. */
function metricasEditor() {
  const rect = ta.getBoundingClientRect();
  const est = getComputedStyle(ta);
  const padL = parseFloat(est.paddingLeft) || 14;
  const padT = parseFloat(est.paddingTop) || 12;
  const lh = parseFloat(est.lineHeight) || 20;
  // La regla está a `padL + ANCHO_MAX ch`; de ahí sale el ancho de un carácter.
  const medido = (regla.offsetLeft - padL) / ANCHO_MAX;
  const ch = medido > 0 ? medido : anchoCaracter13();
  return { rect, padL, padT, lh, ch };
}

/** Índice de carácter de una columna visual (los tabuladores ocupan 4). */
function indiceVisual(linea, colVisual) {
  let v = 0;
  for (let k = 0; k < linea.length; k++) {
    const ancho = linea[k] === '\t' ? 4 - (v % 4) : 1;
    if (colVisual < v + ancho) return k;
    v += ancho;
  }
  return linea.length;
}

/** Columna visual donde empieza el carácter `indice`. */
function columnaVisual(linea, indice) {
  let v = 0;
  for (let k = 0; k < indice && k < linea.length; k++) {
    v += linea[k] === '\t' ? 4 - (v % 4) : 1;
  }
  return v;
}

/** Línea, texto y columna (carácter) bajo un punto de la pantalla. */
function puntoEditor(clientX, clientY) {
  const m = metricasEditor();
  const lineas = ta.value.split('\n');
  let linea = Math.floor((clientY - m.rect.top - m.padT) / m.lh);
  linea = Math.max(0, Math.min(lineas.length - 1, linea));
  const texto = lineas[linea] ?? '';
  const colVis = Math.max(0, Math.floor((clientX - m.rect.left - m.padL) / m.ch));
  return { linea, texto, col: indiceVisual(texto, colVis), colVis, m, lineas };
}

/** Acorde (o anotación) bajo el dedo/ratón, o null si no hay ninguno. */
function acordeEnPunto(clientX, clientY) {
  if (!ficha) return null;
  const p = puntoEditor(clientX, clientY);
  const t = tipo(p.texto, p.lineas[p.linea + 1] || '');
  if (t !== 'acordes' && t !== 'acordes-sucio') return null;
  const tokens = [...p.texto.matchAll(/\S+/g)].map((x) => ({ token: x[0], col: x.index }));
  const tok = tokens.find((x) => p.col >= x.col && p.col < x.col + x.token.length);
  if (!tok || (!esAcorde(tok.token) && !esAnotacion(tok.token))) return null;
  return { linea: p.linea, col: tok.col, fin: tok.col + tok.token.length, token: tok.token };
}

/** Línea de acordes bajo el dedo/ratón, o null si no se puede soltar ahí. */
function destinoEnPunto(clientX, clientY) {
  if (!ficha) return null;
  const r = lienzo.getBoundingClientRect();
  if (clientY < r.top || clientY > r.bottom) return null;
  const p = puntoEditor(clientX, clientY);
  if (!esLineaAcordes(p.lineas, p.linea, conocidos)) return null;
  return { linea: p.linea, col: p.col, texto: p.texto, m: p.m };
}

/** Crea el fantasma y las marcas de destino la primera vez que se usan. */
function prepararPiezasArrastre() {
  if (!fantasma) {
    fantasma = document.createElement('div');
    fantasma.className = 'fantasma-acorde';
    fantasma.hidden = true;
    hoja.appendChild(fantasma);
  }
  if (!bandaDestino) {
    bandaDestino = document.createElement('div');
    bandaDestino.className = 'destino-banda';
    bandaDestino.hidden = true;
    hoja.appendChild(bandaDestino);
  }
  if (!lineaDestino) {
    lineaDestino = document.createElement('div');
    lineaDestino.className = 'destino-linea';
    lineaDestino.hidden = true;
    hoja.appendChild(lineaDestino);
  }
}

function moverFantasma(clientX, clientY) {
  if (!fantasma || fantasma.hidden) return;
  const m = metricasEditor();
  const r = lienzo.getBoundingClientRect();
  const ancho = fantasma.offsetWidth;
  const alto = fantasma.offsetHeight;
  const margen = 12;
  let x = clientX - m.rect.left + margen;
  let y = clientY - m.rect.top + margen;
  const minX = r.left - m.rect.left + 4;
  const maxX = r.right - m.rect.left - 8;
  const minY = r.top - m.rect.top + 4;
  const maxY = r.bottom - m.rect.top - 8;
  if (x + ancho > maxX) x = clientX - m.rect.left - ancho - margen;
  if (y + alto > maxY) y = clientY - m.rect.top - alto - margen;
  x = Math.max(minX, Math.min(x, maxX - ancho));
  y = Math.max(minY, Math.min(y, maxY - alto));
  fantasma.style.left = Math.round(x) + 'px';
  fantasma.style.top = Math.round(y) + 'px';
}

/** Repinta el fantasma y la marca de la línea/columna de destino. */
function actualizarDestinoArrastre() {
  if (!arrastre) return;
  moverFantasma(arrastre.x, arrastre.y);
  const d = destinoEnPunto(arrastre.x, arrastre.y);
  let valido = !!d;
  if (valido && d.linea === arrastre.linea && d.col >= arrastre.col && d.col <= arrastre.fin) {
    valido = false;
  }
  arrastre.destino = valido ? { linea: d.linea, col: d.col } : null;
  if (fantasma) fantasma.classList.toggle('invalido', !valido);

  if (!d) {
    if (bandaDestino) bandaDestino.hidden = true;
    if (lineaDestino) lineaDestino.hidden = true;
    return;
  }

  const colVis = columnaVisual(d.texto || '', d.col);
  const top = d.m.padT + d.linea * d.m.lh;
  if (bandaDestino) {
    bandaDestino.style.top = top + 'px';
    bandaDestino.style.height = d.m.lh + 'px';
    bandaDestino.hidden = false;
  }
  if (lineaDestino) {
    lineaDestino.style.left = (d.m.padL + colVis * d.m.ch) + 'px';
    lineaDestino.style.top = top + 'px';
    lineaDestino.style.height = d.m.lh + 'px';
    lineaDestino.hidden = false;
  }
}

function iniciarArrastre(origen, clientX, clientY) {
  if (!ficha || arrastre) return;
  cerrarSug();
  prepararPiezasArrastre();
  arrastre = { ...origen, x: clientX, y: clientY, destino: null };
  fantasma.textContent = origen.token;
  fantasma.classList.remove('invalido');
  fantasma.hidden = false;
  ta.style.cursor = 'grabbing';
  document.body.classList.add('arrastrando');
  // Quita la selección que pueda haber dejado la pulsación larga nativa.
  try { ta.setSelectionRange(ta.selectionStart, ta.selectionStart); } catch { /* sin foco */ }
  try { window.getSelection()?.removeAllRanges(); } catch { /* sin selección */ }
  try { navigator.vibrate?.(12); } catch { /* sin vibración */ }
  actualizarDestinoArrastre();
  iniciarAutoScroll();
}

/** Desplaza el lienzo cuando el dedo se acerca a un borde. */
function iniciarAutoScroll() {
  if (rafScroll) return;
  const paso = () => {
    if (!arrastre) { rafScroll = 0; return; }
    const r = lienzo.getBoundingClientRect();
    const margen = 48;
    let dx = 0;
    let dy = 0;
    if (arrastre.x < r.left + margen) dx = -Math.ceil((r.left + margen - arrastre.x) / 6);
    else if (arrastre.x > r.right - margen) dx = Math.ceil((arrastre.x - (r.right - margen)) / 6);
    if (arrastre.y < r.top + margen) dy = -Math.ceil((r.top + margen - arrastre.y) / 6);
    else if (arrastre.y > r.bottom - margen) dy = Math.ceil((arrastre.y - (r.bottom - margen)) / 6);
    dx = Math.max(-16, Math.min(16, dx));
    dy = Math.max(-16, Math.min(16, dy));
    if (dx || dy) {
      lienzo.scrollLeft += dx;
      lienzo.scrollTop += dy;
      actualizarDestinoArrastre();
    }
    rafScroll = requestAnimationFrame(paso);
  };
  rafScroll = requestAnimationFrame(paso);
}

function detenerAutoScroll() {
  if (rafScroll) cancelAnimationFrame(rafScroll);
  rafScroll = 0;
}

function limpiarArrastre() {
  arrastre = null;
  detenerAutoScroll();
  document.body.classList.remove('arrastrando');
  document.body.classList.remove('posible-arrastre');
  ta.style.cursor = '';
  if (fantasma) { fantasma.hidden = true; fantasma.classList.remove('invalido'); }
  if (bandaDestino) bandaDestino.hidden = true;
  if (lineaDestino) lineaDestino.hidden = true;
  if (toqueLargo) { clearTimeout(toqueLargo.timer); toqueLargo = null; }
}

function cancelarArrastre() {
  limpiarArrastre();
  raton = null;
  toque = null;
}

function soltarArrastre() {
  if (!arrastre) return;
  ignorarClick = true;
  setTimeout(() => { ignorarClick = false; }, 400);
  const a = arrastre;
  limpiarArrastre();
  if (!a.destino || !ficha) return;
  if (!estructuraOk()) return avisoEstructura();
  const r = moverAcordeA({
    lineas: ta.value.split('\n'),
    registros: ficha.d.registros,
    originales: ficha.d.originales,
    conocidos,
    i: a.linea,
    col: a.col,
    destino: a.destino,
  });
  if (r.error) {
    if (!r.noop) mostrarAviso(r.error, 'var(--nuevo)');
    return;
  }
  aplicarEdicion(r, false);
}

/** Cambia el title de los botones según si el cursor está en acordes o en letra. */
function actualizarAcciones() {
  if (!ficha) return;
  recordarCursor();
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
    modalidad: datos.modalidad || null,
    agrupacion: datos.agrupacion,
    year: datos.year,
    musica: datos.musica || null,
    letra: datos.letra || null,
    letraTitulo: datos.letraTitulo || null,
    cejilla: datos.cejilla || null,
    video: videoEmbed(datos.video) || null,
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
  if (d.local && zonaFicha === 'borradores') {
    const x = indice.find((i) => i.slug === ficha.slug);
    if (x) { x.local = true; x.zona = 'borradores'; }
  }
  pintarDatos(fm);
  return d;
}

async function guardar() {
  if (!ficha) return;
  cerrarSug();
  if (!comprobarObligatorios()) return;

  try {
    const d = await enviarGuardar();

    if (d.local) {
      $('b-pr').hidden = true;
      $('b-fusionar').hidden = true;
      setEstado('guardado en local', true);
      const ruta = 'src/content/' + (zonaFicha === 'borradores' ? 'borradores' : 'acordes') + '/' + ficha.slug + '.md';
      if (zonaFicha === 'acordes') {
        // Ya está en la web: lo que falta es el commit, así que pasa a «Por publicar».
        await refrescarPendientes();
        mostrarAviso('Guardado en ' + ruta + '.\n' + (sinSubir({ slug: ficha.slug })
          ? 'La web no cambia hasta que la subas: la ficha está en «Por publicar» (lista → «Subir»).'
          : 'El archivo es igual al de git: no hay nada pendiente de subir.'), 'var(--ok)');
        return;
      }
      mostrarAviso('Guardado en ' + ruta + '.\nEn local no se crea PR: el archivo queda escrito en el proyecto.', 'var(--ok)');
      return;
    }

    setEstado('en PR #' + d.pr.numero, true);
    $('b-pr').hidden = false;
    $('b-fusionar').hidden = false;
    $('b-pr').onclick = () => window.open(d.pr.url, '_blank');
    // La corrección vive en una PR: la ficha pasa al momento a «Por publicar».
    if (zonaFicha === 'acordes') await refrescarPendientes();
    mostrarAviso('Guardado en la rama ' + d.rama + '.\nPR #' + d.pr.numero + ': ' + d.pr.url +
      '\nLa web no cambia hasta fusionarla: la ficha está en «Por publicar».' +
      '\nNetlify está construyendo el preview; en un par de minutos lo tienes en la PR.', 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Guarda, saca la copla de «Por revisar» y (en producción) fusiona la PR. */
async function revisarFicha() {
  if (!ficha) return;
  if (!comprobarObligatorios()) return;
  const borrador = zonaFicha === 'borradores';
  const seguro = MODO_LOCAL
    ? (borrador
      ? '¿Marcar esta copla como revisada?\nSe guarda, sale de la cola y se promueve a acordes: aparecerá en «Por publicar».'
      : '¿Marcar esta copla como revisada?\nSe guarda el archivo y sale de la cola. El commit lo haces luego.')
    : (borrador
      ? '¿Marcar esta copla como revisada?\nSe guarda en la PR del borrador. Para publicarla, usa Promover.'
      : '¿Marcar esta copla como revisada?\nSe guarda, se marca y se fusiona la PR: el cambio queda publicado.');
  const datosActuales = { ...datosDelEditor(), slug: ficha.slug };
  if (!confirmarPublicacion(seguro, [ficha.slug], [datosActuales])) return;

  try {
    const d = await enviarGuardar({ revisado: true });
    revision.delete(ficha.slug);
    const quedan = d.revision && typeof d.revision.restantes === 'number' ? d.revision.restantes : null;
    const cola = quedan === null ? '' : '\nQuedan ' + quedan + ' por revisar.';

    if (d.local) {
      $('b-revisado').hidden = true;
      if (borrador) {
        // Opción A: marcar un borrador lo promueve para poder subirlo.
        const p = await fetch(API + '/publicar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: cuerpoPublicar(ficha.slug),
        });
        const pd = await p.json();
        if (!p.ok) throw new Error('se marcó como revisada, pero no se pudo promover: ' + (pd.error || 'error'));
        zonaFicha = 'acordes';
        $('b-publicar').hidden = true;
        const x = indice.find((i) => i.slug === ficha.slug);
        if (x) {
          x.zona = 'acordes';
          x.local = false;
          if (pd.fecha) x.date = pd.fecha;
        }
        setEstado('revisada y promovida', true);
        await refrescarPendientes();
        mostrarAviso('Guardada, marcada como revisada y promovida a acordes.' + cola +
          '\nYa aparece en «Por publicar»; el commit lo haces luego (`subir-acorde`).', 'var(--ok)');
        return;
      }
      setEstado('revisada', true);
      await refrescarPendientes();
      mostrarAviso('Guardada y marcada como revisada.' + cola +
        (sinSubir({ slug: ficha.slug })
          ? '\nTiene cambios locales: está en «Por publicar».'
          : '\nEn local no se crea PR: el commit lo haces luego (`subir-acorde`).'), 'var(--ok)');
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
    quitarPR(ficha.slug);
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

/** Abre la ficha tal como la pinta la web, en otra pestaña para no perder el editor. */
function abrirVistaPrevia() {
  if (!ficha) return;
  const ruta = (zonaFicha === 'borradores' ? '/borradores/' : '/acordes/') +
    encodeURIComponent(ficha.slug) + '/';
  // La vista previa lee el archivo guardado: lo que esté sin guardar no sale.
  if (sucio && !confirm('Hay cambios sin guardar: la vista previa muestra la última versión guardada.\n¿Abrirla igual?')) {
    return;
  }
  window.open(ruta, '_blank', 'noopener');
}

async function fusionar() {
  if (!ficha || !ficha.pr) return;
  if (!confirmarPublicacion('¿Fusionar la PR #' + ficha.pr.numero + '? Se publicará en la web.', [ficha.slug])) return;
  try {
    const r = await fetch(API + '/fusionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: ficha.slug, ...(ficha.rama ? { rama: ficha.rama } : {}) }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo fusionar');
    setEstado('fusionada', true);
    quitarPR(ficha.slug);
    mostrarAviso('Fusionada. Netlify publicará en un par de minutos.\n' + (d.url || ''), 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

async function publicar() {
  if (!ficha) return;
  if (sucio) { mostrarAviso('Guarda los cambios antes de publicar (Ctrl+S).', 'var(--nuevo)'); return; }
  if (!confirmarPublicacion(MODO_LOCAL
    ? '¿Promover esta ficha a acordes y marcarla como revisada?\nSolo mueve el archivo en el proyecto: no crea PR ni la publica en la web.'
    : '¿Publicar esta ficha? Se moverá de borradores a acordes, saldrá de la cola y, al fusionar, saldrá el aviso.', [ficha.slug])) return;
  try {
    const r = await fetch(API + '/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpoPublicar(ficha.slug, ficha.rama ? { rama: ficha.rama } : {}),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    const md = montarMd(ficha.d.frontmatter, envolver(ta.value, ficha.d.registros, ficha.d.originales).pre);
    montarEditor(ficha.slug, md, d.pr, 'acordes', d.rama);
    const x = indice.find((i) => i.slug === ficha.slug);
    if (x) {
      x.zona = 'acordes';
      x.local = false;
      x.enPR = d.pr ? d.pr.numero : null;
      if (d.fecha) x.date = d.fecha;
    }
    revision.delete(ficha.slug);
    $('b-revisado').hidden = true;
    const cola = d.revision && typeof d.revision.restantes === 'number'
      ? '\nQuedan ' + d.revision.restantes + ' por revisar.'
      : '';
    if (d.local) {
      setEstado('promovida y revisada', true);
      $('b-publicar').hidden = true;
      await refrescarPendientes();
      mostrarAviso('Promovida a acordes y marcada como revisada: ' + 'src/content/acordes/' + ficha.slug + '.md.' + cola +
        '\nEn el proyecto ya cuenta como publicada, pero la web no cambia hasta que hagas commit y push (`subir-acorde`).', 'var(--ok)');
      return;
    }
    setEstado('publicando · PR #' + d.pr.numero, true);
    $('b-publicar').hidden = true;
    mostrarAviso('Publicación en la PR #' + d.pr.numero + ': ' + d.pr.url + cola +
      '\nAl fusionar, Telegram avisa solo. WhatsApp y X, desde el PC.', 'var(--ok)');
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
  if (!confirmarPublicacion(MODO_LOCAL
    ? '¿Promover «' + slug + '» a acordes y marcarla como revisada?\nSolo mueve el archivo en el proyecto: no crea PR ni la publica en la web.'
    : '¿Publicar «' + slug + '»?\nSe moverá de borradores a acordes, saldrá de la cola y se abrirá la PR. Al fusionar saldrá el aviso.', [slug])) return;
  const antes = boton.textContent;
  boton.disabled = true;
  boton.textContent = '…';
  try {
    const r = await fetch(API + '/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpoPublicar(slug),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    if (item) {
      item.zona = 'acordes';
      item.local = false;
      item.enPR = d.pr ? d.pr.numero : null;
      if (d.fecha) item.date = d.fecha;
    }
    revision.delete(slug);
    if (d.local) await refrescarPendientes();
    else pintarLista();
    const cola = d.revision && typeof d.revision.restantes === 'number'
      ? ' Quedan ' + d.revision.restantes + ' por revisar.'
      : '';
    mostrarAviso(d.local
      ? 'Promovida a acordes y marcada como revisada: «' + slug + '» ya está en src/content/acordes/.' + cola +
        '\nLa web no cambia hasta que hagas commit y push (`subir-acorde`).'
      : 'Publicada «' + slug + '» en la PR #' + d.pr.numero + ' y fuera de la cola.' + cola +
        '\nAl fusionar, Telegram avisa solo; WhatsApp y X, desde el PC.\n' + d.pr.url, 'var(--ok)');
  } catch (e) {
    boton.disabled = false;
    boton.textContent = antes;
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/**
 * «A borradores» de la pestaña Otra web: envuelve los acordes y mueve la ficha
 * de `otraweb` a `borradores` (solo en local). Después recarga la lista, así la
 * ficha desaparece de aquí y aparece en «Borradores».
 */
async function pasarABorradores(slug, boton) {
  const ficha = importados.find((x) => x.slug === slug);
  const titulo = ficha
    ? [ficha.pieza, ficha.agrupacion, ficha.year].filter(Boolean).join(' · ')
    : slug;
  const antes = boton ? boton.textContent : '';
  if (boton) { boton.disabled = true; boton.textContent = '…'; }
  try {
    const r = await fetch(API + '/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'no se pudo pasar a borradores');
    await recargarIndice();
    mostrarAviso('«' + (titulo || slug) + '» ya está en borradores' +
      (d.acordes ? ' con ' + d.acordes + ' acordes envueltos' : '') +
      '.\nÁbrela desde la pestaña Borradores para revisarla.' +
      ((d.avisos || []).length ? '\n' + d.avisos.join('\n') : ''), 'var(--ok)');
  } catch (e) {
    if (boton) { boton.disabled = false; boton.textContent = antes; }
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/**
 * «Publicar» de una ficha que está en una PR (una corrección guardada desde el móvil):
 * fusiona la PR en master. Netlify reconstruye y, si era una ficha nueva, Telegram
 * avisa solo; una corrección no manda aviso.
 */
async function fusionarDesdeLista(slug, boton) {
  const item = indice.find((x) => x.slug === slug);
  if (!confirmarPublicacion('¿Publicar «' + slug + '»?\nSe fusiona su PR en master y Netlify reconstruye la web.' +
    (MODO_LOCAL ? '\nDespués tendrás que hacer `git pull` en el ordenador.' : ''), [slug])) return;
  const antes = boton ? boton.textContent : '';
  if (boton) { boton.disabled = true; boton.textContent = '…'; }
  try {
    const r = await fetch(API + '/fusionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...(item && item.rama ? { rama: item.rama } : {}) }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    await recargarIndice();
    mostrarAviso('PR fusionada: la ficha ya está en la web.' +
      (d.url ? '\n' + d.url : '') +
      '\nNetlify publica en un par de minutos.' +
      (MODO_LOCAL ? '\nEn local, haz `git pull` para traerte el cambio.' : ''), 'var(--ok)');
  } catch (e) {
    if (boton) { boton.disabled = false; boton.textContent = antes; }
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/**
 * «Revisado ✓» desde la lista: guarda, saca la ficha de la cola y, si es un
 * borrador en local, lo promueve a `acordes` para que pase a «Por publicar».
 */
async function revisarDesdeLista(slug, boton) {
  const item = indice.find((x) => x.slug === slug);
  if (!item) return;
  const borrador = item.zona === 'borradores';
  const promover = borrador && MODO_LOCAL;
  const partes = ['¿Marcar «' + slug + '» como revisada?'];
  if (borrador) {
    partes.push(promover
      ? 'Se guarda, sale de la cola y se promueve a acordes: aparecerá en «Por publicar».'
      : 'Se guarda y sale de la cola. Para pasarla a acordes, usa Promover.');
  } else {
    partes.push('Se guarda y sale de la cola.');
  }
  if (item.incompleta === 'sinLetra') partes.push('\nOjo: el bloque de la letra está vacío.');
  if (item.incompleta === 'sinAcordes') partes.push('\nOjo: la letra no tiene ningún acorde.');
  if (promover
    ? !confirmarPublicacion(partes.join('\n'), [slug])
    : !confirm(partes.join('\n'))) return;

  const antes = boton ? boton.textContent : '';
  if (boton) { boton.disabled = true; boton.textContent = '…'; }
  try {
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(slug) + '&zona=' + encodeURIComponent(item.zona));
    const f = await r.json();
    if (!r.ok) throw new Error(f.error || 'no se pudo leer la ficha');

    const g = await fetch(API + '/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        md: f.md,
        zona: item.zona,
        revisado: true,
        ...(f.rama ? { rama: f.rama } : {}),
      }),
    });
    const gd = await g.json();
    if (!g.ok) throw new Error(gd.error || 'no se pudo guardar');
    revision.delete(slug);

    if (promover) {
      const p = await fetch(API + '/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: cuerpoPublicar(slug),
      });
      const pd = await p.json();
      if (!p.ok) throw new Error(pd.error || 'se marcó como revisada, pero no se pudo promover');
      item.zona = 'acordes';
      item.local = false;
      if (pd.fecha) item.date = pd.fecha;
    }

    await recargarIndice();
    mostrarAviso(promover
      ? 'Revisada y promovida: «' + slug + '» ya está en acordes y aparece en «Por publicar».'
      : 'Revisada: «' + slug + '» sale de la cola.', 'var(--ok)');
  } catch (e) {
    if (boton) { boton.disabled = false; boton.textContent = antes; }
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/* ---------------- publicar en local ---------------- */
let avisoSlugs = [];
// Lo que hay en el diálogo de subida: qué fichas se suben y qué PRs se fusionan.
let publicacionPendiente = null;

/** Texto de qué va a pasar al publicar una ficha de `pendientesPublicar`. */
function textoPublicacion(item) {
  const llevaAviso = avisaFicha(item);
  if (item.estado === 'nueva') return 'Se publica en la web.';
  if (item.estado === 'borrada') return 'Se sube la eliminación. No hay aviso.';
  if (item.estado === 'sin-push') {
    return 'Se suben los commits que ya están hechos.' + (llevaAviso ? '' : ' No hay aviso.');
  }
  return 'Se suben los cambios. No hay aviso.';
}

/** Opciones de aviso recordadas entre publicaciones. */
function leerOpcionesAviso() {
  try {
    const j = JSON.parse(localStorage.getItem('admin-avisos') || '{}');
    return { sinX: j.sinX === true, sinEtiquetas: j.sinEtiquetas === true };
  } catch {
    return { sinX: false, sinEtiquetas: false };
  }
}
function guardarOpcionesAviso(o) {
  try { localStorage.setItem('admin-avisos', JSON.stringify(o)); } catch { /* sin almacenamiento */ }
}

/** Abre el diálogo de subida con una ficha sola (botón «Publicar» de la fila). */
function pedirPublicar(slug) {
  const item = pendientesPublicar.find((x) => x.slug === slug);
  if (!item) return;
  publicacionPendiente = { subir: [slug], fusionar: [], omitidos: 0 };
  const nombre = item.pieza ? item.pieza + ' · ' + item.agrupacion : slug;
  $('subir-titulo').textContent = 'Publicar';
  $('subir-plan').innerHTML = '<b>' + esc(nombre) + '</b><br>' + textoPublicacion(item);
  abrirDialogoSubir(avisaFicha(item), [slug]);
}

/** Diálogo de subida de la selección de «Por publicar». */
function pedirPublicarLote() {
  const items = loteVisibles.filter((x) => seleccion.has(x.slug));
  const { subir, fusionar, omitidos } = dividirLote(items, MODO_LOCAL);
  if (!subir.length && !fusionar.length) {
    mostrarAviso('Ninguna de las seleccionadas se puede publicar desde aquí.', 'var(--nuevo)');
    return;
  }

  publicacionPendiente = {
    subir: subir.map((x) => x.slug),
    fusionar: fusionar.map((x) => ({ slug: x.slug, rama: x.rama || null })),
    omitidos: omitidos.length,
  };

  const conAviso = subir.filter((x) => avisaFicha(x)).length;
  const lineas = [];
  if (subir.length) {
    lineas.push('<b>' + subir.length + (subir.length === 1 ? ' ficha se sube' : ' fichas se suben') + '</b>' +
      (conAviso ? ' · ' + conAviso + ' con aviso' : ' · sin aviso'));
  }
  if (fusionar.length) {
    lineas.push('<b>' + fusionar.length + (fusionar.length === 1 ? ' PR se fusiona' : ' PRs se fusionan') + '</b>' +
      ' · Telegram avisa solo si es una copla nueva');
  }
  if (omitidos.length) {
    lineas.push(omitidos.length + (omitidos.length === 1 ? ' se queda fuera' : ' se quedan fuera') +
      ': ya no está pendiente de subir');
  }
  const total = subir.length + fusionar.length;
  $('subir-titulo').textContent = 'Publicar ' + total + (total === 1 ? ' ficha' : ' fichas');
  $('subir-plan').innerHTML = lineas.join('<br>');
  abrirDialogoSubir(conAviso > 0, [...subir.map((x) => x.slug), ...fusionar.map((x) => x.slug)]);
}

/** Casillas de aviso del diálogo de subida (se recuerdan entre veces). */
function abrirDialogoSubir(llevaAviso, slugs = []) {
  const o = leerOpcionesAviso();
  $('f-subir').sinX.checked = o.sinX;
  $('f-subir').sinEtiquetas.checked = o.sinEtiquetas;
  const avisos = textoAvisosLetraTitulo(slugs);
  const avisoEl = $('subir-aviso-letra');
  avisoEl.textContent = avisos;
  avisoEl.hidden = !avisos;
  // En producción no hay avisos que lanzar: el botón solo publica.
  $('subir-opciones').hidden = !MODO_LOCAL || !llevaAviso;
  if (!$('dlg-subir').open) $('dlg-subir').showModal();
}

/** Fusiona las PRs de un lote (una llamada por ficha). */
async function fusionarLote(entradas) {
  for (let i = 0; i < entradas.length; i++) {
    const { slug, rama } = entradas[i];
    if (entradas.length > 1) $('lote-n').textContent = 'Fusionando ' + (i + 1) + '/' + entradas.length + '…';
    const r = await fetch(API + '/fusionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...(rama ? { rama } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error ? slug + ': ' + d.error : 'no se pudo fusionar ' + slug);
  }
}

/** Sube las fichas de un lote, en tandas de 20 (límite de publicar-local). */
async function publicarLocal(slugs, opciones = {}) {
  const lista = (Array.isArray(slugs) ? slugs : [slugs]).filter(Boolean);
  if (!lista.length) return;

  const tandas = enTandas(lista, 20);
  const avisos = [];
  const fallos = [];
  let error = '';

  for (let i = 0; i < tandas.length; i++) {
    try {
      const r = await fetch(API + '/publicar-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slugs: tandas[i],
          sinAviso: false,
          avisar: MODO_LOCAL,
          ...opciones,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
      abrirPublicacion(d.id, d.plan, tandas.length > 1 ? 'Tanda ' + (i + 1) + '/' + tandas.length : '');
      const res = await seguirPublicacion(d.id, true);
      avisos.push(...res.avisos);
      for (const f of res.fallos) if (!fallos.includes(f)) fallos.push(f);
      if (!res.ok) {
        error = res.error || 'mira el registro';
        break;
      }
    } catch (e) {
      error = String(e.message || e);
      break;
    }
  }

  await recargarIndice();
  if (avisos.length) {
    avisoSlugs = avisos;
    $('publicar-avisos').hidden = false;
    $('publicar-avisos').textContent = avisos.length === 1 ? 'Copiar aviso' : 'Copiar avisos';
    if (!$('dlg-publicar').open) $('dlg-publicar').showModal();
  }

  const n = lista.length;
  let texto;
  if (error) texto = 'Falló la publicación: ' + error;
  else if (fallos.length) {
    texto = 'Publicado, pero no se pudo avisar por ' + fallos.join(' y ') +
      '.\nEl texto está en «Copiar aviso» para mandarlo a mano.';
  } else if (avisos.length) {
    texto = (n > 1 ? 'Publicadas ' + n + ' fichas' : 'Publicado') + '. Avisos enviados por WhatsApp y X.';
  } else {
    texto = n > 1 ? 'Publicadas ' + n + ' fichas.' : 'Publicado.';
  }
  mostrarAviso(texto, error ? 'var(--mal)' : (fallos.length ? 'var(--nuevo)' : 'var(--ok)'));
}

/** Publica lo que haya en el diálogo: primero las PRs y después las locales. */
async function ejecutarPublicacion(pendiente, opciones) {
  if (!pendiente) return;
  try {
    if (pendiente.fusionar.length) {
      await fusionarLote(pendiente.fusionar);
      if (!pendiente.subir.length) {
        await recargarIndice();
        mostrarAviso(pendiente.fusionar.length === 1
          ? 'PR fusionada: la ficha ya está en la web.'
          : 'Fusionadas ' + pendiente.fusionar.length + ' PRs: ya están en la web.', 'var(--ok)');
        return;
      }
    }
    if (pendiente.subir.length) await publicarLocal(pendiente.subir, opciones);
  } catch (e) {
    await recargarIndice();
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
    return '<b>' + esc(nombre) + '</b><br>' + cola + (x.avisar
      ? (MODO_LOCAL ? 'aviso por WhatsApp y X al terminar' : 'aviso disponible para copiar')
      : 'sin aviso');
  }).join('<br><br>');
}

function abrirPublicacion(id, plan, nota = '') {
  avisoSlugs = [];
  $('publicar-avisos').hidden = true;
  $('publicar-plan').innerHTML = (nota ? '<b>' + esc(nota) + '</b><br>' : '') + textoPlan(plan);
  $('publicar-log').textContent = '';
  if (!$('dlg-publicar').open) $('dlg-publicar').showModal();
}

/**
 * Sigue el trabajo en segundo plano. Con `callar` no refresca ni avisa: lo hace
 * quien lo lanza, que puede estar encadenando varias tandas.
 */
async function seguirPublicacion(id, callar = false) {
  while (true) {
    await new Promise((listo) => setTimeout(listo, 2000));
    let d;
    try {
      const r = await fetch(API + '/publicar-local?id=' + encodeURIComponent(id));
      if (!r.ok) throw new Error('no se pudo leer el estado');
      d = await r.json();
    } catch (e) {
      const error = String(e.message || e);
      $('publicar-log').textContent += '\n' + error;
      return { ok: false, error, avisos: [], fallos: [] };
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

      // Avisos: si se lanzaron WhatsApp y X y alguno falló, se dice cuál.
      const resumen = (ok && d.resumen) || {};
      const fallos = Array.isArray(resumen.fallos) ? resumen.fallos : [];
      const avisos = ok && Array.isArray(resumen.avisos) ? resumen.avisos : [];
      const error = ok ? '' : (d.error || 'mira el registro');

      if (callar) return { ok, error, avisos, fallos };

      if (avisos.length) {
        // El texto queda siempre a mano por si hay que mandarlo a mano.
        avisoSlugs = avisos;
        $('publicar-avisos').hidden = false;
        $('publicar-avisos').textContent = avisos.length === 1 ? 'Copiar aviso' : 'Copiar avisos';
        if (!$('dlg-publicar').open) $('dlg-publicar').showModal();
      }

      let texto;
      if (!ok) texto = 'Falló la publicación: ' + error;
      else if (fallos.length) texto = 'Publicado, pero no se pudo avisar por ' + fallos.join(' y ') +
        '.\nEl texto está en «Copiar aviso» para mandarlo a mano.';
      else if (avisos.length) texto = 'Publicado. Avisos enviados por WhatsApp y X.';
      else texto = 'Publicado.';
      if (fallos.length) $('publicar-log').textContent += '\n✖ Avisos fallidos: ' + fallos.join(' y ');

      await recargarIndice();
      mostrarAviso(texto, ok ? (fallos.length ? 'var(--nuevo)' : 'var(--ok)') : 'var(--mal)');
      return { ok, error, avisos, fallos };
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

/**
 * Compone y abre el aviso, o los avisos de un lote, para copiarlos. Con varias
 * fichas se juntan en un solo texto separado por una línea.
 */
async function abrirAvisosSlug(slugs) {
  const lista = (Array.isArray(slugs) ? slugs : [slugs]).filter(Boolean);
  if (!lista.length) return;
  try {
    const textos = [];
    let titulo = 'Aviso';
    let textoX = '';
    for (const slug of lista) {
      const r = await fetch(API + '/aviso?slug=' + encodeURIComponent(slug));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'no se pudo componer el aviso de ' + slug);
      textos.push(d.texto);
      if (lista.length === 1) {
        titulo = d.titulo || titulo;
        textoX = d.textoX || d.texto;
      } else {
        textoX += (textoX ? '\n\n' : '') + String(d.textoX || d.texto).replace(/\*/g, '');
      }
    }
    $('aviso-meta').textContent = titulo;
    $('aviso-texto').value = textos.join('\n\n———\n\n');
    avisoX = textoX;
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
  const caja = $('f-datos');
  for (const el of caja.querySelectorAll('[name]')) {
    if (el.name === 'modalidad') continue;
    el.value = fm[el.name] ?? '';
  }
  const sel = caja.querySelector('[name="modalidad"]');
  if (sel) {
    sel.querySelectorAll('option[data-temporal]').forEach((o) => o.remove());
    const valor = valorModalidad(fm.modalidad);
    if (valor && ![...sel.options].some((o) => o.value === valor)) {
      const opt = document.createElement('option');
      opt.value = valor;
      opt.textContent = valor;
      opt.dataset.temporal = '1';
      sel.append(opt);
    }
    sel.value = valor;
  }
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

/**
 * Enlace normal de YouTube → URL de embed, que es como se guarda en el frontmatter.
 * Acepta watch, youtu.be, shorts, live y el id suelto; lo que ya es embed se deja igual.
 */
function videoEmbed(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/youtube(?:-nocookie)?\.com\/embed\//i.test(s)) return s;
  const id = /^[A-Za-z0-9_-]{11}$/.test(s)
    ? s
    : (s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/) || [])[1];
  return id ? 'https://www.youtube.com/embed/' + id : s;
}

/** Valor de modalidad que encaja con el desplegable (tolera variantes antiguas). */
function valorModalidad(valor) {
  const limpio = String(valor || '').trim();
  if (!limpio) return '';
  const clave = normalizar(limpio).replace(/\s+/g, '-');
  const mapa = {
    comparsa: 'Comparsa',
    chirigota: 'Chirigota',
    coro: 'Coro',
    coros: 'Coro',
    cuarteto: 'Cuarteto',
    cuartetos: 'Cuarteto',
    'chirigota-callejera': 'Chirigota callejera',
    'chirigotas-callejeras': 'Chirigota callejera',
  };
  return mapa[clave] || limpio;
}

let sugListaId = 0;

/** `true` si las palabras de `consulta` empiezan palabras consecutivas del nombre. */
function coincideNombre(nombre, consulta) {
  const palabras = normalizar(nombre).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const busca = String(consulta || '').split(/\s+/).filter(Boolean);
  if (!busca.length) return false;
  for (let i = 0; i <= palabras.length - busca.length; i++) {
    if (busca.every((b, j) => palabras[i + j].startsWith(b))) return true;
  }
  return false;
}

/**
 * Sugiere valores ya existentes mientras se escriben.
 * `varios` permite listas separadas por coma (música, letra): solo mira el
 * trozo que se está escribiendo y no repite los ya puestos.
 */
function autocompletarValores(input, { valores, varios = false, alElegir } = {}) {
  if (!input || input.dataset.sugLista === '1') return;
  input.dataset.sugLista = '1';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  const caja = document.createElement('div');
  caja.className = 'sug-campo';
  input.parentNode.insertBefore(caja, input);
  caja.appendChild(input);

  const lista = document.createElement('div');
  lista.className = 'sug-campo-lista';
  lista.id = 'sug-lista-' + (++sugListaId);
  lista.hidden = true;
  lista.setAttribute('role', 'listbox');
  caja.appendChild(lista);
  input.setAttribute('aria-controls', lista.id);

  let opciones = [];
  let activo = -1;

  const cerrar = () => {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activo = -1;
  };

  const marcar = () => {
    [...lista.children].forEach((b, i) => {
      b.classList.toggle('sel', i === activo);
      b.setAttribute('aria-selected', i === activo ? 'true' : 'false');
    });
    if (activo >= 0) input.setAttribute('aria-activedescendant', lista.id + '-i' + activo);
    else input.removeAttribute('aria-activedescendant');
  };

  /** Texto que se está escribiendo: todo el campo o lo que va tras la última coma. */
  const tramo = () => {
    const texto = input.value;
    if (!varios) return texto.trim();
    const corte = texto.lastIndexOf(',');
    return (corte === -1 ? texto : texto.slice(corte + 1)).trim();
  };

  const pintar = () => {
    const consulta = normalizar(tramo());
    if (!consulta) { cerrar(); return; }
    const usados = varios
      ? new Set(input.value.split(',').slice(0, -1).map((n) => normalizar(n.trim())).filter(Boolean))
      : new Set();
    const coincide = (n) => coincideNombre(n, consulta);
    opciones = valores()
      .filter((n) => n && coincide(n) && normalizar(n) !== consulta && !usados.has(normalizar(n)))
      .sort((a, b) => {
        const pa = normalizar(a).startsWith(consulta) ? 0 : 1;
        const pb = normalizar(b).startsWith(consulta) ? 0 : 1;
        return pa - pb || a.localeCompare(b, 'es');
      })
      .slice(0, 8);
    if (!opciones.length) { cerrar(); return; }
    lista.innerHTML = opciones.map((n, i) =>
      '<button type="button" class="sug-campo-item" role="option" aria-selected="false"' +
        ' data-i="' + i + '" id="' + lista.id + '-i' + i + '">' + esc(n) + '</button>',
    ).join('');
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    activo = -1;
    marcar();
  };

  const elegir = (i) => {
    const nombre = opciones[i];
    if (!nombre) return;
    if (varios) {
      const corte = input.value.lastIndexOf(',');
      const prefijo = corte >= 0 ? input.value.slice(0, corte + 1).replace(/\s*$/, '') + ' ' : '';
      input.value = prefijo + nombre + ', ';
    } else {
      input.value = nombre;
    }
    cerrar();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    if (alElegir) alElegir();
  };

  input.addEventListener('input', pintar);
  input.addEventListener('focus', pintar);
  input.addEventListener('blur', () => setTimeout(cerrar, 120));
  input.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activo = (activo + 1) % opciones.length; marcar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activo = (activo - 1 + opciones.length) % opciones.length; marcar(); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(activo >= 0 ? activo : 0); }
    else if (e.key === 'Tab' && activo >= 0) { e.preventDefault(); elegir(activo); }
    else if (e.key === 'Escape') cerrar();
  });
  lista.addEventListener('mousedown', (e) => e.preventDefault());
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) elegir(Number(b.dataset.i));
  });
}

/** Ficha de la que copiar acordes: misma agrupación y, si hay, mismo año y pieza. */
function fichaBaseAutomatica() {
  const f = $('f-nueva');
  const agrupacion = normalizar(f.agrupacion.value.trim());
  if (!agrupacion) return null;
  const candidatas = indice.filter((x) => normalizar(x.agrupacion) === agrupacion);
  if (!candidatas.length) return null;
  const pieza = normalizar(f.pieza.value.trim());
  const year = String(f.year.value || '').trim();
  const grupos = [
    candidatas.filter((x) => normalizar(x.pieza) === pieza && String(x.year) === year),
    candidatas.filter((x) => String(x.year) === year),
    candidatas.filter((x) => normalizar(x.pieza) === pieza),
    candidatas,
  ];
  for (const grupo of grupos) {
    if (!grupo.length) continue;
    return grupo.find((x) => !x.letraTitulo) || grupo[0];
  }
  return null;
}

const etiquetaFicha = (x) => [x.pieza, x.agrupacion, x.year].filter(Boolean).join(' · ');

/** Rellena y explica los datos que se toman de la ficha de referencia. */
function pintarBaseNueva() {
  const f = $('f-nueva');
  const el = $('nueva-base');
  if (!el || !f) return;
  // En «Otra letra» la base ya viene fijada de la ficha original.
  if (f.clon.value === '1') {
    const x = indice.find((i) => i.slug === f.base.value.trim());
    el.textContent = x ? 'Copiará los acordes de: ' + etiquetaFicha(x) : '';
    el.classList.remove('mal');
    return;
  }
  if (f.base.dataset.auto === '1') {
    const x = fichaBaseAutomatica();
    f.base.value = x ? x.slug : '';
    el.textContent = x
      ? 'Tomará año, modalidad, imagen, autores y vídeo de: ' + etiquetaFicha(x) + '. El bloque de la letra y la cejilla no se copian.'
      : 'Sin ficha base: la ficha nace vacía. Pega la letra y los acordes en el editor.';
  } else {
    const elegida = f.base.value.trim();
    const x = indice.find((i) => i.slug === elegida);
    el.textContent = elegida
      ? (x ? 'Copiará los acordes de: ' + etiquetaFicha(x) : 'No encuentro «' + elegida + '»: elige una ficha de la lista.')
      : 'Sin ficha base: la ficha nace vacía. Pega la letra y los acordes en el editor.';
  }
  el.classList.toggle('mal', Boolean(f.base.value.trim()) && !indice.some((i) => i.slug === f.base.value.trim()));
}

const cacheFrontmatter = new Map();

/** Frontmatter completo de una ficha, cacheado para no pedirlo en cada tecla. */
async function frontmatterDeFicha(slug) {
  if (!slug) return null;
  if (cacheFrontmatter.has(slug)) return cacheFrontmatter.get(slug);
  try {
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(slug));
    if (!r.ok) return null;
    const d = await r.json();
    const fm = leerFrontmatter(desenvolver(d.md).frontmatter);
    cacheFrontmatter.set(slug, fm);
    return fm;
  } catch {
    return null;
  }
}

/**
 * Si la agrupación ya existe, copia a la ficha nueva sus datos por defecto:
 * año, imagen, autores y vídeo. No copia la letra (el bloque), la cejilla, la
 * frase clave ni el título de otra letra.
 */
async function rellenarDesdeAgrupacion() {
  const f = $('f-nueva');
  if (!f || f.clon.value === '1' || f.base.dataset.auto !== '1') return;
  const candidata = fichaBaseAutomatica();
  f.base.value = candidata ? candidata.slug : '';
  if (!candidata) { pintarBaseNueva(); return; }
  if (f.base.dataset.autoSlug === candidata.slug) { pintarBaseNueva(); return; }
  f.base.dataset.autoSlug = candidata.slug;
  pintarBaseNueva();
  const fm = await frontmatterDeFicha(candidata.slug);
  // La agrupación pudo cambiar mientras llegaba la respuesta.
  if (!fm) { f.base.dataset.autoSlug = ''; return; }
  if (f.base.dataset.autoSlug !== candidata.slug) return;
  f.year.value = fm.year || f.year.value;
  f.img.value = fm.img || '';
  f.musica.value = fm.musica || '';
  f.letra.value = fm.letra || '';
  f.video.value = fm.video || '';
  f.modalidad.value = valorModalidad(fm.modalidad);
  pintarBaseNueva();
}

let rellenoBaseTimer = null;
let rellenoBasePendiente = null;
let resolverRellenoBase = null;

/** Cancela el relleno pendiente (al cambiar de ficha o elegir la base a mano). */
function cancelarRellenoBase() {
  clearTimeout(rellenoBaseTimer);
  if (resolverRellenoBase) { resolverRellenoBase(); resolverRellenoBase = null; }
  rellenoBasePendiente = null;
}

/** Programa el relleno de los datos de la agrupación (con un respiro al escribir). */
function programarRellenoBase(espera = 250) {
  clearTimeout(rellenoBaseTimer);
  if (resolverRellenoBase) { resolverRellenoBase(); resolverRellenoBase = null; }
  rellenoBasePendiente = new Promise((resolve) => {
    resolverRellenoBase = resolve;
    rellenoBaseTimer = setTimeout(async () => {
      try {
        await rellenarDesdeAgrupacion();
      } finally {
        resolverRellenoBase = null;
        rellenoBasePendiente = null;
        resolve();
      }
    }, espera);
  });
}

/** Resumen del panel de datos. La URL no cambia al editar los campos. */
function actualizarDatos() {
  if (!ficha) return;
  const d = datosDelEditor();
  const el = $('datos-slug');
  el.textContent = (zonaFicha === 'borradores' ? '/borradores/' : '/acordes/') + ficha.slug + '/';
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
    f.base.dataset.auto = '';
    f.base.dataset.autoSlug = '';
    cancelarRellenoBase();
    f.pieza.value = fm.pieza || 'Pasodoble';
    f.modalidad.value = valorModalidad(fm.modalidad);
    f.agrupacion.value = fm.agrupacion || '';
    f.year.value = fm.year || '';
    f.musica.value = fm.musica || '';
    f.letra.value = fm.letra || '';
    f.cejilla.value = fm.cejilla || '';
    f.video.value = fm.video || '';
    f.img.value = fm.img || '';
    f.letraTitulo.value = '';
    f.fraseClave.value = '';
    pintarBaseNueva();
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
  const form = $('f-nueva');
  // Si se está rellenando desde la agrupación, espera a que termine.
  if (rellenoBasePendiente) await rellenoBasePendiente;
  const f = new FormData(form);
  const v = (k) => String(f.get(k) || '').trim();
  const base = v('base');
  const auto = form.base.dataset.auto === '1';
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
    // Sin ficha base (o con la que se elige sola por la agrupación), la ficha
    // nace vacía de bloque. Si la base es manual, se copian sus acordes.
    let bd = { frontmatter: '---\n---\n', pre: '' };
    if (base && !auto) {
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
      modalidad: v('modalidad') || undefined,
      cejilla: v('cejilla') || undefined,
      video: videoEmbed(v('video')) || undefined,
      img: v('img') || (base && !auto ? undefined : '/og-image.jpg'),
      fraseClave: clon ? (v('fraseClave') || null) : (v('fraseClave') || undefined),
      date: hoy(),
      // La copia no hereda el sitio en portada ni el destacado de la original.
      ...(clon ? { destacada: null, recomendada: null } : {}),
    });
    const md = montarMd(fm, bd.pre);
    const g = await fetch(API + '/guardar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, md, zona: 'borradores' }),
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
      modalidad: v('modalidad'),
      agrupacion: v('agrupacion'),
      year: v('year'),
      letraTitulo: v('letraTitulo'),
      musica: v('musica'),
      letra: v('letra'),
      zona: 'borradores',
      local: gd.local === true,
      enPR: gd.pr ? gd.pr.numero : null,
    });
    cargarSugerencias();
    montarEditor(slug, md, gd.pr, 'borradores', gd.rama);
    mostrarAviso(gd.local
      ? 'Ficha creada en src/content/borradores/' + slug + '.md.\n' +
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
function posicionarSug() {
  const m = metricasEditor();
  const texto = ta.value;
  const pos = ta.selectionStart;
  const ini = texto.lastIndexOf('\n', pos - 1) + 1;
  const fila = texto.slice(0, ini).split('\n').length - 1;
  let col = 0;
  for (const c of texto.slice(ini, pos)) col += c === '\t' ? 4 - (col % 4) : 1;
  const x = m.rect.left + m.padL + col * m.ch;
  const y = m.rect.top + m.padT + fila * m.lh;
  const ancho = sug.offsetWidth || 200;
  const alto = sug.offsetHeight || 220;
  let left = x;
  let top = y + m.lh + 4;
  if (left + ancho > window.innerWidth - 8) left = window.innerWidth - ancho - 8;
  if (top + alto > window.innerHeight - 8) top = y - alto - 4;
  sug.style.left = Math.max(8, Math.round(left)) + 'px';
  sug.style.top = Math.max(8, Math.round(top)) + 'px';
}
function abrirSug() {
  const t = tokenAntesCaret();
  if (t.length < 2) return cerrarSug();
  const q = t.toLowerCase();
  const lista = [...conocidos].filter((x) => x.toLowerCase().startsWith(q) && x !== t).slice(0, 8);
  if (!lista.length) return cerrarSug();
  sugerencias = lista;
  sugSel = 0;
  sugLista.innerHTML = lista.map((x, i) => '<button data-i="' + i + '" class="' + (i === 0 ? 'sel' : '') + '">' + esc(x) + '</button>').join('');
  sugLista.querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); insertarSug(b.textContent); });
  });
  sug.hidden = false;
  posicionarSug();
}
function cerrarSug() {
  sug.hidden = true;
  sugLista.innerHTML = '';
  sugerencias = [];
}
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
  b.onclick = () => aplicarFiltro(b.dataset.filtro);
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
$('b-stats-refrescar').onclick = () => (statsFuente === 'cf' ? cargarCloudflare(true) : cargarStats());
document.querySelectorAll('#stats-fuentes button').forEach((b) => {
  b.onclick = () => mostrarFuenteStats(b.dataset.stats);
});
$('cf-ruta-cerrar').onclick = () => $('dlg-cf-ruta').close();
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
// Al escribir la agrupación, el año o la pieza se elige sola la ficha base;
// si el usuario escribe una a mano, deja de proponerse.
$('f-nueva').addEventListener('input', (e) => {
  if (e.target.name === 'base') {
    e.target.dataset.auto = '';
    e.target.dataset.autoSlug = '';
    cancelarRellenoBase();
  }
  pintarBaseNueva();
  if (e.target.name === 'agrupacion') programarRellenoBase();
});
// El enlace normal de YouTube se convierte a embed al salir del campo.
for (const zona of [$('f-nueva'), $('f-datos')]) {
  zona.addEventListener('focusout', (e) => {
    if (e.target.name === 'video') e.target.value = videoEmbed(e.target.value);
  });
}
// Autores: música y letra sugieren los nombres que ya existen en el cancionero.
for (const input of document.querySelectorAll('#f-nueva [name="musica"], #f-nueva [name="letra"], #f-datos [name="musica"], #f-datos [name="letra"]')) {
  autocompletarValores(input, { valores: () => autoresConocidos, varios: true });
}
// Agrupaciones: sugiere las que ya existen al escribir.
const agrNueva = document.querySelector('#f-nueva [name="agrupacion"]');
if (agrNueva) autocompletarValores(agrNueva, {
  valores: () => agrupacionesConocidas,
  alElegir: () => { pintarBaseNueva(); programarRellenoBase(0); },
});
const agrDatos = document.querySelector('#f-datos [name="agrupacion"]');
if (agrDatos) autocompletarValores(agrDatos, { valores: () => agrupacionesConocidas, alElegir: actualizarDatos });
$('b-letra').onclick = () => { $('f-letra').reset(); pintarBaseLetra(); $('dlg-letra').showModal(); $('f-letra').frase.focus(); };
$('f-letra').addEventListener('input', pintarBaseLetra);
$('l-cancelar').onclick = () => $('dlg-letra').close();
$('f-letra').onsubmit = anadirLetra;
$('subir-cancelar').onclick = () => { publicacionPendiente = null; $('dlg-subir').close(); };
$('f-subir').onsubmit = (e) => {
  e.preventDefault();
  const opciones = {
    sinX: $('f-subir').sinX.checked,
    sinEtiquetas: $('f-subir').sinEtiquetas.checked,
  };
  guardarOpcionesAviso(opciones);
  const pendiente = publicacionPendiente;
  publicacionPendiente = null;
  $('dlg-subir').close();
  if (pendiente) ejecutarPublicacion(pendiente, opciones);
};
$('lote-todo').onclick = () => {
  const todos = seleccion.size > 0 && seleccion.size === loteVisibles.length;
  if (todos) seleccion.clear();
  else for (const x of loteVisibles) seleccion.add(x.slug);
  pintarLista();
};
$('lote-limpiar').onclick = () => { seleccion.clear(); pintarLista(); };
$('lote-publicar').onclick = pedirPublicarLote;
$('b-guardar').onclick = guardar;
$('b-revisado').onclick = revisarFicha;
$('b-comprobar').onclick = comprobar;
$('b-preview').onclick = abrirVistaPrevia;
$('b-fusionar').onclick = fusionar;
$('b-publicar').onclick = publicar;
$('b-avisos').onclick = abrirAvisos;
$('nota-local-cerrar').onclick = cerrarNotaLocal;
$('av-cerrar').onclick = () => $('dlg-aviso').close();
$('publicar-cerrar').onclick = () => $('dlg-publicar').close();
$('publicar-avisos').onclick = () => { if (avisoSlugs.length) abrirAvisosSlug(avisoSlugs); };
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
    aplicarZoom();
    if (paneActivo === 'cen') verCaret();
  };
});

function alternarZoom() {
  zoomAjustado = !zoomAjustado;
  try { localStorage.setItem(CLAVE_ZOOM, zoomAjustado ? '1' : '0'); } catch { /* sin almacenamiento */ }
  aplicarZoom();
  verCaret();
}
$('b-zoom').onclick = alternarZoom;
document.querySelectorAll('.b-zoom-pane').forEach((b) => { b.onclick = alternarZoom; });
$('b-separar').onclick = separar;
$('b-juntar').onclick = juntar;
$('b-deshacer').onclick = deshacer;

// El cursor se apunta antes de que el foco se vaya al botón: en iOS un
// textarea sin foco devuelve la selección en 0 y el corte caería al principio.
['b-separar', 'b-juntar'].forEach((id) => {
  const b = $(id);
  b.addEventListener('pointerdown', recordarCursor);
  b.addEventListener('mousedown', (e) => { recordarCursor(); e.preventDefault(); });
});

let rafAjuste = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(rafAjuste);
  rafAjuste = requestAnimationFrame(() => { aplicarZoom(); verCaret(); cerrarSug(); });
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
  reajustarEstructura();
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
  if (!sug.hidden && ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
    cerrarSug();
  }
  if (!sug.hidden) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sugSel = (sugSel + 1) % sugerencias.length; marcarSug(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); sugSel = (sugSel - 1 + sugerencias.length) % sugerencias.length; marcarSug(); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return insertarSug(sugerencias[sugSel]); }
  }
});
function marcarSug() {
  sugLista.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === sugSel));
}

$('sug-cerrar').addEventListener('pointerdown', (e) => { e.preventDefault(); cerrarSug(); });
document.addEventListener('pointerdown', (e) => {
  if (sug.hidden) return;
  if (sug.contains(e.target)) return;
  cerrarSug();
}, true);
ta.addEventListener('blur', () => {
  setTimeout(() => { if (document.activeElement !== ta) cerrarSug(); }, 0);
});
lienzo.addEventListener('scroll', cerrarSug, { passive: true });

/* Arrastre horizontal/vertical a mano y arrastre de acordes. En móvil el
   textarea se queda el gesto y, al mantener pulsado, el navegador empieza a
   seleccionar texto. Si el toque cae en un acorde tomamos el control:
   - el toque corto coloca el cursor a mano;
   - el desplazamiento mueve el lienzo (horizontal o vertical);
   - la pulsación larga (~350 ms) levanta el acorde para arrastrarlo. */
ta.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) {
    toque = null;
    if (toqueLargo) { clearTimeout(toqueLargo.timer); toqueLargo = null; }
    document.body.classList.remove('posible-arrastre');
    if (arrastre) cancelarArrastre();
    return;
  }
  const t = e.touches[0];
  toque = {
    x0: t.clientX,
    y0: t.clientY,
    x: t.clientX,
    y: t.clientY,
    scroll: lienzo.scrollLeft,
    scrollTop: lienzo.scrollTop,
    horizontal: false,
    movido: false,
    acorde: null,
  };
  document.body.classList.remove('posible-arrastre');
  if (arrastre) return;
  if (toqueLargo) { clearTimeout(toqueLargo.timer); toqueLargo = null; }
  const acorde = acordeEnPunto(t.clientX, t.clientY);
  if (acorde) {
    toque.acorde = acorde;
    // Si no tomamos el gesto, el textarea empieza a seleccionar texto.
    e.preventDefault();
    document.body.classList.add('posible-arrastre');
    toqueLargo = {
      timer: setTimeout(() => {
        if (!toque) return;
        toqueLargo = null;
        iniciarArrastre(acorde, toque.x, toque.y);
      }, LARGO_TOQUE),
    };
  }
}, { passive: false });

ta.addEventListener('touchmove', (e) => {
  if (!toque || e.touches.length !== 1) return;
  const t = e.touches[0];
  toque.x = t.clientX;
  toque.y = t.clientY;

  if (arrastre) {
    e.preventDefault();
    arrastre.x = t.clientX;
    arrastre.y = t.clientY;
    actualizarDestinoArrastre();
    return;
  }

  const dx = t.clientX - toque.x0;
  const dy = t.clientY - toque.y0;
  if (toqueLargo && Math.hypot(dx, dy) > UMBRAL_ARRASTRE) {
    clearTimeout(toqueLargo.timer);
    toqueLargo = null;
    document.body.classList.remove('posible-arrastre');
    toque.movido = true;
  }
  if (!toque.horizontal) {
    if (Math.abs(dx) < UMBRAL_ARRASTRE || Math.abs(dx) < Math.abs(dy)) {
      // En un acorde el gesto es nuestro: desplazamos el lienzo a mano.
      if (toque.acorde && Math.abs(dy) >= UMBRAL_ARRASTRE) {
        e.preventDefault();
        toque.movido = true;
        lienzo.scrollTop = toque.scrollTop - dy;
      }
      return;
    }
    toque.horizontal = true;
  }
  e.preventDefault();
  lienzo.scrollLeft = toque.scroll - dx;
}, { passive: false });

ta.addEventListener('touchend', (e) => {
  document.body.classList.remove('posible-arrastre');
  if (arrastre) {
    if (e.cancelable) e.preventDefault();
    soltarArrastre();
  } else if (toque?.acorde && !toque.movido) {
    // Toque corto en un acorde: como hemos bloqueado el gesto nativo, el
    // cursor lo colocamos nosotros en el punto donde estaba el dedo.
    const t = e.changedTouches?.[0];
    const p = puntoEditor(t ? t.clientX : toque.x, t ? t.clientY : toque.y);
    const pos = posicionDe(p.linea, p.col);
    if (e.cancelable) e.preventDefault();
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }
  if (toqueLargo) { clearTimeout(toqueLargo.timer); toqueLargo = null; }
  toque = null;
}, { passive: false });

ta.addEventListener('touchcancel', () => {
  document.body.classList.remove('posible-arrastre');
  if (toqueLargo) { clearTimeout(toqueLargo.timer); toqueLargo = null; }
  toque = null;
  if (arrastre) cancelarArrastre();
}, { passive: true });

/* Ratón: se empieza a arrastrar en cuanto el puntero se mueve unos píxeles.
   Si solo se hace clic, el cursor se coloca como siempre. */
ta.addEventListener('mousedown', (e) => {
  if (toque || e.button !== 0 || e.shiftKey || arrastre) return;
  const acorde = acordeEnPunto(e.clientX, e.clientY);
  raton = acorde ? { x0: e.clientX, y0: e.clientY, origen: acorde } : null;
});

document.addEventListener('mousemove', (e) => {
  if (arrastre) {
    e.preventDefault();
    arrastre.x = e.clientX;
    arrastre.y = e.clientY;
    actualizarDestinoArrastre();
    return;
  }
  if (!raton) return;
  if (Math.hypot(e.clientX - raton.x0, e.clientY - raton.y0) < 5) return;
  e.preventDefault();
  iniciarArrastre(raton.origen, e.clientX, e.clientY);
});

document.addEventListener('mouseup', () => {
  if (arrastre) soltarArrastre();
  raton = null;
});

/* Un arrastre no debe acabar colocando el cursor ni pulsando un botón. */
document.addEventListener('click', (e) => {
  if (!ignorarClick) return;
  e.preventDefault();
  e.stopPropagation();
  ignorarClick = false;
}, true);

/* Pista visual: sobre un acorde el cursor es «grab». */
ta.addEventListener('mousemove', (e) => {
  if (arrastre || raton) return;
  ta.style.cursor = acordeEnPunto(e.clientX, e.clientY) ? 'grab' : '';
});
ta.addEventListener('mouseleave', () => {
  if (!arrastre && !raton) ta.style.cursor = '';
});

ta.addEventListener('contextmenu', (e) => {
  if (arrastre || toqueLargo || ignorarClick) e.preventDefault();
});

document.addEventListener('selectstart', (e) => {
  if (arrastre || toqueLargo) e.preventDefault();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && arrastre) {
    e.preventDefault();
    cancelarArrastre();
  }
});

if (window) {
  window.addEventListener('blur', () => {
    if (toqueLargo) { clearTimeout(toqueLargo.timer); toqueLargo = null; }
    document.body.classList.remove('posible-arrastre');
    if (arrastre) cancelarArrastre();
    raton = null;
  });
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
  $('leyenda-filtro').innerHTML = LEYENDAS[filtroTipo] || '';
  // «Por publicar» vale en los dos modos: en local son los cambios sin commit; en
  // producción (y también en local) las PRs abiertas de fichas publicadas.
  $('f-por-publicar').hidden = false;
  // «Otra web» solo tiene sentido en local: en Netlify no existe la colección
  // provisional ni se pueden mover archivos.
  $('f-otraweb').hidden = !MODO_LOCAL;
  // Recupera la pestaña que se estaba viendo (p. ej. al volver de una previa).
  try {
    const f = sessionStorage.getItem('admin-filtro');
    if (f && f !== 'todas') aplicarFiltro(f);
  } catch { /* sin almacenamiento */ }
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
