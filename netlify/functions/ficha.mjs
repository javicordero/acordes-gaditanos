// Devuelve el `.md` de una ficha. Busca primero en los borradores (`acordes3`),
// luego en las publicadas (`acordes`) y, si no está en master, en la rama de una
// PR abierta de esa ficha (para poder seguir editando lo que se guardó desde el
// móvil antes de fusionar).
//
// En local (`astro dev`) hay además una tercera fuente: el propio disco. El panel
// pide la lista a `/indice-busqueda.json`, que sale de los archivos locales, así
// que una ficha creada en el ordenador y todavía sin subir aparecía en la lista y
// al abrirla daba «no existe». Ahora se lee del disco y se avisa en el panel.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sesion, sinSesion, json, fichaEnRepo, gh, REPO, BASE, CARPETAS } from './_lib.mjs';

// Lo activa la ruta de desarrollo (`src/integrations/estudio-api.ts`).
const LOCAL = process.env.ESTUDIO_LOCAL === '1';

const sinRetorno = (md) => String(md).replace(/\r\n/g, '\n');

/** `.md` de una ficha en el disco (solo en dev); `null` si no está. */
async function fichaLocal(slug, zona) {
  if (!LOCAL) return null;
  const carpeta = CARPETAS[zona] || CARPETAS.acordes;
  try {
    return sinRetorno(await readFile(join(process.cwd(), carpeta, `${slug}.md`), 'utf8'));
  } catch {
    return null;
  }
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  const ref = String(url.searchParams.get('ref') || BASE);
  const zona = String(url.searchParams.get('zona') || '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);

  const zonas = zona ? [zona] : ['acordes3', 'acordes'];

  try {
    // En local manda el archivo del proyecto: es lo que se edita y lo que se
    // guarda. Si además está en GitHub, se avisa cuando las dos copias difieren.
    if (LOCAL) {
      for (const z of zonas) {
        const md = await fichaLocal(slug, z);
        if (md === null) continue;
        let enRepo = null;
        try { enRepo = await fichaEnRepo(s.token, slug, ref, z); } catch { /* sin red */ }
        return json({
          slug, ref: 'local', zona: z, md, local: true,
          ...(enRepo && sinRetorno(enRepo.md) !== md ? { desync: true } : {}),
        });
      }
    }

    for (const z of zonas) {
      const f = await fichaEnRepo(s.token, slug, ref, z);
      if (f) return json({ slug, ref, zona: z, md: sinRetorno(f.md) });
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
        if (f) return json({ slug, ref: pr.head.ref, rama: pr.head.ref, zona: z, enPR: pr.number, md: sinRetorno(f.md) });
      }
    }

    // Ni en GitHub: si existe en el disco, es una ficha aún sin subir.
    for (const z of zonas) {
      const md = await fichaLocal(slug, z);
      if (md !== null) return json({ slug, ref: 'local', zona: z, md, local: true });
    }

    return json({
      error: LOCAL
        ? `No existe la ficha «${slug}»: no está ni en el repositorio ni en el ordenador.`
        : `No encuentro la ficha «${slug}» en el repositorio. Si la has creado en el ordenador, aún no está subida.`,
      slug,
    }, 404);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
