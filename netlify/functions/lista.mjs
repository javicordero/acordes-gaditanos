// Lista las fichas de `src/content/borradores` (de master y de PRs abiertas) con su
// frontmatter, para el panel. En local añade los borradores que solo viven en el
// disco (creados con `acordes:aplicar --destino borradores` y aún sin subir).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sesion, sinSesion, json, gh, REPO, BASE, CARPETAS } from './_lib.mjs';

const ejecutar = promisify(execFile);
const git = (args) => ejecutar('git', args, { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 });

// Lo activa la ruta de desarrollo (`src/integrations/estudio-api.ts`).
const LOCAL = process.env.ESTUDIO_LOCAL === '1';

// Cola de coplas pendientes de revisión (una sola, compartida por el panel y
// `npm run revisar`). Se versiona para que el panel la lea de master.
const RUTA_REVISION = 'src/data/revision-acordes.json';

const campo = (md, k) => {
  const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const m = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const datos = (slug, md) => {
  // Los `.md` del disco pueden venir con CRLF: el frontmatter se busca con `\n`.
  const t = md.replace(/\r\n/g, '\n');
  return {
    slug,
    pieza: campo(t, 'pieza'),
    agrupacion: campo(t, 'agrupacion'),
    year: campo(t, 'year'),
    letraTitulo: campo(t, 'letraTitulo'),
    // La usa el panel para calcular la fecha siguiente al publicar.
    date: campo(t, 'date'),
    incompleta: incompleta(t),
  };
};

/**
 * Marca de ficha a medias: `sinLetra` si el `<pre>` está vacío (o solo tiene
 * comentarios) y `sinAcordes` si la letra no lleva ningún acorde. Vacío si está
 * completa. Así el panel avisa antes de promover un borrador.
 */
const incompleta = (md) => {
  const m = /<pre>([\s\S]*?)<\/pre>/.exec(md);
  if (!m) return 'sinLetra';
  const cuerpo = m[1].replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, '');
  if (!cuerpo) return 'sinLetra';
  if (!/<a[\s>]/.test(m[1])) return 'sinAcordes';
  return '';
};

/** Slugs de una carpeta del proyecto (solo en dev). */
async function slugsLocales(carpeta) {
  if (!LOCAL) return new Set();
  try {
    const nombres = await readdir(join(process.cwd(), carpeta));
    return new Set(nombres.filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3)));
  } catch {
    return new Set();
  }
}

/** Borradores de `src/content/borradores` que aún no están en GitHub (solo en dev). */
async function borradoresLocales() {
  if (!LOCAL) return [];
  const carpeta = join(process.cwd(), CARPETAS.borradores);
  let nombres;
  try {
    nombres = await readdir(carpeta);
  } catch {
    return [];
  }
  const out = [];
  for (const nombre of nombres) {
    if (!nombre.endsWith('.md')) continue;
    try {
      const md = (await readFile(join(carpeta, nombre), 'utf8')).replace(/\r\n/g, '\n');
      out.push({ ...datos(nombre.slice(0, -3), md), zona: 'borradores', local: true });
    } catch { /* ficha ilegible: se omite */ }
  }
  return out;
}

/**
 * Fichas de la colección provisional `otraweb` (las importadas del cancionero,
 * aún con los acordes sin envolver). Solo en dev: es la lista de la pestaña
 * «Otra web», desde la que se pasan a borradores. Allí no se puede comprobar si
 * la letra lleva acordes (van sin etiquetas), así que solo se marca la vacía.
 */
async function importadasLocales() {
  if (!LOCAL) return [];
  const carpeta = join(process.cwd(), CARPETAS.otraweb);
  let nombres;
  try {
    nombres = await readdir(carpeta);
  } catch {
    return [];
  }
  const out = [];
  for (const nombre of nombres) {
    if (!nombre.endsWith('.md')) continue;
    try {
      const md = (await readFile(join(carpeta, nombre), 'utf8')).replace(/\r\n/g, '\n');
      const pre = /<pre>([\s\S]*?)<\/pre>/.exec(md);
      const sinLetra = !pre || !pre[1].replace(/<!--[\s\S]*?-->/g, '').trim();
      out.push({
        ...datos(nombre.slice(0, -3), md),
        zona: 'otraweb',
        local: true,
        incompleta: sinLetra ? 'sinLetra' : '',
      });
    } catch { /* ficha ilegible: se omite */ }
  }
  out.sort((a, b) => `${b.year}${a.agrupacion}`.localeCompare(`${a.year}${b.agrupacion}`, 'es'));
  return out;
}

/**
 * Fichas de `acordes` que están en el ordenador pero no en git: sin rastrear,
 * modificadas, borradas o en commits locales sin push. Solo tiene sentido en
 * dev, donde existe el working tree; en Netlify devuelve [].
 */
