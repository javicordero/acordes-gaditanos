// scripts/trim-pre-whitespace.mjs
//
// Elimina los espacios y tabuladores al final de línea dentro de los bloques
// <pre> de los acordes. Esos espacios son literales en HTML y ensucian el
// ancho del bloque (AnchoPreInit mide el scrollWidth del <pre>), además de
// generar ruido en el diff.
//
// Solo toca el interior de <pre>…</pre>: la indentación inicial (alineación
// de acordes), el frontmatter y todo lo demás quedan intactos.
//
// Uso:
//   node scripts/trim-pre-whitespace.mjs                 # aplica en acordes y acordes2
//   node scripts/trim-pre-whitespace.mjs --dry-run       # solo informa
//   node scripts/trim-pre-whitespace.mjs --dir src/content/acordes
//   node scripts/trim-pre-whitespace.mjs --quiet

import fs from 'fs';
import path from 'path';

const DEFAULT_DIRS = ['src/content/acordes', 'src/content/acordes2'];

function parseArgs(argv) {
  const opts = { dirs: [], dryRun: false, quiet: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--dir') {
      const value = argv[++i];
      if (!value) throw new Error('Falta la ruta después de --dir');
      opts.dirs.push(value);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  if (opts.dirs.length === 0) opts.dirs = DEFAULT_DIRS;
  return opts;
}

function printHelp() {
  console.log(`Uso: node scripts/trim-pre-whitespace.mjs [opciones]

Opciones:
  --dir <ruta>   Carpeta con archivos .md (repetible). Por defecto:
                 ${DEFAULT_DIRS.join(', ')}
  --dry-run      No escribe nada, solo informa de lo que cambiaría
  --quiet        Solo muestra el resumen final
  -h, --help     Muestra esta ayuda`);
}

// Quita [ \t] al final de cada línea interior de los <pre>.
// Devuelve el contenido nuevo y el número de líneas modificadas.
function trimPreBlocks(content) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  let insidePre = false;
  let changed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (insidePre && /[ \t]+$/.test(line)) {
      lines[i] = line.replace(/[ \t]+$/, '');
      changed++;
    } else if (!insidePre && /<pre\b/i.test(line) && /[ \t]+$/.test(line)) {
      // La línea que abre el <pre> también puede acabar en espacios
      // (p. ej. "<pre>      "), que forman parte del contenido.
      lines[i] = line.replace(/[ \t]+$/, '');
      changed++;
    }

    // Se actualiza el estado después de limpiar, para no tocar lo que
    // haya fuera del bloque.
    if (!insidePre && /<pre\b/i.test(line)) insidePre = true;
    if (insidePre && /<\/pre>/i.test(line)) insidePre = false;
  }

  if (changed === 0) return { content, changed };

  return { content: lines.join(eol), changed };
}

function collectMarkdownFiles(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) return { abs, files: [] };

  const files = [];
  const entries = fs.readdirSync(abs, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(abs, entry.name);
    if (entry.isDirectory()) files.push(...collectMarkdownFiles(full).files);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(full);
  }

  return { abs, files };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    return;
  }

  let totalFiles = 0;
  let totalChangedFiles = 0;
  let totalLines = 0;

  for (const dir of opts.dirs) {
    const { abs, files } = collectMarkdownFiles(dir);

    if (!files.length) {
      console.log(`\n${dir}: sin archivos .md (se omite)`);
      continue;
    }

    let changedFiles = 0;
    let changedLines = 0;

    for (const file of files) {
      totalFiles++;

      const raw = fs.readFileSync(file, 'utf8');
      const { content, changed } = trimPreBlocks(raw);
      if (changed === 0) continue;

      if (!opts.dryRun) fs.writeFileSync(file, content, 'utf8');

      changedFiles++;
      changedLines += changed;
      if (!opts.quiet) {
        console.log(`${opts.dryRun ? '[dry-run] ' : ''}${path.relative(process.cwd(), file)} (${changed} líneas)`);
      }
    }

    totalChangedFiles += changedFiles;
    totalLines += changedLines;

    console.log(`\n${dir}: ${changedFiles}/${files.length} archivos, ${changedLines} líneas`);
  }

  const verb = opts.dryRun ? 'Se limpiarían' : 'Limpiadas';
  console.log(`\n${verb} ${totalLines} líneas en ${totalChangedFiles}/${totalFiles} archivos.`);

  if (opts.dryRun) console.log('Modo --dry-run: no se ha escrito ningún archivo.');
}

main();
