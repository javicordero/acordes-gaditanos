#!/usr/bin/env node
/**
 * Trello watcher — vigila el tablero y, cuando aparece una tarjeta nueva o un
 * comentario nuevo del usuario, arranca un agente headless (`opencode run`) que
 * responde en la tarjeta siguiendo la skill `trello`.
 *
 * Diseño:
 *   - Sondea la API de Trello cada N segundos (por defecto 30). El sondeo NO
 *     cuesta tokens: es Node puro pegando llamadas a la API.
 *   - Detecta tarjetas nuevas en «En curso», «Prioritarias» y «Pendiente», y
 *     comentarios nuevos.
 *   - Cola FIFO: las tarjetas se atienden de la **más antigua a la más nueva**
 *     (por fecha de creación del id, no por la posición, porque Trello apila las
 *     nuevas arriba de la columna) y por tramos: primero las de «En curso» con
 *     comentario nuevo, después «Prioritarias» y después «Pendiente».
 *   - Varios comentarios seguidos = un solo encargo: antes de arrancar el agente
 *     se espera `TRELLO_WATCH_AGRUPAR` segundos (45) y se leen todos juntos, para
 *     que haga un plan único y no uno por comentario.
 *   - Una sola sesión de OpenCode por tarjeta: el id es fijo
 *     (`ses_trello_<idTarjeta>`) y se guarda en el estado, así cada tarjeta vive
 *     siempre en su misma sesión (también al reiniciar el watcher). Sesión nueva
 *     solo al empezar otra tarjeta, o a mano con
 *     `TRELLO_WATCH_SESION_NUEVA=<id|shortLink|1>`.
 *   - La primera pasada solo registra el estado actual y NO dispara nada: así no
 *     procesa de golpe las tarjetas que ya hubiera al arrancar.
 *   - El baseline es el **id** del último comentario procesado (el contador de
 *     la tarjeta queda como respaldo), así un contador que no cuadre no repite
 *     la respuesta ni se come un comentario que llegue mientras corre el agente.
 *   - Lock de una sola instancia (si ya hay otro watcher vivo, sale).
 *
 * Modelo del agente: opencode-go/deepseek-v4.1-flash (fijado; no se usa otro).
 * Puertos: el agente puede usar 4322/4323/4324, nunca el 4321.
 * Sin commit ni push salvo que el usuario lo pida explícitamente.
 * Los comentarios del agente empiezan por «🤖» (TRELLO_WATCH_MARCA) para
 *   distinguirlos de los del usuario y para no re-disparar con sus respuestas.
 *
 * Uso:
 *   node scripts/trello-watch.mjs              vigilar en bucle
 *   node scripts/trello-watch.mjs --una-vez    una sola pasada (para probar)
 *   node scripts/trello-watch.mjs --seco       no arranca agente, solo avisa
 *
 * Env (opcional):
 *   TRELLO_WATCH_INTERVALO       segundos entre pasadas (por defecto 30)
 *   TRELLO_WATCH_AGRUPAR         segundos de espera para juntar comentarios (45)
 *   TRELLO_LISTA_PRIORITARIAS    nombre de la columna (por defecto «Prioritarias»)
 *   TRELLO_WATCH_SESION_NUEVA    id/shortLink de una tarjeta (o `1` para todas)
 *                                para que el próximo turno estrene sesión limpia
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const CACHE = join(RAIZ, '.cache');
const ESTADO = join(CACHE, 'trello-watch.json');
const LOCK = join(CACHE, 'trello-watch.lock');

const API = 'https://api.trello.com/1';
const MODELO = 'opencode-go/deepseek-v4.1-flash';
const INTERVALO_MS = (parseInt(process.env.TRELLO_WATCH_INTERVALO || '30', 10) || 30) * 1000;
// Espera de agrupación: antes de arrancar el agente se espera este tiempo por si
// llegan más comentarios seguidos, y se mandan **todos juntos** en un solo
// encargo (un plan para todos, no uno por comentario). 0 lo desactiva.
const AGRUPAR_MS = Math.max(
  0,
  (parseInt(process.env.TRELLO_WATCH_AGRUPAR || '45', 10) || 0) * 1000,
);
// Prefijo que el agente pone al principio de sus comentarios para distinguirlos
// de los del usuario. Sirve también para que el watcher ignore sus respuestas.
const MARCA = process.env.TRELLO_WATCH_MARCA || '🤖';

const UNA_VEZ = process.argv.includes('--una-vez');
const SECO = process.argv.includes('--seco');
const AYUDA = process.argv.includes('--ayuda') || process.argv.includes('--help');

// Tarjeta (id o shortLink) cuya próxima sesión debe estrenarse. `1`/`todas`
// vale para cualquier tarjeta. Se puede pasar por flag (`--nueva-sesion [id]`)
// o por entorno (`TRELLO_WATCH_SESION_NUEVA`). El flag sin valor usa `1`.
function leerNuevaSesion() {
  const entorno = (process.env.TRELLO_WATCH_SESION_NUEVA || '').trim();
  if (entorno) return entorno;
  const i = process.argv.indexOf('--nueva-sesion');
  if (i === -1) {
    const conValor = process.argv.find((a) => a.startsWith('--nueva-sesion='));
    return conValor ? conValor.split('=')[1].trim() : '';
  }
  const siguiente = process.argv[i + 1];
  return siguiente && !siguiente.startsWith('--') ? siguiente.trim() : '1';
}

const NUEVA_SESION = leerNuevaSesion();
// Tarjetas ya refrescadas en este proceso (para no estrenar sesión en cada pasada).
const SESIONES_REFRESCADAS = new Set();

// ---------------------------------------------------------------------------
// Entorno
// ---------------------------------------------------------------------------

function leerEnv() {
  const ruta = join(RAIZ, '.env');
  if (!existsSync(ruta)) return {};
  const bruto = readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '');
  const valores = {};
  for (const linea of bruto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    valores[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return valores;
}

const ENV = leerEnv();
const KEY = process.env.TRELLO_KEY || ENV.TRELLO_KEY || '';
const TOKEN = process.env.TRELLO_TOKEN || ENV.TRELLO_TOKEN || '';
const TABLERO = process.env.TRELLO_TABLERO || ENV.TRELLO_TABLERO || 'vwbp5cJ5';

const NOMBRES = {
  pendiente: process.env.TRELLO_LISTA_PENDIENTE || ENV.TRELLO_LISTA_PENDIENTE || 'Pendiente',
  prioritaria:
    process.env.TRELLO_LISTA_PRIORITARIAS || ENV.TRELLO_LISTA_PRIORITARIAS || 'Prioritarias',
  curso: process.env.TRELLO_LISTA_CURSO || ENV.TRELLO_LISTA_CURSO || 'En curso',
  final: process.env.TRELLO_LISTA_FINAL || ENV.TRELLO_LISTA_FINAL || 'Finalizado',
};

function log(...partes) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...partes);
}

function faltanCredenciales() {
  if (KEY && TOKEN) return false;
  console.error(
    'Faltan TRELLO_KEY y/o TRELLO_TOKEN en .env. El watcher sale (código 2).\n' +
      'Se sacan en https://trello.com/power-ups/admin (Autenticación Trello).',
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

async function api(ruta, { consulta = {} } = {}) {
  const url = new URL(API + ruta);
  url.searchParams.set('key', KEY);
  url.searchParams.set('token', TOKEN);
  for (const [k, v] of Object.entries(consulta)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  const texto = await res.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (!res.ok) {
    const detalle = typeof datos === 'string' ? datos : datos?.message || texto;
    throw new Error(`Trello ${res.status} en ${ruta}: ${detalle}`);
  }
  return datos;
}

// Listas abiertas con sus tarjetas (badges.comments da el nº de comentarios).
async function snapshot() {
  const listas = await api(`/boards/${TABLERO}/lists`, {
    consulta: {
      filter: 'open',
      fields: 'name,pos',
      cards: 'open',
      card_fields: 'id,name,idList,pos,shortLink,badges',
    },
  });
  const tarjetas = listas.flatMap((l) =>
    (l.cards || []).map((c) => ({ ...c, idList: c.idList || l.id, lista: l.name })),
  );
  return { listas, tarjetas };
}

const sinTildes = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Fecha de creación de la tarjeta en segundos. El id de Trello es un ObjectId de
// Mongo: los 8 primeros hex son la marca de tiempo. Sirve para atender la cola
// de la más antigua a la más nueva, sin depender de en qué extremo de la columna
// apila Trello las tarjetas nuevas (por defecto, arriba).
function creadaEn(t) {
  const segundos = parseInt(String(t.id || '').slice(0, 8), 16);
  return Number.isFinite(segundos) ? segundos : 0;
}

function compararAntiguedad(a, b) {
  return creadaEn(a) - creadaEn(b) || (a.pos ?? 0) - (b.pos ?? 0);
}

function esVigilada(nombreLista) {
  const clave = sinTildes(nombreLista);
  return (
    clave === sinTildes(NOMBRES.pendiente) ||
    clave === sinTildes(NOMBRES.prioritaria) ||
    clave === sinTildes(NOMBRES.curso)
  );
}

// Orden de la cola:
//   0 · En curso con comentario nuevo del usuario (algo que corregir)
//   1 · Prioritarias
//   2 · Pendiente
//   3 · En curso sin novedades (solo se refresca el nombre)
// Dentro de cada tramo, la más antigua primero.
function rangoDe(t, previo) {
  const clave = sinTildes(t.lista);
  const actuales = t.badges?.comments ?? 0;
  const hayNovedad =
    actuales > 0 &&
    (!previo || !previo.ultimoComentario || actuales !== (previo.comments ?? 0));
  if (clave === sinTildes(NOMBRES.curso)) return hayNovedad ? 0 : 3;
  if (clave === sinTildes(NOMBRES.prioritaria)) return 1;
  return 2;
}

async function contarComentarios(idTarjeta) {
  const c = await api(`/cards/${idTarjeta}`, { consulta: { fields: 'badges' } });
  return c?.badges?.comments ?? 0;
}

function esComentarioDelAgente(texto) {
  return String(texto || '').trim().startsWith(MARCA);
}

// Comentarios nuevos desde el último procesado. Devuelve los del usuario (del
// más antiguo al más nuevo) y el id del último comentario de la tarjeta.
// El baseline es el id: si un comentario llega mientras corre el agente, queda
// detrás de la respuesta del agente y aun así se procesa en la pasada siguiente.
// Con estado antiguo (sin id) se usa el contador como respaldo.
async function comentariosNuevos(idTarjeta, previo, actuales) {
  const acciones = await api(`/cards/${idTarjeta}/actions`, {
    consulta: { filter: 'commentCard', limit: 20 },
  });
  const lista = Array.isArray(acciones) ? acciones : [];
  const ultimoId = lista[0]?.id ?? null;

  let candidatos;
  if (previo.ultimoComentario) {
    const i = lista.findIndex((a) => a.id === previo.ultimoComentario);
    candidatos = i === -1 ? lista.slice(0, 1) : lista.slice(0, i);
  } else {
    const delta = Math.max(0, actuales - (previo.comments ?? 0));
    candidatos = delta > 0 ? lista.slice(0, Math.min(delta, lista.length)) : [];
  }

  const nuevos = candidatos
    .filter((a) => !esComentarioDelAgente(a?.data?.text))
    .reverse();

  return { nuevos, candidatos, ultimoId };
}

// Espera de agrupación: cuando hay comentarios nuevos espera unos segundos y
// vuelve a leer. Los que hayan llegado entretanto se suman al mismo encargo, así
// el agente hace **un solo plan para todos** en vez de uno por comentario.
async function agruparComentarios(t, previo, iniciales) {
  if (!AGRUPAR_MS) return iniciales;
  log(`⏳ ${AGRUPAR_MS / 1000} s para agrupar más comentarios en`, t.name);
  await new Promise((r) => setTimeout(r, AGRUPAR_MS));
  const actuales = await contarComentarios(t.id);
  const { nuevos } = await comentariosNuevos(t.id, previo, actuales);
  const vistos = new Set(iniciales.map((a) => a.id));
  const todos = [...iniciales, ...nuevos.filter((a) => !vistos.has(a.id))];
  if (todos.length > iniciales.length) {
    log(`   agrupados ${todos.length} comentarios en un solo encargo`);
  }
  return todos.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Estado antiguo sin `ultimoComentario` (o tarjeta recién añadida al estado): se
// alinea con lo último que haya en la tarjeta para no reenviar comentarios ya
// atendidos al arrancar.
async function alinearBaselines(estado) {
  const { tarjetas } = await snapshot();
  for (const t of tarjetas.filter((x) => esVigilada(x.lista))) {
    const previo = estado.cards[t.id];
    if (!previo || previo.ultimoComentario) continue;
    const actuales = t.badges?.comments ?? 0;
    const { ultimoId } = await comentariosNuevos(t.id, { comments: previo.comments ?? 0 }, actuales);
    previo.ultimoComentario = ultimoId;
    previo.comments = actuales;
    log('baseline alineado:', String(t.name).slice(0, 50));
  }
}

// ---------------------------------------------------------------------------
// Sesión de OpenCode por tarjeta
// ---------------------------------------------------------------------------

function tituloSesion(t) {
  const nombre = String(t.name || '').replace(/\s+/g, ' ').trim();
  return `Trello: ${nombre.length > 60 ? nombre.slice(0, 57).trimEnd() + '…' : nombre}`;
}

function pideNuevaSesion(t) {
  if (!NUEVA_SESION) return false;
  return (
    NUEVA_SESION === '1' ||
    NUEVA_SESION === 'todas' ||
    NUEVA_SESION === 'all' ||
    NUEVA_SESION === t.id ||
    NUEVA_SESION === t.shortLink
  );
}

// Id fijo por tarjeta: la sesión se crea la primera vez y se continúa siempre.
// Con `--nueva-sesion` se estrena una (sufijo aleatorio) una sola vez por proceso.
function sesionDe(t, previo) {
  const quiere = pideNuevaSesion(t);
  if (previo.sesion && !(quiere && !SESIONES_REFRESCADAS.has(t.id))) return previo.sesion;
  const base = `ses_trello_${t.id}`;
  const id = previo.sesion ? `${base}_${Math.random().toString(36).slice(2, 8)}` : base;
  if (quiere) SESIONES_REFRESCADAS.add(t.id);
  return id;
}

// ---------------------------------------------------------------------------
// Estado y lock
// ---------------------------------------------------------------------------

function leerEstado() {
  if (!existsSync(ESTADO)) return { cards: {} };
  try {
    const datos = JSON.parse(readFileSync(ESTADO, 'utf8'));
    return { cards: datos.cards || {}, ...datos };
  } catch {
    return { cards: {} };
  }
}

function guardarEstado(estado) {
  writeFileSync(ESTADO, JSON.stringify(estado, null, 2), 'utf8');
}

function procesoVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tomarLock() {
  if (existsSync(LOCK)) {
    let pid = null;
    try {
      pid = JSON.parse(readFileSync(LOCK, 'utf8')).pid;
    } catch {
      /* lock corrupto: se reescribe abajo */
    }
    if (pid && procesoVivo(pid)) {
      console.error(`Ya hay otro watcher corriendo (pid ${pid}). Sale.`);
      process.exit(0);
    }
  }
  writeFileSync(LOCK, JSON.stringify({ pid: process.pid, inicio: new Date().toISOString() }), 'utf8');
}

