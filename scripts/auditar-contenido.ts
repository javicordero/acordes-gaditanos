// Auditor del contenido de las fichas.
//
// Vigila lo que el schema deja pasar (o tira en silencio) y lo que se escapa
// ficha a ficha: `pieza`/`modalidad` sin normalizar, campos obligatorios
// vacíos, fechas imposibles, claves mal escritas, duplicados, autores con
// variantes, imágenes caídas y vídeos sin auditar.
//
// Ojo: `cover` no es una imagen, es el vídeo de la versión a la guitarra
// (`autorCover`), y su estado no se audita.
//
// No repite lo que ya hacen `auditar:letras`, `auditar:orden` ni `npm run videos`:
// de los vídeos solo lee `src/data/videos-estado.json`.
//
// Uso:
//   npm run auditar:contenido              # todo, con comprobación de imágenes
//   npm run auditar:contenido -- --sin-red # sin salir a internet
//   npm run auditar:contenido -- --dir src/content/borradores
//
// Requiere Node >= 22.6 (igual que el resto de auditores en TypeScript).

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  MODALIDADES_CANONICAS,
  calificadorPieza,
  etiquetaModalidad,
  normalizarAgrupacion,
  normalizarAutor,
  normalizarPieza,
  tipoBasePieza,
} from '../src/lib/contenido.ts';
import { normalizeSlug, normalizeText } from '../src/lib/text.ts';

const argumentos = process.argv.slice(2);
const sinRed = argumentos.includes('--sin-red');
const indiceDir = argumentos.indexOf('--dir');
const DIR = indiceDir === -1 ? 'src/content/acordes' : argumentos[indiceDir + 1];
const CACHE_IMAGENES = '.cache/contenido-imagenes.json';
const DIAS_CACHE = 30;

const CLAVES = new Set([
  'pieza',
  'agrupacion',
  'musica',
  'letra',
  'letraTitulo',
  'img',
  'year',
  'modalidad',
  'cejilla',
  'date',
  'video',
  'cover',
  'autorCover',
  'fraseClave',
  'destacada',
  'recomendada',
]);

/** Calificadores que admite una pieza además del tipo base. */
const CALIFICADORES = new Set(['inédito', 'original', 'Noly']);

const errores: string[] = [];
const avisos: string[] = [];

const error = (mensaje: string) => errores.push(mensaje);
const aviso = (mensaje: string) => avisos.push(mensaje);

/* 1. Lectura --------------------------------------------------------------- */

interface Ficha {
  archivo: string;
  slug: string;
  data: Record<string, unknown>;
  cuerpo: string;
}

const entradas = fs.readdirSync(DIR);
const fichas: Ficha[] = [];

for (const archivo of entradas) {
  if (!archivo.endsWith('.md')) {
    aviso(`${archivo}: no es un .md, fuera de la colección (${DIR})`);
    continue;
  }

  const ruta = path.join(DIR, archivo);
  const crudo = fs.readFileSync(ruta, 'utf8');

  try {
    const { data, content } = matter(crudo);
    fichas.push({ archivo, slug: archivo.replace(/\.md$/, ''), data, cuerpo: content });
  } catch (fallo) {
    error(`${archivo}: no se puede leer el frontmatter (${(fallo as Error).message})`);
  }
}

/* 2. Campos obligatorios y claves conocidas -------------------------------- */

for (const ficha of fichas) {
  for (const clave of ['pieza', 'agrupacion', 'img', 'year', 'date']) {
    const valor = ficha.data[clave];
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      error(`${ficha.archivo}: falta "${clave}"`);
    }
  }

  for (const clave of Object.keys(ficha.data)) {
    if (!CLAVES.has(clave)) error(`${ficha.archivo}: clave desconocida "${clave}" (¿mal escrita?)`);
  }

  for (const clave of ['musica', 'letra']) {
    const valor = ficha.data[clave];
    if (valor === undefined || String(valor).trim() === '') {
      aviso(`${ficha.archivo}: sin "${clave}"`);
    }
  }
}

