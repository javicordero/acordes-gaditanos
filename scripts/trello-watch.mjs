#!/usr/bin/env node
/**
 * Trello watcher — vigila el tablero y, cuando aparece una tarjeta nueva o un
 * comentario nuevo del usuario, arranca un agente headless (`opencode run`) que
 * responde en la tarjeta siguiendo la skill `trello`.
 *
 * Diseño:
 *   - Sondea la API de Trello cada N segundos (por defecto 60). El sondeo NO
 *     cuesta tokens: es Node puro pegando llamadas a la API.
 *   - Detecta tarjetas nuevas en «Pendiente»/«En curso» y comentarios nuevos.
 *   - La primera pasada solo registra el estado actual y NO dispara nada: así no
 *     procesa de golpe las tarjetas que ya hubiera al arrancar.
 *   - Tras cada agente se relee el nº de comentarios de la tarjeta para no
 *     volver a disparar con la respuesta del propio agente.
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
 * Env (opcional): TRELLO_WATCH_INTERVALO (segundos, por defecto 60).
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
const INTERVALO_MS = (parseInt(process.env.TRELLO_WATCH_INTERVALO || '60', 10) || 60) * 1000;
// Prefijo que el agente pone al principio de sus comentarios para distinguirlos
// de los del usuario. Sirve también para que el watcher ignore sus respuestas.
const MARCA = process.env.TRELLO_WATCH_MARCA || '🤖';

const UNA_VEZ = process.argv.includes('--una-vez');
const SECO = process.argv.includes('--seco');
const AYUDA = process.argv.includes('--ayuda') || process.argv.includes('--help');

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

function esVigilada(nombreLista) {
  const clave = sinTildes(nombreLista);
  return (
    clave === sinTildes(NOMBRES.pendiente) || clave === sinTildes(NOMBRES.curso)
  );
}

async function contarComentarios(idTarjeta) {
  const c = await api(`/cards/${idTarjeta}`, { consulta: { fields: 'badges' } });
  return c?.badges?.comments ?? 0;
}

function esComentarioDelAgente(texto) {
  return String(texto || '').trim().startsWith(MARCA);
}

// Último comentario que NO es del agente (el del usuario). Devuelve null si los
// comentarios recientes son todos del agente.
async function ultimoComentarioUsuario(idTarjeta) {
  const acciones = await api(`/cards/${idTarjeta}/actions`, {
    consulta: { filter: 'commentCard', limit: 8 },
  });
  if (!Array.isArray(acciones)) return null;
  for (const a of acciones) {
    const texto = a?.data?.text || '';
    if (!esComentarioDelAgente(texto)) return texto;
  }
  return null;
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
    '- Si es una aprobación del plan ("adelante", "dale", "implementa", "hazlo"): implementa el plan siguiendo AGENTS.md y la skill correspondiente, verifica (`npm run astro check` y los auditores que apliquen) y comenta el resultado en la tarjeta. Si el plan no está visible, léelo antes con `npm run trello -- ver <id>`. No hagas commit ni push salvo que el usuario lo pida explícitamente.',
    '- Si pide cambios o correcciones al plan: reescribe el plan, coméntalo en la tarjeta y vuelve a parar.',
    '- Si es otra cosa (una pregunta, un "ok", información): respóndele en un comentario de la tarjeta y no toques nada más.',
    '',
    `Reglas: trabaja en local (sin commit ni push). No uses el puerto 4321 (es del usuario); si necesitas servidor, 4322/4323/4324. Mensajes y comentarios en español. Todos tus comentarios en Trello deben empezar con «${MARCA}» para distinguirlos de los del usuario.`,
  ].join('\n');
}

function ejecutarAgente(prompt) {
  return new Promise((resolver) => {
    log('arrancando agente', MODELO);
    const hijo = spawn(
      'opencode',
      ['run', '--standalone', '--auto', '--model', MODELO, prompt],
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
  const vigiladas = tarjetas.filter((t) => esVigilada(t.lista));

  log(
    `pasada${primera ? ' (primera)' : ''}: ${tarjetas.length} tarjetas abiertas, ` +
      `${vigiladas.length} en Pendiente/En curso`,
  );

  for (const t of vigiladas) {
    const previo = estado.cards[t.id];

    if (!previo) {
      if (primera) {
        // Primera pasada: registrar el estado actual sin disparar nada.
        estado.cards[t.id] = { comments: t.badges?.comments ?? 0, nombre: t.name };
        continue;
      }
      // Tarjeta nueva desde la última pasada.
      log('🆕 tarjeta nueva:', t.name);
      if (!SECO) {
        await ejecutarAgente(promptNuevaTarjeta(t));
        estado.cards[t.id] = { comments: await contarComentarios(t.id), nombre: t.name };
      }
      continue;
    }

    const actuales = t.badges?.comments ?? 0;
    if (actuales > previo.comments) {
      const ultimo = await ultimoComentarioUsuario(t.id);
      if (!ultimo) {
        // Solo comentarios del agente: re-baseline sin disparar.
        estado.cards[t.id].comments = actuales;
        continue;
      }
      log('💬 comentario del usuario en', t.name, ':', String(ultimo).slice(0, 80));
      if (!SECO) {
        await ejecutarAgente(promptNuevoComentario(t, ultimo));
        estado.cards[t.id].comments = await contarComentarios(t.id);
      }
    }
  }
}

async function main() {
  if (AYUDA) {
    console.log(
      [
        'trello-watch — vigila el tablero y arranca un agente headless ante lo nuevo.',
        '',
        '  node scripts/trello-watch.mjs            vigilar en bucle (cada 60 s)',
        '  node scripts/trello-watch.mjs --una-vez  una sola pasada',
        '  node scripts/trello-watch.mjs --seco     no arranca agente, solo avisa',
        '',
        'Env: TRELLO_WATCH_INTERVALO (segundos), TRELLO_WATCH_MARCA (prefijo de los comentarios del agente, por defecto 🤖). Modelo: opencode-go/deepseek-v4.1-flash.',
      ].join('\n'),
    );
    return;
  }

  faltanCredenciales();
  tomarLock();

  const estado = leerEstado();
  const primera = Object.keys(estado.cards).length === 0;

  log(
    `arrancando (${UNA_VEZ ? 'una vez' : 'bucle a ' + INTERVALO_MS / 1000 + ' s'}` +
      `${SECO ? ', seco' : ''})`,
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