// ---------------------------------------------------------------------------
// Agente
// ---------------------------------------------------------------------------

function promptNuevaTarjeta(t) {
  return [
    'Has detectado una tarjeta nueva en el tablero de Trello del proyecto Acordes Gaditanos.',
    '',
    `Título: ${t.name}`,
    `Enlace: https://trello.com/c/${t.shortLink}`,
    `ID: ${t.id}`,
    '',
    'Sigue la skill `trello`:',
    `1. Léela entera: \`npm run trello -- ver ${t.id}\`.`,
    `2. Pásala a «En curso»: \`npm run trello -- empezar ${t.id}\`.`,
    '3. Escribe el plan (objetivo, cambios archivo por archivo, pasos, comprobación, riesgos y dudas) y coméntalo en la tarjeta con `npm run trello -- comentar <id> --texto-archivo .cache/plan-trello.md`.',
    '4. PARA. No implementes nada todavía: espera a que el usuario apruebe el plan con un comentario en la tarjeta.',
    '',
    `Reglas: trabaja en local (sin commit ni push). No uses el puerto 4321 (es del usuario); si necesitas servidor, 4322/4323/4324. Mensajes y comentarios en español. Todos tus comentarios en Trello deben empezar con «${MARCA}» para distinguirlos de los del usuario.`,
  ].join('\n');
}

