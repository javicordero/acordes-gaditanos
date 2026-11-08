// scripts/rutas-fechas.ts
//
// Registro de la fecha de alta de cada ruta pública, para calcular en el panel
// la media de visitas por día. La fecha sale SIEMPRE del commit que añadió el
// archivo (nunca del campo `date` del frontmatter, que es una fecha asignada y
// puede ir en el futuro).
//
// El resultado se guarda en `public/rutas-fechas.json` y lo lee `/admin` al
// abrir Estadísticas. Las fechas ya registradas no se mueven: las rutas nuevas
// se añaden solas y las antiguas conservan su alta.
//
// Uso:
//   node --experimental-strip-types scripts/rutas-fechas.ts
//   node --experimental-strip-types scripts/rutas-fechas.ts --recalcular
//   node --experimental-strip-types scripts/rutas-fechas.ts --auditar
//   node --experimental-strip-types scripts/rutas-fechas.ts --silencioso
//
// `predev` y `prebuild` lo ejecutan en silencio. No hace commit ni push: eso lo
// hace `publicar-acorde.mjs` (el único que publica) o la Action `fechas.yml`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { normalizeSlug } from '../src/lib/text.ts';
import { construirHubs, type FichaHub } from '../src/lib/hubs.ts';

const RAIZ = process.cwd();
const SALIDA = join(RAIZ, 'public/rutas-fechas.json');
const DESDE = '2026-01-19';
const CARPETA = 'src/content/acordes';
const GLOSARIO = 'src/data/glosario-acordes.json';
const SITEMAP = join(RAIZ, 'dist/sitemap-0.xml');

const args = new Set(process.argv.slice(2));
const RECALCULAR = args.has('--recalcular');
const AUDITAR = args.has('--auditar');
const SILENCIOSO = args.has('--silencioso');

const hoy = () => new Date().toISOString().slice(0, 10);
const log = (...partes: unknown[]) => {
  if (!SILENCIOSO) console.log(...partes);
};
const max = (a: string, b: string) => (a > b ? a : b);

interface Ficha {
  slug: string;
  archivo: string;
  pieza: string;
  agrupacion: string;
  agrupacionSlug: string;
  year: string;
  modalidad: string;
  musicaSlugs: string[];
  letraSlugs: string[];
}

interface Registro {
  desde: string;
  rutas: Record<string, string>;
  patrones: Record<string, string>;
}

/** Fecha del commit que añadió cada archivo, en una sola pasada por git. */
function fechasDeAlta(): Map<string, string> {
  const mapa = new Map<string, string>();
  let salida = '';
  try {
    salida = execFileSync(
      'git',
      // `core.quotepath=false`: sin esto git escapa las rutas con tildes o ñ
      // (`final-de-popurr\303\255…`) y las fichas afectadas se quedaban sin fecha.
      ['-c', 'core.quotepath=false', 'log', '--reverse', '--diff-filter=A', '--no-renames', '--name-only', '--format=@@%ad', '--date=short'],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).replace(/\r\n/g, '\n');
  } catch {
    return mapa;
  }

  let fecha = '';
  for (const linea of salida.split('\n')) {
    if (linea.startsWith('@@')) {
      fecha = linea.slice(2).trim();
      continue;
    }
    const ruta = linea.trim();
    if (ruta && fecha && !mapa.has(ruta)) mapa.set(ruta, fecha);
  }
  return mapa;
}

