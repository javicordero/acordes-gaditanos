// scripts/publicar-acorde.mjs
//
// Sube a git las fichas de `src/content/acordes` que están en el ordenador pero
// no en el remoto, ajusta la fecha de las nuevas y, si se pide con `--avisar`,
// lanza los avisos de WhatsApp y X. Es la parte mecánica de la skill
// `subir-acorde`, para que también la pueda disparar el botón «Publicar» del
// panel /admin (que solo publica y deja el aviso listo para copiar).
//
// Uso:
//   node scripts/publicar-acorde.mjs --solo <slug>[,<slug>] [--sin-aviso]
//   node scripts/publicar-acorde.mjs --solo <slug> --plan --json
//   node scripts/publicar-acorde.mjs --todos [--sin-aviso] [--avisar]
//
// Opciones:
//   --solo <slugs>   fichas a publicar (separadas por coma)
//   --todos          todas las pendientes del working tree
//   --sin-aviso      no marca el aviso en Telegram (commit con [sin aviso])
//   --avisar         lanza WhatsApp y X desde este equipo (por defecto no: el
//                    panel solo publica y deja el aviso listo para copiar)
//   --sin-wa         con --avisar, no manda WhatsApp
//   --sin-x          con --avisar, no publica el tuit
//   --sin-etiquetas  con --avisar, el tuit va sin etiquetar a nadie en la imagen
//   --plan           no toca nada: imprime el plan y sale
//   --json           log en líneas JSON (lo consume el panel)
//   --id <id>        identificador del trabajo para .cache/publicar/estado.json
//
// Antes de commitear limpia los espacios y tabuladores al final de línea dentro
// del `<pre>` de cada ficha del plan (no se ven, pero `AnchoPreInit` los mide
// para encoger la letra y el editor los cuenta en el límite de 55 columnas) y
// falla si quedara alguno. `--plan` solo los cuenta, no toca nada.
//
// Códigos de salida: 0 bien, 1 error (nada se revierte: si el push ya salió, la
// web queda publicada y solo se informa de lo que falló). El push se reintenta
// hasta 3 veces si el fallo es transitorio (500 de GitHub, corte de red); un
// auth o un non-fast-forward fallan a la primera.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { frontmatterDeTexto } from './lib/aviso.mjs';
import { analizarPre, limpiarPre } from './lib/pre-espacios.mjs';
import { avisosPasodoblesSinTitulo } from '../src/lib/alertas-letra-titulo.js';

const RAIZ = process.cwd();
const CARPETA = 'src/content/acordes';
const BORRADORES = 'src/content/borradores';
const ESTADO = join(RAIZ, '.cache/publicar/estado.json');

const opciones = { slugs: [], todos: false, sinAviso: false, avisar: false, sinWa: false, sinX: false, sinEtiquetas: false, plan: false, json: false, id: '' };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--solo') opciones.slugs = String(args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--todos') opciones.todos = true;
  else if (a === '--sin-aviso') opciones.sinAviso = true;
  else if (a === '--avisar') opciones.avisar = true;
  else if (a === '--sin-wa') opciones.sinWa = true;
  else if (a === '--sin-x') opciones.sinX = true;
  else if (a === '--sin-etiquetas') opciones.sinEtiquetas = true;
  else if (a === '--plan') opciones.plan = true;
  else if (a === '--json') opciones.json = true;
  else if (a === '--id') opciones.id = String(args[++i] || '');
}

const log = (msg, nivel = 'info') => {
  if (opciones.json) console.log(JSON.stringify({ t: Date.now(), nivel, msg: String(msg) }));
  else console.log(msg);
};

/** Ejecuta git y devuelve la salida (sin CR). Con `permitirFallo` no lanza. */
function git(argumentos, { permitirFallo = false } = {}) {
  try {
    return execFileSync('git', argumentos, {
      cwd: RAIZ,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }).replace(/\r\n/g, '\n');
  } catch (e) {
    if (permitirFallo) return '';
    const detalle = String(e.stderr || e.stdout || e.message || '').trim();
    throw new Error(`git ${argumentos.join(' ')}: ${detalle}`);
  }
}