function promptNuevoComentario(t, texto) {
  const comentario = String(texto || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, 1500);
  return [
    'El usuario ha comentado en una tarjeta de Trello del proyecto Acordes Gaditanos.',
    '',
    `Tarjeta: ${t.name}`,
    `Enlace: https://trello.com/c/${t.shortLink}`,
    `ID: ${t.id}`,
    `Comentario nuevo: «${comentario}»`,
    '',
    'Decide qué hacer según el comentario:',
    '- Si el encargo trae **varios comentarios** (van separados por «---»), léelos todos juntos y haz **un solo plan** que los cubra todos. No los apliques uno a uno ni pidas aprobación por separado.',
    '- Si es una aprobación del plan ("adelante", "dale", "implementa", "hazlo"): implementa el plan siguiendo AGENTS.md y la skill correspondiente, verifica (`npm run astro check` y los auditores que apliquen) y comenta el resultado en la tarjeta. Si el plan no está visible, léelo antes con `npm run trello -- ver <id>`. No hagas commit ni push salvo que el usuario lo pida explícitamente.',
    '- Si pide cambios o correcciones al plan: reescribe el plan, coméntalo en la tarjeta y vuelve a parar.',
    '- Si es otra cosa (una pregunta, un "ok", información): respóndele en un comentario de la tarjeta y no toques nada más.',
    '',
    `Reglas: trabaja en local (sin commit ni push). No uses el puerto 4321 (es del usuario); si necesitas servidor, 4322/4323/4324. Mensajes y comentarios en español. Todos tus comentarios en Trello deben empezar con «${MARCA}» para distinguirlos de los del usuario.`,
  ].join('\n');
}