const campo = (fm: string, clave: string): string => {
  const m = new RegExp(`^${clave}:\\s*(.+)$`, 'm').exec(fm);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

/** Las fichas publicadas, con lo justo para construir sus hubs. */
function leerFichas(): Ficha[] {
  return readdirSync(join(RAIZ, CARPETA))
    .filter((n) => n.endsWith('.md'))
    .map((n) => {
      const slug = n.slice(0, -3);
      const archivo = `${CARPETA}/${n}`;
      const md = readFileSync(join(RAIZ, archivo), 'utf8').replace(/\r\n/g, '\n');
      const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
      const agrupacion = campo(fm, 'agrupacion');
      const autores = (valor: string) =>
        valor.split(',').map((s) => s.trim()).filter(Boolean).map((s) => normalizeSlug(s));
      return {
        slug,
        archivo,
        pieza: campo(fm, 'pieza'),
        agrupacion,
        agrupacionSlug: normalizeSlug(agrupacion),
        year: campo(fm, 'year'),
        modalidad: campo(fm, 'modalidad'),
        musicaSlugs: autores(campo(fm, 'musica')),
        letraSlugs: autores(campo(fm, 'letra')),
      };
    });
}

/** Páginas fijas de `src/pages` (sin plantillas dinámicas ni rutas privadas). */
function rutasEstaticas(): Map<string, string> {
  const fuera = new Set(['admin.astro', 'estudio.astro', '404.astro', 'lista-otraweb.astro']);
  const carpetasFuera = new Set(['api', 'borradores', 'otraweb']);
  const salida = new Map<string, string>();

  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const abs = join(dir, nombre);
      if (statSync(abs).isDirectory()) {
        recorrer(abs);
        continue;
      }
      if (!nombre.endsWith('.astro') && !nombre.endsWith('.md')) continue;

      const rel = relative(join(RAIZ, 'src/pages'), abs).split(sep).join('/');
      if (rel.includes('[')) continue;
      if (carpetasFuera.has(rel.split('/')[0])) continue;
      if (fuera.has(rel)) continue;

      let ruta = rel.replace(/\.(astro|md)$/, '');
      if (ruta === 'index') ruta = '/';
      else if (ruta.endsWith('/index')) ruta = `/${ruta.slice(0, -6)}/`;
      else ruta = `/${ruta}/`;
      salida.set(ruta, `src/pages/${rel}`);
    }
  };

  recorrer(join(RAIZ, 'src/pages'));
  return salida;
}

/**
 * Plantillas dinámicas que no son de las familias conocidas. Se guardan como
 * patrón (`/seccion/`) para que una sección nueva quede cubierta aunque no
 * sepamos enumerar sus parámetros.
 */
function patronesNuevos(fecha: (archivo: string) => string): Map<string, string> {
  const conocidas = new Set([
    'acordes',
    'autor/musica',
    'autor/letra',
    'agrupacion',
    'carnaval',
    'decada',
    'modalidad',
    'pieza',
    'glosario',
    'borradores',
    'otraweb',
  ]);
  const salida = new Map<string, string>();

  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const abs = join(dir, nombre);
      if (statSync(abs).isDirectory()) {
        recorrer(abs);
        continue;
      }
      if (!nombre.endsWith('.astro') || !nombre.includes('[')) continue;

      const rel = relative(join(RAIZ, 'src/pages'), abs).split(sep).join('/');
      const partes = rel.split('/');
      const idx = partes.findIndex((p) => p.includes('['));
      if (idx <= 0) continue;

      const clave = partes.slice(0, idx).join('/');
      if (conocidas.has(clave)) continue;

      const prefijo = `/${clave}/`;
      salida.set(prefijo, fecha(`src/pages/${rel}`));
    }
  };

  recorrer(join(RAIZ, 'src/pages'));
  return salida;
}

function auditar(rutas: Map<string, string>, altas: Map<string, string>): boolean {
  if (!existsSync(SITEMAP)) {
    console.error('No existe dist/sitemap-0.xml. Ejecuta `npm run build` antes de auditar.');
    return false;
  }
  const xml = readFileSync(SITEMAP, 'utf8');
  const faltan: string[] = [];
  let pendientes = 0;
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let ruta = '';
    try {
      // El sitemap escapa tildes y eñes (`%C3%AD`); las claves van decodificadas.
      ruta = decodeURIComponent(new URL(m[1]).pathname);
    } catch {
      continue;
    }
    if (rutas.has(ruta)) continue;

    // Una ficha nueva sin commit todavía no está publicada: el sitemap local
    // puede tenerla (astro build la compila), pero el registro no debe fecharla
    // hasta que exista el commit. Se ignora en la auditoría.
    const ficha = /^\/acordes\/([^/]+)\/$/.exec(ruta);
    if (ficha && !altas.has(`${CARPETA}/${ficha[1]}.md`)) {
      pendientes++;
      continue;
    }
    faltan.push(ruta);
  }
  if (pendientes) log(`(${pendientes} ficha(s) del sitemap sin commit: aún no están publicadas.)`);
  if (faltan.length) {
    console.error(`Faltan ${faltan.length} ruta(s) del sitemap en el registro:`);
    for (const ruta of faltan.slice(0, 30)) console.error(`  ${ruta}`);
    if (faltan.length > 30) console.error(`  … y ${faltan.length - 30} más`);
    return false;
  }
  log(`Auditoría OK: las ${rutas.size} rutas del registro cubren el sitemap.`);
  return true;
}

