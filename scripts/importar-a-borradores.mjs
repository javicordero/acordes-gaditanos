// Pasa una ficha de la colección provisional `acordes2` (importada del
// cancionero, con los acordes sin envolver) a los borradores (`acordes3`),
// envolviendo los acordes en <a> para poder revisarla en el panel.
//
// Uso:
//   npm run importar:borrador -- --slug <slug>[,<slug>] [--dry] [--json]
//
// La usa el panel /admin (pestaña Acordes2), que solo la ofrece en local.
// El envoltorio es el mismo del editor (`src/lib/pre-acordes.js`), así que la
// ficha llega a `acordes3` tal y como la dejaría «Guardar».

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { desenvolver, envolver, montarMd } from '../src/lib/pre-acordes.js';

const ORIGEN = 'src/content/acordes2';
const DESTINO = 'src/content/acordes3';
const PUBLICADAS = 'src/content/acordes';

const args = process.argv.slice(2);
const iSlug = args.indexOf('--slug');
const slugs = iSlug >= 0 && args[iSlug + 1] && !args[iSlug + 1].startsWith('--')
  ? String(args[iSlug + 1]).split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const dry = args.includes('--dry');
const json = args.includes('--json');

if (!slugs.length) {
  const error = 'Uso: npm run importar:borrador -- --slug <slug>[,<slug>] [--dry] [--json]';
  if (json) console.log(JSON.stringify({ error }));
  else console.error(error);
  process.exit(1);
}

const salida = [];
let fallos = 0;

for (const slug of slugs) {
  const origen = join(ORIGEN, `${slug}.md`);
  const destino = join(DESTINO, `${slug}.md`);
  const fallo = (texto) => {
    fallos++;
    salida.push({ slug, ok: false, error: texto });
    if (!json) console.error(`✗ ${slug}: ${texto}`);
  };

  if (!existsSync(origen)) { fallo(`no encuentro la ficha en ${ORIGEN}`); continue; }
  if (existsSync(destino)) { fallo('ya hay un borrador con ese mismo nombre; no lo piso'); continue; }
  if (existsSync(join(PUBLICADAS, `${slug}.md`))) { fallo('esa ficha ya está publicada en acordes'); continue; }

  try {
    const md = readFileSync(origen, 'utf8');
    const desenvuelto = desenvolver(md);
    // Sin `originales`: la ficha de `acordes2` no trae etiquetas, así que hay que
    // clasificar cada línea y envolverla (con los originales, `envolver` copiaría
    // las líneas «sin tocar» y no envolvería nada).
    const envuelto = envolver(desenvuelto.texto, desenvuelto.registros);
    const nuevo = montarMd(desenvuelto.frontmatter, envuelto.pre);

    if (dry) {
      salida.push({ slug, ok: true, dry: true, acordes: envuelto.acordes, avisos: envuelto.avisos });
      if (!json) console.log(`→ ${slug}: se movería a ${DESTINO} con ${envuelto.acordes} acordes`);
      continue;
    }

    writeFileSync(destino, nuevo, 'utf8');
    unlinkSync(origen);
    salida.push({ slug, ok: true, acordes: envuelto.acordes, avisos: envuelto.avisos });
    if (!json) console.log(`✓ ${slug}: ${DESTINO}/${slug}.md (${envuelto.acordes} acordes)`);
  } catch (e) {
    fallo(String(e.message || e));
  }
}

if (json) {
  console.log(JSON.stringify(fallos ? { error: salida.find((x) => !x.ok)?.error, fichas: salida } : { ok: true, fichas: salida }));
}
if (fallos) process.exit(1);
