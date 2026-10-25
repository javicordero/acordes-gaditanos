// scripts/difundir.mjs
//
// Avisa en el canal de Telegram de las coplas nuevas. Solo cuentan los .md
// AÑADIDOS en src/content/acordes: corregir o editar una copla ya publicada no
// avisa.
//
// Uso:
//   node scripts/difundir.mjs --antes <sha> --despues <sha>   (lo que usa la Action)
//   node scripts/difundir.mjs --antes HEAD~1 --dry-run        (probar sin enviar)
//   node scripts/difundir.mjs --solo pasodoble-la-marea       (reenviar a mano)
//   node scripts/difundir.mjs --test                          (mensaje de prueba)
//
// Variables de entorno:
//   TELEGRAM_BOT_TOKEN  obligatoria para enviar (nunca se imprime)
//   TELEGRAM_CHAT_ID    por defecto @acordesgaditanos
//   SITE_URL            por defecto https://acordesgaditanos.com
//   GITHUB_STEP_SUMMARY si existe, deja el texto en el resumen de la Action

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const CARPETA = 'src/content/acordes';
const SITE = (process.env.SITE_URL || 'https://acordesgaditanos.com').replace(/\/+$/, '');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT = process.env.TELEGRAM_CHAT_ID || '@acordesgaditanos';

/** Piezas que llegan del frontmatter en formas muy distintas (sin tildes, minúsculas…). */
const PIEZAS = {
  pasodoble: 'Pasodoble',
  presentacion: 'Presentación',
  popurri: 'Popurrí',
  'final de popurri': 'Final de popurrí',
  estribillo: 'Estribillo',
  tango: 'Tango',
  credo: 'Credo',
  cuarteta: 'Cuarteta',
};

function sinTildes(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function leerArgumentos(argv) {
  const opciones = {
    antes: '',
    despues: 'HEAD',
    seco: false,
    test: false,
    solo: [],
    espera: 300,
    tope: 10,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const siguiente = argv[i + 1];

    if (arg === '--dry-run' || arg === '--seco') {
      opciones.seco = true;
    } else if (arg === '--test') {
      opciones.test = true;
    } else if (arg === '--antes') {
      opciones.antes = siguiente;
      i++;
    } else if (arg === '--despues') {
      opciones.despues = siguiente;
      i++;
    } else if (arg === '--espera') {
      opciones.espera = Number(siguiente) || 0;
      i++;
    } else if (arg === '--sin-esperar') {
      opciones.espera = 0;
    } else if (arg === '--tope') {
      opciones.tope = Number(siguiente) || 10;
      i++;
    } else if (arg === '--solo') {
      opciones.solo = (siguiente || '')
        .split(',')
        .map((slug) => slug.trim().replace(/\.md$/, ''))
        .filter(Boolean);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Uso: node scripts/difundir.mjs [opciones]',
          '',
          '  --antes <sha>       commit base (por defecto: HEAD~1)',
          '  --despues <sha>     commit final (por defecto: HEAD)',
          '  --solo a,b          reenviar estos slugs, añadidos o no',
          '  --dry-run           enseña el mensaje sin enviarlo',
          '  --test              manda un mensaje de prueba',
          '  --espera <seg>      espera máxima a que la ficha responda 200 (300)',
          '  --sin-esperar       no espera a la publicación',
          '  --tope <n>          a partir de n coplas manda resumen (10)',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      console.warn(`Argumento desconocido: ${arg}`);
    }
  }

  return opciones;
}

function leerFrontmatter(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  const bloque = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!bloque) return {};

  const datos = {};
  for (const linea of bloque[1].split(/\r?\n/)) {
    const corte = linea.indexOf(':');
    if (corte <= 0) continue;

    const clave = linea.slice(0, corte).trim();
    let valor = linea.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    datos[clave] = valor.trim();
  }
  return datos;
}