function ordenar(mapa: Map<string, string> | Record<string, string>): Record<string, string> {
  const entradas = mapa instanceof Map ? [...mapa.entries()] : Object.entries(mapa);
  return Object.fromEntries(entradas.sort(([a], [b]) => a.localeCompare(b, 'es')));
}

// ---------------------------------------------------------------------------

const add = fechasDeAlta();
// Sin commit no hay alta: una ficha o una página sin rastrear todavía no está
// publicada. Se añadirá cuando el commit exista (publicar-acorde o la Action).
const fecha = (archivo: string) => add.get(archivo) || '';
const fichas = leerFichas();
const porSlug = new Map(fichas.map((f) => [f.slug, f]));
const hoyIso = hoy();
const rutas = new Map<string, string>();
const patrones = new Map<string, string>();

// Páginas fijas.
for (const [ruta, archivo] of rutasEstaticas()) {
  const alta = fecha(archivo);
  if (alta) rutas.set(ruta, alta);
}

// Fichas (la ruta nace con el commit que añade el .md).
for (const f of fichas) {
  const alta = fecha(f.archivo);
  if (alta) rutas.set(`/acordes/${f.slug}/`, alta);
}

// Hubs generados: la plantilla manda, salvo que la primera ficha del hub sea
// posterior (una agrupación nueva, un año nuevo…).
const fechaGrupo = (plantilla: string, miembros: Ficha[]): string => {
  const fechas = miembros.map((f) => fecha(f.archivo)).filter(Boolean).sort();
  return max(fecha(plantilla), fechas[0] || '');
};

const hubs: { tipo: 'modalidad' | 'pieza' | 'decada'; plantilla: string }[] = [
  { tipo: 'modalidad', plantilla: 'src/pages/modalidad/[modalidad].astro' },
  { tipo: 'pieza', plantilla: 'src/pages/pieza/[tipo].astro' },
  { tipo: 'decada', plantilla: 'src/pages/decada/[decada].astro' },
];
const fichasHub: FichaHub[] = fichas.map((f) => ({
  slug: f.slug,
  data: {
    pieza: f.pieza,
    agrupacion: f.agrupacion,
    agrupacionSlug: f.agrupacionSlug,
    year: f.year,
    date: '',
    modalidad: f.modalidad,
  },
}));
const construidos = construirHubs(fichasHub);
for (const { tipo, plantilla } of hubs) {
  for (const hub of construidos[tipo]) {
    const miembros = hub.fichas
      .map((f) => porSlug.get(f.slug))
      .filter((f): f is Ficha => Boolean(f));
    const alta = fechaGrupo(plantilla, miembros);
    if (alta) rutas.set(`/${tipo}/${hub.slug}/`, alta);
  }
}

// Agrupaciones.
const agrupaciones = new Map<string, Ficha[]>();
for (const f of fichas) {
  if (!f.agrupacionSlug) continue;
  const lista = agrupaciones.get(f.agrupacionSlug) || [];
  lista.push(f);
  agrupaciones.set(f.agrupacionSlug, lista);
}
for (const [slug, miembros] of agrupaciones) {
  const alta = fechaGrupo('src/pages/agrupacion/[agrupacionSlug].astro', miembros);
  if (alta) rutas.set(`/agrupacion/${slug}/`, alta);
}

