// Gestiona `letras-pendientes.md`: la cola de coplas cuya letra hay que buscar
// y a las que después se les copian los acordes de otra ficha de la misma
// música.
//
// Uso:
//   node scripts/letras-pendientes.mjs                     (la cola)
//   node scripts/letras-pendientes.mjs siguiente          (el primero pendiente)
//   node scripts/letras-pendientes.mjs estado 5 encontrada --fuente <url>
//   node scripts/letras-pendientes.mjs estado 5 "con acordes" --ficha <slug>
//   node scripts/letras-pendientes.mjs auditar            (estados contra fichas)
//   node scripts/letras-pendientes.mjs anadir "frase" --agrupacion "Los X"
//
// El archivo es la fuente de verdad y se edita solo en la tabla: la cabecera, la
// explicación y el historial se conservan tal cual.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVO = 'letras-pendientes.md';
const CARPETA = 'src/content/acordes';
const ESTADOS = ['pendiente', 'encontrada', 'con acordes', 'no encontrada', 'duplicada'];
const ICONO = {
  pendiente: '·', encontrada: '🔎', 'con acordes': '✓', 'no encontrada': '✗', duplicada: '=' ,
};

const args = process.argv.slice(2);
const orden = args[0] || 'listar';

function leer() {
  const texto = readFileSync(ARCHIVO, 'utf8');
  const lineas = texto.split('\n');
  const filas = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!/^\|\s*\d+\s*\|/.test(l)) continue;
    const celdas = l.split('|').slice(1, -1).map((c) => c.trim());
    filas.push({
      i: filas.length,
      linea: i,
      n: Number(celdas[0]),
      frase: celdas[1],
      agrupacion: celdas[2],
      base: celdas[3],
      estado: celdas[4],
      ficha: celdas[5] || '',
      fuente: celdas[6] || '',
      notas: celdas[7] || '',
    });
  }
  return { texto, lineas, filas };
}

function escribir(filas, lineas) {
  for (const f of filas) {
    lineas[f.linea] = `| ${f.n} | ${f.frase} | ${f.agrupacion} | ${f.base} | ${f.estado} | ${f.ficha} | ${f.fuente} | ${f.notas} |`;
  }
  writeFileSync(ARCHIVO, lineas.join('\n'));
}

function opciones(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) o[k] = true;
    else { o[k] = sig; i++; }
  }
  return o;
}

/** ¿Existe la ficha y es una letra alternativa de su base? */
function comprobar(f) {
  const problemas = [];
  if (!f.base || f.base === '?' || f.base.includes('?')) problemas.push('sin ficha base');
  else if (!existsSync(join(CARPETA, `${f.base}.md`))) problemas.push(`no existe la base ${f.base}`);
  if (f.estado === 'con acordes') {
    if (!f.ficha) problemas.push('estado «con acordes» sin ficha');
    else if (!existsSync(join(CARPETA, `${f.ficha}.md`))) problemas.push(`no existe ${f.ficha}.md`);
    else {
      const t = readFileSync(join(CARPETA, `${f.ficha}.md`), 'utf8');
      if (!t.includes('letraTitulo:')) problemas.push(`${f.ficha} no lleva letraTitulo`);
    }
  }
  if (f.estado === 'encontrada' && !f.fuente) problemas.push('estado «encontrada» sin fuente');
  if (f.estado === 'no encontrada' && !f.notas) problemas.push('estado «no encontrada» sin notas de dónde se miró');
  return problemas;
}

function listar(filas, filtro) {
  const porEstado = {};
  for (const f of filas) porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
  const resumen = ESTADOS.map((e) => `${ICONO[e]} ${e}: ${porEstado[e] || 0}`).join(' · ');
  console.log(`${resumen}\n`);
  const visibles = filtro ? filas.filter((f) => f.estado === filtro) : filas;
  for (const f of visibles) {
    console.log(`${String(f.n).padStart(2)} ${ICONO[f.estado]} ${f.frase}`);
    console.log(`   ${f.agrupacion}${f.base && f.base !== '?' ? ` · base ${f.base}` : ''}${f.ficha ? ` · ${f.ficha}` : ''}`);
    if (f.notas) console.log(`   ${f.notas}`);
  }
}

