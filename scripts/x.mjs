// scripts/x.mjs
//
// Publica el aviso de coplas nuevas en X (@AcordesGaditano) con tu Chrome.
// Mismo patrón que el canal de WhatsApp: perfil propio (./x-profile), el
// mensaje se deja escrito en el compositor y tú pulsas «Publicar».
//
// Uso:
//   npm run x:login                          iniciar sesión (una vez)
//   npm run x -- --solo pasodoble-la-marea   escribir el aviso con su imagen
//   npm run x -- --solo <slug> --dry-run     ver el texto sin abrir el navegador
//   npm run x -- --texto "hola"              texto libre
//
// Variables de entorno:
//   X_CUENTA    cuenta para verificar la publicación (@AcordesGaditano)
//   X_PERFIL    carpeta del perfil de Chrome (./x-profile)
//
// Códigos de salida:
//   0  publicado (o nada que hacer)
//   1  error inesperado
//   2  sesión caducada: hay que ejecutar `npm run x:login`
//   3  no se encontró el compositor
//   5  no se publicó (cerraste el compositor o se agotó la espera)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

import { cargarCoplas, esperarPublicacion, urlAcorde } from './lib/aviso.mjs';
import { ajustarTuit, contarTuit, descargarImagen, ETIQUETAS, tuitDeCoplas, LIMITE } from './lib/tuit.mjs';

const WEB = 'https://x.com';
const COMPONER = `${WEB}/compose/post`;
const CUENTA = (process.env.X_CUENTA || '@AcordesGaditano').replace(/^@/, '');
const PERFIL = path.resolve(process.env.X_PERFIL || 'x-profile');
const DEPURACION = path.resolve('x-debug');
const REGISTRO = path.resolve('x-enviados.json');

/** Selectores por data-testid / role: las clases de X cambian a diario. */
const SELECTORES = {
  sesion: [
    '[data-testid="SideNav_AccountSwitcher_Button"]',
    '[data-testid="AppTabBar_Home_Link"]',
    '[data-testid="SideNav_NewTweet_Button"]',
  ],
  sinSesion: [
    '[data-testid="loginButton"]',
    'a[href="/login"]',
    '[data-testid="login"]',
  ],
  compositor: ['[data-testid="tweetTextarea_0"]', '[role="textbox"][contenteditable="true"]'],
  publicar: ['[data-testid="tweetButton"]', '[data-testid="tweetButtonInline"]'],
  archivo: ['input[data-testid="fileInput"]', 'input[type="file"]'],
  adjunto: ['[data-testid="attachments"]', '[data-testid="tweetPhoto"]', '[data-testid="removeMedia"]'],
};

const AYUDA = [
  'Uso:',
  '  npm run x:login                          iniciar sesión en X (una vez)',
  '  npm run x -- --solo <slug>[,<slug>]      escribir el tuit con la imagen del acorde',
  '  npm run x -- --solo <slug> --dry-run     ver el texto sin abrir Chrome',
  '',
  'Opciones:',
  '  --texto "<texto>"       publicar un texto libre',
  '  --imagen <url>          imagen para el texto libre',
  '  --etiquetar @a,@b       cuentas a etiquetar en la imagen (por defecto las del proyecto)',
  '  --sin-etiquetas         no etiquetar a nadie en la imagen',
  '  --cuenta @handle        cuenta para verificar (por defecto @AcordesGaditano)',
  '  --espera <seg>          espera máxima a que la ficha responda 200 (240)',
  '  --sin-esperar           no espera a la publicación de la ficha',
  '  --espera-manual <min>   minutos que espera a que pulses Publicar (30; 0 = sin límite)',
  '  --forzar                publicar aunque ya esté en x-enviados.json',
  '  --manual                dejar el tuit escrito y esperar a que pulses Publicar',
  '  --margen <seg>          segundos de margen antes de publicar solo (15)',
  '  --comprobar             abrir el compositor con texto e imagen y capturar, sin publicar',
  '  --dry-run               enseñar el texto y salir',
].join('\n');

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