function ejecutarAgente(prompt, t, previo) {
  const sesion = sesionDe(t, previo);
  previo.sesion = sesion;
  return new Promise((resolver) => {
    log('arrancando agente', MODELO, '· sesión', sesion);
    const hijo = spawn(
      'opencode',
      [
        'run',
        '--standalone',
        '--auto',
        '--model',
        MODELO,
        '--session',
        sesion,
        '--title',
        tituloSesion(t),
        prompt,
      ],
      { cwd: RAIZ, stdio: 'inherit' },
    );
    hijo.on('error', (e) => {
      console.error('No se pudo arrancar el agente:', e.message);
      resolver();
    });
    hijo.on('close', (codigo) => {
      log('agente terminado (código', codigo ?? '?', ')');
      resolver();
    });
  });
}

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------

async function pasada(estado, primera) {
  const { tarjetas } = await snapshot();
  const vigiladas = tarjetas
    .filter((t) => esVigilada(t.lista))
    .sort(
      (a, b) =>
        rangoDe(a, estado.cards[a.id]) - rangoDe(b, estado.cards[b.id]) ||
        compararAntiguedad(a, b),
    );

  log(
    `pasada${primera ? ' (primera)' : ''}: ${tarjetas.length} tarjetas abiertas, ` +
      `${vigiladas.length} en la cola`,
  );
  for (const t of vigiladas) {
    log(`   · [${t.lista}] ${String(t.name).slice(0, 45)}`);
  }

  for (const t of vigiladas) {
    const previo = estado.cards[t.id];
    const actuales = t.badges?.comments ?? 0;

    if (!previo) {
      if (primera) {
        // Primera pasada: registrar el estado actual sin disparar nada. Se
        // apunta el id del último comentario para no procesarlo luego.
        const { ultimoId } = await comentariosNuevos(t.id, { comments: actuales }, actuales);
        estado.cards[t.id] = {
          comments: actuales,
          nombre: t.name,
          sesion: sesionDe(t, {}),
          ultimoComentario: ultimoId,
        };
        continue;
      }
      // Tarjeta nueva desde la última pasada.
      log('🆕 tarjeta nueva:', t.name);
      const ficha = { comments: actuales, nombre: t.name, sesion: sesionDe(t, {}) };
      if (!SECO) {
        await ejecutarAgente(promptNuevaTarjeta(t), t, ficha);
        const ahora = await contarComentarios(t.id);
        const { nuevos, ultimoId } = await comentariosNuevos(t.id, ficha, ahora);
        ficha.comments = ahora;
        // Si el usuario comentó mientras corría el agente, el baseline se queda
        // en su comentario para que la pasada siguiente lo procese.
        ficha.ultimoComentario = nuevos.length ? nuevos[nuevos.length - 1].id : ultimoId;
      }
      estado.cards[t.id] = ficha;
      continue;
    }

    if (!previo.sesion) previo.sesion = sesionDe(t, {});

    // ¿Hay algo que mirar? El contador manda para no pegar una llamada por
    // tarjeta y pasada; el id del comentario cierra los empates.
    const sinNovedad = actuales === (previo.comments ?? 0);
    if (sinNovedad && (previo.ultimoComentario || actuales === 0)) {
      previo.nombre = t.name;
      continue;
    }

    const { nuevos, candidatos, ultimoId } = await comentariosNuevos(t.id, previo, actuales);
    previo.comments = actuales;
    previo.nombre = t.name;

    if (!nuevos.length) {
      // Solo respuestas mías (o nada): se avanza el baseline sin gastar sesión.
      if ((candidatos.length || !previo.ultimoComentario) && ultimoId) {
        previo.ultimoComentario = ultimoId;
      }
      continue;
    }

    const lote = await agruparComentarios(t, previo, nuevos);
    const texto = lote.map((a) => a.data?.text || '').join('\n\n---\n\n');
    log(
      `💬 ${lote.length} comentario(s) del usuario en`,
      t.name,
      ':',
      texto.slice(0, 80),
    );
    if (!SECO) {
      await ejecutarAgente(promptNuevoComentario(t, texto), t, previo);
    }
    // Baseline = comentario más nuevo procesado (no la respuesta del agente), así
    // un comentario que llegue mientras corre se recoge en la pasada siguiente.
    previo.ultimoComentario = lote[lote.length - 1].id;
  }
}