/* 3. Pieza y modalidad canónicas ------------------------------------------ */

for (const ficha of fichas) {
  const pieza = String(ficha.data.pieza ?? '').trim();
  if (!pieza) continue;

  if (normalizarPieza(pieza) !== pieza) {
    error(`${ficha.archivo}: pieza «${pieza}» → «${normalizarPieza(pieza)}»`);
  }

  if (!tipoBasePieza(pieza)) {
    error(`${ficha.archivo}: tipo de pieza desconocido «${pieza}»`);
  }

  const calificador = calificadorPieza(pieza);
  if (calificador && !CALIFICADORES.has(calificador)) {
    aviso(`${ficha.archivo}: calificador «${calificador}» fuera de la lista (${[...CALIFICADORES].join(', ')})`);
  }

  const slugBase = normalizeSlug(tipoBasePieza(pieza));
  if (slugBase && !ficha.slug.startsWith(`${slugBase}-`)) {
    aviso(`${ficha.archivo}: el archivo no empieza por «${slugBase}-»; si se renombra, cambia la URL`);
  }

  const modalidad = String(ficha.data.modalidad ?? '').trim();
  if (!modalidad) {
    aviso(`${ficha.archivo}: sin modalidad`);
    continue;
  }

  const etiqueta = etiquetaModalidad(modalidad) ?? '';
  if (etiqueta !== modalidad) {
    error(`${ficha.archivo}: modalidad «${modalidad}» → «${etiqueta}»`);
  } else if (!MODALIDADES_CANONICAS.includes(etiqueta)) {
    error(`${ficha.archivo}: modalidad no reconocida «${modalidad}»`);
  }
}

/* 4. Fechas ---------------------------------------------------------------- */

for (const ficha of fichas) {
  const date = String(ficha.data.date ?? '').trim();
  const year = Number(ficha.data.year);
  if (!date) continue;

  const partes = date.split(/[-/]/).map(Number);
  if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) {
    error(`${ficha.archivo}: fecha «${date}» con formato inválido (DD/MM/AAAA)`);
    continue;
  }

  const [dia, mes, anio] = partes;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    error(`${ficha.archivo}: la fecha «${date}» no existe en el calendario`);
    continue;
  }

  if (Number.isFinite(year) && anio < year) {
    error(`${ficha.archivo}: fecha de alta ${date}, anterior al año de la copla (${year})`);
  }
}

/* 5. Autores --------------------------------------------------------------- */

const autores = new Map<string, Set<string>>();

for (const ficha of fichas) {
  for (const clave of ['musica', 'letra']) {
    const valor = String(ficha.data[clave] ?? '').trim();
    if (!valor) continue;

    const nombres = valor.split(',');
    if (nombres.some((nombre) => nombre.trim() === '')) {
      error(`${ficha.archivo}: "${clave}" tiene una coma de más o un autor vacío (${valor})`);
    }

    for (const nombre of nombres.map((n) => n.trim()).filter(Boolean)) {
      const canonico = normalizarAutor(nombre);
      if (canonico !== nombre) error(`${ficha.archivo}: autor «${nombre}» → «${canonico}»`);

      const claveNombre = normalizeText(canonico)
        .replace(/[^a-z0-9]/g, '')
        .trim();
      if (!claveNombre) continue;
      if (!autores.has(claveNombre)) autores.set(claveNombre, new Set());
      autores.get(claveNombre)!.add(canonico);
    }
  }
}

for (const [claveNombre, variantes] of autores) {
  if (variantes.size < 2) continue;
  aviso(`autores que pueden ser el mismo (${claveNombre}): ${[...variantes].join(' | ')}`);
}

/* 6. Duplicados ------------------------------------------------------------ */