/** Estado del working tree en `acordes` y bajas pendientes en `borradores`. */
function estadoWorkingTree() {
  const mapa = new Map();
  const borradores = new Set();
  const salida = git(['status', '--porcelain=v1', '-z', '--no-renames', '--', CARPETA, BORRADORES], { permitirFallo: true });

  for (const entrada of salida.split('\0').filter(Boolean)) {
    const xy = entrada.slice(0, 2);
    const ruta = entrada.slice(3);
    if (!ruta.endsWith('.md')) continue;
    const slug = ruta.split('/').pop().slice(0, -3);

    if (ruta.startsWith(`${BORRADORES}/`)) {
      if (xy.includes('D')) borradores.add(slug);
      continue;
    }
    if (!ruta.startsWith(`${CARPETA}/`)) continue;

    const estado = xy === '??' || xy[0] === 'A'
      ? 'nueva'
      : xy.includes('D') ? 'borrada' : 'modificada';
    mapa.set(slug, { slug, estado, ruta });
  }
  return { mapa, borradores };
}

/** Fichas que ya están en commits locales pero todavía no en origin. */
function sinPush() {
  const mapa = new Map();
  const salida = git(['diff', '--name-status', 'origin/master..HEAD', '--', CARPETA], { permitirFallo: true });
  for (const linea of salida.split('\n')) {
    if (!linea.trim()) continue;
    const [cambio, ruta] = linea.split('\t');
    if (!ruta || !ruta.endsWith('.md')) continue;
    const slug = ruta.split('/').pop().slice(0, -3);
    const tipo = cambio[0] === 'A' ? 'nueva' : cambio[0] === 'D' ? 'borrada' : 'modificada';
    mapa.set(slug, { slug, estado: 'sin-push', cambio: tipo, ruta });
  }
  return mapa;
}

/** Texto de una ficha: del disco o, si está borrada, de HEAD/origin. */
function textoDe(item) {
  if (item.estado === 'borrada' || item.cambio === 'borrada') {
    for (const ref of ['HEAD', 'origin/master']) {
      const texto = git(['show', `${ref}:${item.ruta}`], { permitirFallo: true });
      if (texto) return texto;
    }
    return '';
  }
  try { return readFileSync(join(RAIZ, item.ruta), 'utf8'); } catch { return ''; }
}

/** Fichas locales publicadas y borradores, para comprobar pasodobles hermanos. */
function fichasEnDisco(carpeta) {
  let nombres = [];
  try { nombres = readdirSync(join(RAIZ, carpeta)); } catch { /* carpeta ausente */ }
  return nombres.filter((nombre) => nombre.endsWith('.md')).map((nombre) => {
    const slug = nombre.slice(0, -3);
    let md = '';
    try { md = readFileSync(join(RAIZ, carpeta, nombre), 'utf8'); } catch { /* archivo ilegible */ }
    return { slug, ...frontmatterDeTexto(md) };
  });
}

/** Última fecha publicada en HEAD (tolera días inválidos como 31/09). */
function ultimaFecha() {
  const salida = git(['grep', '-h', '^date:', 'HEAD', '--', CARPETA], { permitirFallo: true });
  let max = 0;
  for (const linea of salida.split('\n')) {
    const m = /date:\s*["']?(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(linea);
    if (!m) continue;
    const clave = Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
    if (clave > max) max = clave;
  }
  if (!max) return new Date();
  return new Date(Math.floor(max / 10000), Math.floor((max % 10000) / 100) - 1, max % 100);
}

const dos = (n) => String(n).padStart(2, '0');
const formatear = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Plan: qué se publica, con qué fecha y si lleva aviso. */
function construirPlan() {
  const { mapa, borradores } = estadoWorkingTree();
  const todos = new Map([...sinPush(), ...mapa]); // el working tree manda
  const pedidos = opciones.todos ? [...todos.keys()] : opciones.slugs;

  const errores = [];
  const items = [];
  for (const slug of pedidos) {
    const item = todos.get(slug);
    if (!item) {
      errores.push({ slug, error: 'no está pendiente de publicar' });
      continue;
    }
    const texto = textoDe(item);
    items.push({
      ...item,
      ...frontmatterDeTexto(texto),
      borrador: borradores.has(slug),
      // Líneas del <pre> que acaban en espacios: se limpian al publicar.
      // En `--plan` solo se cuentan, no se toca ningún archivo.
      espacios: analizarPre(texto).total,
    });
  }

  // Fechas consecutivas solo para las nuevas, en orden alfabético de archivo.
  const nuevas = items.filter((x) => x.estado === 'nueva').sort((a, b) => a.slug.localeCompare(b.slug));
  let base = ultimaFecha();
  nuevas.forEach((x, i) => {
    x.fecha = formatear(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i + 1));
  });

  for (const x of items) {
    x.avisar = !opciones.sinAviso && (x.estado === 'nueva' || (x.estado === 'sin-push' && x.cambio === 'nueva'));
  }

  const catalogo = new Map([
    ...fichasEnDisco(BORRADORES),
    ...fichasEnDisco(CARPETA),
  ].map((x) => [x.slug, x]));
  for (const item of items) {
    if (item.estado === 'borrada' || item.cambio === 'borrada') catalogo.delete(item.slug);
    else catalogo.set(item.slug, { ...catalogo.get(item.slug), ...item });
  }
  const avisosLetraTitulo = avisosPasodoblesSinTitulo(
    [...catalogo.values()],
    items.filter((x) => x.estado !== 'borrada').map((x) => x.slug),
  );

  return {
    items,
    errores,
    avisos: items.filter((x) => x.avisar).length,
    avisosLetraTitulo,
  };
}

