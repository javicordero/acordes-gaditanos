// Pasa una ficha de la colección de borradores (`acordes3`) a la buena
// (`acordes`), le pone la fecha del día y borra el borrador.
//
// Uso:
//   npm run promover -- --slug <slug>[,<slug>]
//   npm run promover -- --todos
//   npm run promover -- --slug <slug> --dry
//
// Después, lo normal es `npm run auditar:pre`, `npm run auditar:acordes` y el
// commit con la skill `subir-acorde`.
//
// Ojo: la fecha que pone es la de hoy. Si vas a publicar varias, `subir-acorde`
// la ajusta al día siguiente del último publicado.

import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = 'src/content/acordes3';
const DESTINO = 'src/content/acordes';

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

const hoy = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

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
const conFecha = plano.replace(/^date:[^\n]*/m, `date: "${hoy()}"`);
  if (conFecha === plano) console.error(`! ${slug}: no tenía campo date; se queda como está`);

  if (dry) {
    console.log(`· ${slug}: se movería a ${destino} con fecha ${hoy()}`);
    continue;
  }
  writeFileSync(destino, crlf ? conFecha.replace(/\n/g, '\r\n') : conFecha);
  unlinkSync(origen);
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