async function pendientesGit() {
  if (!LOCAL) return [];

  const mapa = new Map();
  const borradores = new Set();

  try {
    const { stdout } = await git([
      'status', '--porcelain=v1', '-z', '--no-renames', '--',
      CARPETAS.acordes, CARPETAS.borradores,
    ]);
    for (const entrada of stdout.split('\0').filter(Boolean)) {
      const xy = entrada.slice(0, 2);
      const ruta = entrada.slice(3);
      if (!ruta.endsWith('.md')) continue;
      const slug = ruta.split('/').pop().slice(0, -3);

      if (ruta.startsWith(`${CARPETAS.borradores}/`)) {
        // La baja del borrador viaja en el mismo commit que su ficha nueva.
        if (xy.includes('D')) borradores.add(slug);
        continue;
      }
      if (!ruta.startsWith(`${CARPETAS.acordes}/`)) continue;

      const estado = xy === '??' || xy[0] === 'A'
        ? 'nueva'
        : xy.includes('D') ? 'borrada' : 'modificada';
      mapa.set(slug, { slug, estado, ruta });
    }
  } catch { /* sin git o sin repo: la pestaña sale vacía */ }

  // Commits locales que aún no están en origin (un push que falló, por ejemplo).
  try {
    const { stdout } = await git(['diff', '--name-status', `origin/${BASE}..HEAD`, '--', CARPETAS.acordes]);
    for (const linea of stdout.split(/\r?\n/)) {
      if (!linea.trim()) continue;
      const [cambio, ruta] = linea.split('\t');
      if (!ruta || !ruta.endsWith('.md')) continue;
      const slug = ruta.split('/').pop().slice(0, -3);
      if (mapa.has(slug)) continue;
      const tipo = cambio[0] === 'A' ? 'nueva' : cambio[0] === 'D' ? 'borrada' : 'modificada';
      mapa.set(slug, { slug, estado: 'sin-push', cambio: tipo, ruta });
    }
  } catch { /* sin remoto o sin commits pendientes */ }

  const out = [];
  for (const item of mapa.values()) {
    let md = '';
    const borrada = item.estado === 'borrada' || item.cambio === 'borrada';
    if (borrada) {
      // En el working tree la ficha sigue en HEAD; en un commit sin push, en origin.
      for (const ref of ['HEAD', `origin/${BASE}`]) {
        try { md = (await git(['show', `${ref}:${item.ruta}`])).stdout; break; } catch { /* siguiente */ }
      }
    } else {
      try { md = await readFile(join(process.cwd(), item.ruta), 'utf8'); } catch { /* ilegible */ }
    }
    out.push({
      ...datos(item.slug, md),
      ...item,
      ...(borradores.has(item.slug) ? { borrador: true } : {}),
    });
  }

  out.sort((a, b) => `${b.year}${b.agrupacion}`.localeCompare(`${a.year}${a.agrupacion}`, 'es'));
  return out;
}

/** Slugs pendientes de revisión. En local manda el archivo del ordenador. */
async function pendientesRevision(token) {
  try {
    if (LOCAL) {
      const { readFile } = await import('node:fs/promises');
      const json = JSON.parse(await readFile(join(process.cwd(), RUTA_REVISION), 'utf8'));
      return Array.isArray(json.pendientes) ? json.pendientes : [];
    }
    const d = await gh(`/repos/${REPO}/contents/${RUTA_REVISION}?ref=${BASE}`, { token });
    const json = JSON.parse(Buffer.from(d.content, 'base64').toString('utf8'));
    return Array.isArray(json.pendientes) ? json.pendientes : [];
  } catch {
    return [];
  }
}

