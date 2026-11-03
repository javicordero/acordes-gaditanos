// scripts/push.mjs
//
// Avisa por notificación push a los móviles que tienen los avisos activados.
// Misma regla que Telegram: solo cuentan los .md AÑADIDOS en src/content/acordes.
//
// Uso:
//   node scripts/push.mjs --antes <sha> --despues <sha>   (lo que usa la Action)
//   node scripts/push.mjs --solo pasodoble-la-marea
//   node scripts/push.mjs --solo pasodoble-la-marea --dry-run
//   node scripts/push.mjs --test                          (notificación de prueba)
//   node scripts/push.mjs --generar-claves                (una sola vez)
//
// Variables (en el entorno o en .env):
//   PUSH_WORKER_URL     URL del worker (p. ej. https://push-worker.….workers.dev)
//   PUSH_SEND_TOKEN     secreto del worker (el mismo de la Action)
//   VAPID_PRIVATE_KEY   clave privada VAPID
//   VAPID_SUBJECT       mailto:…
//
// La clave pública se lee de src/lib/constants.ts (`AVISOS.vapidPublicKey`), que
// es la que usa el móvil: así no puede quedar desparejada con la privada.
//
// `web-push` no está en las dependencias: se importa solo cuando toca enviar.
// En local: `npm install --no-save web-push`; en la Action se instala en el paso.

import { generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  cargarCopla,
  cargarCoplas,
  ficherosAnadidos,
  notificacionDe,
  ordenar,
} from './lib/aviso.mjs';

const CONSTANTS = 'src/lib/constants.ts';
const TANDA = 10; // push simultáneos
function cargarEnv() {
  if (!existsSync('.env')) return;
  const bruto = readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
  for (const linea of bruto.split(/\r?\n/)) {
    const corte = linea.indexOf('=');
    if (corte <= 0 || linea.trim().startsWith('#')) continue;
    const clave = linea.slice(0, corte).trim();
    let valor = linea.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!process.env[clave]) process.env[clave] = valor;
  }
}

cargarEnv();

const WORKER = (process.env.PUSH_WORKER_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.PUSH_SEND_TOKEN || '';
const VAPID_PRIVADA = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'https://acordesgaditanos.com';

function clavePublica() {
  if (!existsSync(CONSTANTS)) return '';
  const texto = readFileSync(CONSTANTS, 'utf8');
  const match = texto.match(/vapidPublicKey:\s*'([^']*)'/);
  return match ? match[1] : '';
}

function leerArgumentos(argv) {
  const opciones = {
    antes: '',
    despues: 'HEAD',
    seco: false,
    test: false,
    claves: false,
    solo: [],
    tope: 10,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const siguiente = argv[i + 1];

    if (arg === '--dry-run' || arg === '--seco') {
      opciones.seco = true;
    } else if (arg === '--test') {
      opciones.test = true;
    } else if (arg === '--generar-claves') {
      opciones.claves = true;
    } else if (arg === '--antes') {
      opciones.antes = siguiente;
      i++;
    } else if (arg === '--despues') {
      opciones.despues = siguiente;
      i++;
    } else if (arg === '--solo') {
      opciones.solo = (siguiente || '')
        .split(',')
        .map((slug) => slug.trim().replace(/\.md$/, ''))
        .filter(Boolean);
      i++;
    } else if (arg === '--tope') {
      opciones.tope = Number(siguiente) || 10;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Uso: node scripts/push.mjs [opciones]',
          '',
          '  --antes <sha>         commit base (por defecto: HEAD~1)',
          '  --despues <sha>       commit final (por defecto: HEAD)',
          '  --solo a,b            reenviar estos slugs',
          '  --dry-run             enseña la notificación sin enviarla',
          '  --test                manda una notificación de prueba',
          '  --generar-claves      crea el par VAPID (una sola vez)',
          '  --tope <n>            a partir de n coplas manda resumen (10)',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      console.warn(`Argumento desconocido: ${arg}`);
    }
  }

  return opciones;
}

/**
 * Un push cuyo último commit lleve «[sin aviso]» no notifica nada, igual que
 * Telegram.
 */
