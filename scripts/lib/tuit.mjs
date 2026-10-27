// scripts/lib/tuit.mjs
//
// Texto e imagen del aviso para X. Formato acordado:
//
//   🆕 Nuevos acordes en la web
//
//   🎭 Presentación – Los locos
//
//   🎵 El Tomate
//   ✏️ El Piru
//
//   🔗 https://acordesgaditanos.com/acordes/presentacion-los-locos/
//
// La imagen es el campo `img` del .md (la misma que usa la ficha y el og:image),
// validada antes de abrir el navegador.

import { SITE, etiquetaPieza, sinTildes, urlAcorde } from './aviso.mjs';

export const CABECERA = '🆕 Nuevos acordes en la web';
export const LIMITE = 280;

/** Cuentas que se etiquetan en la imagen de cada tuit (sin la @). */
export const ETIQUETAS = ['Carnavaladictos', 'Orteguilla25'];

const LIMITE_BYTES = 5 * 1024 * 1024; // tope de X para imágenes
const ANIO_RE = /\s+—\s+\d{4}$/;

/** «Presentación – Los locos». Sin año: ya sale en la vista previa del enlace. */
export function nombreCorto(datos) {
  const pieza = etiquetaPieza(datos.pieza);
  const titulo = (datos.letraTitulo || '').trim();
  const agrupacion = (datos.agrupacion || '').trim();
  return [pieza, titulo ? `"${titulo}"` : '', agrupacion].filter(Boolean).join(' – ');
}

/**
 * Autores con su icono. Si música y letra son la misma persona, una sola línea
 * con 🎵; si solo hay uno de los dos, el que haya.
 */
export function autoresDe(datos) {
  const musica = (datos.musica || '').trim();
  const letra = (datos.letra || '').trim();

  if (musica && letra && sinTildes(musica) !== sinTildes(letra)) {
    return [
      { icono: '🎵', nombre: musica },
      { icono: '✏️', nombre: letra },
    ];
  }

  const unico = musica || letra;
  return unico ? [{ icono: musica ? '🎵' : '✏️', nombre: unico }] : [];
}

function lineasCopla(copla, conAutores = true) {
  const lineas = [`🎭 ${nombreCorto(copla.datos)}`];
  if (conAutores) {
    const autores = autoresDe(copla.datos).map((autor) => `${autor.icono} ${autor.nombre}`);
    // Línea en blanco entre la pieza y los autores, como en WhatsApp y Telegram.
    if (autores.length) lineas.push('', ...autores);
  }
  return lineas;
}

/**
 * Texto del tuit. Una copla → su ficha (con autores). Varias → lista compacta
 * con el enlace a /lista/, sin autores para que quepa.
 */
export function tuitDeCoplas(coplas) {
  if (!coplas.length) return '';

  if (coplas.length === 1) {
    return [CABECERA, '', ...lineasCopla(coplas[0]), '', `🔗 ${urlAcorde(coplas[0])}`].join('\n');
  }

  return [
    CABECERA,
    '',
    ...coplas.flatMap((copla) => lineasCopla(copla, false)),
    '',
    `🔗 ${SITE}/lista/`,
  ].join('\n');
}

const URL_RE = /https?:\/\/\S+/g;
const ANCHO_DOBLE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

/**
 * Longitud como la cuenta X: cada enlace son 23 caracteres (t.co) y los emoji
 * y caracteres anchos valen 2.
 */
export function contarTuit(texto) {
  let total = 0;
  const sinUrls = texto.replace(URL_RE, () => {
    total += 23;
    return '';
  });

  for (const caracter of sinUrls) {
    const punto = caracter.codePointAt(0) || 0;
    total += punto > 0xffff || ANCHO_DOBLE.test(caracter) ? 2 : 1;
  }

  return total;
}

/**
 * Recorta hasta que quepa, sin tocar nunca la URL: primero se quitan las líneas
 * de autores (y el hueco que las separaba), luego se acorta el nombre de la copla
 * con puntos suspensivos.
 */
export function ajustarTuit(texto) {
  if (contarTuit(texto) <= LIMITE) return texto;

  const lineas = texto.split('\n');
  // Con el flag `u` la clase solo casa 🎵 y ✏️; sin él también se comía la
  // cabecera 🆕 y la línea 🎭, que comparten el primer surrogado.
  const sinAutores = lineas.filter((linea) => !/^[🎵✏️]/u.test(linea.trim()));

  // Al quitar los autores queda su línea en blanco: se colapsan las repetidas.
  const limpias = sinAutores.filter(
    (linea, i) => !(linea === '' && sinAutores[i - 1] === ''),
  );
  if (contarTuit(limpias.join('\n')) <= LIMITE) return limpias.join('\n');

  const recortado = limpias.map((linea) =>
    linea.startsWith('🎭 ') ? `${linea.slice(0, 60).trimEnd()}…` : linea,
  );
  return recortado.join('\n');
}

/** Formato real del archivo por sus primeros bytes (el content-type miente a veces). */
function detectarFormato(buffer) {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

const EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** Descarga la imagen del .md y la valida (formato real y tamaño). */
export async function descargarImagen(url) {
  if (!url) throw new Error('La copla no tiene campo img.');

  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AcordesGaditanos/1.0)' },
    });
  } catch (error) {
    throw new Error(`No se pudo descargar la imagen: ${error.message}`);
  }

  if (!res.ok) throw new Error(`La imagen respondió ${res.status}: ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > LIMITE_BYTES) {
    const mb = (buffer.byteLength / 1024 / 1024).toFixed(1);
    throw new Error(`La imagen pesa ${mb} MB y X admite como máximo 5 MB.`);
  }

  const mimeType = detectarFormato(buffer);
  if (!mimeType) {
    const tipo = res.headers.get('content-type') || 'desconocido';
    throw new Error(`El archivo no es una imagen admitida (content-type: ${tipo}).`);
  }

  return {
    buffer,
    mimeType,
    nombre: `acorde.${EXTENSION[mimeType]}`,
    bytes: buffer.byteLength,
  };
}

/** Quita el año de un título ya montado («… — 2024»). */
export function sinAnio(texto) {
  return texto.replace(ANIO_RE, '');
}
