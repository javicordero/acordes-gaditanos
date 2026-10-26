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
//
// El texto y la detección de ficheros nuevos viven en scripts/lib/aviso.mjs,
// porque el canal de WhatsApp (scripts/whatsapp.mjs) usa exactamente lo mismo.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import {
  cargarCopla,
  cargarCoplas,
  esperarPublicacion,
  ficherosAnadidos,
  mensajePrueba,
  ordenar,
  textoDe,
  urlAcorde,
} from './lib/aviso.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT = process.env.TELEGRAM_CHAT_ID || '@acordesgaditanos';

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
      parse_mode: 'HTML',
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

/**
 * Un push cuyo último commit lleve «[sin aviso]» en el asunto no notifica nada.
 * Sirve para subir coplas sin que salte el canal de Telegram.
 */
function marcadoSinAviso() {
  if (process.env.SALTAR_AVISO === '1') return true;

  try {
    const asunto = execFileSync('git', ['log', '-1', '--pretty=%s'], {
      encoding: 'utf8',
    }).trim();
    return /\[sin avisos?\]/i.test(asunto);
  } catch {
    return false;
  }
}

function escribirResumen(tituloResumen, texto) {  if (!process.env.GITHUB_STEP_SUMMARY) return;

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

  let coplas;
  if (opciones.solo.length) {
    coplas = cargarCoplas(opciones.solo);
  } else {
    if (marcadoSinAviso()) {
      console.log('El commit está marcado [sin aviso]: no se notifica nada.');
      escribirResumen('Aviso silenciado', 'El commit lleva [sin aviso].');
      return;
    }
    coplas = ordenar(ficherosAnadidos(opciones.antes, opciones.despues).map(cargarCopla));
  }

  if (!coplas.length) {
    console.log('Sin coplas nuevas en este push: no se avisa.');
    escribirResumen('Sin novedades', 'Este push no añade coplas nuevas.');
    return;
  }

  const texto = textoDe(coplas, opciones.tope, 'telegram');
  const textoPlano = textoDe(coplas, opciones.tope);

  if (opciones.seco) {
    console.log('Mensaje preparado (no enviado):\n');
    console.log(textoPlano);
    escribirResumen('Mensaje preparado (modo seco)', textoPlano);
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
  escribirResumen('Aviso enviado a Telegram', textoPlano);
}

principal().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
