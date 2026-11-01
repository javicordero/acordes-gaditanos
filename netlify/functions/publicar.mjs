// Publica un borrador: lo mueve de `acordes3` a `acordes` en la rama de su PR
// (o en una nueva) y deja la PR lista para fusionar. Al fusionar, Netlify
// reconstruye y el aviso de Telegram sale solo (un `.md` añadido en `acordes`).
import {
  REPO, BASE, CARPETAS, LOCAL, sesion, sinSesion, json, gh,
} from './_lib.mjs';

const campo = (md, k) => {
  const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const m = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const hoy = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const contenido = async (token, carpeta, slug, ref) => {
  try {
    const d = await gh(`/repos/${REPO}/contents/${carpeta}/${slug}.md?ref=${encodeURIComponent(ref)}`, { token });
    return { sha: d.sha, md: Buffer.from(d.content, 'base64').toString('utf8') };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
};

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  let cuerpo;
  try { cuerpo = await req.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }
  const slug = String(cuerpo.slug || '').trim();
  const ramaPedida = String(cuerpo.rama || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);

  try {
    // En local «publicar» es mover el archivo de acordes3 a acordes, con la fecha
    // de hoy, sin PR ni ramas.
    if (LOCAL) {
      const { readFile, writeFile, rm, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const origen = join(process.cwd(), CARPETAS.acordes3, `${slug}.md`);
      let md;
      try {
        md = await readFile(origen, 'utf8');
      } catch {
        return json({ error: 'no encuentro el borrador en acordes3' }, 404);
      }
      md = md.replace(/^date:[^\n]*/m, `date: "${hoy()}"`);
      const destinoDir = join(process.cwd(), CARPETAS.acordes);
      await mkdir(destinoDir, { recursive: true });
      await writeFile(join(destinoDir, `${slug}.md`), md, 'utf8');
      await rm(origen, { force: true });
      const titulo = [campo(md, 'pieza'), campo(md, 'agrupacion'), campo(md, 'year')].filter(Boolean).join(' · ');
      return json({ ok: true, local: true, rama: null, pr: null, titulo, slug });
    }

    // 1. ¿Hay ya una PR abierta de esta ficha? Entonces se publica en su rama.
    const abiertas = await gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token: s.token });
    const previa =
      abiertas.find((p) => ramaPedida && p.head.ref === ramaPedida) ||
      abiertas.find((p) => p.head.ref === `estudio/${slug}` || p.head.ref.startsWith(`estudio/${slug}-`));

    let rama = previa?.head?.ref;
    if (!rama) {
      const master = await gh(`/repos/${REPO}/git/ref/heads/${BASE}`, { token: s.token });
      rama = `publica/${slug}-${Date.now().toString(36)}`;
      await gh(`/repos/${REPO}/git/refs`, {
        token: s.token,
        method: 'POST',
        body: { ref: `refs/heads/${rama}`, sha: master.object.sha },
      });
    }

    // 2. Leer el borrador (de la rama si ya había PR; si no, de master).
    //    Si ya hay una ficha publicada con ese slug, no se toca: el `PUT` sin
    //    `sha` daría un 422 de GitHub en vez de un error que se entienda.
    const enAcordes = await contenido(s.token, CARPETAS.acordes, slug, rama);
    if (enAcordes) return json({ error: 'esa ficha ya está publicada' }, 409);

    const borrador = await contenido(s.token, CARPETAS.acordes3, slug, rama);
    if (!borrador) return json({ error: 'no encuentro el borrador en acordes3' }, 404);

    const md = borrador.md.replace(/^date:[^\n]*/m, `date: "${hoy()}"`);
    const titulo = [campo(md, 'pieza'), campo(md, 'agrupacion'), campo(md, 'year')].filter(Boolean).join(' · ');

    // 3. Alta en acordes y baja del borrador, en la misma rama.
    await gh(`/repos/${REPO}/contents/${CARPETAS.acordes}/${slug}.md`, {
      token: s.token,
      method: 'PUT',
      body: {
        message: `Publica ${titulo || slug}`,
        content: Buffer.from(md, 'utf8').toString('base64'),
        branch: rama,
      },
    });
    await gh(`/repos/${REPO}/contents/${CARPETAS.acordes3}/${slug}.md`, {
      token: s.token,
      method: 'DELETE',
      body: {
        message: `Quita el borrador de ${slug}`,
        sha: borrador.sha,
        branch: rama,
      },
    });

    // 4. PR nueva o actualizada.
    const cuerpoPr = [
      'Publica una ficha que estaba en borrador (`acordes3`).',
      '',
      `- Ficha: \`${slug}\``,
      `- Archivo: \`${CARPETAS.acordes}/${slug}.md\``,
      '',
      'Al fusionar se reconstruye la web y el aviso de Telegram sale solo.',
    ].join('\n');

    let pr;
    if (previa) {
      pr = await gh(`/repos/${REPO}/pulls/${previa.number}`, {
        token: s.token,
        method: 'PATCH',
        body: {
          title: titulo ? `Publica: ${titulo}` : `Publica: ${slug}`,
          body: cuerpoPr,
        },
      });
    } else {
      pr = await gh(`/repos/${REPO}/pulls`, {
        token: s.token,
        method: 'POST',
        body: { title: titulo ? `Publica: ${titulo}` : `Publica: ${slug}`, head: rama, base: BASE, body: cuerpoPr },
      });
    }

    return json({ ok: true, rama, pr: { numero: pr.number, url: pr.html_url }, titulo });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