// ---------------------------------------------------------------------------
// Push con reintentos
// ---------------------------------------------------------------------------

// Fallos de GitHub que se pasan solos: un 500 del servidor o un corte de red.
// Un auth, un «non-fast-forward» o un rechazo de permisos no se reintenta:
// volver a probar no lo arregla y solo hace esperar.
const FALLO_TRANSITORIO =
  /Internal Server Error|HTTP 5\d\d|requested URL returned error: 5\d\d|Could not resolve host|Connection reset|Connection refused|Failed to connect|Connection timed out|Operation timed out|RPC failed|remote end hung up|early EOF|TLS handshake timeout|unexpected disconnect|temporary failure/i;

const INTENTOS_PUSH = 3;
const ESPERAS_PUSH_MS = [3000, 6000];

/** Como `git`, pero devuelve el error en vez de lanzarlo. */
function gitResultado(argumentos) {
  try {
    const salida = execFileSync('git', argumentos, {
      cwd: RAIZ,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }).replace(/\r\n/g, '\n');
    return { ok: true, salida, error: '' };
  } catch (e) {
    return {
      ok: false,
      salida: String(e.stdout || '').replace(/\r\n/g, '\n'),
      error: String(e.stderr || e.message || '').trim(),
    };
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * `git push` con reintentos ante fallos transitorios (los 500 de GitHub, cortes
 * de red). Devuelve el número de intento en que salió. Si el fallo no es
 * transitorio, o se agotan los intentos, lanza como antes.
 */
async function empujar() {
  for (let intento = 1; intento <= INTENTOS_PUSH; intento++) {
    const r = gitResultado(['push', 'origin', 'master']);
    if (r.ok) {
      if (intento > 1) log(`Push OK en el intento ${intento}/${INTENTOS_PUSH}.`);
      return intento;
    }

    const detalle = r.error || r.salida;
    const ultimo = intento === INTENTOS_PUSH;
    if (ultimo || !FALLO_TRANSITORIO.test(detalle)) {
      throw new Error(`git push origin master: ${detalle}`);
    }

    const espera = ESPERAS_PUSH_MS[intento - 1] ?? 3000;
    const motivo = detalle.split('\n').map((l) => l.trim()).filter(Boolean).pop() || detalle;
    log(
      `Push falló (intento ${intento}/${INTENTOS_PUSH}): ${motivo.slice(0, 160)}. ` +
        `Reintento en ${espera / 1000} s…`,
    );
    await dormir(espera);
  }
  return INTENTOS_PUSH;
}

/** Guarda el estado que consulta el panel (solo si lo lanza el panel). */function escribirEstado(extra) {
  if (!opciones.id) return;
  try {
    mkdirSync(join(RAIZ, '.cache/publicar'), { recursive: true });
    const previo = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {};
    writeFileSync(ESTADO, JSON.stringify({ ...previo, ...extra, id: opciones.id }, null, 2), 'utf8');
  } catch { /* el panel lo marcará como error por PID */ }
}

/** Lanza un script de `package.json` y devuelve su código de salida. */
function correrScript(nombre, extra = [], { heredar = false } = {}) {
  let programa;
  let argumentos;
  try {
    const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    const comando = String((paquete.scripts || {})[nombre] || '').trim();
    if (!comando) throw new Error(`no existe el script ${nombre} en package.json`);
    const partes = comando.split(/\s+/);
    // Los scripts del proyecto son `node scripts/...`: se lanzan sin npm ni shell.
    programa = partes[0] === 'node' ? process.execPath : partes[0];
    argumentos = [...partes.slice(1), ...extra];
  } catch (e) {
    return { codigo: 1, salida: String(e.message || e) };
  }

  try {
    const salida = execFileSync(programa, argumentos, {
      cwd: RAIZ,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: heredar ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      // Los avisos abren Chrome: si se queda colgado, no puede dejar el trabajo
      // «ejecutando» para siempre. A los 5 minutos se corta y se informa.
      timeout: heredar ? 5 * 60 * 1000 : 0,
    });
    return { codigo: 0, salida: salida || '' };
  } catch (e) {
    return {
      codigo: typeof e.status === 'number' ? e.status : 1,
      salida: `${String(e.stdout || '')}${String(e.stderr || '')}`,
    };
  }
}

(async () => {
  try {
    const plan = construirPlan();

    if (opciones.plan) {
      console.log(JSON.stringify({ ok: plan.errores.length === 0, ...plan }));
      process.exitCode = plan.errores.length ? 1 : 0;
      return;
    }

    if (plan.errores.length) {
      throw new Error(plan.errores.map((e) => `${e.slug}: ${e.error}`).join('; '));
    }
    if (!plan.items.length) throw new Error('no hay fichas pendientes que publicar');

    for (const aviso of plan.avisosLetraTitulo) {
      const faltan = aviso.faltan.map((x) => x.slug).join(', ');
      log(`⚠️ Pasodoble con letraTitulo en ${aviso.agrupacion}: comprueba también ${faltan}; no tienen letraTitulo.`, 'aviso');
    }

    escribirEstado({ estado: 'ejecutando', inicio: Date.now(), pid: process.pid, plan });

    // 1. Fecha de las nuevas.
    for (const x of plan.items) {
      if (x.estado !== 'nueva') continue;
      const ruta = join(RAIZ, x.ruta);
      const md = readFileSync(ruta, 'utf8');
      const nuevo = md.replace(/^date:.*$/m, `date: "${x.fecha}"`);
      if (nuevo === md && !/^date:/m.test(md)) throw new Error(`no encuentro date en ${x.ruta}`);
      writeFileSync(ruta, nuevo, 'utf8');
      log(`Fecha de ${x.slug}: ${x.fecha}`);
    }

    // 2. Espacios al final de línea dentro del <pre>. No se ven, pero cuentan:
    //    AnchoPreInit mide el scrollWidth para encoger la letra de la copla y el
    //    editor del panel los suma al límite de 55 columnas. Se limpian solo las
    //    fichas que entran en un commit de este trabajo; las que ya están
    //    commiteadas (`sin-push`) no se tocan, para no dejar cambios fuera del
    //    commit.
    const limpiadas = [];
    for (const x of plan.items) {
      if (x.estado === 'sin-push') {
        if (x.espacios) {
          log(`Espacios finales en ${x.slug}: ${x.espacios} línea(s). Ya está commiteada; se limpiará cuando se vuelva a publicar.`, 'aviso');
        }
        continue;
      }
      if (x.estado === 'borrada' || !x.espacios) continue;

      const ruta = join(RAIZ, x.ruta);
      const { texto, lineas } = limpiarPre(readFileSync(ruta, 'utf8'));
      if (!lineas.length) continue;

      writeFileSync(ruta, texto, 'utf8');
      x.espacios = 0;
      limpiadas.push({ slug: x.slug, lineas: lineas.length });
      log(`Espacios finales: limpiadas ${lineas.length} línea(s) en ${x.slug} (${lineas.map((l) => `L${l.n}`).join(', ')})`);
    }

    // Red de seguridad: si quedara una cola, no se commitea nada.
    const restos = plan.items
      .filter((x) => x.estado !== 'sin-push' && x.estado !== 'borrada')
      .map((x) => ({ slug: x.slug, ...analizarPre(readFileSync(join(RAIZ, x.ruta), 'utf8')) }))
      .filter((x) => x.total);
    if (restos.length) {
      throw new Error(
        `quedan espacios al final de línea en ${restos.map((r) => `${r.slug} (${r.total})`).join(', ')}; no se publica nada`,
      );
    }

    // 3. Auditorías antes de commitear.
    for (const script of ['auditar:pre', 'auditar:acordes']) {
      log(`Ejecutando ${script}…`);
      const r = correrScript(script);
      if (r.codigo !== 0) {
        const cola = r.salida.split('\n').slice(-15).join('\n');
        throw new Error(`${script} falló:\n${cola}`);
      }
      log(`${script} OK`);
    }

    // 4. Un commit por ficha, tocando solo sus rutas.
    const commits = [];
    for (const x of plan.items) {
      if (x.estado === 'sin-push') continue;
      const rutas = [];
      if (x.estado !== 'borrada') rutas.push(`${CARPETA}/${x.slug}.md`);
      if (x.borrador) rutas.push(`${BORRADORES}/${x.slug}.md`);
      if (!rutas.length) continue;

      git(['add', '-A', '--', ...rutas]);
      const nombre = [x.pieza, x.agrupacion].filter(Boolean).join(' ') || x.slug;
      const prefijo = x.estado === 'nueva' ? 'acordes' : x.estado === 'borrada' ? 'quita' : 'actualiza';
      const mensaje = `${prefijo} ${nombre}${opciones.sinAviso ? ' [sin aviso]' : ''}`;
      try {
        git(['commit', '-m', mensaje, '--', ...rutas]);
        commits.push({ slug: x.slug, mensaje });
        log(`Commit: ${mensaje}`);
      } catch {
        log(`Sin cambios que commitear en ${x.slug}`, 'aviso');
      }
    }

    // 5. Qué fichas nuevas entran en el push (lo mismo que verá la Action).
    let avisos = [];
    if (!opciones.sinAviso) {
      const salida = git(['diff', '--diff-filter=A', '--name-only', 'origin/master..HEAD', '--', CARPETA], { permitirFallo: true });
      avisos = salida.split('\n').filter((r) => r.endsWith('.md')).map((r) => r.split('/').pop().slice(0, -3));
    }

    // 6. Push (con reintentos si GitHub devuelve un 500 o se corta la red).
    const porSubir = Number(git(['rev-list', '--count', 'origin/master..HEAD'], { permitirFallo: true }).trim() || 0);
    let push = 'nada';
    if (porSubir > 0) {
      log(`Subiendo ${porSubir} commit(s)…`);
      const intento = await empujar();
      push = 'ok';
      log(intento > 1 ? `Push OK (intento ${intento}/${INTENTOS_PUSH}).` : 'Push OK');
    } else {
      log('No hay commits nuevos que subir.');
    }

    if (avisos.length) {
      log('Netlify tarda 1-2 min en publicar la ficha: el enlace puede tardar en responder.');
    }

    // 7. Avisos. Por defecto no se envía nada: el panel deja el texto listo
    //    para copiar. Con `--avisar` se lanzan WhatsApp y X desde este equipo.
    let wa = 'no';
    let x = 'no';
    if (avisos.length && opciones.avisar) {
      log(`Lanzando avisos de: ${avisos.join(', ')}`);
      const solo = ['--solo', avisos.join(',')];

      if (!opciones.sinWa) {
        log('Lanzando WhatsApp…');
        const rw = correrScript('wa', solo, { heredar: true });
        wa = rw.codigo === 0 ? 'ok' : `error ${rw.codigo}`;
        if (rw.codigo === 2) log('WhatsApp: sesión caducada. Ejecuta `npm run wa:login`.', 'error');
        else if (rw.codigo) log(`WhatsApp terminó con código ${rw.codigo}.`, 'error');
        log(`Aviso WhatsApp: ${wa}`);
      } else {
        log('WhatsApp: omitido (--sin-wa).');
      }

      if (!opciones.sinX) {
        log('Lanzando X…');
        const extra = opciones.sinEtiquetas ? ['--sin-etiquetas'] : [];
        const rx = correrScript('x', [...solo, ...extra], { heredar: true });
        x = rx.codigo === 0 ? 'ok' : `error ${rx.codigo}`;
        if (rx.codigo === 2) log('X: sesión caducada. Ejecuta `npm run x:login`.', 'error');
        else if (rx.codigo) log(`X terminó con código ${rx.codigo}.`, 'error');
        log(`Aviso X: ${x}${opciones.sinEtiquetas ? ' (sin etiquetas)' : ''}`);
      } else {
        log('X: omitido (--sin-x).');
      }
    } else if (avisos.length) {
      log(`Aviso listo para copiar: ${avisos.join(', ')}`);
    } else {
      log('Nada que avisar (no hay fichas nuevas).');
    }

    // 8. Resumen de los avisos: si alguno falló, se dice cuál. La ficha ya está
    //    publicada igualmente, así que no se cambia el estado del trabajo.
    const fallos = [];
    if (String(wa).startsWith('error')) fallos.push('WhatsApp');
    if (String(x).startsWith('error')) fallos.push('X');
    if (avisos.length && opciones.avisar) {
      if (fallos.length) {
        log(`Avisos fallidos: ${fallos.join(' y ')}. La ficha sí se ha publicado: el texto sigue en «Copiar aviso».`, 'error');
      } else {
        log('Avisos: WhatsApp y X enviados.', 'ok');
      }
    }

    escribirEstado({
      estado: 'ok',
      fin: Date.now(),
      resumen: { commits, push, avisos, wa, x, fallos, limpiadas },
    });
    log('Terminado.', 'ok');
  } catch (e) {
    const mensaje = String(e.message || e);
    log(mensaje, 'error');
    escribirEstado({ estado: 'error', fin: Date.now(), error: mensaje });
    process.exitCode = 1;
  }
})();
