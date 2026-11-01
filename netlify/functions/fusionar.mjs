// Fusiona la PR abierta de una ficha (squash) si estÃ¡ en verde.
import { REPO, LOCAL, sesion, sinSesion, json, gh } from './_lib.mjs';

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  if (LOCAL) return json({ error: 'En local no hay PR que fusionar: guardar escribe el archivo y publicar lo mueve a acordes.' }, 400);

  let cuerpo;
  try { cuerpo = await req.json(); } catch { return json({ error: 'cuerpo invÃ¡lido' }, 400); }
  const slug = String(cuerpo.slug || '').trim();
  const ramaPedida = String(cuerpo.rama || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug invÃ¡lido' }, 400);

  try {
    const abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token: s.token });
    const pr =
      abiertas.find((p) => ramaPedida && p.head.ref === ramaPedida) ||
      abiertas.find((p) => p.head.ref === `estudio/${slug}` || p.head.ref.startsWith(`estudio/${slug}-`));
    if (!pr) return json({ error: 'no hay ninguna PR abierta para esta ficha' }, 404);

    // Si Netlify aÃºn estÃ¡ construyendo, GitHub lo dirÃ¡; lo devolvemos tal cual.
    const r = await gh(`/repos/${REPO}/pulls/${pr.number}/merge`, {
      token: s.token,
      method: 'PUT',
      body: { merge_method: 'squash', commit_title: pr.title },
    });
    return json({ ok: true, fusionada: r.merged, mensaje: r.message, url: pr.html_url });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};


