#!/usr/bin/env node
/**
 * Sube a git la ficha de una tarjeta de la columna «Subir ficha» de Trello.
 *
 * Es la parte mecánica de la skill `subir-acorde` aplicada a una tarjeta:
 *   1. resolver la ficha por el nombre hablado del título (o por el slug),
 *   2. promoverla si todavía está en `acordes3`,
 *   3. publicarla con `publicar-acorde.mjs` (fecha = día siguiente al último
 *      publicado, `auditar:pre`, `auditar:acordes`, un commit y push),
 *   4. avisar por WhatsApp y X según lo que diga el comentario,
 *   5. comentar el resultado y mover la tarjeta a «Subidas».
 *
 * El disparador es **un comentario del usuario** en la tarjeta: crear la
 * tarjeta no hace nada (lo controla `trello-watch.mjs`).
 *
 * Uso:
 *   node scripts/subir-ficha.mjs --tarjeta <id|shortLink> --comentario "sube sin tuit"
 *   node scripts/subir-ficha.mjs --slug pasodoble-las-ratas-manuel [--comentario "…"]
 *   node scripts/subir-ficha.mjs --tarjeta <id> --comentario "sube" --seco
 *
 * Modificadores del comentario (se pueden combinar):
 *   sin tuit · sin whatsapp (o sin wa) · sin etiquetar · sin aviso
 *
 * El comentario tiene que llevar una orden de subir (`sube`, `súbelo`,
 * `publica`, `dale`…). Si no la lleva, no se publica nada: se pregunta.
 *
 * Códigos de salida: 0 subida (o pregunta contestada), 1 error.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describir, listarFichas, normalizar, resolverFicha } from './lib/fichas.mjs';

const RAIZ = process.cwd();
const CARPETA_ACORDES = 'src/content/acordes';

const args = process.argv.slice(2);
const opciones = { tarjeta: '', slug: '', comentario: '', seco: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--tarjeta') opciones.tarjeta = String(args[++i] || '').trim();
  else if (a === '--slug') opciones.slug = String(args[++i] || '').trim();
  else if (a === '--comentario') opciones.comentario = String(args[++i] || '');
  else if (a === '--seco' || a === '--dry-run') opciones.seco = true;
}

const log = (msg) => console.log(msg);

// Tarjeta en curso, para poder comentar un fallo inesperado (ver `main().catch`).
let idTarjeta = '';

// ---------------------------------------------------------------------------
// Entorno y utilidades
// ---------------------------------------------------------------------------

function leerEnv() {
  const ruta = join(RAIZ, '.env');
  if (!existsSync(ruta)) return {};
  const valores = {};
  for (const linea of readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    valores[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return valores;
}

const ENV = leerEnv();
const LISTA_SUBIDAS = process.env.TRELLO_LISTA_SUBIDAS || ENV.TRELLO_LISTA_SUBIDAS || 'Subidas';

function git(argumentos, { permitirFallo = false } = {}) {
  try {
    return execFileSync('git', argumentos, {
      cwd: RAIZ,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }).replace(/\r\n/g, '\n');
  } catch (e) {
    if (permitirFallo) return '';
    throw new Error(`git ${argumentos.join(' ')}: ${String(e.stderr || e.message || '').trim()}`);
  }
}

/** Lanza otro script del proyecto y devuelve código y salida (sin lanzar). */
function script(ruta, extra = []) {
  try {
    const salida = execFileSync(process.execPath, [ruta, ...extra], {
      cwd: RAIZ,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { codigo: 0, salida: salida || '' };
  } catch (e) {
    return {
      codigo: typeof e.status === 'number' ? e.status : 1,
      salida: `${String(e.stdout || '')}${String(e.stderr || '')}`,
    };
  }
}

/** Órdenes del CLI de Trello (comentar y mover), para no duplicar la API. */
function trello(...argumentos) {
  const r = script('scripts/trello.mjs', argumentos);
  if (r.codigo !== 0) throw new Error(`trello ${argumentos[0]}: ${r.salida.trim()}`);
  return r.salida;
}

function urlRepo() {
  const remoto = git(['remote', 'get-url', 'origin'], { permitirFallo: true }).trim();
  const m = remoto.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1].replace(/\.git$/, '')}` : '';
}

/** Fechas y avisos que va a usar `publicar-acorde` para esta ficha. */
function planDePublicacion(slug) {
  const r = script('scripts/publicar-acorde.mjs', ['--solo', slug, '--plan', '--json']);
  let plan = null;
  try {
    plan = JSON.parse(r.salida.trim().split('\n').pop());
  } catch {
    return { ok: false, motivo: r.salida.trim() || 'no he podido leer el plan de publicación' };
  }
  if (!plan.ok) {
    const motivo = (plan.errores || []).map((e) => `${e.slug}: ${e.error}`).join('; ');
    return { ok: false, motivo: motivo || 'la ficha no está pendiente de publicar' };
  }
  const item = (plan.items || [])[0];
  if (!item) return { ok: false, motivo: 'la ficha no está pendiente de publicar' };
  return { ok: true, item };
}

// ---------------------------------------------------------------------------
// Lo que dice el comentario
// ---------------------------------------------------------------------------

const MODIFICADORES = {
  sinAviso: /\bsin avisos?\b|\bsin avisar\b/,
  sinTuit: /\bsin tuit\b|\bsin tuitear\b|\bsin twitter\b|\bsin x\b/,
  sinWa: /\bsin whatsapp\b|\bsin wasap\b|\bsin wa\b/,
  sinEtiquetas: /\bsin etiquetar\b|\bsin etiquetas\b/,
};

const ORDEN = /\b(sube|subir|subelo|suban|publica|publicar|publicad|lanza|lanzalo|adelante|dale|hazlo|vale|ok)\b/;

function leerInstrucciones(texto) {
  const t = normalizar(texto);
  return {
    ordena: ORDEN.test(t),
    sinAviso: MODIFICADORES.sinAviso.test(t),
    sinTuit: MODIFICADORES.sinTuit.test(t),
    sinWa: MODIFICADORES.sinWa.test(t),
    sinEtiquetas: MODIFICADORES.sinEtiquetas.test(t),
  };
}

function describirAvisos(ins) {
  if (ins.sinAviso) return 'ninguno (sin aviso, tampoco Telegram)';
  const canales = [];
  if (!ins.sinWa) canales.push('WhatsApp');
  if (!ins.sinTuit) canales.push(ins.sinEtiquetas ? 'X sin etiquetas' : 'X');
  return canales.length ? canales.join(' + ') : 'ninguno';
}

// ---------------------------------------------------------------------------
// Tarjeta
// ---------------------------------------------------------------------------

function leerTarjeta(id) {
  const salida = script('scripts/trello.mjs', ['ver', id, '--json']);
  if (salida.codigo !== 0) throw new Error(`no encuentro la tarjeta ${id}: ${salida.salida.trim()}`);
  return JSON.parse(salida.salida);
}

function comentar(id, texto) {
  if (opciones.seco) {
    log(`(seco) comentaría:\n${texto}`);
    return;
  }
  trello('comentar', id, '--texto', texto);
}

function moverASubidas(id) {
  if (opciones.seco) {
    log(`(seco) movería la tarjeta a «${LISTA_SUBIDAS}»`);
    return;
  }
  try {
    trello('mover', id, LISTA_SUBIDAS);
  } catch (e) {
    log(`⚠️  No he podido mover la tarjeta: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Publicación
// ---------------------------------------------------------------------------

async function main() {
  if (!opciones.tarjeta && !opciones.slug) {
    console.error('Uso: node scripts/subir-ficha.mjs --tarjeta <id|shortLink> [--comentario "…"]');
    console.error('     node scripts/subir-ficha.mjs --slug <slug> [--comentario "…"] [--seco]');
    process.exitCode = 1;
    return;
  }

  const tarjeta = opciones.tarjeta ? leerTarjeta(opciones.tarjeta) : null;
  const id = tarjeta?.id || '';
  idTarjeta = id;

  // Qué ficha: el título de la tarjeta manda; el slug manual, si se pasa.
  const consulta = opciones.slug || tarjeta?.name || '';
  const { ficha, dudosas } = resolverFicha(consulta, listarFichas(RAIZ));

  if (!ficha) {
    if (dudosas.length) {
      const texto = [
        '🤖 Hay varias fichas que encajan. Dime cuál (el slug o el año en la tarjeta) y comenta otra vez:',
        ...dudosas.map((f) => `- ${describir(f)}`),
      ].join('\n');
      if (id) comentar(id, texto);
      else log(texto);
      return;
    }
    const texto = [
      `🤖 No encuentro ninguna ficha para «${consulta}».`,
      '',
      'Prueba con el slug exacto (por ejemplo `pasodoble-la-marea`) en el título o en un comentario.',
    ].join('\n');
    if (id) comentar(id, texto);
    else log(texto);
    process.exitCode = 1;
    return;
  }

  const ins = leerInstrucciones(opciones.comentario);
  if (!ins.ordena) {
    const texto = [
      `🤖 No la subo todavía: el comentario no lleva la orden. Ficha: ${describir(ficha)}.`,
      '',
      'Comenta «sube» para publicarla. Opciones: «sin tuit», «sin whatsapp», «sin etiquetar», «sin aviso».',
    ].join('\n');
    if (id) comentar(id, texto);
    else log(texto);
    return;
  }

  // 1. Promover si todavía es borrador.
  let avisoPromocion = '';
  if (ficha.borrador) {
    if (opciones.seco) {
      log(`(seco) promovería \`${ficha.slug}\` de acordes3 a acordes`);
    } else {
      const r = script('scripts/promover-acordes3.mjs', ['--slug', ficha.slug]);
      if (r.codigo !== 0) {
        const texto = [
          `🤖 No he podido mover \`${ficha.slug}\` de borradores a acordes:`,
          '',
          '```',
          r.salida.trim().slice(-700),
          '```',
        ].join('\n');
        if (id) comentar(id, texto);
        else log(texto);
        process.exitCode = 1;
        return;
      }
      avisoPromocion = `Movida antes de \`acordes3\` a \`acordes\`.\n`;
      log(r.salida.trim());
    }
  }

  // 2. Comprobar que está pendiente de publicar y con qué fecha.
  if (ficha.borrador && opciones.seco) {
    log(`(seco) «${ficha.slug}» todavía es borrador: el plan se comprueba después de promoverla.`);
    log(`Avisos: ${describirAvisos(ins)}`);
    return;
  }
  const plan = planDePublicacion(ficha.slug);
  if (!plan.ok) {
    const texto = [
      `🤖 No hay nada que subir de \`${ficha.slug}\`: ${plan.motivo}.`,
      '',
      'Si ya está publicada, no se toca (la fecha de una copla publicada no cambia sola).',
    ].join('\n');
    if (id) comentar(id, texto);
    else log(texto);
    process.exitCode = 1;
    return;
  }

  const fecha = plan.item.fecha || '(sin cambio: ya estaba publicada)';
  log(`Ficha: ${describir(ficha)}`);
  log(`Fecha que le toca: ${fecha}`);
  log(`Avisos: ${describirAvisos(ins)}`);

  if (opciones.seco) {
    log('(seco) no se publica nada.');
    return;
  }

  // 3. Publicar: fecha, auditorías, commit y push.
  const extra = [];
  if (ins.sinAviso) {
    extra.push('--sin-aviso');
  } else {
    extra.push('--avisar');
    if (ins.sinWa) extra.push('--sin-wa');
    if (ins.sinTuit) extra.push('--sin-x');
    if (ins.sinEtiquetas) extra.push('--sin-etiquetas');
  }

  const head = git(['rev-parse', 'HEAD']).trim();
  const pendientesAntes = git(
    ['log', '--format=%H%x09%s', 'origin/master..HEAD', '--', `${CARPETA_ACORDES}/${ficha.slug}.md`],
    { permitirFallo: true },
  ).trim();

  log('Publicando (auditorías, commit y push)…');
  if (!ins.sinAviso && (!ins.sinWa || !ins.sinTuit)) {
    log('Los avisos abren Chrome y tardan uno o dos minutos…');
  }
  const pub = script('scripts/publicar-acorde.mjs', ['--solo', ficha.slug, ...extra]);
  log(pub.salida.trim());

  if (pub.codigo !== 0) {
    const texto = [
      `🤖 ❌ No he terminado de subir \`${ficha.slug}\`. La tarjeta se queda aquí para reintentar.`,
      '',
      '```',
      pub.salida.trim().slice(-1200),
      '```',
      '',
      'Si el push falló, los commits pueden estar hechos: comenta otra vez y se reintenta sin duplicar.',
    ].join('\n');
    if (id) comentar(id, texto);
    process.exitCode = 1;
    return;
  }

  // 4. Qué commits han salido y cómo fueron los avisos.
  const nuevos = git(['log', '--format=%H%x09%s', `${head}..HEAD`], { permitirFallo: true }).trim();
  const commits = (nuevos || pendientesAntes)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [sha, ...resto] = l.split('\t');
      return { sha, mensaje: resto.join('\t') };
    });

  const repo = urlRepo();
  const lineas = [`🤖 ✅ Subida \`${ficha.slug}\``];
  if (avisoPromocion) lineas.push(avisoPromocion.trim());
  lineas.push(`${[ficha.pieza, ficha.agrupacion].filter(Boolean).join(' ')} · fecha ${fecha}`);

  if (commits.length) {
    lineas.push('', '**Commit:**');
    for (const c of commits) {
      const enlace = repo ? `${repo}/commit/${c.sha}` : c.sha;
      lineas.push(`- ${enlace} — ${c.mensaje}`);
    }
  } else {
    lineas.push('', '**Commit:** ya estaba en local; solo se ha hecho el push.');
  }

  const wa = /Aviso WhatsApp: (.+)/.exec(pub.salida)?.[1]?.trim();
  const x = /Aviso X: (.+)/.exec(pub.salida)?.[1]?.trim();
  if (ins.sinAviso) {
    lineas.push('**Avisos:** ninguno (`[sin aviso]`, tampoco Telegram).');
  } else if (/Nada que avisar/i.test(pub.salida)) {
    lineas.push('**Avisos:** ninguno (la copla ya estaba publicada; solo se ha actualizado).');
  } else {
    const partes = [];
    if (!ins.sinWa) partes.push(`WhatsApp: ${wa === 'ok' ? '✅' : `❌ ${wa || 'sin confirmar'}`}`);
    if (!ins.sinTuit) partes.push(`X: ${x === 'ok' ? '✅' : `❌ ${x || 'sin confirmar'}`}${ins.sinEtiquetas ? ' (sin etiquetas)' : ''}`);
    lineas.push(`**Avisos:** ${partes.join(' · ') || 'ninguno'}`);
  }
  lineas.push('', `La muevo a «${LISTA_SUBIDAS}».`);

  const texto = lineas.join('\n');
  log(texto);
  if (id) {
    comentar(id, texto);
    moverASubidas(id);
  }
}

main().catch((e) => {
  const mensaje = String(e?.message || e);
  console.error(`\n${mensaje}`);
  if (idTarjeta && !opciones.seco) {
    try {
      comentar(idTarjeta, `🤖 ❌ Algo ha fallado y no he subido nada:\n\n\`\`\`\n${mensaje.slice(0, 800)}\n\`\`\``);
    } catch {
      /* si tampoco se puede comentar, queda el log */
    }
  }
  process.exitCode = 1;
});