function marcadoSinAviso() {
  if (process.env.SALTAR_AVISO === '1') return true;
  try {
    const asunto = execFileSync('git', ['log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim();
    return /\[sin avisos?\]/i.test(asunto);
  } catch {
    return false;
  }
}

/** Escribe (o reemplaza) una variable en `.env`, respetando el salto de línea. */
function guardarEnEnv(clave, valor) {
  if (!existsSync('.env')) return false;
  const texto = readFileSync('.env', 'utf8').replace(/^\uFEFF/, '');
  const eol = texto.includes('\r\n') ? '\r\n' : '\n';
  const lineas = texto.split(/\r?\n/);
  const indice = lineas.findIndex((linea) => new RegExp(`^\\s*${clave}\\s*=`).test(linea));

  if (indice >= 0) lineas[indice] = `${clave}=${valor}`;
  else lineas.push(`${clave}=${valor}`);

  writeFileSync('.env', lineas.join(eol), 'utf8');
  return true;
}

function generarClaves() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });

  // Clave pública = punto sin comprimir (0x04 || X || Y), en base64url.
  const publica = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from(jwk.y, 'base64url'),
  ]).toString('base64url');

  const texto = readFileSync(CONSTANTS, 'utf8');
  if (!/vapidPublicKey:\s*'[^']*'/.test(texto)) {
    throw new Error(`No encuentro «vapidPublicKey» en ${CONSTANTS}.`);
  }
  writeFileSync(
    CONSTANTS,
    texto.replace(/vapidPublicKey:\s*'[^']*'/, `vapidPublicKey: '${publica}'`),
    'utf8',
  );

  const guardada = guardarEnEnv('VAPID_PRIVATE_KEY', jwk.d);

  console.log('Par VAPID nuevo.\n');
  console.log(`Pública (ya escrita en ${CONSTANTS}):\n  ${publica}\n`);
  if (guardada) {
    console.log('Privada: guardada en VAPID_PRIVATE_KEY dentro de .env.');
  } else {
    console.log(`Privada (crea .env y guárdala ahí):\n  VAPID_PRIVATE_KEY=${jwk.d}`);
  }
  console.log('\nFalta copiar la privada a los secretos de GitHub y poner VAPID_SUBJECT.');
  console.log('Y recuerda: si vuelves a generarlas, todas las suscripciones dejan de valer.');
}

function tanda(lista, tamano) {
  const tandas = [];
  for (let i = 0; i < lista.length; i += tamano) tandas.push(lista.slice(i, i + tamano));
  return tandas;
}

/**
 * El navegador descarga la imagen al pintar la notificación. Si el servidor de
 * la foto va lento o la bloquea, el móvil enseñaría un hueco roto, así que se
 * comprueba antes: si no responde a tiempo, se quita y sale el icono de la app.
 */
async function comprobarImagen(payload) {
  if (!payload.icono) return;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 4000);

  try {
    let res = await fetch(payload.icono, {
      method: 'HEAD',
      redirect: 'follow',
      signal: control.signal,
    });

    // Algunos servidores de fotos no contestan a HEAD: se prueba con GET.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(payload.icono, { method: 'GET', redirect: 'follow', signal: control.signal });
    }

    const tipo = res.headers.get('content-type') || '';
    if (!res.ok || (tipo && !tipo.startsWith('image/'))) {
      delete payload.icono;
      console.warn(
        `La foto de la ficha no vale (${res.status}${tipo ? `, ${tipo}` : ''}): sale el icono de la app.`,
      );
    }
  } catch {
    delete payload.icono;
    console.warn('La foto de la ficha no carga a tiempo: sale el icono de la app.');
  } finally {
    clearTimeout(reloj);
  }
}