function primerVerso(cuerpo: string): string {
  for (const linea of cuerpo.split(/\r?\n/)) {
    const limpia = linea
      .replace(/<a[^>]*>[\s\S]*?<\/a>/g, ' ')
      .replace(/<strong>[\s\S]*?<\/strong>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (/[a-záéíóúüñ]/i.test(limpia)) return normalizeText(limpia).replace(/[^a-z0-9]+/g, ' ').trim();
  }
  return '';
}

const porClave = new Map<string, Ficha[]>();

for (const ficha of fichas) {
  const verso = primerVerso(ficha.cuerpo);
  if (!verso) {
    aviso(`${ficha.archivo}: el <pre> no tiene letra reconocible`);
    continue;
  }

  const clave = [
    normalizeSlug(String(ficha.data.agrupacion ?? '')),
    String(ficha.data.year ?? ''),
    tipoBasePieza(String(ficha.data.pieza ?? '')),
    verso,
  ].join('|');

  if (!porClave.has(clave)) porClave.set(clave, []);
  porClave.get(clave)!.push(ficha);
}

for (const grupo of porClave.values()) {
  if (grupo.length < 2) continue;
  aviso(`posible duplicado (misma agrupación, año, pieza y primer verso): ${grupo.map((f) => f.archivo).join(' · ')}`);
}

/* 7. Agrupaciones ---------------------------------------------------------- */

const grafias = new Map<string, Set<string>>();

for (const ficha of fichas) {
  const agrupacion = String(ficha.data.agrupacion ?? '').trim();
  if (!agrupacion) continue;

  const canonica = normalizarAgrupacion(agrupacion);
  if (canonica !== agrupacion) {
    error(`${ficha.archivo}: agrupación «${agrupacion}» → «${canonica}»`);
  }

  const clave = normalizeSlug(agrupacion);
  if (!grafias.has(clave)) grafias.set(clave, new Set());
  grafias.get(clave)!.add(agrupacion);
}

const agrupacionesConVariantes = [...grafias]
  .filter(([, variantes]) => variantes.size > 1)
  .map(([slug, variantes]) => `${slug} (${[...variantes].map((v) => `«${v}»`).join(' / ')})`);

if (agrupacionesConVariantes.length) {
  aviso(
    `agrupaciones con más de una grafía, misma URL (${agrupacionesConVariantes.length}): ${agrupacionesConVariantes.join(', ')}`,
  );
}

/* 8. Vídeos ---------------------------------------------------------------- */

const estadoVideos: Record<string, { estado?: string }> = (() => {
  try {
    const crudo = JSON.parse(fs.readFileSync('src/data/videos-estado.json', 'utf8'));
    return crudo.videos ?? {};
  } catch {
    return {};
  }
})();

for (const ficha of fichas) {
  const video = String(ficha.data.video ?? '').trim();

  if (video) {
    const id = video.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
    if (!id) {
      error(`${ficha.archivo}: la URL del vídeo no se reconoce (${video})`);
    } else {
      const estado = estadoVideos[id]?.estado;
      if (!estado) aviso(`${ficha.archivo}: vídeo sin auditar (${id}); pásale \`npm run videos\``);
      else if (estado !== 'ok') aviso(`${ficha.archivo}: vídeo ${estado} (${id})`);
    }
  }

  // `cover` no es una imagen: es el vídeo de la versión a la guitarra
  // (`autorCover` es quien la toca). Se valida como vídeo, pero no se audita
  // su estado (AGENTS.md: los covers no se auditan).
  const cover = String(ficha.data.cover ?? '').trim();
  if (cover && !/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{11})/.test(cover)) {
    error(`${ficha.archivo}: la URL del cover no se reconoce (${cover})`);
  }
}

/* 9. Imágenes -------------------------------------------------------------- */

interface EstadoImagen {
  estado: 'ok' | '404' | 'error';
  http: number;
  fecha: string;
}

const urlsImagenes = new Set<string>();

for (const ficha of fichas) {
  const url = String(ficha.data.img ?? '').trim();
  if (!url) continue;
  if (!/^https?:\/\//i.test(url)) {
    error(`${ficha.archivo}: "img" no es una URL (${url})`);
    continue;
  }
  urlsImagenes.add(url);
}