async function main() {
  if (AYUDA) {
    console.log(
      [
        'trello-watch — vigila el tablero y arranca un agente headless ante lo nuevo.',
        '',
        '  node scripts/trello-watch.mjs            vigilar en bucle (cada 30 s)',
        '  node scripts/trello-watch.mjs --una-vez  una sola pasada',
        '  node scripts/trello-watch.mjs --seco     no arranca agente, solo avisa',
        '',
        '  --nueva-sesion [id|shortLink]   estrena sesión limpia en la próxima pasada',
        '                                  (sin valor, vale para cualquier tarjeta)',
        '',
        '  Atiende la cola en este orden:',
        '    1) En curso con comentario nuevo  2) Prioritarias  3) Pendiente',
        '    y dentro de cada tramo, la más antigua primero.',
        '',
        '  Los comentarios seguidos se agrupan en un solo encargo (un plan para todos).',
        '',
        'Env: TRELLO_WATCH_INTERVALO (segundos, 30), TRELLO_WATCH_AGRUPAR (segundos de agrupación, 45), TRELLO_WATCH_MARCA (prefijo de los comentarios del agente, por defecto 🤖), TRELLO_WATCH_SESION_NUEVA (id de tarjeta o `1`), TRELLO_LISTA_PRIORITARIAS (por defecto «Prioritarias»). Una sesión de OpenCode por tarjeta: ses_trello_<idTarjeta>. Modelo: opencode-go/deepseek-v4.1-flash.',
      ].join('\n'),
    );
    return;
  }

  faltanCredenciales();
  tomarLock();

  const estado = leerEstado();
  const primera = Object.keys(estado.cards).length === 0;
  if (!SECO) {
    try {
      await alinearBaselines(estado);
      guardarEstado(estado);
    } catch (e) {
      console.error('no se pudo alinear el baseline:', e.message);
    }
  }

  log(
    `arrancando (${UNA_VEZ ? 'una vez' : 'bucle a ' + INTERVALO_MS / 1000 + ' s'}` +
      `${SECO ? ', seco' : ''}${NUEVA_SESION ? ', nueva sesión: ' + NUEVA_SESION : ''})`,
  );

  do {
    try {
      await pasada(estado, primera);
      if (!SECO) guardarEstado(estado);
    } catch (e) {
      console.error('error en la pasada:', e.message);
    }
    if (!UNA_VEZ) await new Promise((r) => setTimeout(r, INTERVALO_MS));
  } while (!UNA_VEZ);

  log('fin.');
}

main();
