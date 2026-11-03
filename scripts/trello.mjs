#!/usr/bin/env node
/**
 * Trello — leer y mover las tarjetas del tablero de Acordes Gaditanos.
 *
 * Credenciales (en `.env`, que está gitignored):
 *   TRELLO_KEY=...      clave de la Power-Up  → https://trello.com/power-ups/admin
 *   TRELLO_TOKEN=...    token con scope read,write
 *   TRELLO_TABLERO=...  id o nombre corto del tablero (por defecto vwbp5cJ5)
 *
 * Nombres de lista configurables si algún día se renombran las columnas:
 *   TRELLO_LISTA_PENDIENTE  (por defecto «Pendiente»)
 *   TRELLO_LISTA_CURSO      (por defecto «En curso»)
 *   TRELLO_LISTA_FINAL      (por defecto «Finalizado»)
 *
 * Órdenes:
 *   listas                          columnas del tablero, con id y nº de tarjetas
 *   pendientes [--json] [--todas]   cola: «Prioritarias» y después «Pendiente»,
 *                                   de la más antigua a la más nueva
 *   ver <tarjeta> [--json]          ficha completa: descripción, checklist, últimos comentarios
 *   empezar <tarjeta> [--texto …]   mueve al final de «En curso» y comenta
 *   terminar <tarjeta> [--texto …]  mueve al final de «Finalizado» y comenta (admite --commit y --pr)
 *   mover <tarjeta> <lista>         mueve al final de la lista indicada (nombre o id)
 *   comentar <tarjeta> --texto …    comenta sin mover
 *
 * Texto largo: `--texto "…"`, `--texto-archivo .cache/plan.md` o por stdin.
 * Cualquier orden de escritura acepta `--simular` para ver qué haría sin tocar nada.
 *
 * <tarjeta> acepta el id, el shortLink (lo que sale en la URL de la tarjeta) o un
 * trozo del título. Si el trozo coincide con varias, se listan y se sale con código 4.
 */

import { existsSync, readFileSync } from 'node:fs';

const API = 'https://api.trello.com/1';

const args = {};
const orden = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const clave = a.slice(2);
    const siguiente = process.argv[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) {
      args[clave] = true;
    } else {
      args[clave] = siguiente;
      i++;
    }
  } else {
    orden.push(a);
  }
}

const comando = (orden[0] || 'pendientes').toLowerCase();
const SIMULAR = Boolean(args.simular);
const JSON_OUT = Boolean(args.json);

// ---------------------------------------------------------------------------
// Entorno
// ---------------------------------------------------------------------------

