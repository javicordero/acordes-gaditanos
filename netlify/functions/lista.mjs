// Lista los borradores de `acordes3` (de master y de PRs abiertas) con su
// frontmatter, para el panel. En local añade los borradores que solo viven en el
// disco (creados con `acordes:aplicar --destino acordes3` y aún sin subir).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sesion, sinSesion, json, gh, REPO, BASE, CARPETAS } from './_lib.mjs';

// Lo activa la ruta de desarrollo (`src/integrations/estudio-api.ts`).
const LOCAL = process.env.ESTUDIO_LOCAL === '1';

const campo = (md, k) => {
  const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const m = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const datos = (slug, md) => ({
  slug,
  pieza: campo(md, 'pieza'),
  agrupacion: campo(md, 'agrupacion'),
  year: campo(md, 'year'),
  letraTitulo: campo(md, 'letraTitulo'),
});

/** Borradores de `src/content/acordes3` que aún no están en GitHub (solo en dev). */
async function borradoresLocales() {
  if (!LOCAL) return [];
  const carpeta = join(process.cwd(), CARPETAS.acordes3);
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
      out.push({ ...datos(nombre.slice(0, -3), md), zona: 'acordes3', local: true });
    } catch { /* ficha ilegible: se omite */ }
  }
  return out;
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  try {
    const arbol = await gh(`/repos/${REPO}/git/trees/${BASE}?recursive=1`, { token: s.token });
    const prefijo = `${CARPETAS.acordes3}/`;
    const rutas = (arbol.tree || [])
      .filter((x) => x.type === 'blob' && x.path.startsWith(prefijo) && x.path.endsWith('.md'))
      .map((x) => x.path)
      .slice(0, 80);

    const fichas = await Promise.all(rutas.map(async (ruta) => {
      const slug = ruta.slice(prefijo.length, -3);
      try {
        const d = await gh(`/repos/${REPO}/contents/${ruta}?ref=${BASE}`, { token: s.token });
        return { ...datos(slug, Buffer.from(d.content, 'base64').toString('utf8')), zona: 'acordes3' };
      } catch {
        return { slug, pieza: '', agrupacion: '', year: '', letraTitulo: '', zona: 'acordes3' };
      }
    }));

    // Fichas que aún viven en una PR abierta: los borradores (`estudio/*`) y las
    // ya publicadas en una PR de publicación (`publica/*`), para que sigan
    // apareciendo en la lista marcadas como EN PR hasta fusionarlas.
    const abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token: s.token });
    for (const pr of abiertas) {
      const ref = pr.head.ref || '';
      const esPublicacion = ref.startsWith('publica/');
      if (!ref.startsWith('estudio/') && !esPublicacion) continue;
      const m = (pr.body || '').match(/Ficha:\s*`([^`]+)`/);
      const slug = m ? m[1] : ref.replace(/^(estudio|publica)\//, '').replace(/-[a-z0-9]+$/, '');
      if (!slug || fichas.some((f) => f.slug === slug)) continue;
      const zona = esPublicacion ? 'acordes' : 'acordes3';
      try {
        const d = await gh(`/repos/${REPO}/contents/${CARPETAS[zona]}/${slug}.md?ref=${encodeURIComponent(ref)}`, { token: s.token });
        fichas.push({ ...datos(slug, Buffer.from(d.content, 'base64').toString('utf8')), zona, enPR: pr.number, rama: ref });
      } catch { /* la PR no toca esa carpeta */ }
    }

    // Borradores que solo están en el disco (en local, aún sin subir).
    for (const l of await borradoresLocales()) {
      if (!fichas.some((f) => f.slug === l.slug)) fichas.push(l);
    }

    fichas.sort((a, b) => `${b.year}${b.agrupacion}`.localeCompare(`${a.year}${a.agrupacion}`, 'es'));
    return json({ borradores: fichas });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
