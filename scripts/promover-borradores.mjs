// Pasa una ficha de la colección de borradores (`src/content/borradores`) a la buena
// (`acordes`), le pone la fecha siguiente a la última publicada y borra el borrador.
//
// Uso:
//   npm run promover -- --slug <slug>[,<slug>]
//   npm run promover -- --todos
//   npm run promover -- --slug <slug> --dry
//
// Después, lo normal es `npm run auditar:pre`, `npm run auditar:acordes` y el
// commit con la skill `subir-acorde`.

import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ORIGEN = 'src/content/borradores';
const DESTINO = 'src/content/acordes';
const CARPETA = DESTINO;

const args = process.argv.slice(2);
const iSlug = args.indexOf('--slug');
const slugs = iSlug >= 0 && args[iSlug + 1] && !args[iSlug + 1].startsWith('--')
  ? String(args[iSlug + 1]).split(',').map((s) => s.trim()).filter(Boolean)
  : args.includes('--todos')
    ? readdirSync(ORIGEN).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))
    : [];
const dry = args.includes('--dry');

if (!slugs.length) {
  console.error('Uso: npm run promover -- --slug <slug>[,<slug>] | --todos [--dry]');
  process.exit(1);
}

/** Última fecha publicada en HEAD (tolera días inválidos como 31/09). */
function ultimaFecha() {
  let salida = '';
  try {
    salida = execFileSync('git', ['grep', '-h', '^date:', 'HEAD', '--', CARPETA], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return new Date();
  }
  let max = 0;
  for (const linea of salida.split('\n')) {
    const m = /date:\s*["']?(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(linea);
    if (!m) continue;
    const clave = Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
    if (clave > max) max = clave;
  }
  if (!max) return new Date();
  return new Date(Math.floor(max / 10000), Math.floor((max % 10000) / 100) - 1, max % 100);
}

const dos = (n) => String(n).padStart(2, '0');
const formatear = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
const base = ultimaFecha();
let contador = 0;

// Fechas consecutivas en orden alfabético, como `subir-acorde`.
slugs.sort((a, b) => a.localeCompare(b));

let hechas = 0;
for (const slug of slugs) {
  const origen = join(ORIGEN, `${slug}.md`);
  const destino = join(DESTINO, `${slug}.md`);
  if (!existsSync(origen)) { console.error(`✗ no existe ${origen}`); continue; }
  if (existsSync(destino)) { console.error(`✗ ya existe ${destino}; no lo piso`); continue; }

  const md = readFileSync(origen, 'utf8');
  if (!/<a[\s>]/.test(md)) {
    console.error(`✗ ${slug}: la ficha no tiene acordes envueltos en <a>; pásala por el editor antes`);
    continue;
  }
  const crlf = md.includes('\r\n');
  const plano = crlf ? md.replace(/\r\n/g, '\n') : md;
  const fecha = formatear(new Date(base.getFullYear(), base.getMonth(), base.getDate() + contador + 1));
  const conFecha = plano.replace(/^date:[^\n]*/m, `date: "${fecha}"`);
  if (conFecha === plano) console.error(`! ${slug}: no tenía campo date; se queda como está`);

  if (dry) {
    console.log(`· ${slug}: se movería a ${destino} con fecha ${fecha}`);
    contador++;
    continue;
  }
  writeFileSync(destino, crlf ? conFecha.replace(/\n/g, '\r\n') : conFecha);
  unlinkSync(origen);
  contador++;
  hechas++;
  console.log(`✓ ${slug} → ${destino}`);
}

if (hechas) {
  console.log(`\n${hechas} ficha(s) promovida(s). Ahora:`);
  console.log('  npm run auditar:pre');
  console.log('  npm run auditar:acordes');
  console.log('  npm run build');
  console.log('  y el commit con la skill subir-acorde');
}