function leerArgumentos(argv) {
  const opciones = {
    comando: 'post',
    solo: [],
    texto: '',
    imagen: '',
    etiquetas: [...ETIQUETAS],
    cuenta: CUENTA,
    espera: 240,
    esperaManual: 30,
    manual: false,
    margen: 15,
    forzar: false,
    seco: false,
    comprobar: false,
    ayuda: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const siguiente = argv[i + 1];

    if (arg === 'login' || arg === 'post') opciones.comando = arg;
    else if (arg === '--dry-run' || arg === '--seco') opciones.seco = true;
    else if (arg === '--forzar') opciones.forzar = true;
    else if (arg === '--comprobar') opciones.comprobar = true;
    else if (arg === '--manual') opciones.manual = true;
    else if (arg === '--margen') {
      const segundos = Number(siguiente);
      opciones.margen = Number.isFinite(segundos) ? segundos : 15;
      i++;
    }
    else if (arg === '--sin-esperar') opciones.espera = 0;
    else if (arg === '--espera') {
      opciones.espera = Number(siguiente) || 0;
      i++;
    } else if (arg === '--espera-manual') {
      const minutos = Number(siguiente);
      opciones.esperaManual = Number.isFinite(minutos) ? minutos : 30;
      i++;
    } else if (arg === '--cuenta') {
      opciones.cuenta = (siguiente || '').replace(/^@/, '');
      i++;
    } else if (arg === '--solo') {
      opciones.solo = (siguiente || '')
        .split(',')
        .map((slug) => slug.trim().replace(/\.md$/, ''))
        .filter(Boolean);
      i++;
    } else if (arg === '--texto') {
      opciones.texto = siguiente || '';
      i++;
    } else if (arg === '--imagen') {
      opciones.imagen = siguiente || '';
      i++;
    } else if (arg === '--etiquetar') {
      opciones.etiquetas = (siguiente || '')
        .split(',')
        .map((cuenta) => cuenta.trim().replace(/^@/, ''))
        .filter(Boolean);
      i++;
    } else if (arg === '--sin-etiquetas') {
      opciones.etiquetas = [];
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
    return page.screenshot({ path: ruta }).then(() => ruta).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

async function localizar(page, selectores, esperaMs = 0) {
  const limite = Date.now() + esperaMs;

  do {
    for (const selector of selectores) {
      const local = page.locator(selector).first();
      try {
        if (await local.isVisible({ timeout: 300 })) return local;
      } catch {
        // Selector inexistente en este DOM: siguiente.
      }
    }
    if (Date.now() >= limite) break;
    await esperar(400);
  } while (Date.now() < limite);

  return null;
}

/**
 * Espera de verdad a que un elemento aparezca visible. `locator.isVisible()` NO
 * espera: devuelve el estado en ese instante e ignora el timeout, así que no
 * sirve para algo que aún se está pintando (p. ej. «Etiquetar personas», que
 * solo sale cuando la imagen ha terminado de subir).
 */
async function aparece(local, timeout) {
  return local
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

/** 'listo' con sesión, 'sin-sesion' si hay que entrar a mano, null si no se sabe. */
async function estadoSesion(page, esperaMs) {
  const limite = Date.now() + esperaMs;

  do {
    if (await localizar(page, SELECTORES.sesion)) return 'listo';
    if (await localizar(page, SELECTORES.sinSesion)) return 'sin-sesion';
    await esperar(500);
  } while (Date.now() < limite);

  return null;
}

/** Handle de la cuenta que tiene la sesión abierta, si se puede leer. */
async function cuentaActual(page) {
  const boton = await localizar(page, ['[data-testid="SideNav_AccountSwitcher_Button"]'], 3000);
  if (!boton) return '';

  const texto = (await boton.innerText().catch(() => '')) || '';
  const encontrado = texto.match(/@([A-Za-z0-9_]{2,20})/);
  return encontrado ? encontrado[1] : '';
}

async function login() {
  console.log(`Abriendo X con el perfil ${PERFIL}…`);
  const contexto = await abrirNavegador();

  try {
    const page = contexto.pages()[0] || (await contexto.newPage());
    await page.goto(`${WEB}/home`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    let estado = await estadoSesion(page, 20_000);

    if (estado !== 'listo') {
      console.log('Inicia sesión en la ventana de Chrome (incluida la verificación).');
      console.log('Esperando hasta 5 minutos…');
      estado = (await localizar(page, SELECTORES.sesion, 300_000)) ? 'listo' : estado;
    }

    if (estado !== 'listo') {
      await captura(page, 'login-sin-sesion');
      throw new Error('No se detectó la sesión iniciada. Mira x-debug/.');
    }

    const cuenta = await cuentaActual(page);
    if (cuenta && cuenta.toLowerCase() !== CUENTA.toLowerCase()) {
      await captura(page, 'cuenta-distinta');
      throw new Error(`La sesión es de @${cuenta}, no de @${CUENTA}.`);
    }

    console.log(`✓ Sesión iniciada${cuenta ? ` como @${cuenta}` : ''}.`);
    if (!cuenta) console.warn('  No pude leer el handle; se usará X_CUENTA al verificar.');
  } finally {
    await contexto.close();
  }
}

/** Escribe el texto respetando los saltos con Shift+Enter (Enter publicaría). */
async function escribir(page, texto) {
  const caja = await localizar(page, SELECTORES.compositor, 25_000);
  if (!caja) return null;

  await caja.click();
  await esperar(400);

  // X también restaura borradores: se vacía lo que haya antes de escribir.
  const previo = (await caja.innerText().catch(() => '')) || '';
  if (previo.trim()) {
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Delete').catch(() => {});
    await esperar(400);
    console.log('(Había un borrador en el compositor: se ha vaciado antes de escribir.)');
  }

  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i]) await page.keyboard.insertText(lineas[i]);
    if (i < lineas.length - 1) await page.keyboard.press('Shift+Enter');
  }

  return caja;
}

async function adjuntar(page, imagen) {
  const entrada = page.locator(SELECTORES.archivo[0]).first();
  const otra = page.locator(SELECTORES.archivo[1]).first();
  const destino = (await entrada.count()) ? entrada : otra;

  await destino.setInputFiles({
    name: imagen.nombre,
    mimeType: imagen.mimeType,
    buffer: imagen.buffer,
  });

  return Boolean(await localizar(page, SELECTORES.adjunto, 30_000));
}

/**
 * Etiqueta cuentas en la imagen («Etiquetar personas»). Es best-effort: si una
 * cuenta no aparece se anota y se sigue, sin tumbar la publicación.
 * El panel se abre una vez, se añaden todas y se cierra con «Listo».
 */
async function etiquetar(page, cuentas) {
  const abrir = page.getByText('Etiquetar personas', { exact: false }).first();
  if (!(await aparece(abrir, 60_000))) {
    return { estado: 'sin-panel', puestas: [], fallidas: [...cuentas] };
  }

  await abrir.click();
  await esperar(1500);

  const puestas = [];
  const fallidas = [];

  for (const cuenta of cuentas) {
    const campo = page.locator('input[data-testid="searchPeople"]').first();
    if (!(await aparece(campo, 5000))) {
      fallidas.push(cuenta);
      continue;
    }

    await campo.click();
    await campo.fill('').catch(() => {});
    await page.keyboard.type(cuenta, { delay: 60 });
    await esperar(3000);

    // Solo vale la coincidencia exacta del handle: la búsqueda devuelve parecidos.
    const filas = page.locator('[data-testid="TypeaheadUser"]');
    const total = await filas.count().catch(() => 0);
    let elegida = null;

    for (let i = 0; i < total; i++) {
      const texto = (await filas.nth(i).innerText().catch(() => '')) || '';
      const handle = texto.match(/@([A-Za-z0-9_]+)/);
      if (handle && handle[1].toLowerCase() === cuenta.toLowerCase()) {
        elegida = filas.nth(i);
        break;
      }
    }

    if (!elegida) {
      fallidas.push(cuenta);
      continue;
    }

    await elegida.click();
    puestas.push(cuenta);
    await esperar(1500);
  }

  const listo = page.getByRole('button', { name: 'Listo' }).first();
  if (await aparece(listo, 4000)) await listo.click();
  await esperar(1200);

  return { estado: 'ok', puestas, fallidas };
}

/** Pulsa «Publicar» en el compositor. */
async function pulsarPublicar(page) {
  for (const selector of SELECTORES.publicar) {
    const boton = page.locator(selector).first();
    if (await boton.isVisible({ timeout: 2500 }).catch(() => false)) {
      await boton.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

/** Espera a que el compositor se cierre (= has pulsado Publicar). */
async function esperarPublicacionManual(page, minutos) {
  // 0 = sin límite (hasta 6 h): se espera a que publiques o cierres la ventana.
  const tope = minutos > 0 ? minutos : 360;
  const limite = Date.now() + tope * 60_000;

  while (Date.now() < limite) {
    if (page.isClosed()) return 'cerrado';

    // Al publicar, X cierra el compositor y vuelve a la portada. Ojo: el compositor
    // en línea de /home también lleva tweetTextarea_0, así que la señal fiable es
    // haber salido de /compose/post (si no, la espera se agotaba aunque el tuit
    // estuviera publicado).
    let ruta = '';
    try {
      ruta = new URL(page.url()).pathname;
    } catch {}
    if (!ruta.startsWith('/compose/')) return 'publicado';

    const abierto = await page
      .locator(SELECTORES.compositor[0])
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (!abierto) return 'publicado';
    await esperar(800);
  }

  return 'tiempo';
}

/** Quita el aviso de cookies si está (tapa la parte baja de la pantalla). */
async function cerrarCookies(page) {
  for (const nombre of [
    /Rechazar cookies no necesarias/i,
    /Reject non-essential cookies/i,
    /Aceptar todas las cookies/i,
    /Accept all cookies/i,
  ]) {
    const boton = page.getByRole('button', { name: nombre }).first();
    if (await boton.isVisible({ timeout: 1200 }).catch(() => false)) {
      await boton.click().catch(() => {});
      await esperar(600);
      return;
    }
  }
}

/** Cuántas veces aparece la marca del aviso en el perfil (para comparar antes/después). */
async function contarMarcas(page, cuenta, marcas) {
  await page.goto(`${WEB}/${cuenta}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await esperar(4000);

  let total = 0;
  for (const marca of marcas) {
    if (!marca) continue;
    total = Math.max(total, await page.getByText(marca, { exact: false }).count().catch(() => 0));
  }
  return total;
}

/** Confirma que el tuit está en el perfil contando las apariciones de la marca. */
async function confirmar(page, cuenta, marcas, antes) {
  for (let intento = 0; intento < 5; intento++) {
    const ahora = await contarMarcas(page, cuenta, marcas);
    if (ahora > antes) return true;
    await esperar(3000);
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
  let coplas = [];
  let texto = opciones.texto.trim();

  if (!texto) {
    if (!opciones.solo.length) {
      console.log(AYUDA);
      throw new Error('Indica --solo <slug> o --texto "<texto>".');
    }

    coplas = cargarCoplas(opciones.solo);
    if (!coplas.length) throw new Error('No existe ninguno de esos slugs en la colección.');
    texto = tuitDeCoplas(coplas);
  }

  const ajustado = ajustarTuit(texto);
  if (ajustado !== texto) console.log('(El texto se ha recortado para caber en 280.)');
  texto = ajustado;

  const clave = opciones.solo.length ? opciones.solo.join(',') : `texto:${texto.slice(0, 40)}`;

  console.log('Tuit:\n');
  console.log(texto);
  console.log(`\n(${contarTuit(texto)}/${LIMITE} caracteres)`);
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

  // La ficha tiene que responder 200: Netlify tarda 1-2 min tras el push.
  for (const copla of coplas) {
    const url = urlAcorde(copla);
    process.stdout.write(`Esperando a que responda ${url} … `);
    const publicada = await esperarPublicacion(url, opciones.espera);
    console.log(publicada ? '200' : 'sin respuesta');
    if (!publicada) throw new Error(`La ficha ${url} no responde 200. No se ha abierto nada.`);
  }

  // La imagen se valida antes de abrir el navegador.
  const urlImagen = opciones.imagen || coplas[0]?.datos.img || '';
  let imagen = null;
  if (urlImagen) {
    process.stdout.write('Descargando la imagen … ');
    imagen = await descargarImagen(urlImagen);
    console.log(`${Math.round(imagen.bytes / 1024)} KB (${imagen.mimeType})`);
  } else {
    console.log('Sin imagen: el .md no trae img.');
  }

  const contexto = await abrirNavegador();
  let codigo = 0;

  try {
    const page = contexto.pages()[0] || (await contexto.newPage());
    page.setDefaultTimeout(20_000);
    await page.goto(`${WEB}/home`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.bringToFront().catch(() => {});

    const estado = await estadoSesion(page, 30_000);
    if (estado === 'sin-sesion') {
      await captura(page, 'sesion-caducada');
      console.error('✗ X pide iniciar sesión: ejecuta `npm run x:login` y vuelve a intentarlo.');
      return 2;
    }
    if (estado !== 'listo') {
      await captura(page, 'sin-sesion');
      throw new Error('No se pudo abrir X. Mira x-debug/.');
    }

    await cerrarCookies(page);

    // Marcas para confirmar el tuit: el enlace y la línea de la copla.
    const marcas = [
      coplas.length ? urlAcorde(coplas[0]) : '',
      texto.split('\n').find((linea) => linea.startsWith('🎭')) || '',
    ].filter(Boolean);

    const antes = await contarMarcas(page, opciones.cuenta, marcas);

    await page.goto(COMPONER, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await cerrarCookies(page);

    const caja = await escribir(page, texto);
    if (!caja) {
      await captura(page, 'compositor-no-encontrado');
      console.error('✗ No se encontró el compositor de X. Mira x-debug/.');
      return 3;
    }

    if (imagen) {
      process.stdout.write('Adjuntando la imagen … ');
      const adjunta = await adjuntar(page, imagen);
      console.log(adjunta ? 'ok' : 'no se pudo confirmar el adjunto');
      if (!adjunta) await captura(page, 'imagen-sin-adjuntar');
    }

    if (imagen && opciones.etiquetas.length) {
      const lista = opciones.etiquetas.map((cuenta) => `@${cuenta}`).join(' ');
      process.stdout.write(`Etiquetando ${lista} … `);
      const res = await etiquetar(page, opciones.etiquetas);

      if (res.estado !== 'ok') {
        console.log('no se encontró «Etiquetar personas»');
        await captura(page, 'etiquetas-sin-panel');
      } else if (res.fallidas.length) {
        console.log(`puestas ${res.puestas.length}, fallaron ${res.fallidas.join(', ')}`);
        await captura(page, 'etiquetas-incompletas');
      } else {
        console.log(`ok (${res.puestas.length})`);
      }
    }

    await esperar(1000);

    if (opciones.comprobar) {
      const ruta = await captura(page, 'comprobacion');
      console.log('✓ Compositor listo, sin publicar (--comprobar).');
      if (ruta) console.log(`  Captura: ${ruta}`);
      return 0;
    }

    console.log('');

    if (opciones.manual) {
      console.log('El tuit está listo en el compositor. Revísalo y pulsa «Publicar».');
      console.log(
        opciones.esperaManual > 0
          ? `Esperando hasta ${opciones.esperaManual} minutos (o cierra la ventana)…`
          : 'Esperando sin límite: publica o cierra la ventana.',
      );
    } else {
      console.log(`Se publica en ${opciones.margen} s. Cierra la ventana si no quieres.`);
      await esperar(opciones.margen * 1000);
      const pulsado = await pulsarPublicar(page);
      if (!pulsado) console.log('No encontré el botón «Publicar»: prueba con --manual.');
    }

    await page.bringToFront().catch(() => {});

    const resultado = await esperarPublicacionManual(
      page,
      opciones.manual ? opciones.esperaManual : 2,
    );

    if (resultado !== 'publicado') {
      const ruta = await captura(page, `sin-publicar-${resultado}`);
      if (ruta) console.error(`  Captura: ${ruta}`);
      console.error(
        resultado === 'tiempo'
          ? '✗ Se agotó la espera sin publicar.'
          : '✗ Se cerró la ventana sin publicar.',
      );
      return 5;
    }

    const confirmado = await confirmar(page, opciones.cuenta, marcas, antes);
    const ruta = await captura(page, `publicado-${confirmado ? 'confirmado' : 'sin-confirmar'}`);

    if (confirmado) {
      marcarEnviado(clave);
      console.log(`✓ Tuit publicado y confirmado en @${opciones.cuenta}.`);
      if (ruta) console.log(`  Captura: ${ruta}`);
    } else {
      console.error('✗ El compositor se cerró, pero no pude confirmar el tuit en el perfil.');
      console.error('  Compruébalo a mano antes de repetirlo (o usa --forzar).');
      if (ruta) console.error(`  Captura: ${ruta}`);
      codigo = 5;
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

  if (opciones.comando === 'login') {
    await login();
    return 0;
  }

  return publicar(opciones);
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
