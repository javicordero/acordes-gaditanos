// Audita las letras alternativas de una misma música.
//
// La relación es implícita: misma agrupación, año y tipo base (de momento solo
// pasodobles), con al menos una ficha marcada con `letraTitulo`. Este script
// comprueba que los grupos tengan sentido y que los títulos no se repitan.
//
// Uso: npm run auditar:letras

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const CARPETA = 'src/content/acordes';
const TIPOS = new Set(['pasodoble']);

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tipoBase(pieza) {
  return normalizar((pieza || '').replace(/"[^"]*"/g, ''));
}

const archivos = readdirSync(CARPETA).filter((archivo) => archivo.endsWith('.md'));

const fichas = archivos.map((archivo) => {
  const ruta = join(CARPETA, archivo);
  const { data } = matter(readFileSync(ruta, 'utf8'));
  return { archivo, slug: archivo.replace(/\.md$/, ''), data };
});

const claveDe = (ficha) =>
  `${(ficha.data.agrupacion || '').trim()}||${String(ficha.data.year || '').trim()}||${tipoBase(ficha.data.pieza)}`;

const grupos = new Map();
for (const ficha of fichas) {
  if (!String(ficha.data.letraTitulo || '').trim()) continue;
  const clave = claveDe(ficha);
  if (!grupos.has(clave)) grupos.set(clave, []);
  grupos.get(clave).push(ficha);
}

let errores = 0;
let avisos = 0;

for (const [clave, marcadas] of grupos) {
  const partes = clave.split('||');
  const [agrupacion, year, tipo] = partes;
  const todos = fichas.filter((ficha) => claveDe(ficha) === clave);

  if (!TIPOS.has(tipo)) {
    console.error(
      `✗ ${marcadas.map((m) => m.archivo).join(', ')}: letraTitulo solo está previsto para ${[...TIPOS].join(', ')} (tipo "${tipo}").`,
    );
    errores++;
  }

  const titulos = new Map();
  for (const ficha of todos) {
    const titulo = String(ficha.data.letraTitulo || '').trim();
    if (!titulo) continue;

    if (titulos.has(titulo)) {
      console.error(`✗ "${titulo}" repetido en ${titulos.get(titulo)} y ${ficha.archivo}.`);
      errores++;
    } else {
      titulos.set(titulo, ficha.archivo);
    }

    if (ficha.data.destacada !== undefined && ficha.data.destacada !== null) {
      console.error(`✗ ${ficha.archivo}: una letra alternativa no debe llevar "destacada".`);
      errores++;
    }

    if (ficha.data.recomendada === true) {
      console.error(`✗ ${ficha.archivo}: una letra alternativa no debe llevar "recomendada".`);
      errores++;
    }
  }

  if (todos.length < 2) {
    console.warn(
      `! ${marcadas[0].archivo}: tiene letraTitulo pero no hay otra ficha en el grupo.`,
    );
    avisos++;
  }

  const musicas = new Set(todos.map((ficha) => normalizar(ficha.data.musica || '')));
  if (musicas.size > 1) {
    console.warn(
      `! ${agrupacion} ${year}: las fichas del grupo no comparten música (${[...musicas].join(' | ')}).`,
    );
    avisos++;
  }
}

if (errores) {
  console.error(`\n✗ ${errores} error(es), ${avisos} aviso(s).`);
  process.exit(1);
}

console.log(`✓ ${grupos.size} grupo(s) de letras alternativas, ${avisos} aviso(s).`);
