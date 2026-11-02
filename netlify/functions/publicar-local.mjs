// Lanza la publicación de fichas de `acordes` que están en el ordenador pero
// aún no en git. Solo funciona en `astro dev`: en Netlify no hay working tree.
//
//   POST /admin/api/publicar-local  { slugs: [...], sinAviso?: boolean }
//   GET  /admin/api/publicar-local?id=<id>   → estado y últimas líneas del log
//   GET  /admin/api/publicar-local?ultimo=1  → el último trabajo (o el que corre)
//
// El trabajo corre en segundo plano (push y avisos tardan minutos) y
// escribe su estado en `.cache/publicar/estado.json`.
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { LOCAL, sesion, sinSesion, json } from './_lib.mjs';

const ejecutar = promisify(execFile);
const RAIZ = process.cwd();
const CARPETA = join(RAIZ, '.cache/publicar');
const ESTADO = join(CARPETA, 'estado.json');

const leerEstado = () => {
  try { return JSON.parse(readFileSync(ESTADO, 'utf8')); } catch { return null; }
};

/** ¿Sigue vivo el proceso del trabajo? */
const vivo = (pid) => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

/** Convierte el log (una línea JSON por paso) en entradas para el panel. */
const cola = (texto, max = 120) => {
  const lineas = texto.split('\n').filter((l) => l.trim());
  return lineas.slice(-max).map((l) => {
    try {
      const j = JSON.parse(l);
      return { nivel: j.nivel || 'info', msg: String(j.msg || ''), t: j.t };
    } catch {
      return { nivel: 'info', msg: l };
    }
  });
};

const estadoYLog = (estado) => {
  // Si el proceso murió sin cerrar el estado (cierre de ventana, Ctrl+C…).
  if (estado.estado === 'ejecutando' && !vivo(estado.pid) && Date.now() - Number(estado.inicio || 0) > 5000) {
    estado.estado = 'error';
    estado.error = estado.error || 'el proceso terminó sin dejar resultado';
    try { writeFileSync(ESTADO, JSON.stringify(estado, null, 2), 'utf8'); } catch { /* sin estado */ }
  }
  let lineas = [];
  try { lineas = cola(readFileSync(join(CARPETA, `${estado.id}.log`), 'utf8')); } catch { /* aún sin log */ }
  return { ...estado, lineas };
};

export default async (req) => {
  if (!LOCAL) return json({ error: 'solo está disponible en local' }, 501);

  const s = sesion(req);
  if (!s) return sinSesion();

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const id = String(url.searchParams.get('id') || '').trim();
    const ultimo = url.searchParams.get('ultimo') === '1';
    const estado = leerEstado();
    if (!estado || (!ultimo && id && estado.id !== id)) return json({ estado: 'ninguno' });
    return json(estadoYLog(estado));
  }

  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  let cuerpo;
  try { cuerpo = await req.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }

  const slugs = Array.isArray(cuerpo.slugs)
    ? cuerpo.slugs.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (!slugs.length || slugs.length > 20) return json({ error: 'fichas inválidas' }, 400);
  if (slugs.some((x) => !/^[a-z0-9][a-z0-9-]*$/.test(x))) return json({ error: 'slug inválido' }, 400);
  const sinAviso = cuerpo.sinAviso === true;

  const anterior = leerEstado();
  if (anterior && anterior.estado === 'ejecutando' && vivo(anterior.pid)) {
    return json({ error: 'ya hay una publicación en marcha' }, 409);
  }

  // Plan rápido (solo git): fechas y si lleva aviso. Si hay slugs que no están
  // pendientes, se devuelve el plan con el error y no se lanza nada.
  const argsPlan = ['scripts/publicar-acorde.mjs', '--plan', '--json', '--solo', slugs.join(',')];
  if (sinAviso) argsPlan.push('--sin-aviso');
  let plan;
  try {
    const { stdout } = await ejecutar(process.execPath, argsPlan, { cwd: RAIZ, maxBuffer: 4 * 1024 * 1024 });
    plan = JSON.parse(stdout.trim().split('\n').pop());
  } catch (e) {
    const salida = String(e.stdout || '').trim();
    try { plan = JSON.parse(salida.split('\n').pop()); } catch { /* sin plan */ }
  }
  if (!plan || !Array.isArray(plan.items) || !plan.items.length) {
    const detalle = plan && Array.isArray(plan.errores)
      ? plan.errores.map((x) => `${x.slug}: ${x.error}`).join('; ')
      : 'no hay nada que publicar';
    return json({ error: detalle, plan }, 400);
  }

  mkdirSync(CARPETA, { recursive: true });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const fd = openSync(join(CARPETA, `${id}.log`), 'a');
  const argumentos = ['scripts/publicar-acorde.mjs', '--solo', slugs.join(','), '--json', '--id', id];
  if (sinAviso) argumentos.push('--sin-aviso');

  const hijo = spawn(process.execPath, argumentos, {
    cwd: RAIZ,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', fd, fd],
    env: process.env,
  });
  hijo.unref();
  try { closeSync(fd); } catch { /* ya cerrado */ }

  writeFileSync(ESTADO, JSON.stringify({
    id,
    estado: 'ejecutando',
    inicio: Date.now(),
    pid: hijo.pid,
    slugs,
    sinAviso,
    plan,
  }, null, 2), 'utf8');

  return json({ id, plan });
};
