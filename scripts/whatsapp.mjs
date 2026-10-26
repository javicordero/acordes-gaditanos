// scripts/whatsapp.mjs
//
// Publica el aviso de coplas nuevas en el canal de WhatsApp usando tu Chrome.
// No hay API oficial de canales, así que se controla WhatsApp Web con
// Playwright: un perfil propio (./wa-profile) en el que inicias sesión una vez.
//
// Uso:
//   npm run wa:login                         iniciar sesión (una vez, con QR)
//   npm run wa -- --solo pasodoble-la-marea  escribir el aviso en el canal
//   npm run wa -- --solo a,b --dry-run       ver el texto sin abrir el navegador
//   npm run wa -- --mensaje "hola"           texto libre
//
// El mensaje se deja ESCRITO en el compositor: lo revisas y pulsas Enter tú.
// El script detecta el envío, hace una captura y cierra Chrome solo.
//
// Variables de entorno:
//   WA_CANAL    nombre exacto del canal (por defecto «Acordes Gaditanos»)
//   WA_PERFIL   carpeta del perfil de Chrome (por defecto ./wa-profile)
//   SITE_URL    por defecto https://acordesgaditanos.com
//
// Códigos de salida:
//   0  enviado (o nada que hacer)
//   1  error inesperado
//   2  sesión caducada: hay que ejecutar `npm run wa:login`
//   3  no se encontró el canal
//   4  no se encontró el compositor del canal
//   5  no se envió (cerraste la ventana o se agotó la espera)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

import { cargarCoplas, esperarPublicacion, textoDe, urlAcorde } from './lib/aviso.mjs';

const WEB = 'https://web.whatsapp.com/';
const CANAL = process.env.WA_CANAL || 'Acordes Gaditanos';
const PERFIL = path.resolve(process.env.WA_PERFIL || 'wa-profile');
const DEPURACION = path.resolve('wa-debug');
const REGISTRO = path.resolve('wa-enviados.json');

/**
 * Selectores por rol/aria-label, nunca por clase: WhatsApp ofusca las clases.
 * Se prueban las variantes en español y en inglés por si cambia el idioma.
 */
const SELECTORES = {
  listaChats: [
    '[role="grid"][aria-label="Lista de chats"]',
    '[aria-label="Lista de chats"]',
    '[aria-label="Chat list"]',
    '#pane-side',
  ],
  qr: [
    'div[data-ref]',
    'canvas[aria-label*="QR" i]',
    'canvas[aria-label*="código QR" i]',
    '[data-testid="qrcode"]',
  ],
  canales: [
    'button[aria-label="Canales"]',
    'button[aria-label="Channels"]',
    '[aria-label="Canales"]',
  ],
  buscar: [
    'input[role="textbox"][aria-label*="Buscar"]',
    'input[role="textbox"][aria-label*="Search"]',
    '[aria-label="Buscar un chat o iniciar uno nuevo"]',
  ],
  // El compositor está en el panel de la conversación, nunca en la barra
  // lateral (donde vive el buscador, que también es contenteditable).
  compositor: [
    '#main div[contenteditable="true"][role="textbox"]',
    '#main footer div[contenteditable="true"]',
    '#main div[contenteditable="true"]',
  ],
  cerrarDialogo: [
    '[role="dialog"] button[aria-label="Cerrar"]',
    '[role="dialog"] button[aria-label="Close"]',
    '[role="dialog"] button[aria-label="Entendido"]',
    '[role="dialog"] button[aria-label="OK"]',
  ],
};

const AYUDA = [
  'Uso:',
  '  npm run wa:login                          iniciar sesión en WhatsApp Web (QR)',
  '  npm run wa -- --solo <slug>[,<slug>]      escribir el aviso en el canal',
  '  npm run wa -- --solo <slug> --dry-run     ver el texto sin abrir Chrome',
  '',
  'Opciones:',
  '  --mensaje "<texto>"     publicar un texto libre',
  '  --canal "<nombre>"      canal de destino (por defecto: Acordes Gaditanos)',
  '  --espera <seg>          espera máxima a que la ficha responda 200 (240)',
  '  --sin-esperar           no espera a la publicación',
  '  --espera-manual <min>   minutos que espera a que pulses Enter (10)',
  '  --forzar                publicar aunque ya esté en wa-enviados.json',
  '  --comprobar             abrir el canal y hacer captura, sin escribir',
  '  --dry-run               enseña el mensaje y sale',
].join('\n');

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

