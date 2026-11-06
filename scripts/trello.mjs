#!/usr/bin/env node
/**
 * Trello — leer y mover las tarjetas del tablero de Acordes Gaditanos.
 *
 * Credenciales (en `.env`, que está gitignored):
 *   TRELLO_KEY=...      clave de la Power-Up  → https://trello.com/power-ups/admin
 *   TRELLO_TOKEN=...    token con scope read,write
 *   TRELLO_TABLERO=...  id o nombre corto del tablero (por defecto vwbp5cJ5)
 *
 * Avisos al móvil: Trello no notifica tus propias acciones, así que un comentario
 * hecho con TU token no enciende la campanita. Si están las claves de la cuenta
 * bot, los comentarios se escriben con ella y entonces sí llega la notificación
 * al móvil. Leer y mover sigue con tu token.
 *   TRELLO_BOT_KEY=...    clave de la cuenta bot
 *   TRELLO_BOT_TOKEN=...  token de la cuenta bot (miembro del tablero)
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
 *   ver <tarjeta> [--json]          ficha completa: título, descripción, checklist y comentarios
 *                                   enteros, de más antiguo a más nuevo (--limite N, --breve)
 *   empezar <tarjeta> [--texto …]   mueve al final de «En curso» y comenta
 *   terminar <tarjeta> [--texto …]  mueve al final de «Finalizado» y comenta (admite --commit y --pr)
 *   mover <tarjeta> <lista>         mueve al final de la lista indicada (nombre o id)
 *   comentar <tarjeta> --texto …    comenta sin mover
 *   titular <tarjeta> --titulo …    pasa el título largo a la descripción y pone
 *                                   un título corto numerado (#1, #2…)
 *   listar <columna> [--json]       tarjetas de una columna (p. ej. «Finalizado»)
 *
 * Texto largo: `--texto "…"`, `--texto-archivo .cache/plan.md` o por stdin.
 * Cualquier orden de escritura acepta `--simular` para ver qué haría sin tocar nada.
 *
 * <tarjeta> acepta el id, el shortLink (lo que sale en la URL de la tarjeta) o un
 * trozo del título. Si el trozo coincide con varias, se listan y se sale con código 4.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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
let AVISO_SIN_BOT_DADO = false;

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
// Cuenta bot: solo para escribir comentarios (ver «comentar» más abajo).
const BOT_KEY = process.env.TRELLO_BOT_KEY || ENV.TRELLO_BOT_KEY || '';
const BOT_TOKEN = process.env.TRELLO_BOT_TOKEN || ENV.TRELLO_BOT_TOKEN || '';
const HAY_BOT = Boolean(BOT_KEY && BOT_TOKEN);
// A quién se menciona para que la notificación llegue (usuario de Trello del dueño).
const AVISAR_A = process.env.TRELLO_AVISAR_A || ENV.TRELLO_AVISAR_A || 'javicordero1';
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

async function api(ruta, { metodo = 'GET', consulta = {}, cuerpo, credenciales } = {}) {
  const clave = credenciales?.key || KEY;
  const token = credenciales?.token || TOKEN;
  const url = new URL(API + ruta);
  url.searchParams.set('key', clave);
  url.searchParams.set('token', token);
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

// Contador de numeración de tareas (gitignored, en .cache). Guarda el siguiente
// número a usar; `consumirNumero` lo devuelve y avanza el contador.
const CONTADOR = '.cache/trello-contador.json';

function leerSiguiente() {
  if (!existsSync(CONTADOR)) return 1;
  try {
    const n = parseInt(JSON.parse(readFileSync(CONTADOR, 'utf8')).siguiente, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

function consumirNumero() {
  const n = leerSiguiente();
  writeFileSync(CONTADOR, JSON.stringify({ siguiente: n + 1 }, null, 2) + '\n', 'utf8');
  return n;
}

async function comentar(id, texto) {
  if (SIMULAR) {
    console.log(`(simulado) comentaría en ${id}:\n${texto}`);
    return;
  }
  // El texto va en el cuerpo, no en la query: un comentario largo (el plan entero)
  // desbordaba la URL y Trello respondía 414.
  //
  // Se escribe con la cuenta bot si está configurada: Trello NO notifica las
  // acciones del propio usuario, así que un comentario con tu token no enciende
  // la campanita ni manda push al móvil. El bot sí, pero solo si te menciona:
  // comentar en una tarjeta de la que no eres miembro no genera notificación
  // (probado: sin mención no salta nada, con @usuario sale «mentionedOnCard»).
  const credenciales = HAY_BOT ? { key: BOT_KEY, token: BOT_TOKEN } : undefined;
  let cuerpo = texto;
  if (HAY_BOT) {
    // Solo cuenta si la mención está al **final**: el texto puede nombrar el
    // usuario a mitad (p. ej. explicando esto mismo) y eso no notifica nada.
    const mencion = `@${AVISAR_A}`;
    const yaAlFinal = new RegExp(`${mencion}\\s*$`, 'i').test(texto.trim());
    if (!yaAlFinal) cuerpo = `${texto.trimEnd()}\n\n${mencion}`;
  }
  await api(`/cards/${id}/actions/comments`, {
    metodo: 'POST',
    cuerpo: { text: cuerpo },
    credenciales,
  });

  if (!HAY_BOT && !AVISO_SIN_BOT_DADO) {
    AVISO_SIN_BOT_DADO = true;
    console.warn(
      '⚠️  Comentario escrito con TU token: Trello no te avisará al móvil. ' +
        'Para que llegue la notificación, pon TRELLO_BOT_KEY y TRELLO_BOT_TOKEN en .env.',
    );
  }
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

async function cmdListar() {
  const columna = orden[1];
  if (!columna) throw new Error('Falta la columna: listar <columna>');
  const abiertas = await listas();
  const destino = emparejarLista(abiertas, columna);
  const tarjetas = (destino.cards || [])
    .map((c) => ({ ...c, idList: c.idList || destino.id, lista: destino.name }))
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  if (JSON_OUT) {
    console.log(JSON.stringify(tarjetas, null, 2));
    return;
  }
  console.log(`«${destino.name}»: ${tarjetas.length} tarjeta(s)\n`);
  for (const t of tarjetas) {
    console.log(`- ${t.name}`);
    console.log(`  id ${t.id}  ·  ${t.shortLink || ''}`);
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
  // Los comentarios NO se recortan: muchas veces el encargo de verdad está ahí
  // (corrige el título o la descripción), así que se leen enteros. `--breve`
  // vuelve al resumen de 300 caracteres y `--limite N` cambia cuántos se traen.
  const limite =
    Number.isFinite(Number(args.limite)) && Number(args.limite) > 0 ? Number(args.limite) : 20;
  const breve = Boolean(args.breve);
  // Se pide uno de más para saber si hay comentarios anteriores que no se muestran.
  const comentarios = await api(`/cards/${t.id}/actions`, {
    consulta: { filter: 'commentCard', limit: limite + 1 },
  });
  const hayMas = Array.isArray(comentarios) && comentarios.length > limite;
  const visibles = hayMas ? comentarios.slice(0, limite) : comentarios || [];
  if (visibles.length) {
    console.log('\nComentarios (de más antiguo a más nuevo):');
    for (const c of visibles.reverse()) {
      const quien = c.memberCreator?.username || c.memberCreator?.fullName || '';
      console.log(`\n  ${c.date.slice(0, 10)}${quien ? ` · ${quien}` : ''}`);
      const texto = String(c.data?.text || '').replace(/\r/g, '').trim();
      const cuerpo = breve ? recortar(texto, 300) : texto;
      for (const linea of cuerpo.split('\n')) console.log(`  ${linea}`);
    }
    if (hayMas) {
      console.log(
        `\n  (+ comentarios más antiguos sin mostrar; usa --limite N para leerlos)`,
      );
    }
  } else {
    console.log('\n(sin comentarios)');
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

async function cmdTitular() {
  const t = await resolverTarjeta(orden[1]);
  const titulo = typeof args.titulo === 'string' ? args.titulo.trim() : '';
  if (!titulo) throw new Error('Falta el título corto: titular <tarjeta> --titulo "…"');

  const tarjeta = await api(`/cards/${t.id}`, { consulta: { fields: 'name,desc' } });
  const nombreViejo = String(tarjeta.name || '').trim();
  const descVieja = String(tarjeta.desc || '').trim();

  // Número: por defecto el siguiente del contador; --numero lo fuerza; --sin-numero lo quita.
  let prefijo = '';
  if (!args['sin-numero']) {
    if (typeof args.numero === 'string') {
      const n = parseInt(args.numero, 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Número inválido: «${args.numero}» (tiene que ser ≥ 1).`);
      }
      prefijo = `#${n} `;
    } else if (SIMULAR) {
      prefijo = `#${leerSiguiente()} `; // en simular se enseña sin consumir
    } else {
      prefijo = `#${consumirNumero()} `;
    }
  }

  const nombreNuevo = `${prefijo}${titulo}`;

  // El título largo de antes pasa a la descripción (arriba), salvo que sea idéntico.
  let descNueva = descVieja;
  if (nombreViejo && nombreViejo !== titulo) {
    descNueva = descVieja ? `${nombreViejo}\n\n${descVieja}` : nombreViejo;
  }

  if (SIMULAR) {
    console.log(`(simulado) título  → «${nombreNuevo}»`);
    console.log(
      `(simulado) descripción ← título anterior${descVieja ? ' + lo que ya había' : ''}`,
    );
    return;
  }

  await api(`/cards/${t.id}`, {
    metodo: 'PUT',
    cuerpo: { name: nombreNuevo, desc: descNueva },
  });
  console.log(`→ Título: «${nombreNuevo}»`);
  console.log(`→ Descripción: guardado el título anterior${descVieja ? ' + lo que ya había' : ''}.`);
}

// ---------------------------------------------------------------------------

const ACCIONES = {
  listas: cmdListas,
  pendientes: cmdPendientes,
  listar: cmdListar,
  ver: cmdVer,
  empezar: cmdEmpezar,
  terminar: cmdTerminar,
  mover: cmdMover,
  comentar: cmdComentar,
  titular: cmdTitular,
};

async function main() {
  if (comando === 'ayuda' || comando === 'help' || args.ayuda) {
    console.log(
      [
        'Órdenes:',
        '  listas                        columnas con id y nº de tarjetas',
        '  pendientes [--json]           cola: Prioritarias y luego Pendiente,',
        '                                de la más antigua a la más nueva',
        '  listar <columna> [--json]     tarjetas de una columna (p. ej. «Finalizado»)',
        '  ver <tarjeta> [--json]        título, descripción, checklist y comentarios enteros',
        '                                (--limite N, --breve para recortarlos)',
        '  empezar <tarjeta>             → En curso, al final de la columna (+ comentario)',
        '  terminar <tarjeta>            → Finalizado, al final de la columna (+ comentario)',
        '  mover <tarjeta> <lista>       mover al final de una columna',
        '  comentar <tarjeta> --texto …  comentar sin mover',
        '  titular <tarjeta> --titulo …  título largo → descripción + título corto numerado',
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
