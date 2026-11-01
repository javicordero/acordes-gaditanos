// Guarda una ficha: crea una rama, hace el commit y abre (o actualiza) la PR.
//
// `zona` decide la carpeta:
//   - "acordes3" (por defecto) → borrador; se publica con `publicar`.
//   - "acordes" → ficha publicada que se corrige.
import {
  REPO, BASE, OWNER, CARPETAS, LOCAL, sesion, sinSesion, json, gh,
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
  // Si se editan pieza/agrupación/título, la ficha puede cambiar de archivo.
  const pedido = String(cuerpo.slugNuevo || '').trim();
  const destino = /^[a-z0-9][a-z0-9-]*$/.test(pedido) ? pedido : slug;
  const ramaPedida = String(cuerpo.rama || '').trim();

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);
  if (md.length < 20 || md.length > 300_000) return json({ error: 'tamaño de ficha fuera de rango' }, 400);
  if (!/^---\n/.test(md) || !md.includes('<pre>') || !md.includes('</pre>')) {
    return json({ error: 'la ficha no tiene frontmatter o <pre>' }, 400);
  }

  try {
    // En local se escribe el archivo tal cual: sin rama, sin commit y sin PR.
    if (LOCAL) {
      const { mkdir, writeFile, rm } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const dir = join(process.cwd(), carpeta);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${destino}.md`), md, 'utf8');
      if (destino !== slug) await rm(join(dir, `${slug}.md`), { force: true });
      return json({ ok: true, local: true, slug: destino, rama: null, pr: null, zona, nueva: false });
    }

    const lista = await abiertas(s.token);
    const previa =
      lista.find((p) => ramaPedida && p.head.ref === ramaPedida) ||
      lista.find((p) => p.head.ref === `estudio/${slug}` || p.head.ref.startsWith(`estudio/${slug}-`)) ||
      (destino !== slug
        ? lista.find((p) => p.head.ref === `estudio/${destino}` || p.head.ref.startsWith(`estudio/${destino}-`))
        : undefined);

    let rama = previa?.head?.ref;
    if (!rama) {
      const master = await gh(`/repos/${REPO}/git/ref/heads/${BASE}`, { token: s.token });
      rama = `estudio/${destino}-${Date.now().toString(36)}`;
      await gh(`/repos/${REPO}/git/refs`, {
        token: s.token,
        method: 'POST',
        body: { ref: `refs/heads/${rama}`, sha: master.object.sha },
      });
    }

    const actual = await contenido(s.token, carpeta, slug, rama);
    const yaDestino = destino !== slug ? await contenido(s.token, carpeta, destino, rama) : null;
    if (yaDestino) return json({ error: `ya existe una ficha con el slug ${destino}` }, 409);

    // GitHub exige el `sha` del archivo para sobrescribir uno que ya existe en
    // la rama; sin él devuelve 422 («sha wasn't supplied»).
    const sha = destino === slug ? actual?.sha : null;

    const titulo = [campo(md, 'pieza'), campo(md, 'agrupacion'), campo(md, 'year')].filter(Boolean).join(' · ');
    const commit = mensaje || `${actual ? 'Actualiza' : 'Añade'} ${titulo || destino}`;

    await gh(`/repos/${REPO}/contents/${carpeta}/${destino}.md`, {
      token: s.token,
      method: 'PUT',
      body: {
        message: commit,
        content: Buffer.from(md, 'utf8').toString('base64'),
        branch: rama,
        ...(sha ? { sha } : {}),
      },
    });

    // Renombrado: se borra el archivo viejo en la misma rama.
    if (destino !== slug && actual) {
      await gh(`/repos/${REPO}/contents/${carpeta}/${slug}.md`, {
        token: s.token,
        method: 'DELETE',
        body: { message: `Renombra ${slug} a ${destino}`, sha: actual.sha, branch: rama },
      });
    }

    const cuerpoPr = [
      `Propuesta desde el panel \`/estudio\`.`,
      '',
      `- Ficha: \`${destino}\``,
      `- Archivo: \`${carpeta}/${destino}.md\``,
      `- Zona: **${zona}**${zona === 'acordes3' ? ' (borrador; se publica desde el panel o con `npm run promover`)' : ' (publicada)'}`,
      ...(destino !== slug ? [`- Renombrada desde: \`${slug}\``] : []),
      '',
      'Netlify deja aquí el enlace al deploy preview cuando termine.',
    ].join('\n');

    let pr = previa ? { numero: previa.number, url: previa.html_url } : null;
    if (!pr) {
      const nueva = await gh(`/repos/${REPO}/pulls`, {
        token: s.token,
        method: 'POST',
        body: {
          title: titulo ? `${zona === 'acordes3' ? 'Borrador' : 'Ficha'}: ${titulo}` : `${zona}: ${destino}`,
          head: rama,
          base: BASE,
          body: cuerpoPr,
        },
      });
      pr = { numero: nueva.number, url: nueva.html_url };
    } else if (destino !== slug) {
      const actualizada = await gh(`/repos/${REPO}/pulls/${previa.number}`, {
        token: s.token,
        method: 'PATCH',
        body: {
          ...(titulo ? { title: `${zona === 'acordes3' ? 'Borrador' : 'Ficha'}: ${titulo}` } : {}),
          body: cuerpoPr,
        },
      });
      pr = { numero: actualizada.number, url: actualizada.html_url };
    }

    return json({ ok: true, rama, zona, pr, nueva: !actual, slug: destino, propietario: OWNER });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