/** La PR trae la ficha en `acordes`: publica un borrador o corrige una ya publicada. */
function esPublicacion(pr) {
  const ref = pr.head.ref || '';
  if (ref.startsWith('publica/')) return true;
  const cuerpo = pr.body || '';
  return /Archivo:\s*`src\/content\/acordes\//.test(cuerpo) || /Zona:\s*\*\*acordes\*\*/.test(cuerpo);
}

/** Slug de la ficha de una PR (del cuerpo o, si no está, de la rama). */
function slugDePr(pr) {
  const m = (pr.body || '').match(/Ficha:\s*`([^`]+)`/);
  if (m) return m[1];
  return (pr.head.ref || '').replace(/^(estudio|publica)\//, '').replace(/-[a-z0-9]+$/, '');
}

/**
 * Fichas de `acordes` con una PR abierta (una corrección hecha desde el móvil o una
 * publicación pendiente de fusionar): la web todavía no las tiene. Es lo que el
 * panel enseña en «Por publicar» en producción.
 */
async function fichasEnPR(token) {
  const out = [];
  let abiertas;
  try {
    abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token });
  } catch {
    return out;
  }
  for (const pr of abiertas) {
    const ref = pr.head.ref || '';
    if (!ref.startsWith('estudio/') && !ref.startsWith('publica/')) continue;
    if (!esPublicacion(pr)) continue;
    const slug = slugDePr(pr);
    if (!slug) continue;
    try {
      const d = await gh(`/repos/${REPO}/contents/${CARPETAS.acordes}/${slug}.md?ref=${encodeURIComponent(ref)}`, { token });
      out.push({
        ...datos(slug, Buffer.from(d.content, 'base64').toString('utf8')),
        zona: 'acordes',
        enPR: pr.number,
        rama: ref,
      });
    } catch { /* la PR no lleva la ficha en acordes */ }
  }
  return out;
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  // `?solo=pendientes` devuelve únicamente lo que cambia al guardar o promover una
  // ficha (lo que falta subir, la cola de revisión y las PRs abiertas de fichas ya
  // publicadas), sin las llamadas a GitHub de la lista completa. El panel lo pide
  // tras cada guardado.
  let url = null;
  try { url = new URL(req.url); } catch { /* petición sin URL absoluta */ }
  if (url && url.searchParams.get('solo') === 'pendientes') {
    try {
      return json({
        revision: await pendientesRevision(s.token),
        pendientes: await pendientesGit(),
        prs: await fichasEnPR(s.token),
      });
    } catch (e) {
      return json({ error: String(e.message || e) }, 502);
    }
  }

  try {
    // En local manda el disco: un borrador que ya está en `acordes` (promovido
    // en el ordenador) no se vuelve a ofrecer como borrador, y los que están en
    // `borradores` se marcan como locales para poder promoverlos.
    const locales3 = await slugsLocales(CARPETAS.borradores);
    const localesPublicadas = await slugsLocales(CARPETAS.acordes);

    let fichas = [];
    try {
      const arbol = await gh(`/repos/${REPO}/git/trees/${BASE}?recursive=1`, { token: s.token });
      const prefijo = `${CARPETAS.borradores}/`;
      const rutas = (arbol.tree || [])
        .filter((x) => x.type === 'blob' && x.path.startsWith(prefijo) && x.path.endsWith('.md'))
        .map((x) => x.path)
        .slice(0, 80);

      fichas = (await Promise.all(rutas.map(async (ruta) => {
        const slug = ruta.slice(prefijo.length, -3);
        try {
          const d = await gh(`/repos/${REPO}/contents/${ruta}?ref=${BASE}`, { token: s.token });
          // En local manda el archivo del disco: es el que se edita (y el que
          // dice si la ficha está completa). El de GitHub puede ir por detrás.
          let md = Buffer.from(d.content, 'base64').toString('utf8');
          if (LOCAL && locales3.has(slug)) {
            try { md = await readFile(join(process.cwd(), CARPETAS.borradores, `${slug}.md`), 'utf8'); } catch { /* se queda el de GitHub */ }
          }
          return { ...datos(slug, md), zona: 'borradores' };
        } catch {
          return { slug, pieza: '', agrupacion: '', year: '', letraTitulo: '', incompleta: '', zona: 'borradores' };
        }
      }))).filter((f) => !(LOCAL && localesPublicadas.has(f.slug)));
      if (LOCAL) for (const f of fichas) f.local = locales3.has(f.slug);

      // Fichas que aún viven en una PR abierta: los borradores (`estudio/*` sobre
      // `borradores`) y las ya publicadas en una PR de publicación o corrección
      // (`publica/*`, o una `estudio/*` que trae `acordes/`), para que sigan
      // apareciendo en la lista marcadas como EN PR hasta fusionarlas.
      const abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token: s.token });
      for (const pr of abiertas) {
        const ref = pr.head.ref || '';
        const publicacion = esPublicacion(pr);
        if (!ref.startsWith('estudio/') && !ref.startsWith('publica/')) continue;
        const slug = slugDePr(pr);
        if (!slug || fichas.some((f) => f.slug === slug)) continue;
        // Un borrador que ya está publicado en el disco no se repite.
        if (LOCAL && !publicacion && localesPublicadas.has(slug)) continue;
        const zona = publicacion ? 'acordes' : 'borradores';
        try {
          const d = await gh(`/repos/${REPO}/contents/${CARPETAS[zona]}/${slug}.md?ref=${encodeURIComponent(ref)}`, { token: s.token });
          const item = { ...datos(slug, Buffer.from(d.content, 'base64').toString('utf8')), zona, enPR: pr.number, rama: ref };
          if (LOCAL && !publicacion) item.local = locales3.has(slug);
          fichas.push(item);
        } catch { /* la PR no toca esa carpeta */ }
      }
    } catch (e) {
      // Sin GitHub (límite de la API, red caída o token caducado) en local seguimos
      // con lo que hay en el disco: es lo que se puede editar de todas formas.
      if (!LOCAL) throw e;
    }

    // Borradores que solo están en el disco (en local, aún sin subir).
    for (const l of await borradoresLocales()) {
      if (localesPublicadas.has(l.slug)) continue;
      if (!fichas.some((f) => f.slug === l.slug)) fichas.push(l);
    }

    fichas.sort((a, b) => `${b.year}${b.agrupacion}`.localeCompare(`${a.year}${a.agrupacion}`, 'es'));
    return json({
      borradores: fichas,
      otraweb: await importadasLocales(),
      revision: await pendientesRevision(s.token),
      pendientes: await pendientesGit(),
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
