// scripts/auditar-view-transitions.mjs
//
// Comprueba el resultado del build para las transiciones de página nativas
// (cross-document view transitions):
//
//   1. Que `@view-transition` sobrevive al pipeline de CSS (PostCSS, minify).
//   2. Que ningún HTML repite un `view-transition-name` dentro de la misma
//      página. Un nombre duplicado anula esa transición en el navegador, así
//      que conviene detectarlo al cambiar una plantilla.
//
// Uso:
//   npm run build
//   node scripts/auditar-view-transitions.mjs [--dir dist]

import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const opts = { dir: 'dist', help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dir') opts.dir = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }

  return opts;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log('Uso: node scripts/auditar-view-transitions.mjs [--dir dist]');
    return 0;
  }

  if (!fs.existsSync(opts.dir)) {
    console.error(`No existe "${opts.dir}". Ejecuta \`npm run build\` primero.`);
    return 1;
  }

  const files = walk(opts.dir);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const cssFiles = files.filter((f) => f.endsWith('.css'));

  // 1. El at-rule tiene que sobrevivir al build.
  const cssHasAtRule = cssFiles.some((f) => fs.readFileSync(f, 'utf8').includes('@view-transition'));

  if (!cssHasAtRule) {
    console.error('✗ No se encuentra `@view-transition` en ningún CSS del build.');
  }

  // 2. Nombres duplicados por página.
  const nameRe = /view-transition-name:\s*([a-zA-Z0-9_-]+)/g;
  let pages = 0;
  let names = 0;
  const duplicates = [];

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const counts = new Map();
    let match;

    nameRe.lastIndex = 0;
    while ((match = nameRe.exec(html)) !== null) {
      counts.set(match[1], (counts.get(match[1]) || 0) + 1);
      names++;
    }

    if (counts.size === 0) continue;
    pages++;

    const repeated = [...counts.entries()].filter(([, count]) => count > 1);
    if (repeated.length > 0) duplicates.push({ file, repeated });
  }

  console.log(`Páginas con view-transition-name: ${pages}`);
  console.log(`Nombres encontrados: ${names}`);
  console.log(`@view-transition en el CSS: ${cssHasAtRule ? 'sí' : 'no'}`);

  if (duplicates.length === 0) {
    console.log('✓ Sin nombres duplicados.');
    return cssHasAtRule ? 0 : 1;
  }

  console.error(`\n✗ ${duplicates.length} página(s) con nombres duplicados:`);
  for (const { file, repeated } of duplicates.slice(0, 20)) {
    const list = repeated.map(([name, count]) => `${name} ×${count}`).join(', ');
    console.error(`  ${path.relative(opts.dir, file)} → ${list}`);
  }
  if (duplicates.length > 20) {
    console.error(`  … y ${duplicates.length - 20} más.`);
  }

  return 1;
}

process.exit(main());
