// Añade una entrada a la cola de letras pendientes (`letras-pendientes.md`).
//
// En local escribe el archivo del proyecto; en producción abre una PR con la
// fila nueva (rama `letras/<n>-<rand>`), igual que el resto del panel.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REPO, BASE, LOCAL, sesion, sinSesion, json, gh } from './_lib.mjs';

const ARCHIVO = 'letras-pendientes.md';

/** Una celda de la tabla: sin saltos ni barras (romperían el markdown). */
const celda = (t) => String(t || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

/**
 * Mete la fila después de la última numerada. Devuelve el texto nuevo y el
 * número asignado (el siguiente al mayor).
 */
function insertar(texto, datos) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  let n = 0;
  let iUltima = -1;
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\|\s*(\d+)\s*\|/);
    if (!m) continue;
    iUltima = i;
    n = Math.max(n, Number(m[1]));
  }
  if (iUltima < 0) throw new Error('no encuentro la tabla en letras-pendientes.md');

  n += 1;
  const fila = `| ${n} | ${celda(datos.frase)} | ${celda(datos.agrupacion) || '?'} | ${celda(datos.base) || '?'} | pendiente | | ${celda(datos.fuente)} | ${celda(datos.notas)} |`;
  lineas.splice(iUltima + 1, 0, fila);
  return { texto: lineas.join('\n'), n };
}

export default async (req) => {
  const s = sesion(req);
  if (!s) return sinSesion();

  let cuerpo;
  try { cuerpo = await req.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }

  const frase = celda(cuerpo.frase);
  const agrupacion = celda(cuerpo.agrupacion);
  if (!frase) return json({ error: 'falta la frase de la letra' }, 400);
  if (!agrupacion) return json({ error: 'falta la agrupación' }, 400);

  const datos = {
    frase,
    agrupacion,
    base: celda(cuerpo.base),
    fuente: celda(cuerpo.fuente),
    notas: celda(cuerpo.notas),
  };

  try {
    // En local se modifica el archivo tal cual, sin rama ni PR.
    if (LOCAL) {
      const ruta = join(process.cwd(), ARCHIVO);
      const { texto, n } = insertar(await readFile(ruta, 'utf8'), datos);
      await writeFile(ruta, texto, 'utf8');
      return json({ ok: true, local: true, n, archivo: ARCHIVO });
    }

    const actual = await gh(`/repos/${REPO}/contents/${ARCHIVO}?ref=${BASE}`, { token: s.token });
    const { texto, n } = insertar(Buffer.from(actual.content, 'base64').toString('utf8'), datos);

    const master = await gh(`/repos/${REPO}/git/ref/heads/${BASE}`, { token: s.token });
    const rama = `letras/${n}-${Date.now().toString(36)}`;
    await gh(`/repos/${REPO}/git/refs`, {
      token: s.token,
      method: 'POST',
      body: { ref: `refs/heads/${rama}`, sha: master.object.sha },
    });

    await gh(`/repos/${REPO}/contents/${ARCHIVO}`, {
      token: s.token,
      method: 'PUT',
      body: {
        message: `Añade letra pendiente: ${frase}`,
        content: Buffer.from(texto, 'utf8').toString('base64'),
        branch: rama,
        sha: actual.sha,
      },
    });

    const pr = await gh(`/repos/${REPO}/pulls`, {
      token: s.token,
      method: 'POST',
      body: {
        title: `Letra pendiente: ${frase}`,
        head: rama,
        base: BASE,
        body: [
          'Añade una entrada a la cola de letras pendientes desde el panel `/admin`.',
          '',
          `- Entrada: **${n}**`,
          `- Frase: ${frase}`,
          `- Agrupación: ${agrupacion}`,
          ...(datos.base ? [`- Base: \`${datos.base}\``] : []),
          ...(datos.fuente ? [`- Fuente: ${datos.fuente}`] : []),
          '',
          'Al fusionar, la letra queda en la cola para buscar y ponerle los acordes.',
        ].join('\n'),
      },
    });

    return json({ ok: true, n, rama, pr: { numero: pr.number, url: pr.html_url } });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
