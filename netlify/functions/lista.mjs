// Lista los borradores de `acordes3` (de master y de PRs abiertas) con su
// frontmatter, para el panel.
import { sesion, sinSesion, json, gh, REPO, BASE, CARPETAS } from './_lib.mjs';

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

    // Borradores que aún viven en una PR abierta (guardados desde el móvil y sin fusionar).
    const abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token: s.token });
    for (const pr of abiertas) {
      const ref = pr.head.ref || '';
      if (!ref.startsWith('estudio/')) continue;
      const m = (pr.body || '').match(/Ficha:\s*`([^`]+)`/);
      const slug = m ? m[1] : ref.replace(/^estudio\//, '').replace(/-[a-z0-9]+$/, '');
      if (!slug || fichas.some((f) => f.slug === slug)) continue;
      try {
        const d = await gh(`/repos/${REPO}/contents/${CARPETAS.acordes3}/${slug}.md?ref=${encodeURIComponent(ref)}`, { token: s.token });
        fichas.push({ ...datos(slug, Buffer.from(d.content, 'base64').toString('utf8')), zona: 'acordes3', enPR: pr.number });
      } catch { /* la PR no toca acordes3 */ }
    }

    fichas.sort((a, b) => `${b.year}${b.agrupacion}`.localeCompare(`${a.year}${a.agrupacion}`, 'es'));
    return json({ borradores: fichas });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
