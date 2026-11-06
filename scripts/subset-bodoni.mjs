#!/usr/bin/env node
/**
 * Genera el subset de Bodoni que usa la cabecera para el nombre de la web.
 *
 * La Bodoni completa (bodoni-72-oldstyle-book.woff2, ~30 KB) solo se necesita
 * en el panel. En la web pública la fuente únicamente dibuja «Acordes
 * Gaditanos», así que se recorta a esos glifos (~2 KB) y se precarga esa copia.
 *
 * No se ejecuta en el build: la salida se versiona. Hay que volver a pasarlo si
 * cambia el rótulo (otra palabra, una tilde…) y, como los nombres de fuente no
 * llevan versión, renombrar el archivo para no servir la copia vieja durante el
 * max-age de /fonts/*.
 *
 * Uso: npm run subset:bodoni
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(raiz, 'public/fonts/bodoni-72-oldstyle-book.woff2');
const SALIDA = join(raiz, 'public/fonts/bodoni-logo.woff2');
// Tiene que coincidir con el texto de .branding-title en Header.astro.
const TEXTO = 'Acordes Gaditanos';

if (!existsSync(ORIGEN)) {
  console.error(`No encuentro la fuente original: ${relative(raiz, ORIGEN)}`);
  process.exit(1);
}

/** Devuelve el comando de Python disponible (`python` o `py -3`). */
function comandoPython() {
  for (const [cmd, prefijo] of [
    ['python', []],
    ['py', ['-3']],
  ]) {
    try {
      execFileSync(cmd, [...prefijo, '--version'], { stdio: 'ignore' });
      return { cmd, prefijo };
    } catch {
      // Siguiente candidato.
    }
  }
  console.error('No encuentro Python. Instala Python 3 y `fonttools` (pip install fonttools brotli).');
  process.exit(1);
}

const { cmd, prefijo } = comandoPython();

try {
  execFileSync(
    cmd,
    [
      ...prefijo,
      '-m',
      'fontTools.subset',
      ORIGEN,
      `--text=${TEXTO}`,
      '--flavor=woff2',
      '--layout-features=',
      '--no-hinting',
      '--desubroutinize',
      '--drop-tables+=FFTM',
      `--output-file=${SALIDA}`,
    ],
    { stdio: 'inherit' },
  );
} catch {
  console.error('fontTools no pudo generar el subset. ¿Está instalado? pip install fonttools brotli');
  process.exit(1);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(
  `\n✓ ${relative(raiz, SALIDA)}: ${kb(statSync(SALIDA).size)} (original: ${kb(statSync(ORIGEN).size)})`,
);
console.log(`  Glifos: «${TEXTO}». Si cambia el rótulo, actualiza TEXTO en este script y renombra el archivo.`);
