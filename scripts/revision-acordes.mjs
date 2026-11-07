// Cola de coplas pendientes de revisión a mano.
//
// La fuente de verdad es `src/data/revision-acordes.json`, que también lee el
// panel `/admin` (pestaña «Por revisar»). Aquí se consulta y se edita desde la
// consola, por si el panel no está a mano.
//
//   node scripts/revision-acordes.mjs                     lista las pendientes
//   node scripts/revision-acordes.mjs --marcar <slug>     la quita de la cola
//   node scripts/revision-acordes.mjs --anadir <slug>     la mete en la cola
//   node scripts/revision-acordes.mjs --auditar           comprueba que existen
//   node scripts/revision-acordes.mjs --sincronizar [md]  rehace la cola desde
//                                                         un markdown de `- [ ]`
//
// Vale tanto una ficha publicada (`acordes`) como un borrador (`borradores`): el
// panel enseña los dos en «Por revisar».
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const RAIZ = process.cwd();
const JSON_REVISION = join(RAIZ, 'src/data/revision-acordes.json');
const CARPETAS = [join(RAIZ, 'src/content/acordes'), join(RAIZ, 'src/content/borradores')];
const COLA_POR_DEFECTO = join(RAIZ, 'pendientes-revision.md');

const hoy = () => new Date().toISOString().slice(0, 10);

async function leer() {
  const json = JSON.parse(await readFile(JSON_REVISION, 'utf8'));
  if (!Array.isArray(json.pendientes)) json.pendientes = [];
  return json;
}

async function guardar(json) {
  json.pendientes = [...new Set(json.pendientes)];
  json.actualizado = hoy();
  await writeFile(JSON_REVISION, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

const existe = async (slug) => {
  for (const carpeta of CARPETAS) {
    try {
      await access(join(carpeta, `${slug}.md`));
      return true;
    } catch {
      // se prueba en la siguiente carpeta
    }
  }
  return false;
};

const args = process.argv.slice(2);
const orden = args[0] && !args[0].startsWith('--') ? args[0] : null;
const valor = (bandera) => {
  const i = args.indexOf(bandera);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null;
};

const json = await leer();

if (valor('--marcar')) {
  const slugs = String(valor('--marcar')).split(',').map((s) => s.trim()).filter(Boolean);
  const antes = json.pendientes.length;
  json.pendientes = json.pendientes.filter((s) => !slugs.includes(s));
  await guardar(json);
  console.log(`Revisadas: ${slugs.join(', ')}. Quedan ${json.pendientes.length} (antes ${antes}).`);
} else if (valor('--anadir')) {
  const slugs = String(valor('--anadir')).split(',').map((s) => s.trim()).filter(Boolean);
  for (const s of slugs) {
    if (!(await existe(s))) {
      console.error(`No existe ${s}.md en acordes ni en borradores`);
      process.exitCode = 1;
      continue;
    }
    json.pendientes.push(s);
  }
  await guardar(json);
  console.log(`En la cola: ${json.pendientes.length} pendientes.`);
} else if (valor('--auditar')) {
  const faltan = [];
  for (const s of json.pendientes) if (!(await existe(s))) faltan.push(s);
  console.log(`Pendientes: ${json.pendientes.length}`);
  if (faltan.length) {
    console.error(`En la cola pero sin ficha: ${faltan.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Todas las fichas de la cola existen.');
  }
} else if (valor('--sincronizar')) {
  const archivo = valor('--sincronizar') === true ? COLA_POR_DEFECTO : String(valor('--sincronizar'));
  const texto = await readFile(archivo, 'utf8');
  const slugs = [...texto.matchAll(/`src\/content\/acordes\/(.+)\.md`/g)].map((m) => m[1]);
  json.pendientes = slugs;
  await guardar(json);
  console.log(`Cola sincronizada desde ${archivo}: ${slugs.length} pendientes.`);
} else {
  const sinFicha = [];
  console.log(`Pendientes de revisión: ${json.pendientes.length} (actualizado ${json.actualizado || '—'})`);
  for (const s of json.pendientes) {
    const ok = await existe(s);
    if (!ok) sinFicha.push(s);
    console.log(`  ${ok ? ' ' : '?'} ${s}`);
  }
  if (sinFicha.length) console.log('\n(? = sin ficha: pasa --auditar)');
}