function leerArgumentos(argv) {
  const opciones = {
    comando: 'post',
    solo: [],
    mensaje: process.env.MENSAJE || '',
    canal: CANAL,
    espera: 240,
    esperaManual: 10,
    forzar: false,
    seco: false,
    comprobar: false,
    ayuda: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const siguiente = argv[i + 1];

    if (arg === 'login' || arg === 'post') {
      opciones.comando = arg;
    } else if (arg === '--dry-run' || arg === '--seco') {
      opciones.seco = true;
    } else if (arg === '--forzar') {
      opciones.forzar = true;
    } else if (arg === '--comprobar') {
      opciones.comprobar = true;
    } else if (arg === '--sin-esperar') {
      opciones.espera = 0;
    } else if (arg === '--espera') {
      opciones.espera = Number(siguiente) || 0;
      i++;
    } else if (arg === '--espera-manual') {
      opciones.esperaManual = Number(siguiente) || 10;
      i++;
    } else if (arg === '--canal') {
      opciones.canal = siguiente || opciones.canal;
      i++;
    } else if (arg === '--solo') {
      opciones.solo = (siguiente || '')
        .split(',')
        .map((slug) => slug.trim().replace(/\.md$/, ''))
        .filter(Boolean);
      i++;
    } else if (arg === '--mensaje') {
      opciones.mensaje = siguiente || '';
      i++;
    } else if (arg === '--help' || arg === '-h') {
      opciones.ayuda = true;
    } else {
      console.warn(`Argumento desconocido: ${arg}`);
    }
  }

  return opciones;
}

function abrirNavegador() {
  if (!existsSync(PERFIL)) mkdirSync(PERFIL, { recursive: true });

  return chromium.launchPersistentContext(PERFIL, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
}

function captura(page, motivo) {
  try {
    mkdirSync(DEPURACION, { recursive: true });
    const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ruta = path.join(DEPURACION, `${marca}-${motivo}.png`);
    return page.screenshot({ path: ruta, fullPage: false }).then(() => ruta);
  } catch {
    return Promise.resolve(null);
  }
}

/** Primer selector visible de la lista, o null. */
async function localizar(page, selectores, esperaMs = 0) {
  const limite = Date.now() + esperaMs;

  do {
    for (const selector of selectores) {
      const local = page.locator(selector).first();
      try {
        if (await local.isVisible({ timeout: 300 })) return local;
      } catch {
        // Selector que no existe en este DOM: siguiente.
      }
    }
    if (Date.now() >= limite) break;
    await esperar(400);
  } while (Date.now() < limite);

  return null;
}

/** 'listo' si hay sesión, 'qr' si pide vincular el dispositivo, null si ni una cosa ni otra. */
async function estadoSesion(page, esperaMs) {
  const limite = Date.now() + esperaMs;

  do {
    if (await localizar(page, SELECTORES.listaChats)) return 'listo';
    if (await localizar(page, SELECTORES.qr)) return 'qr';
    await esperar(500);
  } while (Date.now() < limite);

  return null;
}

async function login() {
  console.log(`Abriendo WhatsApp Web con el perfil ${PERFIL}…`);
  const contexto = await abrirNavegador();

  try {
    const page = contexto.pages()[0] || (await contexto.newPage());
    await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    console.log('Escanea el QR con el móvil (WhatsApp → Dispositivos vinculados).');
    console.log('Esperando hasta 3 minutos…');

    const estado = await estadoSesion(page, 180_000);
    if (!estado) {
      await captura(page, 'login-sin-estado');
      throw new Error('No se pudo detectar ni el QR ni la lista de chats. Mira wa-debug/.');
    }

    if (estado === 'qr') {
      // El QR sigue a la vista: se espera a que aparezca la lista de chats.
      console.log('QR a la vista. Esperando a que termines de vincular…');
      const listo = await localizar(page, SELECTORES.listaChats, 180_000);
      if (!listo) {
        await captura(page, 'login-qr');
        throw new Error('La sesión no llegó a iniciarse. Vuelve a intentarlo.');
      }
    }

    await esperar(2000);
    console.log('✓ Sesión iniciada. Ya puedes usar `npm run wa -- --solo <slug>`.');
  } finally {
    await contexto.close();
  }
}

/** Cierra los avisos que WhatsApp enseña encima («Novedades en WhatsApp Web»…). */
async function cerrarAvisos(page) {
  for (let intento = 0; intento < 3; intento++) {
    const boton = await localizar(page, SELECTORES.cerrarDialogo, 800);
    if (boton) {
      await boton.click({ timeout: 3000 }).catch(() => {});
      await esperar(700);
      continue;
    }

    const dialogo = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (await dialogo.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => {});
      await esperar(700);
      continue;
    }

    break;
  }
}