function fechaDe(texto) {
  const partes = (texto || '').split(/[-/]/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return 0;
  return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
}

function etiquetaPieza(pieza) {
  const limpia = (pieza || '').trim().replace(/\s+/g, ' ');
  const clave = sinTildes(limpia);
  if (PIEZAS[clave]) return PIEZAS[clave];
  if (clave.startsWith('cuarteta')) return 'Cuarteta';
  return limpia ? limpia.charAt(0).toUpperCase() + limpia.slice(1) : '';
}

function titulo(datos) {
  const pieza = etiquetaPieza(datos.pieza);
  const agrupacion = (datos.agrupacion || '').trim();
  const year = (datos.year || '').trim();
  const nombre = [pieza, agrupacion].filter(Boolean).join(' ');
  return year ? `${nombre} — ${year}` : nombre;
}

/** Música y letra en líneas separadas; si son la misma persona, en una. */
function lineasAutores(datos) {
  const musica = (datos.musica || '').trim();
  const letra = (datos.letra || '').trim();

  if (musica && letra && sinTildes(musica) === sinTildes(letra)) {
    return [`Música y letra: ${musica}`];
  }

  const lineas = [];
  if (musica) lineas.push(`Música: ${musica}`);
  if (letra) lineas.push(`Letra: ${letra}`);
  return lineas;
}

function urlAcorde(copla) {
  return `${SITE}/acordes/${copla.slug}/`;
}

function mensajeUna(copla) {
  return [
    '🎶 Nuevos acordes',
    '',
    titulo(copla.datos),
    ...lineasAutores(copla.datos),
    '',
    urlAcorde(copla),
  ].join('\n');
}

function mensajeVarias(coplas) {
  return [
    `🎶 ${coplas.length} acordes nuevos`,
    '',
    ...coplas.map((copla) => `• ${titulo(copla.datos)}`),
    '',
    `${SITE}/lista/`,
  ].join('\n');
}

function mensajeResumen(coplas) {
  return [
    `🎶 ${coplas.length} acordes nuevos`,
    '',
    `Hoy hemos subido ${coplas.length} coplas al cancionero. La última, ${titulo(coplas[0].datos)}.`,
    '',
    `${SITE}/novedades/`,
  ].join('\n');
}

function mensajePrueba() {
  return [
    '🎶 Canal de Acordes Gaditanos',
    '',
    'Prueba de publicación correcta. A partir de ahora, cada acorde nuevo se avisará aquí.',
    '',
    `${SITE}/`,
  ].join('\n');
}

function ficherosAnadidos(antes, despues) {
  const base = !antes || /^0+$/.test(antes) ? `${despues}~1` : antes;

  try {
    const salida = execFileSync(
      'git',
      ['diff', '--diff-filter=A', '--name-only', base, despues, '--', CARPETA],
      { encoding: 'utf8' },
    ).trim();

    return salida ? salida.split(/\r?\n/).filter((ruta) => ruta.endsWith('.md')) : [];
  } catch (error) {
    console.warn(`No se pudo comparar ${base}..${despues}: ${error.message}`);
    return [];
  }
}

function cargarCopla(ruta) {
  return {
    ruta,
    slug: ruta.split('/').pop().replace(/\.md$/, ''),
    datos: leerFrontmatter(ruta),
  };
}

async function esperarPublicacion(url, segundos) {
  if (!segundos) return true;

  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status === 200) return true;
    } catch {
      // Reintentamos hasta agotar la espera.
    }
    await new Promise((listo) => setTimeout(listo, 10_000));
  }
  return false;
}

async function enviarTelegram(texto) {
  if (!TOKEN) {
    throw new Error('Falta TELEGRAM_BOT_TOKEN en el entorno.');
  }

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      text: texto,
      link_preview_options: { is_disabled: false, prefer_large_media: true },
    }),
  });

  let datos = {};
  try {
    datos = await res.json();
  } catch {
    // Respuesta sin JSON: nos quedamos con el código de estado.
  }

  if (!res.ok || datos.ok !== true) {
    throw new Error(
      `Telegram respondió ${res.status}: ${datos.description || 'sin descripción'}`,
    );
  }
}

function escribirResumen(tituloResumen, texto) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;

  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## ${tituloResumen}\n\n\`\`\`\n${texto}\n\`\`\`\n\n`,
    'utf8',
  );
}

async function principal() {
  const opciones = leerArgumentos(process.argv);

  if (opciones.test) {
    const texto = mensajePrueba();
    if (opciones.seco) {
      console.log('Mensaje de prueba (no enviado):\n');
      console.log(texto);
      escribirResumen('Mensaje de prueba (modo seco)', texto);
      return;
    }

    await enviarTelegram(texto);
    console.log('✓ Mensaje de prueba enviado a Telegram.');
    escribirResumen('Mensaje de prueba enviado', texto);
    return;
  }

  let rutas;
  if (opciones.solo.length) {
    rutas = opciones.solo
      .map((slug) => `${CARPETA}/${slug}.md`)
      .filter((ruta) => existsSync(ruta));

    const faltan = opciones.solo.filter((slug) => !existsSync(`${CARPETA}/${slug}.md`));
    if (faltan.length) console.warn(`No existen: ${faltan.join(', ')}`);
  } else {
    rutas = ficherosAnadidos(opciones.antes, opciones.despues);
  }

  if (!rutas.length) {
    console.log('Sin coplas nuevas en este push: no se avisa.');
    escribirResumen('Sin novedades', 'Este push no añade coplas nuevas.');
    return;
  }

  const coplas = rutas
    .map(cargarCopla)
    .sort(
      (a, b) =>
        fechaDe(b.datos.date) - fechaDe(a.datos.date) ||
        Number(b.datos.year) - Number(a.datos.year) ||
        (a.datos.agrupacion || '').localeCompare(b.datos.agrupacion || '', 'es'),
    );

  const texto =
    coplas.length === 1
      ? mensajeUna(coplas[0])
      : coplas.length > opciones.tope
        ? mensajeResumen(coplas)
        : mensajeVarias(coplas);

  if (opciones.seco) {
    console.log('Mensaje preparado (no enviado):\n');
    console.log(texto);
    escribirResumen('Mensaje preparado (modo seco)', texto);
    return;
  }

  if (coplas.length === 1) {
    const url = urlAcorde(coplas[0]);
    const publicada = await esperarPublicacion(url, opciones.espera);
    if (!publicada) {
      throw new Error(`La ficha ${url} no responde 200. No se ha enviado nada.`);
    }
  }

  await enviarTelegram(texto);
  console.log(`✓ Aviso enviado a Telegram (${coplas.length} copla${coplas.length === 1 ? '' : 's'}).`);
  escribirResumen('Aviso enviado a Telegram', texto);
}

principal().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
