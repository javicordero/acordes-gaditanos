// Guarda una ficha: crea una rama, hace el commit y abre (o actualiza) la PR.
//
// `zona` decide la carpeta:
//   - "acordes3" (por defecto) → borrador; se publica con `publicar`.
//   - "acordes" → ficha publicada que se corrige.
import {
  REPO, BASE, OWNER, CARPETAS, sesion, sinSesion, json, gh,
} from './_lib.mjs';

const campo = (md, k) => {
  const fm = (md.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const m = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const abiertas = (token) => gh(`/repos/${REPO}/pulls?state=open&per_page=100`, { token });

async function contenido(token, carpeta, slug, ref) {
  try {
    const d = await gh(`/repos/${REPO}/contents/${carpeta}/${slug}.md?ref=${encodeURIComponent(ref)}`, { token });
    return { sha: d.sha };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  let cuerpo;
  try { cuerpo = await req.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }
  const slug = String(cuerpo.slug || '').trim();
  const md = String(cuerpo.md || '');
  const mensaje = String(cuerpo.mensaje || '').slice(0, 200);
  const zona = cuerpo.zona === 'acordes' ? 'acordes' : 'acordes3';
  const carpeta = CARPETAS[zona];

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);
  if (md.length < 20 || md.length > 300_000) return json({ error: 'tamaño de ficha fuera de rango' }, 400);
  if (!/^---\n/.test(md) || !md.includes('<pre>') || !md.includes('</pre>')) {
    return json({ error: 'la ficha no tiene frontmatter o <pre>' }, 400);
  }

  try {
    const lista = await abiertas(s.token);
    const previa = lista.find((p) => p.head.ref === `estudio/${slug}` || p.head.ref.startsWith(`estudio/${slug}-`));

    let rama = previa?.head?.ref;
    if (!rama) {
      const master = await gh(`/repos/${REPO}/git/ref/heads/${BASE}`, { token: s.token });
      rama = `estudio/${slug}-${Date.now().toString(36)}`;
      await gh(`/repos/${REPO}/git/refs`, {
        token: s.token,
        method: 'POST',
        body: { ref: `refs/heads/${rama}`, sha: master.object.sha },
      });
    }

    const actual = await contenido(s.token, carpeta, slug, rama);
    const titulo = [campo(md, 'pieza'), campo(md, 'agrupacion'), campo(md, 'year')].filter(Boolean).join(' · ');
    const commit = mensaje || `${actual ? 'Actualiza' : 'Añade'} ${titulo || slug}`;

    await gh(`/repos/${REPO}/contents/${carpeta}/${slug}.md`, {
      token: s.token,
      method: 'PUT',
      body: {
        message: commit,
        content: Buffer.from(md, 'utf8').toString('base64'),
        branch: rama,
        ...(actual ? { sha: actual.sha } : {}),
      },
    });

    let pr = previa ? { numero: previa.number, url: previa.html_url } : null;
    if (!pr) {
      const nueva = await gh(`/repos/${REPO}/pulls`, {
        token: s.token,
        method: 'POST',
        body: {
          title: titulo ? `${zona === 'acordes3' ? 'Borrador' : 'Ficha'}: ${titulo}` : `${zona}: ${slug}`,
          head: rama,
          base: BASE,
          body: [
            `Propuesta desde el panel \`/estudio\`.`,
            '',
            `- Ficha: \`${slug}\``,
            `- Archivo: \`${carpeta}/${slug}.md\``,
            `- Zona: **${zona}**${zona === 'acordes3' ? ' (borrador; se publica desde el panel o con `npm run promover`)' : ' (publicada)'}`,
            '',
            'Netlify deja aquí el enlace al deploy preview cuando termine.',
          ].join('\n'),
        },
      });
      pr = { numero: nueva.number, url: nueva.html_url };
    }

    return json({ ok: true, rama, zona, pr, nueva: !actual, propietario: OWNER });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