/** Entra en la pestaña de canales y abre el canal por su nombre. */
async function abrirCanal(page, canal) {
  await cerrarAvisos(page);

  const pestana = await localizar(page, SELECTORES.canales, 20_000);
  if (pestana) {
    await pestana.click({ timeout: 8000 }).catch(() => {});
    await esperar(1500);
  }

  // :visible descarta las copias ocultas que WhatsApp deja montadas.
  const enLista = page.locator(`span[title="${canal}"]:visible`).first();
  if (await enLista.isVisible({ timeout: 4000 }).catch(() => false)) {
    await enLista.click();
    return true;
  }

  // Sin suerte: se filtra con el buscador de la barra lateral.
  const buscador = await localizar(page, SELECTORES.buscar, 4000);
  if (!buscador) return false;

  await buscador.click();
  await buscador.fill(canal).catch(async () => {
    await page.keyboard.type(canal, { delay: 40 });
  });
  await esperar(2000);

  const resultado = page.getByText(canal, { exact: true }).first();
  if (await resultado.isVisible({ timeout: 5000 }).catch(() => false)) {
    await resultado.click();
    return true;
  }

  return false;
}

/** Escribe el texto respetando los saltos de línea con Shift+Enter. */
async function escribir(page, texto) {
  await cerrarAvisos(page);
  const compositor = await localizar(page, SELECTORES.compositor, 20_000);
  if (!compositor) return null;

  await compositor.click();
  await esperar(300);

  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i]) await page.keyboard.insertText(lineas[i]);
    if (i < lineas.length - 1) await page.keyboard.press('Shift+Enter');
  }

  return compositor;
}

/** Espera a que el compositor se vacíe (= has pulsado Enter y el mensaje salió). */
async function esperarEnvio(page, compositor, minutos) {
  const limite = Date.now() + minutos * 60_000;

  while (Date.now() < limite) {
    if (page.isClosed() || !page.url().startsWith('https://web.whatsapp.com')) return 'cerrado';

    const texto = await compositor.innerText().catch(() => null);
    if (texto === null) return 'cerrado';
    if (texto.trim() === '') return 'enviado';

    await esperar(800);
  }

  return 'tiempo';
}

/** Cuántas veces aparece la marca del mensaje en la conversación abierta. */
async function contarMarca(page, marca) {
  if (!marca) return 0;
  return page
    .locator('#main')
    .getByText(marca, { exact: false })
    .count()
    .catch(() => 0);
}

/**
 * Confirma que el mensaje está de verdad en el canal: si la vista se ha movido
 * (el usuario cambió de chat), se vuelve al canal y se busca la marca.
 * Compara con las apariciones que había antes de escribir.
 */
async function confirmarEnvio(page, canal, marca, antes) {
  const cabecera = (await page.locator('#main header').innerText().catch(() => '')) || '';
  if (!cabecera.includes(canal)) {
    if (!(await abrirCanal(page, canal))) return false;
    await esperar(2500);
  }

  for (let intento = 0; intento < 6; intento++) {
    if ((await contarMarca(page, marca)) > antes) return true;
    await esperar(800);
  }

  return false;
}

function leerRegistro() {
  try {
    return JSON.parse(readFileSync(REGISTRO, 'utf8'));
  } catch {
    return {};
  }
}

function marcarEnviado(clave) {
  const registro = leerRegistro();
  registro[clave] = new Date().toISOString();
  writeFileSync(REGISTRO, `${JSON.stringify(registro, null, 2)}\n`, 'utf8');
}