if (orden === 'listar') {
  const { filas } = leer();
  listar(filas, opciones(args.slice(1)).estado);
} else if (orden === 'siguiente') {
  const { filas } = leer();
  const f = filas.find((x) => x.estado === 'pendiente');
  if (!f) { console.log('✓ No queda ninguna pendiente.'); process.exit(0); }
  console.log(`Siguiente: ${f.n}. ${f.frase}`);
  console.log(`  Agrupación: ${f.agrupacion}`);
  console.log(`  Base:       ${f.base}`);
  if (f.notas) console.log(`  Notas:      ${f.notas}`);
  console.log(`\n  node scripts/letra-web.mjs <url> --salida .cache/letra-${f.n}.txt`);
} else if (orden === 'estado') {
  const n = Number(args[1]);
  const estado = args[2];
  if (!Number.isInteger(n) || !estado) {
    console.error('Uso: npm run letras -- estado <n> "<estado>" [--ficha <slug>] [--fuente <url>] [--notas "..."]');
    process.exit(1);
  }
  if (!ESTADOS.includes(estado)) {
    console.error(`Estado desconocido: «${estado}». Válidos: ${ESTADOS.join(' · ')}`);
    process.exit(1);
  }
  const { filas, lineas } = leer();
  const f = filas.find((x) => x.n === n);
  if (!f) { console.error(`No hay ninguna entrada con el número ${n}.`); process.exit(1); }
  const o = opciones(args.slice(3));
  f.estado = estado;
  if (o.ficha) f.ficha = String(o.ficha);
  if (o.fuente) f.fuente = String(o.fuente);
  if (o.notas) f.notas = String(o.notas).replace(/\|/g, '/');
  if (o.base) f.base = String(o.base);
  if (o.agrupacion) f.agrupacion = String(o.agrupacion);
  escribir(filas, lineas);
  console.log(`${ICONO[estado]} ${n}. ${f.frase} → ${estado}${f.ficha ? ` (${f.ficha})` : ''}`);
} else if (orden === 'auditar') {
  const { filas } = leer();
  let errores = 0;
  for (const f of filas) {
    for (const p of comprobar(f)) { errores++; console.error(`✗ ${f.n}. ${f.frase}: ${p}`); }
  }
  // Fichas con letraTitulo que no están en la lista: solo informativo.
  const enLista = new Set(filas.map((f) => f.ficha).filter(Boolean));
  const sueltas = readdirSync(CARPETA).filter((x) => x.endsWith('.md')).map((x) => x.slice(0, -3))
    .filter((s) => !enLista.has(s) && readFileSync(join(CARPETA, `${s}.md`), 'utf8').includes('letraTitulo:'));
  if (sueltas.length) {
    console.log(`\nLetras alternativas fuera de la lista (${sueltas.length}):`);
    for (const s of sueltas) console.log(`  ${s}`);
  }
  if (errores) { console.error(`\n✗ ${errores} problema(s).`); process.exit(1); }
  console.log(`✓ ${filas.length} entrada(s) coherentes.`);
} else if (orden === 'anadir') {
  const frase = args[1];
  const o = opciones(args.slice(2));
  if (!frase) { console.error('Uso: npm run letras -- anadir "frase" [--agrupacion "Los X"] [--base slug]'); process.exit(1); }
  const { lineas } = leer();
  const { filas } = leer();
  const n = Math.max(0, ...filas.map((f) => f.n)) + 1;
  const fila = `| ${n} | ${frase} | ${o.agrupacion || '?'} | ${o.base || '?'} | pendiente | | | |`;
  const iCabecera = lineas.findIndex((l) => /^\|\s*#\s*\|/.test(l));
  let iUltima = iCabecera;
  for (let i = iCabecera; i < lineas.length; i++) {
    if (/^\|\s*\d+\s*\|/.test(lineas[i])) iUltima = i;
  }
  lineas.splice(iUltima + 1, 0, fila);
  writeFileSync(ARCHIVO, lineas.join('\n'));
  console.log(`+ ${n}. ${frase}`);
} else {
  console.error('Órdenes: listar · siguiente · estado · auditar · anadir');
  process.exit(1);
}
