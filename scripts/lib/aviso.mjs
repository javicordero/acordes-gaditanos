// scripts/lib/aviso.mjs
//
// Piezas comunes de los avisos de coplas nuevas: leer el frontmatter, componer
// el texto y esperar a que la ficha esté publicada. Lo usan los dos canales:
//   - scripts/difundir.mjs  (Telegram, desde la Action)
//   - scripts/whatsapp.mjs  (WhatsApp, desde local con Chrome)
// El texto tiene que salir idéntico por los dos, así que vive solo aquí.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const CARPETA = 'src/content/acordes';
export const SITE = (process.env.SITE_URL || 'https://acordesgaditanos.com').replace(/\/+$/, '');

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

export function sinTildes(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function leerFrontmatter(ruta) {
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

export function fechaDe(texto) {
  const partes = (texto || '').split(/[-/]/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return 0;
  return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
}

export function etiquetaPieza(pieza) {
  const limpia = (pieza || '').trim().replace(/\s+/g, ' ');
  const clave = sinTildes(limpia);
  if (PIEZAS[clave]) return PIEZAS[clave];

  // Cuarteta "Título": se normaliza el tipo y se conserva el título.
  const cuarteta = limpia.match(/^cuarteta\s+"(.+)"$/i);
  if (cuarteta) return `Cuarteta "${cuarteta[1]}"`;

  return limpia ? limpia.charAt(0).toUpperCase() + limpia.slice(1) : '';
}

/** Pieza y agrupación, sin año. */
export function nombreDe(datos) {
  const pieza = etiquetaPieza(datos.pieza);
  const agrupacion = (datos.agrupacion || '').trim();
  return [pieza, agrupacion].filter(Boolean).join(' ');
}

/** HTML de Telegram: evita que un «&» o un «<» del título rompan el mensaje. */
export function escaparHtml(texto) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Cada canal marca la negrita a su manera: WhatsApp con asteriscos (se aplican
 * al enviar) y Telegram con `<b>` y `parse_mode: HTML`.
 */
function negrita(texto, formato) {
  if (formato === 'telegram') return `<b>${escaparHtml(texto)}</b>`;
  if (formato === 'whatsapp') return `*${texto}*`;
  return texto;
}

/** Pieza y agrupación en negrita (sin año: en el aviso no aporta). */
export function tituloResaltado(datos, formato = 'plano') {
  return negrita(nombreDe(datos), formato);
}

/** Escapa el texto normal en Telegram; en los demás formatos no hay nada que escapar. */
function normal(texto, formato) {
  return formato === 'telegram' ? escaparHtml(texto) : texto;
}

/** Música y letra en líneas separadas; si son la misma persona, en una. */
export function lineasAutores(datos) {
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

export function urlAcorde(copla) {
  return `${SITE}/acordes/${copla.slug}/`;
}

export function mensajeUna(copla, formato = 'plano') {
  return [
    '🎶 Nuevos acordes',
    '',
    tituloResaltado(copla.datos, formato),
    '',
    ...lineasAutores(copla.datos).map((linea) => normal(linea, formato)),
    '',
    normal(urlAcorde(copla), formato),
  ].join('\n');
}

export function mensajeVarias(coplas, formato = 'plano') {
  return [
    '🎶 Nuevos acordes',
    '',
    ...coplas.map((copla) => `• ${tituloResaltado(copla.datos, formato)}`),
    '',
    normal(`${SITE}/lista/`, formato),
  ].join('\n');
}

export function mensajeResumen(coplas, formato = 'plano') {
  return [
    '🎶 Nuevos acordes',
    '',
    `Hoy hemos subido ${coplas.length} coplas al cancionero. La última, ${tituloResaltado(coplas[0].datos, formato)}.`,
    '',
    normal(`${SITE}/novedades/`, formato),
  ].join('\n');
}

export function mensajePrueba() {
  return [
    '🎶 Canal de Acordes Gaditanos',
    '',
    'Prueba de publicación correcta. A partir de ahora, cada acorde nuevo se avisará aquí.',
    '',
    `${SITE}/`,
  ].join('\n');
}

/** Texto del aviso según cuántas coplas entren en el mismo aviso. */
export function textoDe(coplas, tope = 10, formato = 'plano') {
  if (coplas.length === 1) return mensajeUna(coplas[0], formato);
  return coplas.length > tope ? mensajeResumen(coplas, formato) : mensajeVarias(coplas, formato);
}

export function ficherosAnadidos(antes, despues) {
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

export function cargarCopla(ruta) {
  return {
    ruta,
    slug: ruta.split('/').pop().replace(/\.md$/, ''),
    datos: leerFrontmatter(ruta),
  };
}

/** Coplas a partir de una lista de slugs. Avisa de los que no existen. */
export function cargarCoplas(slugs) {
  const rutas = slugs.map((slug) => `${CARPETA}/${slug}.md`).filter((ruta) => existsSync(ruta));
  const faltan = slugs.filter((slug) => !existsSync(`${CARPETA}/${slug}.md`));
  if (faltan.length) console.warn(`No existen: ${faltan.join(', ')}`);

  return ordenar(rutas.map(cargarCopla));
}

/** Más recientes primero; el orden del mensaje es el de esta lista. */
export function ordenar(coplas) {
  return [...coplas].sort(
    (a, b) =>
      fechaDe(b.datos.date) - fechaDe(a.datos.date) ||
      Number(b.datos.year) - Number(a.datos.year) ||
      (a.datos.agrupacion || '').localeCompare(b.datos.agrupacion || '', 'es'),
  );
}

/** Espera a que la ficha responda 200 (Netlify tarda 1-2 min tras el push). */
export async function esperarPublicacion(url, segundos) {
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