function leerCache(): Record<string, EstadoImagen> {
  try {
    return JSON.parse(fs.readFileSync(CACHE_IMAGENES, 'utf8'));
  } catch {
    return {};
  }
}

const hoy = new Date().toISOString().slice(0, 10);

async function comprobarImagen(url: string): Promise<EstadoImagen> {
  const cabeceras = { 'user-agent': 'Mozilla/5.0 (compatible; acordes-gaditanos)' };

  try {
    let respuesta = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: cabeceras,
      signal: AbortSignal.timeout(15000),
    });

    if (respuesta.status === 405 || respuesta.status === 501) {
      respuesta = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { ...cabeceras, range: 'bytes=0-0' },
        signal: AbortSignal.timeout(15000),
      });
    }

    await respuesta.body?.cancel().catch(() => {});

    if (respuesta.status === 404 || respuesta.status === 410) {
      return { estado: '404', http: respuesta.status, fecha: hoy };
    }
    if (respuesta.status >= 400) return { estado: 'error', http: respuesta.status, fecha: hoy };
    return { estado: 'ok', http: respuesta.status, fecha: hoy };
  } catch {
    return { estado: 'error', http: 0, fecha: hoy };
  }
}

const cache = leerCache();
const pendientes = [...urlsImagenes].filter((url) => {
  const guardada = cache[url];
  if (!guardada) return true;
  const dias = (Date.now() - new Date(guardada.fecha).getTime()) / 86_400_000;
  return dias > DIAS_CACHE;
});

let comprobadas = 0;

if (!sinRed && pendientes.length) {
  console.log(`Comprobando ${pendientes.length} imagen(es)…`);
  let siguiente = 0;

  const trabajador = async () => {
    while (siguiente < pendientes.length) {
      const url = pendientes[siguiente++];
      cache[url] = await comprobarImagen(url);
      comprobadas++;
    }
  };

  await Promise.all(Array.from({ length: 6 }, trabajador));

  try {
    fs.mkdirSync(path.dirname(CACHE_IMAGENES), { recursive: true });
    const vigentes = Object.fromEntries(
      Object.entries(cache).filter(([url]) => urlsImagenes.has(url)),
    );
    fs.writeFileSync(CACHE_IMAGENES, `${JSON.stringify(vigentes, null, 2)}\n`);
  } catch (fallo) {
    aviso(`no se pudo guardar la caché de imágenes (${(fallo as Error).message})`);
  }
}

let sinComprobar = new Set<string>();

for (const ficha of fichas) {
  const url = String(ficha.data.img ?? '').trim();
  if (!/^https?:\/\//i.test(url)) continue;

  const guardada = cache[url];
  if (!guardada) {
    sinComprobar.add(url);
    continue;
  }

  if (guardada.estado === '404') {
    error(`${ficha.archivo}: "img" da ${guardada.http} (${url})`);
  } else if (guardada.estado === 'error') {
    aviso(`${ficha.archivo}: "img" no se pudo comprobar (${guardada.http || 'sin respuesta'})`);
  }
}

if (sinComprobar.size) {
  aviso(`${sinComprobar.size} imagen(es) sin comprobar (sin red o fuera de la caché)`);
}

/* 10. Resumen -------------------------------------------------------------- */

console.log(`\nFichas: ${fichas.length} · imágenes distintas: ${urlsImagenes.size}` +
  `${sinRed ? ' (sin red)' : ` · comprobadas ahora: ${comprobadas}`}`);

if (errores.length) {
  console.error(`\n❌ ${errores.length} error(es):`);
  for (const mensaje of errores.sort()) console.error(`  - ${mensaje}`);
}

if (avisos.length) {
  console.log(`\n⚠️  ${avisos.length} aviso(s):`);
  for (const mensaje of avisos.sort()) console.log(`  - ${mensaje}`);
}

if (errores.length) {
  console.error(`\n❌ Contenido con errores (${errores.length}).`);
  process.exit(1);
}

console.log('\n✅ Contenido OK');
