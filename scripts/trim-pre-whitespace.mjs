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
//   node scripts/trim-pre-whitespace.mjs                 # aplica en acordes y otraweb
//   node scripts/trim-pre-whitespace.mjs --dry-run       # solo informa
//   node scripts/trim-pre-whitespace.mjs --dir src/content/acordes
//   node scripts/trim-pre-whitespace.mjs --check         # no escribe; sale con 1 si hay cola
//   node scripts/trim-pre-whitespace.mjs --archivo src/content/acordes/pasodoble-x.md
//   node scripts/trim-pre-whitespace.mjs --dir src/content/acordes --publicadas
//   node scripts/trim-pre-whitespace.mjs --quiet

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { analizarPre, limpiarPre } from './lib/pre-espacios.mjs';

const DEFAULT_DIRS = ['src/content/acordes', 'src/content/otraweb'];

function parseArgs(argv) {
  const opts = { dirs: [], archivos: [], dryRun: false, check: false, publicadas: false, quiet: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--check') opts.check = true;
    else if (arg === '--publicadas') opts.publicadas = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--dir') {
      const value = argv[++i];
      if (!value) throw new Error('Falta la ruta después de --dir');
      opts.dirs.push(value);
    } else if (arg === '--archivo') {
      const value = argv[++i];
      if (!value) throw new Error('Falta la ruta después de --archivo');
      opts.archivos.push(value);
    } else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }

  if (opts.archivos.length && opts.publicadas) {
    throw new Error('--archivo y --publicadas no se pueden combinar: --archivo ya elige las fichas');
  }

  if (opts.dirs.length === 0 && opts.archivos.length === 0) opts.dirs = DEFAULT_DIRS;
  return opts;
}

function printHelp() {
  console.log(`Uso: node scripts/trim-pre-whitespace.mjs [opciones]

Opciones:
  --dir <ruta>     Carpeta con archivos .md (repetible). Por defecto:
                   ${DEFAULT_DIRS.join(', ')}
  --archivo <ruta> Ficha concreta (repetible). No combinar con --publicadas.
  --publicadas     Solo las fichas que están en HEAD (las publicadas); deja
                   fuera las nuevas sin commitear.
  --check          No escribe nada y sale con 1 si queda alguna cola.
  --dry-run        No escribe nada, solo informa de lo que cambiaría.
  --quiet          Solo muestra el resumen final.
  -h, --help       Muestra esta ayuda`);
}

/** Fichas .md publicadas en HEAD dentro de una carpeta (rutas absolutas). */
function ficherosPublicados(dir) {
  let salida;
  try {
    salida = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', dir], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    throw new Error(`no se pudo leer HEAD con git (¿estás dentro del repositorio?): ${String(e.message || e).trim()}`);
  }
  return salida
    .split('\0')
    .filter((ruta) => ruta.toLowerCase().endsWith('.md'))
    .map((ruta) => path.resolve(ruta));
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

/** Ficheros de un `--archivo`: comprueba que existan antes de seguir. */
function collectArchivos(archivos) {
  return archivos.map((ruta) => {
    const abs = path.resolve(ruta);
    if (!fs.existsSync(abs)) throw new Error(`no existe el archivo ${ruta}`);
    return abs;
  });
}

const rel = (ruta) => path.relative(process.cwd(), ruta).split(path.sep).join('/');

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    return;
  }

  // Un grupo por cada --dir (o por cada --archivo suelto). Se conserva el
  // resumen por carpeta que ya se imprimía.
  const grupos = opts.archivos.length
    ? [{ etiqueta: 'archivo', files: collectArchivos(opts.archivos) }]
    : opts.dirs.map((dir) => {
        const { files } = opts.publicadas
          ? { files: ficherosPublicados(dir) }
          : collectMarkdownFiles(dir);
        return { etiqueta: dir, files };
      });

  let totalFiles = 0;
  let totalChangedFiles = 0;
  let totalLines = 0;

  for (const { etiqueta, files } of grupos) {
    if (!files.length) {
      console.log(`\n${etiqueta}: sin archivos .md (se omite)`);
      continue;
    }

    let changedFiles = 0;
    let changedLines = 0;

    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      totalFiles++;

      const raw = fs.readFileSync(file, 'utf8');
      const { lineas } = analizarPre(raw);
      if (!lineas.length) continue;

      if (opts.check) {
        console.log(`${rel(file)} (${lineas.length} línea(s) con espacios al final)`);
        if (!opts.quiet) {
          for (const { n, cola } of lineas) console.log(`  L${n}  ${'·'.repeat(cola)} (${cola})`);
        }
      } else {
        const { texto } = limpiarPre(raw);
        if (!opts.dryRun) fs.writeFileSync(file, texto, 'utf8');
        if (!opts.quiet) console.log(`${opts.dryRun ? '[dry-run] ' : ''}${rel(file)} (${lineas.length} líneas)`);
      }

      changedFiles++;
      changedLines += lineas.length;
    }

    totalChangedFiles += changedFiles;
    totalLines += changedLines;

    if (!opts.check) console.log(`\n${etiqueta}: ${changedFiles}/${files.length} archivos, ${changedLines} líneas`);
  }

  if (opts.check) {
    if (totalLines) {
      console.error(`\n✗ ${totalLines} línea(s) con espacios o tabuladores al final en ${totalChangedFiles}/${totalFiles} archivo(s).`);
      console.error('  Límpialas con: node scripts/trim-pre-whitespace.mjs (--archivo <ruta> para una sola ficha)');
      process.exitCode = 1;
    } else {
      console.log(`✓ Sin espacios al final de línea en ${totalFiles} archivo(s).`);
    }
    return;
  }

  const verbo = opts.dryRun ? 'Se limpiarían' : 'Limpiadas';
  console.log(`\n${verbo} ${totalLines} líneas en ${totalChangedFiles}/${totalFiles} archivos.`);

  if (opts.dryRun) console.log('Modo --dry-run: no se ha escrito ningún archivo.');
}

main();