function leerEnv() {
  if (!existsSync('.env')) return {};
  const bruto = readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
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

function faltanCredenciales() {
  if (KEY && TOKEN) return false;
  console.error(
    [
      'Faltan TRELLO_KEY y/o TRELLO_TOKEN.',
      '',
      '  1. Entra en https://trello.com/power-ups/admin y crea una Power-Up (nombre: Acordes Gaditanos).',
      '  2. En su pestaña «Clave de API» copia la clave.',
      '  3. Pulsa el enlace «Token» de esa misma página y autoriza (scope read,write).',
      '  4. Pega las dos líneas en .env:',
      '',
      '       TRELLO_KEY=...',
      '       TRELLO_TOKEN=...',
      '',
      '  El .env está gitignored, así que el token no se sube nunca al repo.',
    ].join('\n'),
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

async function api(ruta, { metodo = 'GET', consulta = {}, cuerpo } = {}) {
  const url = new URL(API + ruta);
  url.searchParams.set('key', KEY);
  url.searchParams.set('token', TOKEN);
  for (const [k, v] of Object.entries(consulta)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { 'content-type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await res.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }

  if (!res.ok) {
    const detalle = typeof datos === 'string' ? datos : datos?.message || texto;
    if (res.status === 401) {
      throw new Error(
        `Trello 401 (credenciales): ${detalle}\n` +
          'Revisa TRELLO_KEY / TRELLO_TOKEN en .env y que el token siga autorizado.',
      );
    }
    if (res.status === 404) throw new Error(`Trello 404: no existe «${ruta}» (${detalle}).`);
    throw new Error(`Trello ${res.status} en ${metodo} ${ruta}: ${detalle}`);
  }
  return datos;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const sinTildes = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

async function listas() {
  return api(`/boards/${TABLERO}/lists`, {
    consulta: {
      filter: 'open',
      fields: 'name,pos',
      cards: 'open',
      card_fields: 'name,idList,pos,shortLink',
    },
  });
}

function emparejarLista(listasAbiertas, buscado) {
  const objetivo = sinTildes(buscado);
  const porId = listasAbiertas.find((l) => l.id === buscado);
  if (porId) return porId;

  const normalizadas = listasAbiertas.map((l) => ({ lista: l, clave: sinTildes(l.name) }));
  const exacta = normalizadas.find((n) => n.clave === objetivo);
  if (exacta) return exacta.lista;

  // «Pendiente» ↔ «Pendientes», «En curso» ↔ «En Curso / haciendo»
  const parcial = normalizadas.filter(
    (n) => n.clave.includes(objetivo) || objetivo.includes(n.clave),
  );
  if (parcial.length === 1) return parcial[0].lista;
  if (parcial.length > 1) {
    throw new Error(
      `La lista «${buscado}» es ambigua: ${parcial.map((p) => p.lista.name).join(', ')}`,
    );
  }

  throw new Error(
    `No hay ninguna lista que se llame «${buscado}». Las que hay: ` +
      listasAbiertas.map((l) => l.name).join(', '),
  );
}

async function tarjetasDelTablero() {
  const abiertas = await listas();
  return {
    listas: abiertas,
    tarjetas: abiertas.flatMap((l) =>
      (l.cards || []).map((c) => ({ ...c, idList: c.idList || l.id, lista: l.name })),
    ),
  };
}

async function resolverTarjeta(referencia, { listas: abiertas, tarjetas } = {}) {
  if (!referencia) throw new Error('Falta la tarjeta (id, shortLink o trozo del título).');
  const ref = String(referencia).trim();

  if (/^[0-9a-f]{24}$/i.test(ref)) return { id: ref };

  const { listas: ls, tarjetas: ts } = abiertas ? { listas: abiertas, tarjetas } : await tarjetasDelTablero();

  const porLink = ts.find((t) => t.shortLink && t.shortLink.toLowerCase() === ref.toLowerCase());
  if (porLink) return porLink;

  const buscado = sinTildes(ref);
  const candidatas = ts.filter((t) => sinTildes(t.name).includes(buscado));
  if (candidatas.length === 1) return candidatas[0];
  if (candidatas.length === 0) {
    throw new Error(`No encuentro ninguna tarjeta que contenga «${ref}».`);
  }
  console.error(`«${ref}» coincide con ${candidatas.length} tarjetas:`);
  for (const c of candidatas) console.error(`  ${c.id}  ${c.shortLink}  [${c.lista}]  ${c.name}`);
  const err = new Error('Referencia ambigua: usa el id o el shortLink.');
  err.codigo = 4;
  throw err;
}

function leerTexto(requerido = true) {
  if (typeof args.texto === 'string') return args.texto;
  if (typeof args['texto-archivo'] === 'string') {
    if (!existsSync(args['texto-archivo'])) {
      throw new Error(`No existe el archivo «${args['texto-archivo']}».`);
    }
    return readFileSync(args['texto-archivo'], 'utf8').trim();
  }
  return null;
}

function recortar(texto, max = 220) {
  const limpio = String(texto || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

async function comentar(id, texto) {
  if (SIMULAR) {
    console.log(`(simulado) comentaría en ${id}:\n${texto}`);
    return;
  }
  // El texto va en el cuerpo, no en la query: un comentario largo (el plan entero)
  // desbordaba la URL y Trello respondía 414.
  await api(`/cards/${id}/actions/comments`, { metodo: 'POST', cuerpo: { text: texto } });
}

async function moverA(id, lista, nombreLista) {
  if (SIMULAR) {
    console.log(`(simulado) movería ${id} a «${lista.name}»`);
    return;
  }
  await api(`/cards/${id}`, { metodo: 'PUT', consulta: { idList: lista.id, pos: 'bottom' } });
  console.log(`→ ${nombreLista}: «${lista.name}»`);
}

// ---------------------------------------------------------------------------
// Órdenes
// ---------------------------------------------------------------------------

async function cmdListas() {
  const tablero = await api(`/boards/${TABLERO}`, { consulta: { fields: 'name,shortLink' } });
  const abiertas = await listas();
  console.log(`Tablero: ${tablero.name} (${tablero.shortLink || TABLERO})\n`);
  const marcas = new Map();
  for (const [clave, nombre] of Object.entries(NOMBRES)) {
    try {
      marcas.set(emparejarLista(abiertas, nombre).id, clave);
    } catch {
      /* si la columna no existe, se avisa abajo */
    }
  }
  for (const l of abiertas) {
    const marca = marcas.get(l.id);
    const etiqueta = marca ? `  ← ${marca}` : '';
    console.log(
      `  ${(l.cards || []).length.toString().padStart(2)}  ${l.id}  ${l.name}${etiqueta}`,
    );
  }
  for (const [clave, nombre] of Object.entries(NOMBRES)) {
    if (![...marcas.values()].includes(clave)) {
      console.log(`\n⚠️  No hay columna para «${clave}» (buscaba «${nombre}»).`);
    }
  }
}

async function cmdPendientes() {
  const abiertas = await listas();
  // Cola de trabajo: primero «Prioritarias» y luego «Pendiente». Dentro de cada
  // columna, de la más antigua a la más nueva. No vale el orden de la columna,
  // porque Trello apila las tarjetas nuevas arriba; la fecha de creación va en
  // los 8 primeros hex del id (ObjectId de Mongo).
  const creadaEn = (t) => {
    const segundos = parseInt(String(t.id || '').slice(0, 8), 16);
    return Number.isFinite(segundos) ? segundos : 0;
  };

  const grupos = [];
  for (const nombre of [NOMBRES.prioritaria, NOMBRES.pendiente]) {
    let lista;
    try {
      lista = emparejarLista(abiertas, nombre);
    } catch {
      continue; // la columna de prioritarias puede no existir
    }
    if (grupos.some((g) => g.lista.id === lista.id)) continue;
    const tarjetas = (lista.cards || [])
      .map((c) => ({ ...c, idList: c.idList || lista.id, lista: lista.name }))
      .sort((a, b) => creadaEn(a) - creadaEn(b) || (a.pos ?? 0) - (b.pos ?? 0));
    grupos.push({ lista, tarjetas });
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(grupos.flatMap((g) => g.tarjetas), null, 2));
    return;
  }
  const total = grupos.reduce((n, g) => n + g.tarjetas.length, 0);
  if (total === 0) {
    console.log(`«${NOMBRES.prioritaria}» y «${NOMBRES.pendiente}» están vacías.`);
    return;
  }
  for (const { lista, tarjetas } of grupos) {
    if (!tarjetas.length) continue;
    console.log(`«${lista.name}»: ${tarjetas.length} tarjeta(s)\n`);
    for (const t of tarjetas) {
      console.log(`- ${t.name}`);
      console.log(`  id ${t.id}  ·  ${t.shortLink || ''}`);
    }
    console.log('');
  }
}

async function cmdVer() {
  const t = await resolverTarjeta(orden[1]);
  const tarjeta = await api(`/cards/${t.id}`, {
    consulta: {
      fields: 'name,desc,due,dueComplete,shortLink,idList,closed,dateLastActivity',
      checklists: 'all',
      checklist_fields: 'name,pos',
      members: 'false',
    },
  });
  if (JSON_OUT) {
    console.log(JSON.stringify(tarjeta, null, 2));
    return;
  }
  const abiertas = await listas();
  const lista = abiertas.find((l) => l.id === tarjeta.idList);
  console.log(`# ${tarjeta.name}`);
  console.log(`lista: ${lista?.name || tarjeta.idList}   ·   ${tarjeta.shortLink}`);
  if (tarjeta.due) console.log(`vence: ${tarjeta.due}${tarjeta.dueComplete ? ' (hecho)' : ''}`);
  console.log('');
  console.log(tarjeta.desc?.trim() || '(sin descripción)');
  for (const cl of tarjeta.checklists || []) {
    const items = cl.checkItems || [];
    const hechos = items.filter((i) => i.state === 'complete').length;
    console.log(`\nChecklist «${cl.name}» (${hechos}/${items.length})`);
    for (const i of items) console.log(`  ${i.state === 'complete' ? '[x]' : '[ ]'} ${i.name}`);
  }
  const comentarios = await api(`/cards/${t.id}/actions`, {
    consulta: { filter: 'commentCard', limit: 5 },
  });
  if (comentarios?.length) {
    console.log('\nÚltimos comentarios:');
    for (const c of comentarios.reverse()) {
      console.log(`  ${c.date.slice(0, 10)}  ${recortar(c.data.text, 300)}`);
    }
  }
}

async function cmdEmpezar() {
  const t = await resolverTarjeta(orden[1]);
  const abiertas = await listas();
  const destino = emparejarLista(abiertas, NOMBRES.curso);
  const texto = leerTexto(false);
  if (!SIMULAR) await api(`/cards/${t.id}`, { metodo: 'PUT', consulta: { idList: destino.id, pos: 'bottom' } });
  console.log(`→ En curso: «${destino.name}»`);
  await comentar(t.id, texto || '🤖 En curso. Primero escribo el plan y después lo implemento.');
}

async function cmdTerminar() {
  const t = await resolverTarjeta(orden[1]);
  const abiertas = await listas();
  const destino = emparejarLista(abiertas, NOMBRES.final);
  let texto = leerTexto(false) || '🤖 ✅ Hecho.';
  if (typeof args.commit === 'string') texto += `\n\nCommit: ${args.commit}`;
  if (typeof args.pr === 'string') texto += `\nPR: ${args.pr}`;
  if (!SIMULAR) await api(`/cards/${t.id}`, { metodo: 'PUT', consulta: { idList: destino.id, pos: 'bottom' } });
  console.log(`→ Finalizado: «${destino.name}»`);
  await comentar(t.id, texto);
}

async function cmdMover() {
  const t = await resolverTarjeta(orden[1]);
  if (!orden[2]) throw new Error('Falta la lista de destino: mover <tarjeta> <lista>');
  const abiertas = await listas();
  const destino = emparejarLista(abiertas, orden[2]);
  await moverA(t.id, destino, 'Destino');
}

async function cmdComentar() {
  const t = await resolverTarjeta(orden[1]);
  const texto = leerTexto();
  if (!texto) throw new Error('Falta el texto: --texto "…" o --texto-archivo ruta.md');
  await comentar(t.id, texto);
  if (!SIMULAR) console.log('💬 Comentario añadido.');
}

// ---------------------------------------------------------------------------

const ACCIONES = {
  listas: cmdListas,
  pendientes: cmdPendientes,
  ver: cmdVer,
  empezar: cmdEmpezar,
  terminar: cmdTerminar,
  mover: cmdMover,
  comentar: cmdComentar,
};

async function main() {
  if (comando === 'ayuda' || comando === 'help' || args.ayuda) {
    console.log(
      [
        'Órdenes:',
        '  listas                        columnas con id y nº de tarjetas',
        '  pendientes [--json]           cola: Prioritarias y luego Pendiente,',
        '                                de la más antigua a la más nueva',
        '  ver <tarjeta> [--json]        descripción, checklist y comentarios',
        '  empezar <tarjeta>             → En curso, al final de la columna (+ comentario)',
        '  terminar <tarjeta>            → Finalizado, al final de la columna (+ comentario)',
        '  mover <tarjeta> <lista>       mover al final de una columna',
        '  comentar <tarjeta> --texto …  comentar sin mover',
        '',
        'Texto: --texto "…" | --texto-archivo ruta.md | stdin',
        'Escritura: añade --simular para verlo sin tocar Trello.',
      ].join('\n'),
    );
    return;
  }

  const accion = ACCIONES[comando];
  if (!accion) {
    console.error(`Orden desconocida: «${comando}». Prueba con: node scripts/trello.mjs ayuda`);
    process.exit(1);
  }

  faltanCredenciales();
  await accion();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(e.codigo || 1);
});
