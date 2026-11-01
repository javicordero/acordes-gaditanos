// Devuelve el texto del aviso de una ficha (el mismo que Telegram), para
// copiarlo en WhatsApp o abrirlo en X desde el móvil.
import { sesion, sinSesion, json, fichaEnRepo, BASE, CARPETAS, LOCAL } from './_lib.mjs';
import { mensajeUna } from '../../scripts/lib/aviso.mjs';

function frontmatter(md) {
  const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const datos = {};
  for (const linea of fm.split('\n')) {
    const m = linea.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    datos[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return datos;
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);

  try {
    // En local se lee el archivo del disco: puede ser un borrador sin publicar.
    let mdCrudo = null;
    if (LOCAL) {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      for (const zona of ['acordes', 'acordes3']) {
        try {
          mdCrudo = await readFile(join(process.cwd(), CARPETAS[zona], `${slug}.md`), 'utf8');
          break;
        } catch { /* siguiente carpeta */ }
      }
    }

    const f = mdCrudo ? { md: mdCrudo } : await fichaEnRepo(s.token, slug, BASE);
    if (!f) return json({ error: 'no existe la ficha (¿aún sin fusionar?)' }, 404);
    const datos = frontmatter(f.md);
    return json({
      slug,
      titulo: [datos.pieza, datos.agrupacion, datos.year].filter(Boolean).join(' · '),
      texto: mensajeUna({ slug, datos }, 'plano'),
      url: `https://acordesgaditanos.com/acordes/${slug}/`,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