async function suscriptores() {
  const todos = [];
  let cursor = '';

  do {
    const url = `${WORKER}/subs?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

    if (res.status === 401) {
      throw new Error('El worker no acepta PUSH_SEND_TOKEN. Revisa que sea el mismo.');
    }
    if (!res.ok) {
      throw new Error(`El worker respondió ${res.status} al listar los suscriptores.`);
    }

    const datos = await res.json();
    todos.push(...(datos.subs || []));
    cursor = datos.cursor || '';
  } while (cursor);

  return todos;
}

async function enviar(payload, subs, seco) {
  if (seco) {
    console.log(`Notificación preparada (no enviada) para ${subs.length} móvil(es):\n`);
    console.log(`  ${payload.titulo}`);
    console.log(`  ${payload.cuerpo.replace(/\n/g, '\n  ')}`);
    console.log(`  → ${payload.url}`);
    if (payload.icono) console.log(`  (con foto de la ficha: ${payload.icono})`);
    console.log('');
    return { ok: 0, muertas: 0, fallos: 0 };
  }

  if (!subs.length) {
    console.log('No hay ningún móvil con los avisos activados.');
    return { ok: 0, muertas: 0, fallos: 0 };
  }

  const webpush = await import('web-push').catch(() => {
    throw new Error(
      'Falta web-push. En local: `npm install --no-save web-push`. En la Action lo instala el paso.',
    );
  });

  const publica = clavePublica();
  if (!publica) {
    throw new Error(`Falta AVISOS.vapidPublicKey en ${CONSTANTS} (npm run push -- --generar-claves).`);
  }

  webpush.default.setVapidDetails(VAPID_SUBJECT, publica, VAPID_PRIVADA);

  const resultado = { ok: 0, muertas: 0, fallos: 0 };
  const cuerpo = JSON.stringify(payload);

  for (const grupo of tanda(subs, TANDA)) {
    await Promise.all(
      grupo.map(async (sub) => {
        try {
          await webpush.default.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            cuerpo,
            { TTL: 86400, urgency: 'normal' },
          );
          resultado.ok++;
        } catch (error) {
          const estado = error?.statusCode;
          if (estado === 404 || estado === 410) {
            resultado.muertas++;
            await fetch(`${WORKER}/subs/${sub.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${TOKEN}` },
            }).catch(() => undefined);
            return;
          }

          resultado.fallos++;
          if (estado === 401 || estado === 403) {
            console.warn(
              `El servicio de push rechazó la clave VAPID (${estado}). ¿Pública y privada son del mismo par?`,
            );
          } else {
            console.warn(`Fallo con ${sub.id}: ${error?.message || estado || 'sin detalle'}`);
          }
        }
      }),
    );
  }

  return resultado;
}

async function principal() {
  const opciones = leerArgumentos(process.argv);

  if (opciones.claves) {
    generarClaves();
    return;
  }

  const faltan = [];
  if (!WORKER) faltan.push('PUSH_WORKER_URL');
  if (!TOKEN) faltan.push('PUSH_SEND_TOKEN');
  if (!VAPID_PRIVADA) faltan.push('VAPID_PRIVATE_KEY');
  if (faltan.length) {
    throw new Error(`Faltan en el entorno o en .env: ${faltan.join(', ')}.`);
  }

  let payload;
  if (opciones.test) {
    payload = {
      titulo: 'Acordes Gaditanos',
      cuerpo: 'Prueba de avisos. Si ves esto, todo funciona.',
      url: '/',
      tag: 'prueba',
    };
  } else {
    let coplas;
    if (opciones.solo.length) {
      coplas = cargarCoplas(opciones.solo);
    } else {
      if (marcadoSinAviso()) {
        console.log('El commit está marcado [sin aviso]: no se notifica nada.');
        return;
      }
      coplas = ordenar(ficherosAnadidos(opciones.antes, opciones.despues).map(cargarCopla));
    }

    if (!coplas.length) {
      console.log('Sin coplas nuevas en este push: no se avisa.');
      return;
    }

    payload = notificacionDe(coplas, opciones.tope);
  }

  const subs = await suscriptores();
  if (!opciones.seco) await comprobarImagen(payload);
  const resultado = await enviar(payload, subs, opciones.seco);

  if (opciones.seco) return;

  console.log(
    `✓ Push: ${resultado.ok} enviados, ${resultado.muertas} suscripciones muertas (borradas)` +
      (resultado.fallos ? `, ${resultado.fallos} fallos` : '') +
      '.',
  );
}

principal().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