async function publicar(opciones) {
  // 1. Texto: o libre, o el mismo que manda Telegram.
  let texto = opciones.mensaje.trim();
  let coplas = [];

  if (!texto) {
    if (!opciones.solo.length) {
      console.log(AYUDA);
      throw new Error('Indica --solo <slug> o --mensaje "<texto>".');
    }
    coplas = cargarCoplas(opciones.solo);
    if (!coplas.length) throw new Error('No existe ninguno de esos slugs en la colección.');
    texto = textoDe(coplas);
  }

  const clave = opciones.solo.length ? opciones.solo.join(',') : `mensaje:${texto.slice(0, 40)}`;

  console.log('Mensaje:\n');
  console.log(texto);
  console.log('');

  if (opciones.seco) {
    console.log('(--dry-run: no se abre Chrome ni se publica nada)');
    return 0;
  }

  if (!opciones.forzar && !opciones.comprobar) {
    const ya = leerRegistro()[clave];
    if (ya) {
      console.log(`Ya se publicó este aviso el ${new Date(ya).toLocaleString('es-ES')}.`);
      console.log('Usa --forzar si quieres volver a publicarlo.');
      return 0;
    }
  }

  // 2. La ficha tiene que responder 200: Netlify tarda 1-2 min tras el push.
  for (const copla of coplas) {
    const url = urlAcorde(copla);
    process.stdout.write(`Esperando a que responda ${url} … `);
    const publicada = await esperarPublicacion(url, opciones.espera);
    console.log(publicada ? '200' : 'sin respuesta');
    if (!publicada) throw new Error(`La ficha ${url} no responde 200. No se ha abierto nada.`);
  }

  // 3. Chrome con el perfil propio.
  const contexto = await abrirNavegador();
  let codigo = 0;

  try {
    const page = contexto.pages()[0] || (await contexto.newPage());
    page.setDefaultTimeout(15_000);
    await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const estado = await estadoSesion(page, 90_000);
    if (estado === 'qr') {
      await captura(page, 'sesion-caducada');
      console.error('✗ WhatsApp pide vincular el dispositivo: la sesión ha caducado.');
      console.error('  Ejecuta `npm run wa:login` y vuelve a intentarlo.');
      return 2;
    }
    if (estado !== 'listo') {
      await captura(page, 'sin-sesion');
      throw new Error('No se pudo abrir WhatsApp Web. Mira wa-debug/.');
    }

    console.log(`Abriendo el canal «${opciones.canal}»…`);
    if (!(await abrirCanal(page, opciones.canal))) {
      await captura(page, 'canal-no-encontrado');
      console.error(`✗ No se encontró el canal «${opciones.canal}». Mira wa-debug/.`);
      return 3;
    }

    // Marca única del aviso y cuántas veces aparecía ya: así se distingue el
    // envío real de un cambio de vista.
    const marca = texto.split('\n').map((linea) => linea.trim()).filter(Boolean).pop() || '';
    const antes = await contarMarca(page, marca);

    if (opciones.comprobar) {
      const ruta = await captura(page, 'comprobacion');
      console.log('✓ Canal abierto sin escribir nada (--comprobar).');
      console.log(`  Apariciones de la marca del aviso en el canal: ${antes}`);
      if (ruta) console.log(`  Captura: ${ruta}`);
      return 0;
    }

    const compositor = await escribir(page, texto);
    if (!compositor) {
      await captura(page, 'compositor-no-encontrado');
      console.error('✗ No se encontró el compositor del canal. Mira wa-debug/.');
      return 4;
    }

    console.log('');
    console.log('El mensaje está escrito en el canal. Revísalo y pulsa Enter para enviarlo.');
    console.log('(Si tienes activado «Intro para nueva línea», envía con Ctrl+Enter).');
    console.log(`Esperando hasta ${opciones.esperaManual} minutos…`);

    const resultado = await esperarEnvio(page, compositor, opciones.esperaManual);
    const confirmado =
      resultado === 'enviado' && (await confirmarEnvio(page, opciones.canal, marca, antes));
    const ruta = await captura(page, `envio-${confirmado ? 'confirmado' : resultado}`);

    if (confirmado) {
      marcarEnviado(clave);
      console.log('✓ Mensaje enviado y confirmado en el canal de WhatsApp.');
      if (ruta) console.log(`  Captura: ${ruta}`);
    } else if (resultado === 'tiempo') {
      console.error('✗ Se agotó la espera sin enviar: el mensaje sigue en el compositor.');
      codigo = 5;
    } else if (resultado === 'enviado') {
      console.error('✗ El compositor se vació, pero no pude confirmar el aviso en el canal.');
      console.error('  Compruébalo a mano antes de repetirlo (o usa --forzar).');
      codigo = 5;
    } else {
      console.error('✗ Se cerró la ventana sin enviar.');
      codigo = 5;
    }

    if (codigo === 0) {
      // Deja unos segundos para que WhatsApp confirme el envío al servidor.
      await esperar(3000);
    }
  } finally {
    await contexto.close().catch(() => {});
  }

  return codigo;
}

async function principal() {
  const opciones = leerArgumentos(process.argv);

  if (opciones.ayuda) {
    console.log(AYUDA);
    return 0;
  }

  return opciones.comando === 'login' ? (await login(), 0) : publicar(opciones);
}

principal()
  .then((codigo) => {
    process.exitCode = codigo ?? 0;
  })
  .catch((error) => {
    const mensaje = String(error?.message || error);
    console.error(`✗ ${mensaje}`);
    if (/chrome|channel/i.test(mensaje)) {
      console.error('  ¿Está Chrome instalado? El script usa tu Chrome (channel: "chrome").');
    }
    process.exitCode = 1;
  });
