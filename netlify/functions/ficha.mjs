// Devuelve el `.md` de una ficha. Busca primero en los borradores (`acordes3`),
// luego en las publicadas (`acordes`) y, si no está en master, en la rama de una
// PR abierta de esa ficha (para poder seguir editando lo que se guardó desde el
// móvil antes de fusionar).
import { sesion, sinSesion, json, fichaEnRepo, gh, REPO, BASE } from './_lib.mjs';

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  const ref = String(url.searchParams.get('ref') || BASE);
  const zona = String(url.searchParams.get('zona') || '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);

  try {
    const zonas = zona ? [zona] : ['acordes3', 'acordes'];
    for (const z of zonas) {
      const f = await fichaEnRepo(s.token, slug, ref, z);
      if (f) return json({ slug, ref, zona: z, md: f.md });
    }

    // No está en master: puede estar en una PR abierta.
    const abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token: s.token });
    const pr = abiertas.find((p) =>
      p.head.ref === `estudio/${slug}` ||
      p.head.ref.startsWith(`estudio/${slug}-`) ||
      p.head.ref === `publica/${slug}` ||
      p.head.ref.startsWith(`publica/${slug}-`));
    if (pr) {
      for (const z of zonas) {
        const f = await fichaEnRepo(s.token, slug, pr.head.ref, z);
        if (f) return json({ slug, ref: pr.head.ref, zona: z, enPR: pr.number, md: f.md });
      }
    }

    return json({ error: 'no existe', slug }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
