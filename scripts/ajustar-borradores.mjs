// Deja cada ficha en la carpeta que le toca: los borradores sin revisar, en
// `borradores`; lo revisado y/o publicado, en `acordes`.
//
// La regla: una ficha de `acordes` que **no estÃ¡ en git** (sin commit) y sigue en
// la cola de revisiÃ³n no estÃ¡ revisada, asÃ­ que es un borrador de verdad y se
// mueve a `borradores`. Solo se mueven archivos sin rastrear: un archivo rastreado
// que se mueva aparecerÃ­a como borrado en git, y eso no se hace aquÃ­.
//
// No toca el contenido de ninguna ficha ni la cola, no publica, no hace commit y
// no hace push.
//
//   node scripts/ajustar-borradores.mjs --dry   enseÃ±a lo que moverÃ­a
//   node scripts/ajustar-borradores.mjs         lo mueve
import { readdir, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const RAIZ = process.cwd();
const ACORDES = join(RAIZ, 'src/content/acordes');
const BORRADORES = join(RAIZ, 'src/content/borradores');
const REVISION = join(RAIZ, 'src/data/revision-acordes.json');

const seco = process.argv.includes('--dry');

const git = async (args) => {
  const { stdout } = await ejecutar('git', args, { cwd: RAIZ, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
};

/** Cola de revisiÃ³n (`pendientes`). */
const cola = async () => {
  const json = JSON.parse(await readFile(REVISION, 'utf8'));
  return new Set(Array.isArray(json.pendientes) ? json.pendientes : []);
};

/** Slugs `.md` de una carpeta. */
const slugs = async (carpeta) =>
  (await readdir(carpeta)).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3));

/** Fichas de `acordes` sin commit: sin rastrear (`??`) o con un alta en el Ã­ndice (`A`). */
async function sinCommit() {
  const salida = await git(['status', '--porcelain=v1', '-z', '--no-renames', '--', 'src/content/acordes']);
  const mapa = new Map();
  for (const entrada of salida.split('\0').filter(Boolean)) {
    const xy = entrada.slice(0, 2);
    const ruta = entrada.slice(3);
    if (!ruta.endsWith('.md')) continue;
    if (xy === '??' || xy[0] === 'A') mapa.set(ruta.split('/').pop().slice(0, -3), xy === '??' ? 'nueva' : 'indexada');
  }
  return mapa;
}

/** Las cuatro pestaÃ±as del panel, calculadas igual que `estudio.js`. */
async function cuentas() {
  const enCola = await cola();
  const nuevos = await sinCommit();
  const acordes = new Set(await slugs(ACORDES));
  const borradores = new Set(await slugs(BORRADORES));
  const enGit = [...acordes].filter((s) => !nuevos.has(s));
  return {
    cola: enCola,
    nuevos,
    acordes,
    borradores,
    porRevisar: enGit.filter((s) => enCola.has(s)).length,
    // Los que quedan en acordes sin commit y en la cola siguen siendo borradores
    // aunque no se hayan podido mover (por ejemplo, si ya habÃ­a un borrador).
    borradores: borradores.size + [...nuevos.keys()].filter((s) => enCola.has(s)).length,
    porPublicar: [...nuevos.keys()].filter((s) => !enCola.has(s)).length,
    publicadas: enGit.filter((s) => !enCola.has(s)).length,
  };
}

const antes = await cuentas();
const mover = [];
const avisos = [];
for (const [slug, estado] of antes.nuevos) {
  if (!antes.cola.has(slug)) continue; // revisada: se queda en acordes, va a Â«Por publicarÂ»
  if (antes.borradores.has(slug)) {
    avisos.push(`${slug}: ya existe en borradores (no se toca)`);
    continue;
  }
  mover.push({ slug, estado });
}

console.log(`Sin commit y sin revisar: ${mover.length} fichas${seco ? ' (simulaciÃ³n: no se mueve nada)' : ''}`);
for (const { slug, estado } of mover) console.log(`  ${slug}  (${estado})`);
if (avisos.length) {
  console.log('\nAvisos:');
  for (const a of avisos) console.log(`  ${a}`);
}

if (!seco && mover.length) {
  for (const { slug } of mover) {
    await rename(join(ACORDES, `${slug}.md`), join(BORRADORES, `${slug}.md`));
  }
  console.log(`\nMovidas ${mover.length} fichas de acordes a borradores.`);
}

const c = seco ? antes : await cuentas();
const total = c.porRevisar + c.borradores + c.porPublicar + c.publicadas;
const fichas = c.acordes.size + c.borradores.size;

console.log('\nPestaÃ±as:');
console.log(`  Por revisar   ${c.porRevisar}`);
console.log(`  Borradores    ${c.borradores}`);
console.log(`  Por publicar  ${c.porPublicar}`);
console.log(`  Publicadas    ${c.publicadas}`);
console.log(`  Total         ${total}  (acordes ${c.acordes.size} + borradores ${c.borradores.size} = ${fichas})`);

if (total !== fichas) {
  console.error('\nLos recuentos no cuadran con el nÃºmero de fichas: revisa el ajuste.');
  process.exitCode = 1;
}
