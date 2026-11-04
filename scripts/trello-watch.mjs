#!/usr/bin/env node
/**
 * Trello watcher — vigila el tablero y, cuando aparece una tarjeta nueva o un
 * comentario nuevo del usuario, arranca un agente headless (`opencode run`) que
 * responde en la tarjeta siguiendo la skill `trello`.
 *
 * Diseño:
 *   - Sondea la API de Trello cada N segundos (por defecto 10). El sondeo NO
 *     cuesta tokens: es Node puro pegando llamadas a la API (una petición y
 *     ~0,4 s por pasada), y el límite de Trello está muy por encima.
 *   - Si una pasada arranca un agente, la siguiente va enseguida (2 s por
 *     defecto) para vaciar la cola sin esperar el intervalo entero.
 *   - Detecta tarjetas nuevas en «En curso», «Prioritarias» y «Pendiente», y
 *     comentarios nuevos.
 *   - Cola por tramos: primero las de «En curso» con comentario nuevo, después
 *     «Prioritarias» y después «Pendiente». Las de «En curso» se ordenan por su
 *     posición en la columna (arriba primero); «Prioritarias» y «Pendiente» por
 *     fecha de creación (la más antigua primero, porque Trello apila las nuevas
 *     arriba de la columna).
 *   - Una planificación por pasada: la primera tarjeta de la cola que no tenga
 *     plan (nueva, salida de Despriorizadas o registrada sin planificar) se
 *     planifica sola; las demás esperan a la pasada siguiente.
 *   - Varios comentarios seguidos = un solo encargo: antes de arrancar el agente
 *     se espera a que el usuario lleve `TRELLO_WATCH_SILENCIO` segundos (8) sin
 *     comentar (comprobando cada 2 s) y se leen todos juntos, para que haga un
 *     plan único y no uno por comentario. `TRELLO_WATCH_AGRUPAR` (45) es el tope
 *     de la espera, no una espera fija: quien comenta seguido arranca en 8 s.
 *   - **Despriorizadas**: columna que no se toca nunca. Si una tarjeta sale de
 *     ahí a Pendiente/Prioritarias, cuenta como nueva y se planifica.
 *   - **Subir ficha**: columna de fichas listas para publicar. No se planifica
 *     nada: crear la tarjeta no hace nada. Solo cuando el usuario comenta (una
 *     orden de subir) se lanza `scripts/subir-ficha.mjs`, que publica la copla
 *     con la mecánica de la skill `subir-acorde`, comenta el resultado y mueve
 *     la tarjeta a «Subidas». Sin orden en el comentario, no se publica nada.
 *     Un comentario del usuario que se quede sin respuesta se atiende igual,
 *     aunque el baseline ya lo hubiera dado por visto (tarjeta creada y
 *     comentada entre dos pasadas).
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
 *   TRELLO_WATCH_INTERVALO       segundos entre pasadas (por defecto 10)
 *   TRELLO_WATCH_REPOSO          segundos entre pasadas cuando la anterior ha
 *                                arrancado un agente (por defecto 2)
 *   TRELLO_WATCH_SILENCIO        segundos sin comentarios nuevos para dejar de
 *                                agrupar y arrancar el agente (por defecto 8)
 *   TRELLO_WATCH_AGRUPAR         tope en segundos de esa espera (por defecto 45)
 *   TRELLO_LISTA_PRIORITARIAS    nombre de la columna (por defecto «Prioritarias»)
 *   TRELLO_LISTA_DESPRIORIZADAS  nombre de la columna (por defecto «Despriorizadas»)
 *   TRELLO_LISTA_SUBIR           columna de fichas por subir («Subir ficha»)
 *   TRELLO_LISTA_SUBIDAS         columna de fichas subidas («Subidas»)
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
const INTERVALO_MS = (parseInt(process.env.TRELLO_WATCH_INTERVALO || '10', 10) || 10) * 1000;
// Espera entre pasadas cuando la anterior ha arrancado un agente: la cola se
// vacía sin pagar el intervalo entero por cada tarjeta. Suelo de 1 s para no
// machacar la API si alguien lo pone a cero.
const REPOSO_MS = Math.max(
  1000,
  (parseInt(process.env.TRELLO_WATCH_REPOSO || '2', 10) || 0) * 1000,
);
// Agrupación de comentarios: se espera a que el usuario lleve SILENCIO_MS sin
// escribir (comprobando cada PASO_MS) y AGRUPAR_MS es el tope de la espera, no
// una espera fija. Antes eran 45 s siempre. 0 en cualquiera de las dos desactiva
// la espera y se arranca con lo que haya.
const SILENCIO_MS = Math.max(
  0,
  (parseInt(process.env.TRELLO_WATCH_SILENCIO || '8', 10) || 0) * 1000,
);
const AGRUPAR_MS = Math.max(
  0,
  (parseInt(process.env.TRELLO_WATCH_AGRUPAR || '45', 10) || 0) * 1000,
);
const PASO_MS = 2000;
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
  despriorizada:
    process.env.TRELLO_LISTA_DESPRIORIZADAS ||
    ENV.TRELLO_LISTA_DESPRIORIZADAS ||
    'Despriorizadas',
  curso: process.env.TRELLO_LISTA_CURSO || ENV.TRELLO_LISTA_CURSO || 'En curso',
  final: process.env.TRELLO_LISTA_FINAL || ENV.TRELLO_LISTA_FINAL || 'Finalizado',
  subir: process.env.TRELLO_LISTA_SUBIR || ENV.TRELLO_LISTA_SUBIR || 'Subir ficha',
  subidas: process.env.TRELLO_LISTA_SUBIDAS || ENV.TRELLO_LISTA_SUBIDAS || 'Subidas',
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

// Columna donde el usuario aparca lo que no quiere que se toque: no se atiende
// nunca, ni al planificar ni al implementar. Si saca una tarjeta de ahí a
// Pendiente o Prioritarias, cuenta como nueva y sí se planifica.
function esDespriorizada(nombreLista) {
  return Boolean(nombreLista) && sinTildes(nombreLista) === sinTildes(NOMBRES.despriorizada);
}

// Columna de fichas listas para publicar. Igual que Despriorizadas, no entra en
// la cola de planificación: sacar el agente cuesta tokens y aquí lo que hay es
// una orden mecánica («sube esta ficha»). Solo se atiende cuando hay comentario.
function esSubir(nombreLista) {
  return Boolean(nombreLista) && sinTildes(nombreLista) === sinTildes(NOMBRES.subir);
}

function esSubidas(nombreLista) {
  return Boolean(nombreLista) && sinTildes(nombreLista) === sinTildes(NOMBRES.subidas);
}

// ¿Hay que planificarla? Solo las de la cola (Pendiente/Prioritarias), y solo si
// no tienen plan todavía o si acaban de salir de Despriorizadas. Las de «En
// curso» se atienden por comentarios, no se vuelven a planificar.
function necesitaPlan(t, previo) {
  const clave = sinTildes(t.lista);
  const enCola =
    clave === sinTildes(NOMBRES.pendiente) || clave === sinTildes(NOMBRES.prioritaria);
  if (!enCola) return false;
  if (!previo) return true;
  if (esDespriorizada(previo.lista)) return true;
  return !previo.planificado;
}

function etiquetaPlan(t, previo) {
  if (!previo) return '🆕 tarjeta nueva:';
  if (esDespriorizada(previo.lista)) return '🔁 vuelve de Despriorizadas:';
  return '📝 sin plan todavía:';
}

// Orden de la cola:
//   0 · En curso con comentario nuevo del usuario (algo que corregir)
//   1 · Prioritarias
//   2 · Pendiente
//   3 · En curso sin novedades (solo se refresca el nombre)
// Dentro de «En curso», por posición en la columna (arriba primero); en
// «Prioritarias» y «Pendiente», la más antigua primero (ver compararCola).
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

// Orden dentro de cada tramo de la cola (ver rangoDe):
//   - «En curso» (con o sin novedad): por posición en la columna, de arriba abajo.
//     El usuario mantiene esa columna como una cola: arriba lo que toca atender
//     antes, abajo lo que acaba de entrar (los movimientos dejan la tarjeta al
//     final de la columna).
//   - «Prioritarias» y «Pendiente»: por fecha de creación, la más antigua primero,
//     porque Trello apila las tarjetas nuevas arriba y ahí la posición no refleja
//     el orden de llegada.
function compararCola(a, b, estado) {
  const ra = rangoDe(a, estado.cards[a.id]);
  const rb = rangoDe(b, estado.cards[b.id]);
  if (ra !== rb) return ra - rb;
  if (ra === 0 || ra === 3) return (a.pos ?? 0) - (b.pos ?? 0);
  return compararAntiguedad(a, b);
}

async function contarComentarios(idTarjeta) {
  const c = await api(`/cards/${idTarjeta}`, { consulta: { fields: 'badges' } });
  return c?.badges?.comments ?? 0;
}

function esComentarioDelAgente(texto) {
  return String(texto || '').trim().startsWith(MARCA);
}

// ¿El último comentario de la tarjeta es del usuario? Entonces hay una orden (o
// una pregunta) que todavía no se ha contestado. Se usa en «Subir ficha», donde
// el baseline por id puede quedarse por delante: si la tarjeta se crea y se
// comenta entre dos pasadas, al registrarla se apuntaba su comentario como «ya
// visto» y no se atendía nunca (un «sube» se perdía sin más).
async function pendienteDeRespuesta(idTarjeta) {
  const acciones = await api(`/cards/${idTarjeta}/actions`, {
    consulta: { filter: 'commentCard', limit: 1 },
  });
  const ultimo = Array.isArray(acciones) ? acciones[0] : null;
  return Boolean(ultimo) && !esComentarioDelAgente(ultimo?.data?.text);
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

// Espera de agrupación: cuando hay comentarios nuevos se espera a que el usuario
// lleve un rato sin escribir y se vuelve a leer. Los que hayan llegado entretanto
// se suman al mismo encargo, así el agente hace **un solo plan para todos** en
// vez de uno por comentario. No es una espera fija: AGRUPAR_MS es el tope.
async function agruparComentarios(t, previo, iniciales) {
  const todos = [...iniciales];
  if (!SILENCIO_MS || !AGRUPAR_MS) return todos;

  const vistos = new Set(iniciales.map((a) => a.id));
  const inicio = Date.now();
  let ultimo = inicio;
  log(
    `⏳ hasta ${SILENCIO_MS / 1000} s de silencio para agrupar más comentarios en`,
    t.name,
    `(tope ${AGRUPAR_MS / 1000} s)`,
  );

  while (true) {
    const espera = Math.min(
      SILENCIO_MS - (Date.now() - ultimo),
      AGRUPAR_MS - (Date.now() - inicio),
    );
    if (espera <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(PASO_MS, espera)));

    // Con baseline por id basta una llamada; el contador solo hace falta en
    // estados antiguos, que no lo tienen.
    const actuales = previo.ultimoComentario ? 0 : await contarComentarios(t.id);
    const { nuevos } = await comentariosNuevos(t.id, previo, actuales);
    const añadidos = nuevos.filter((a) => !vistos.has(a.id));
    if (añadidos.length) {
      for (const a of añadidos) vistos.add(a.id);
      todos.push(...añadidos);
      ultimo = Date.now();
      log(`   ${todos.length} comentarios en el encargo`);
    }
  }

  if (todos.length > iniciales.length) {
    log(`   agrupados ${todos.length} comentarios en un solo encargo`);
  }
  return todos.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Estado antiguo sin `ultimoComentario` (o tarjeta recién añadida al estado): se
// alinea lo que falte para no reenviar comentarios ya atendidos ni volver a
// planificar lo que ya tiene plan.
async function alinearEstado(estado) {
  const { tarjetas } = await snapshot();
  for (const t of tarjetas.filter((x) => esVigilada(x.lista))) {
    const previo = estado.cards[t.id];
    if (!previo) continue;
    const actuales = t.badges?.comments ?? 0;

    if (!previo.ultimoComentario) {
      const { ultimoId } = await comentariosNuevos(
        t.id,
        { comments: previo.comments ?? 0 },
        actuales,
      );
      previo.ultimoComentario = ultimoId;
      previo.comments = actuales;
      log('baseline alineado:', String(t.name).slice(0, 50));
    }

    // Estado de antes de la marca `planificado`: se da por planificada si algún
    // agente ya comentó algo en la tarjeta (sus comentarios llevan la marca).
    if (typeof previo.planificado !== 'boolean') {
      const acciones = await api(`/cards/${t.id}/actions`, {
        consulta: { filter: 'commentCard', limit: 100 },
      });
      const lista = Array.isArray(acciones) ? acciones : [];
      previo.planificado = lista.some((a) => esComentarioDelAgente(a?.data?.text));
      log(
        previo.planificado ? 'ya planificada:' : 'pendiente de plan:',
        String(t.name).slice(0, 50),
      );
    }
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
    'Si el título o la descripción es una petición de letra (por ejemplo «nueva letra comparsa el cementerio» o «pasodoble el cementerio», o trae una letra o una URL), NO hagas el plan genérico: pásala a «En curso» y sigue el apartado «Tarjetas de letras» de la skill `trello`. Reconoce la copla con `npm run letras -- reconocer`, apúntala en `letras-pendientes.md`, busca y formatea la letra con los acordes de la ficha base y déjala en «Por revisar» del panel. Hazlo directamente, sin esperar aprobación; para y pregunta en la tarjeta solo si falta la base, no encuentras la letra o hay varias candidatas. El barrido de la cola de letras es otra tarea: no lo hagas aquí.',
    '',
    'Para el resto de tarjetas, sigue la skill `trello`:',
    `1. Léela entera: \`npm run trello -- ver ${t.id}\`.`,
    `2. Pásala a «En curso»: \`npm run trello -- empezar ${t.id}\`.`,
    '3. Escribe el plan (objetivo, cambios archivo por archivo, pasos, comprobación, riesgos y dudas) y coméntalo en la tarjeta con `npm run trello -- comentar <id> --texto-archivo .cache/plan-trello.md`.',
    '4. PARA. No implementes nada todavía: espera a que el usuario apruebe el plan con un comentario en la tarjeta.',
    '',
    `Reglas: trabaja en local y no hagas commit ni push salvo que el usuario lo pida explícitamente («haz commit y push»). No uses el puerto 4321 (es del usuario); si necesitas servidor, 4322/4323/4324. Mensajes y comentarios en español. Todos tus comentarios en Trello deben empezar con «${MARCA}» para distinguirlos de los del usuario.`,
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
    '- Si es una aprobación del plan ("adelante", "dale", "implementa", "hazlo"): si la tarjeta es de letras, haz el flujo de «Tarjetas de letras» de la skill `trello`; si es una tarea de código, implementa el plan siguiendo AGENTS.md y la skill correspondiente y verifica (`npm run astro check` y los auditores que apliquen). Al terminar, comenta «ya está implementado» y qué has hecho, y deja la tarjeta en «En curso»: no hagas commit ni push todavía y no la pases a «Finalizado». Si el plan no está visible, léelo antes con `npm run trello -- ver <id>`.',
    '- Si el usuario dice «haz commit y push» (o «sube», «publícalo»): haz el commit y el push (sigue la skill `subir-acorde` si toca) y después pasa la tarjeta a «Finalizado» con `npm run trello -- terminar <id> --commit <url-del-commit>`. Pasa la URL completa del commit (no solo el sha) en el comentario y en el chat.',
    '- Si el usuario dice «finaliza sin commit» (o la tarea no requiere commit, como las letras nuevas): pasa la tarjeta a «Finalizado» directamente con el resumen, sin commit.',
    '- Si pide el **barrido de la cola de letras** (pasar todas las pendientes por la skill y ponerles acordes), recuerda que es otra tarea: no lo hagas aquí y responde que se hará en su tarjeta.',
    '- Si pide cambios o correcciones al plan: reescribe el plan, coméntalo en la tarjeta y vuelve a parar.',
    '- Si es otra cosa (una pregunta, un "ok", información): respóndele en un comentario de la tarjeta y no toques nada más.',
    '',
    `Reglas: trabaja en local y no hagas commit ni push salvo que el usuario lo pida explícitamente («haz commit y push»). No uses el puerto 4321 (es del usuario); si necesitas servidor, 4322/4323/4324. Mensajes y comentarios en español. Todos tus comentarios en Trello deben empezar con «${MARCA}» para distinguirlos de los del usuario.`,
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

function ejecutarSubida(t, texto) {
  return new Promise((resolver) => {
    log('📤 publicando la ficha de', t.name);
    const hijo = spawn(
      process.execPath,
      ['scripts/subir-ficha.mjs', '--tarjeta', t.id, '--comentario', texto],
      { cwd: RAIZ, stdio: 'inherit' },
    );
    hijo.on('error', (e) => {
      console.error('No se pudo lanzar subir-ficha:', e.message);
      resolver();
    });
    hijo.on('close', (codigo) => {
      log('subir-ficha terminado (código', codigo ?? '?', ')');
      resolver();
    });
  });
}

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------

async function pasada(estado, primera) {
  const { tarjetas } = await snapshot();
  let trabajo = false;

  // Despriorizadas: no se tocan nunca. Solo se apunta en qué columna están, para
  // saber si más adelante las pasan a Pendiente o Prioritarias (entonces sí
  // cuentan como nuevas y se planifican). Se apunta igual para cualquier columna
  // fuera de la cola (Finalizado incluido), así el cambio se detecta.
  for (const t of tarjetas) {
    if (esVigilada(t.lista)) continue;
    const previo = estado.cards[t.id];
    if (previo) previo.lista = t.lista;
  }

  const vigiladas = tarjetas
    .filter((t) => esVigilada(t.lista))
    .sort((a, b) => compararCola(a, b, estado));

  // «Subir ficha»: aquí no se planifica nunca. La tarjeta recién creada se
  // registra y se queda quieta; solo un comentario del usuario dispara la
  // publicación (`scripts/subir-ficha.mjs`, que también comenta y mueve la
  // tarjeta a «Subidas»). Se atiende una por pasada.
  const porSubir = tarjetas
    .filter((t) => esSubir(t.lista))
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));

  for (const t of porSubir) {
    const actuales = t.badges?.comments ?? 0;
    let previo = estado.cards[t.id];
    const primeraVez = !previo;

    if (primeraVez) {
      // Se registra antes de decidir nada: crear la tarjeta no publica.
      previo = {
        comments: actuales,
        nombre: t.name,
        lista: t.lista,
        planificado: false,
        subir: true,
        ultimoComentario: null,
      };
      estado.cards[t.id] = previo;
    }

    previo.lista = t.lista;
    previo.nombre = t.name;

    // Arranque en frío (estado vacío): solo se apunta el baseline, así levantar
    // el watcher con tarjetas dentro no publica nada de golpe.
    if (primeraVez && primera) {
      const { ultimoId } = await comentariosNuevos(t.id, { comments: actuales }, actuales);
      previo.ultimoComentario = ultimoId;
      log('· [Subir ficha] registrada sin atender:', String(t.name).slice(0, 45));
      continue;
    }

    const sinNovedad = actuales === (previo.comments ?? 0);
    // El contador no cambia cuando el baseline se quedó por delante (tarjeta
    // creada y comentada entre dos pasadas): si el último comentario es del
    // usuario, sigue sin respuesta y hay que atenderlo.
    const sinAtender = sinNovedad && actuales > 0 ? await pendienteDeRespuesta(t.id) : false;
    if (sinNovedad && !sinAtender && (previo.ultimoComentario || actuales === 0)) {
      if (primeraVez) {
        log('· [Subir ficha] registrada, sin orden de subir:', String(t.name).slice(0, 45));
      }
      continue;
    }

    if (sinAtender) {
      log('· [Subir ficha] comentario sin responder:', String(t.name).slice(0, 45));
    }

    const base = sinAtender ? { comments: 0 } : previo;
    const { nuevos, candidatos, ultimoId } = await comentariosNuevos(t.id, base, actuales);
    previo.comments = actuales;

    if (!nuevos.length) {
      if ((candidatos.length || !previo.ultimoComentario) && ultimoId) {
        previo.ultimoComentario = ultimoId;
      }
      continue;
    }

    const lote = await agruparComentarios(t, previo, nuevos);
    const texto = lote.map((a) => a.data?.text || '').join('\n\n---\n\n');
    log(
      `📤 ${lote.length} comentario(s) en «${NOMBRES.subir}»:`,
      t.name,
      '·',
      texto.replace(/\s+/g, ' ').slice(0, 80),
    );
    if (!SECO) {
      await ejecutarSubida(t, texto);
    }
    // Baseline = último comentario del usuario procesado (no la respuesta del
    // script), así un comentario que llegue mientras corre se recoge después.
    previo.ultimoComentario = lote[lote.length - 1].id;
    return true; // una publicación por pasada
  }

  log(
    `pasada${primera ? ' (primera)' : ''}: ${tarjetas.length} tarjetas abiertas, ` +
      `${vigiladas.length} en la cola, ${porSubir.length} en «${NOMBRES.subir}», ` +
      `${tarjetas.filter((t) => esSubidas(t.lista)).length} en «${NOMBRES.subidas}»`,
  );
  // La lista de la cola solo se pinta cuando hay algo que hacer (o con
  // `--una-vez`): a 10 s de sondeo, si no, llena la consola todos los minutos.
  const hayAlgo =
    UNA_VEZ ||
    vigiladas.some(
      (t) => necesitaPlan(t, estado.cards[t.id]) || rangoDe(t, estado.cards[t.id]) === 0,
    );
  if (hayAlgo) {
    for (const t of vigiladas) {
      log(`   · [${t.lista}] ${String(t.name).slice(0, 45)}`);
    }
  }

  for (const t of vigiladas) {
    const previo = estado.cards[t.id];
    const actuales = t.badges?.comments ?? 0;

    // Planificar: una tarjeta por pasada y la primera de la cola. Entra aquí la
    // nueva, la que vuelve de Despriorizadas y la que nunca llegó a tener plan
    // (se quedó registrada sin que ningún agente la mirase).
    if (necesitaPlan(t, previo)) {
      log(etiquetaPlan(t, previo), t.name);
      const ficha = {
        comments: actuales,
        nombre: t.name,
        lista: t.lista,
        planificado: true,
        sesion: sesionDe(t, previo || {}),
      };
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
      return true; // una planificación por pasada: la siguiente, en la próxima
    }

    if (!previo) {
      // En curso sin estado: se registra sin lanzar nada; se atiende por
      // comentarios.
      const { ultimoId } = await comentariosNuevos(t.id, { comments: actuales }, actuales);
      estado.cards[t.id] = {
        comments: actuales,
        nombre: t.name,
        lista: t.lista,
        planificado: true,
        sesion: sesionDe(t, {}),
        ultimoComentario: ultimoId,
      };
      continue;
    }

    if (!previo.sesion) previo.sesion = sesionDe(t, {});
    previo.lista = t.lista;

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
    trabajo = true;
  }
  return trabajo;
}

async function main() {
  if (AYUDA) {
    console.log(
      [
        'trello-watch — vigila el tablero y arranca un agente headless ante lo nuevo.',
        '',
        '  node scripts/trello-watch.mjs            vigilar en bucle (cada 10 s)',
        '  node scripts/trello-watch.mjs --una-vez  una sola pasada',
        '  node scripts/trello-watch.mjs --seco     no arranca agente, solo avisa',
        '',
        '  --nueva-sesion [id|shortLink]   estrena sesión limpia en la próxima pasada',
        '                                  (sin valor, vale para cualquier tarjeta)',
        '',
        '  Atiende la cola en este orden:',
        '    1) En curso con comentario nuevo  2) Prioritarias  3) Pendiente',
        '    En «En curso», de arriba abajo de la columna; en Prioritarias y',
        '    Pendiente, la más antigua primero.',
        '',
        '  Los comentarios seguidos se agrupan en un solo encargo (un plan para todos).',
        '  Se planifica una tarjeta por pasada, la primera de la cola que no tenga plan.',
        '  La columna «Despriorizadas» no se toca nunca; si una tarjeta sale de ahí',
        '  a Pendiente o Prioritarias, se planifica como nueva.',
        '',
        '  «Subir ficha» es la columna de fichas listas para publicar: crear la tarjeta',
        '  no hace nada y solo un comentario con orden («sube», «súbelo», «publica»…)',
        '  publica la ficha con la mecánica de `subir-acorde` y mueve la tarjeta a',
        '  «Subidas». Modificadores: «sin tuit», «sin whatsapp», «sin etiquetar»,',
        '  «sin aviso».',
        '',
        '  Las tarjetas de letras («nueva letra…», «pasodoble…») se atienden directamente,',
        '  sin plan: se busca la letra, se ponen los acordes y se dejan en «Por revisar».',
        '',
        'Env: TRELLO_WATCH_INTERVALO (segundos entre pasadas, 10), TRELLO_WATCH_REPOSO (segundos tras arrancar un agente, 2), TRELLO_WATCH_SILENCIO (segundos de silencio para dejar de agrupar, 8), TRELLO_WATCH_AGRUPAR (tope de esa espera, 45), TRELLO_WATCH_MARCA (prefijo de los comentarios del agente, por defecto 🤖), TRELLO_WATCH_SESION_NUEVA (id de tarjeta o `1`), TRELLO_LISTA_PRIORITARIAS («Prioritarias»), TRELLO_LISTA_DESPRIORIZADAS («Despriorizadas»). Una sesión de OpenCode por tarjeta: ses_trello_<idTarjeta>. Modelo: opencode-go/deepseek-v4.1-flash.',
      ].join('\n'),
    );
    return;
  }

  faltanCredenciales();
  // `--seco` no escribe estado: no necesita el lock, así se puede probar una
  // pasada sin parar el watcher que esté corriendo.
  if (!SECO) tomarLock();

  const estado = leerEstado();
  const primera = Object.keys(estado.cards).length === 0;
  if (!SECO) {
    try {
      await alinearEstado(estado);
      guardarEstado(estado);
    } catch (e) {
      console.error('no se pudo alinear el baseline:', e.message);
    }
  }

  log(
    `arrancando (${UNA_VEZ ? 'una vez' : 'bucle a ' + INTERVALO_MS / 1000 + ' s'}` +
      `${UNA_VEZ ? '' : ', ' + REPOSO_MS / 1000 + ' s tras un agente'}` +
      `${SECO ? ', seco' : ''}${NUEVA_SESION ? ', nueva sesión: ' + NUEVA_SESION : ''})`,
  );

  do {
    let trabajo = false;
    try {
      trabajo = await pasada(estado, primera);
      if (!SECO) guardarEstado(estado);
    } catch (e) {
      console.error('error en la pasada:', e.message);
    }
    // Si la pasada ha arrancado un agente, la siguiente va enseguida para vaciar
    // la cola; si no, se espera el intervalo normal.
    if (!UNA_VEZ) {
      await new Promise((r) => setTimeout(r, trabajo ? REPOSO_MS : INTERVALO_MS));
    }
  } while (!UNA_VEZ);

  log('fin.');
}

main();
