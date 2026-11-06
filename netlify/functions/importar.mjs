// Pasa una ficha de la colección provisional `acordes2` (importada del
// cancionero, con los acordes sin envolver) a los borradores (`acordes3`), ya
// envuelta en <a>, para revisarla en el editor del panel.
//
//   POST /admin/api/importar  { slug: 'pasodoble-…' }
//
// Solo funciona en local: en Netlify no existe la colección `acordes2` ni un
// working tree donde mover archivos. El trabajo (envolver y mover) lo hace
// `scripts/importar-a-borradores.mjs`, con el mismo envoltorio que el editor.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LOCAL, sesion, sinSesion, json } from './_lib.mjs';

const ejecutar = promisify(execFile);

/** Última línea JSON de la salida del script (las anteriores son trazas). */
const ultimaJson = (texto) => {
  const lineas = String(texto || '').trim().split('\n').filter((l) => l.trim());
  try { return JSON.parse(lineas[lineas.length - 1] || ''); } catch { return null; }
};

export default async (req) => {
  if (!LOCAL) return json({ error: 'solo está disponible en local' }, 501);

  const s = sesion(req);
  if (!s) return sinSesion();

  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  let cuerpo;
  try { cuerpo = await req.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }

  const slug = String(cuerpo.slug || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return json({ error: 'slug inválido' }, 400);

  try {
    const { stdout } = await ejecutar(
      process.execPath,
      ['scripts/importar-a-borradores.mjs', '--slug', slug, '--json'],
      { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 }
    );
    const datos = ultimaJson(stdout) || {};
    const ficha = (datos.fichas || []).find((x) => x.slug === slug) || {};
    return json({ ok: true, slug, acordes: ficha.acordes || 0, avisos: ficha.avisos || [] });
  } catch (e) {
    const datos = ultimaJson(e.stdout);
    const ficha = ((datos && datos.fichas) || []).find((x) => x.slug === slug) || {};
    return json({ error: (ficha.error || (datos && datos.error) || 'no se pudo pasar la ficha a borradores') }, 502);
  }
};
