import { initPreAcordes, desenvolver, envolver, montarMd, revisar, clasificar } from '../lib/pre-acordes.js';
import glosario from '../data/glosario-acordes.json';

initPreAcordes(glosario);

const API = '/estudio/api';
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
async function cargarIndice() {
  if (indice.length) return indice;
  const r = await fetch('/indice-busqueda.json');
  const publicadas = (await r.json()).map((x) => ({ ...x, zona: 'acordes' }));
  let borradores = [];
  try {
    const b = await fetch(API + '/lista');
    if (b.ok) borradores = (await b.json()).borradores.map((x) => ({ ...x, zona: 'acordes3' }));
  } catch { /* sin borradores */ }
  indice = [...borradores, ...publicadas];
  const dl = $('slugs');
  dl.innerHTML = indice.slice(0, 400).map((x) => '<option value="' + esc(x.slug) + '">' + esc(x.pieza + ' · ' + x.agrupacion + ' · ' + x.year) + '</option>').join('');
  return indice;
}

function pintarLista(filtro) {
  const q = (filtro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filas = indice.filter((x) => {
    if (!q) return true;
    const t = [x.slug, x.pieza, x.agrupacion, x.year, x.letraTitulo, x.musica, x.letra].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return q.split(/\s+/).every((w) => t.includes(w));
  }).slice(0, 300);

  $('filas').innerHTML = filas.map((x) =>
    '<div class="fila" data-slug="' + esc(x.slug) + '">' +
      '<div><b>' + esc(x.pieza + ' · ' + x.agrupacion) + '</b><small>' +
        (x.zona === 'acordes3' ? '<span class="marca">BORRADOR</span> ' : '') +
        (x.enPR ? '<span class="marca pr">EN PR</span> ' : '') +
        esc(x.letraTitulo || '') + '</small></div>' +
      '<div class="der">' + esc(String(x.year)) + '</div>' +
    '</div>').join('');
  $('filas').querySelectorAll('.fila').forEach((f) => {
    f.onclick = () => abrirFicha(f.dataset.slug);
  });
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

async function abrirFicha(slug) {
  try {
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(slug));
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || 'no se pudo cargar');
    montarEditor(slug, datos.md, null, datos.zona);
    await cargarBase(slug);
    pintar();
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/** Prepara el editor con un `.md` ya cargado (de master o de una rama recién creada). */
function montarEditor(slug, md, pr, zona) {
  zonaFicha = zona === 'acordes3' ? 'acordes3' : 'acordes';
  const d = desenvolver(md);
  conocidos.clear();
  d.registros.flat().forEach((x) => conocidos.add(x.etiqueta));
  ficha = { slug, md, d, pr: pr || null };
  anterior = d.texto;
  hist = [];
  futuro = [];
  sucio = false;
  ta.value = d.texto;
  pintarTexto(d.texto, $('ref-izq'));
  $('cab-meta').textContent = slug;
  $('editor-meta').textContent = d.texto.split('\n').length + ' líneas';
  $('vista-lista').hidden = true;
  $('vista-editor').hidden = false;
  ['b-lista', 'b-comprobar', 'b-guardar', 'b-avisos'].forEach((id) => { $(id).hidden = false; });
  $('b-nueva').hidden = true;
  $('b-publicar').hidden = zonaFicha !== 'acordes3';
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

async function cargarBase(slug) {
  const actual = indice.find((x) => x.slug === slug);
  $('ref-der').textContent = 'Sin ficha base para comparar.';
  $('base-meta').textContent = '';
  if (!actual) return;
  const candidatas = indice.filter((x) => x.slug !== slug && x.agrupacion === actual.agrupacion && String(x.year) === String(actual.year));
  const base = candidatas.find((x) => x.pieza === actual.pieza) || candidatas[0];
  if (!base) return;
  try {
    const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(base.slug));
    const datos = await r.json();
    if (!r.ok) return;
    const d = desenvolver(datos.md);
    pintarTexto(d.texto, $('ref-der'));
    $('base-meta').textContent = base.slug;
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
async function guardar() {
  if (!ficha) return;
  try {
    const envuelto = envolver(ta.value, ficha.d.registros, ficha.d.originales);
    const md = montarMd(ficha.d.frontmatter, envuelto.pre);
    const r = await fetch(API + '/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug, md, zona: zonaFicha }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo guardar');
    ficha.pr = d.pr;
    setEstado('en PR #' + d.pr.numero, true);
    $('b-pr').hidden = false;
    $('b-fusionar').hidden = false;
    $('b-pr').onclick = () => window.open(d.pr.url, '_blank');
    mostrarAviso('Guardado en la rama ' + d.rama + '.\nPR #' + d.pr.numero + ': ' + d.pr.url + '\nNetlify está construyendo el preview; en un par de minutos lo tienes en la PR.', 'var(--ok)');
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
    const r = await fetch(API + '/fusionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: ficha.slug }) });
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
  if (!confirm('¿Publicar esta ficha? Se moverá de acordes3 a acordes y, al fusionar, saldrá el aviso.')) return;
  try {
    const r = await fetch(API + '/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo publicar');
    const md = montarMd(ficha.d.frontmatter, envolver(ta.value, ficha.d.registros, ficha.d.originales).pre);
    montarEditor(ficha.slug, md, d.pr, 'acordes');
    setEstado('publicando · PR #' + d.pr.numero, true);
    $('b-publicar').hidden = true;
    mostrarAviso('Publicación en la PR #' + d.pr.numero + ': ' + d.pr.url + '\nAl fusionar, Telegram avisa solo. WhatsApp y X, desde el PC.', 'var(--ok)');
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/* ---------------- avisos ---------------- */
async function abrirAvisos() {
  if (!ficha) return;
  try {
    const r = await fetch(API + '/aviso?slug=' + encodeURIComponent(ficha.slug));
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'no se pudo componer el aviso');
    $('aviso-meta').textContent = d.titulo;
    $('aviso-texto').value = d.texto;
    $('dlg-aviso').showModal();
  } catch (e) {
    mostrarAviso(String(e.message || e), 'var(--mal)');
  }
}

/* ---------------- nueva ficha ---------------- */
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
    if (v === undefined || v === '') continue;
    const i = cuerpo.findIndex((l) => l.startsWith(k + ':'));
    if (i >= 0) cuerpo[i] = valor(k, v); else cuerpo.push(valor(k, v));
  }
  return '---\n' + cuerpo.join('\n') + '\n---\n';
}

async function crear(e) {
  e.preventDefault();
  const f = new FormData($('f-nueva'));
  const v = (k) => String(f.get(k) || '').trim();
  const base = v('base');
  const pieza = v('pieza') || 'Pasodoble';
  if (!v('agrupacion')) { mostrarAviso('La agrupación es obligatoria.', 'var(--mal)'); return; }
  try {
    // Sin ficha base, la ficha nace vacía: el bloque se pega luego en el editor.
    let bd = { frontmatter: '---\n---\n', pre: '' };
    if (base) {
      const r = await fetch(API + '/ficha?slug=' + encodeURIComponent(base));
      const d = await r.json();
      if (!r.ok) throw new Error('no encuentro la base ' + base);
      bd = desenvolver(d.md);
    }
    const slug = (pieza + '-' + v('agrupacion') + (v('letraTitulo') ? '-' + v('letraTitulo') : ''))
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fm = cambiarFrontmatter(bd.frontmatter, {
      pieza,
      agrupacion: v('agrupacion'),
      year: v('year'),
      musica: v('musica'),
      letra: v('letra'),
      letraTitulo: v('letraTitulo'),
      cejilla: v('cejilla') || undefined,
      video: v('video') || undefined,
      img: v('img') || (base ? undefined : '/og-image.png'),
      fraseClave: v('fraseClave') || undefined,
      date: hoy(),
    });
    const md = montarMd(fm, bd.pre);
    const g = await fetch(API + '/guardar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, md, zona: 'acordes3' }),
    });
    const gd = await g.json();
    if (!g.ok) throw new Error(gd.error || 'no se pudo crear');
    $('dlg-nueva').close();
    montarEditor(slug, md, gd.pr, 'acordes3');
    mostrarAviso('Ficha creada en la rama ' + gd.rama + '.\nPR #' + gd.pr.numero + ': ' + gd.pr.url + '\nAhora pega la letra nueva sobre la de la base y mueve los acordes.', 'var(--ok)');
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
$('q').oninput = (e) => pintarLista(e.target.value);
$('b-lista').onclick = () => {
  $('vista-editor').hidden = true;
  $('vista-lista').hidden = false;
  $('b-nueva').hidden = false;
  ['b-comprobar', 'b-guardar', 'b-avisos', 'b-pr', 'b-fusionar', 'b-publicar'].forEach((id) => { $(id).hidden = true; });
  $('cab-meta').textContent = '';
  setEstado('', true);
};
$('b-nueva').onclick = () => { $('f-nueva').reset(); $('f-nueva').pieza.value = 'Pasodoble'; $('f-nueva').year.value = new Date().getFullYear(); $('dlg-nueva').showModal(); };
$('n-cancelar').onclick = () => $('dlg-nueva').close();
$('f-nueva').onsubmit = crear;
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
  const t = $('aviso-texto').value;
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
  const login = await quien();
  if (!login) return; // se queda la pantalla de login
  $('login').hidden = true;
  $('quien').textContent = login;
  $('vista-lista').hidden = false;
  $('b-nueva').hidden = false;
  $('cab-meta').textContent = '';
  setEstado('', true);
  await cargarIndice();
  pintarLista('');
  $('pie').innerHTML = '<a href="/estudio/api/salir">Salir</a>';
})();