// Autores (música y letra).
for (const eje of ['musica', 'letra'] as const) {
  const autores = new Map<string, Ficha[]>();
  for (const f of fichas) {
    const slugs = eje === 'musica' ? f.musicaSlugs : f.letraSlugs;
    for (const slug of slugs) {
      const lista = autores.get(slug) || [];
      lista.push(f);
      autores.set(slug, lista);
    }
  }
  for (const [slug, miembros] of autores) {
    const alta = fechaGrupo('src/pages/autor/musica/[autorSlug].astro', miembros);
    if (alta) rutas.set(`/autor/${eje}/${slug}/`, alta);
  }
}

// Años del carnaval.
const years = new Map<string, Ficha[]>();
for (const f of fichas) {
  if (!/^\d{4}$/.test(f.year)) continue;
  const lista = years.get(f.year) || [];
  lista.push(f);
  years.set(f.year, lista);
}
for (const [year, miembros] of years) {
  const alta = fechaGrupo('src/pages/carnaval/[year].astro', miembros);
  if (alta) rutas.set(`/carnaval/${year}/`, alta);
}

// Glosario: el índice y cada acorde salen de la plantilla del glosario.
const plantillaIndiceGlosario = fecha('src/pages/glosario.astro');
if (plantillaIndiceGlosario) rutas.set('/glosario/', plantillaIndiceGlosario);
try {
  const json = JSON.parse(readFileSync(join(RAIZ, GLOSARIO), 'utf8'));
  const acordes = (json && json.acordes) || {};
  const plantilla = fecha('src/pages/glosario/[acorde].astro');
  for (const entrada of Object.values(acordes) as { slug?: string; posiciones?: unknown[] }[]) {
    if (!plantilla || !entrada || !entrada.slug || !Array.isArray(entrada.posiciones) || !entrada.posiciones.length) continue;
    rutas.set(`/glosario/${entrada.slug}/`, plantilla);
  }
} catch {
  log('Aviso: no se pudo leer el glosario; faltan sus rutas.');
}

// Secciones dinámicas nuevas.
for (const [prefijo, alta] of patronesNuevos(fecha)) {
  if (alta) patrones.set(prefijo, alta);
}

// ---------------------------------------------------------------------------

if (AUDITAR) {
  process.exitCode = auditar(rutas, add) ? 0 : 1;
} else {
  let previo: Registro | null = null;
  if (!RECALCULAR && existsSync(SALIDA)) {
    try {
      previo = JSON.parse(readFileSync(SALIDA, 'utf8')) as Registro;
    } catch {
      previo = null;
    }
  }

  const rutasFinal = new Map<string, string>();
  if (previo?.rutas) for (const [k, v] of Object.entries(previo.rutas)) rutasFinal.set(k, v);
  for (const [k, v] of rutas) if (!rutasFinal.has(k)) rutasFinal.set(k, v);

  const patronesFinal = new Map<string, string>();
  if (previo?.patrones) for (const [k, v] of Object.entries(previo.patrones)) patronesFinal.set(k, v);
  for (const [k, v] of patrones) if (!patronesFinal.has(k)) patronesFinal.set(k, v);

  const datos: Registro = {
    desde: DESDE,
    rutas: ordenar(rutasFinal),
    patrones: ordenar(patronesFinal),
  };
  const texto = `${JSON.stringify(datos, null, 2)}\n`;
  const anterior = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8') : '';

  if (texto !== anterior) {
    writeFileSync(SALIDA, texto, 'utf8');
    log(`Registro actualizado: ${Object.keys(datos.rutas).length} rutas, ${Object.keys(datos.patrones).length} patrón(es).`);
  } else {
    log(`Registro sin cambios: ${Object.keys(datos.rutas).length} rutas.`);
  }

  if (RECALCULAR) {
    const antiguas = Object.entries(datos.rutas).filter(([, f]) => f < DESDE).length;
    log(`Fechas anteriores al contador (${DESDE}): ${antiguas}; la media empieza ahí.`);
    log(`Generado: ${SALIDA}`);
    if (hoyIso < DESDE) log(`Aviso: hoy (${hoyIso}) es anterior al inicio del contador.`);
  }
}
