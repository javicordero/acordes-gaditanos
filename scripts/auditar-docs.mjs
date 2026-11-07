// Audita la documentación que lee el agente.
//
// Comprueba cuatro cosas que se rompen solas al mover documentos:
//
//   1. Los enlaces relativos de AGENTS.md (raíz y anidados), README.md, docs/**/*.md y
//      .agents/skills/**/SKILL.md apuntan a un archivo que existe.
//   2. Cada `docs/operativa/*.md` está referenciado (por nombre) desde un AGENTS.md, el
//      README o una skill. Si no, el mapa por tareas no lo encuentra nunca.
//   3. Avisa de docs de operativa por encima de 24 KB: es la señal de que toca partirlos.
//   4. El AGENTS.md raíz no pasa de 8 KB (se carga en cada petición) ni los anidados de 6 KB.
//
// Uso: npm run auditar:docs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const RAIZ = process.cwd();
const IGNORAR = new Set(['node_modules', '.git', 'dist', '.astro', '.cache', '.netlify']);
const TOPE_DOC = 24 * 1024;

let errores = 0;
let avisos = 0;
let enlaces = 0;

/** Ruta relativa a la raíz, siempre con `/` (también en Windows). */
const rel = (ruta) => relative(RAIZ, ruta).split('\\').join('/');

const fallo = (texto) => {
  console.error(`FALLO  ${texto}`);
  errores++;
};
const aviso = (texto) => {
  console.warn(`AVISO  ${texto}`);
  avisos++;
};

/** Recorre un directorio y devuelve los archivos que cumplen el filtro. */
function recorrer(dir, filtro) {
  const salida = [];
  const pendientes = [dir];
  while (pendientes.length) {
    const actual = pendientes.pop();
    let entradas;
    try {
      entradas = readdirSync(actual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      if (IGNORAR.has(entrada.name)) continue;
      const ruta = join(actual, entrada.name);
      if (entrada.isDirectory()) pendientes.push(ruta);
      else if (entrada.isFile() && filtro(ruta)) salida.push(ruta);
    }
  }
  return salida;
}

const esMarkdown = (ruta) => ruta.endsWith('.md');
const esSkill = (ruta) => basename(ruta) === 'SKILL.md';

const agents = recorrer(RAIZ, (ruta) => basename(ruta) === 'AGENTS.md');
const docs = recorrer(join(RAIZ, 'docs'), esMarkdown);
const skills = recorrer(join(RAIZ, '.agents', 'skills'), esSkill);
const readme = join(RAIZ, 'README.md');
const conEnlaces = [...agents, ...docs, ...skills, ...(existsSync(readme) ? [readme] : [])];

// ---------------------------------------------------------------------------
// 1. Enlaces relativos
// ---------------------------------------------------------------------------
const RE_ENLACE = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

for (const archivo of conEnlaces) {
  const texto = readFileSync(archivo, 'utf8');
  for (const m of texto.matchAll(RE_ENLACE)) {
    const destino = m[1];
    if (!destino || /^(#|https?:|mailto:|tel:|\/)/i.test(destino)) continue;
    const limpio = decodeURIComponent(destino.split('#')[0].split('?')[0]);
    if (!limpio) continue;
    enlaces++;
    const ruta = resolve(dirname(archivo), limpio);
    if (!existsSync(ruta)) {
      fallo(`${rel(archivo)} → ${destino} (no existe)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Docs de operativa alcanzables desde el mapa / README / skills
// ---------------------------------------------------------------------------
const operativa = docs.filter((ruta) => rel(ruta).startsWith('docs/operativa/'));
const hubs = [
  ...agents,
  ...skills,
  ...(existsSync(readme) ? [readme] : []),
].map((ruta) => readFileSync(ruta, 'utf8'));

const corpus = hubs.join('\n');
for (const archivo of operativa) {
  const nombre = basename(archivo);
  if (!corpus.includes(nombre)) {
    fallo(`${rel(archivo)} no está referenciado desde AGENTS.md, el README ni una skill`);
  }
}
for (const archivo of docs.filter((ruta) => !operativa.includes(ruta))) {
  if (!corpus.includes(basename(archivo))) {
    aviso(`${rel(archivo)} no lo referencia nadie (nota histórica o suelta)`);
  }
}

// ---------------------------------------------------------------------------
// 3. Tamaño de los docs de operativa
// ---------------------------------------------------------------------------
for (const archivo of operativa) {
  const { size } = statSync(archivo);
  if (size > TOPE_DOC) {
    aviso(`${rel(archivo)} pesa ${Math.round(size / 1024)} KB: pártelo por tarea (tope ${TOPE_DOC / 1024} KB)`);
  }
}

// ---------------------------------------------------------------------------
// 4. El AGENTS.md raíz se carga en cada petición: no puede volver a crecer
// ---------------------------------------------------------------------------
const raiz = join(RAIZ, 'AGENTS.md');
if (existsSync(raiz) && statSync(raiz).size > 8 * 1024) {
  fallo(`AGENTS.md raíz pesa ${Math.round(statSync(raiz).size / 1024)} KB (tope 8 KB): mueve el detalle a docs/operativa, se carga en cada petición`);
}
for (const archivo of agents.filter((ruta) => ruta !== raiz)) {
  if (statSync(archivo).size > 6 * 1024) {
    aviso(`${rel(archivo)} pesa ${Math.round(statSync(archivo).size / 1024)} KB (tope 6 KB para uno anidado)`);
  }
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
const kb = Math.round(operativa.reduce((suma, ruta) => suma + statSync(ruta).size, 0) / 1024);
console.log(
  `${agents.length} AGENTS.md, ${docs.length} docs (${operativa.length} de operativa, ${kb} KB), ` +
  `${skills.length} skills, ${enlaces} enlaces revisados.`,
);

if (!errores) console.log(`OK: documentación coherente${avisos ? ` (${avisos} aviso/s)` : ''}.`);
process.exit(errores ? 1 : 0);
