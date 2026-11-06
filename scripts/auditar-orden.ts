// scripts/auditar-orden.ts
//
// Comprueba el orden de las cards de /carnaval/[year] y /lista: autores
// destacados → agrupaciones de los autores con más coplas → agrupación →
// tipo de pieza → fecha ↓ → pieza → slug.
//
// Uso:
//   node --experimental-strip-types scripts/auditar-orden.ts
//
// Requiere Node >= 22.6 (igual que scripts/auditar-filtros-lista.ts).

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { normalizeSlug, normalizeText } from '../src/lib/text.ts';
import { contarCoplasAutores } from '../src/lib/autores.ts';
import {
  ordenarAcordesYear,
  prioridadDeAgrupaciones,
  prioridadDeAutores,
  prioridadPorCoplas,
} from '../src/lib/orden.ts';

let fallos = 0;

function comprobar(nombre: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    console.log(`✓ ${nombre}`);
  } else {
    fallos++;
    console.log(`✗ ${nombre}\n  esperado: ${b}\n  real:     ${a}`);
  }
}

/* 1. El comparador, con fichas de mentira. */
type Ficha = {
  slug: string;
  data: {
    pieza: string;
    year: string;
    agrupacion: string;
    agrupacionSlug: string;
    date: string;
    musicaSlugs?: string[];
    letraSlugs?: string[];
  };
};

function ficha(
  slug: string,
  agrupacion: string,
  pieza: string,
  fecha: string,
  musica: string[] = [],
  letra: string[] = [],
): Ficha {
  return {
    slug,
    data: {
      pieza,
      year: '2024',
      agrupacion,
      agrupacionSlug: normalizeSlug(agrupacion),
      date: fecha,
      musicaSlugs: musica,
      letraSlugs: letra,
    },
  };
}

const destacados = ficha('a', 'Los Colgaos', 'Popurrí', '01/01/2024', ['juan-carlos-aragon']);
const prolífico = ficha('b', 'Los Chabolis', 'Pasodoble', '01/01/2024', ['autor-prolifico']);
const menosProlífico = ficha('c', 'La Consentida', 'Pasodoble', '01/01/2024', ['autor-menor']);
const sinAutor = ficha('d', 'Agrupación anónima', 'Pasodoble', '01/01/2024');

const prioridad = prioridadDeAgrupaciones(
  [destacados, prolífico, menosProlífico, sinAutor],
  prioridadDeAutores([
    { data: { autorSlug: 'juan-carlos-aragon', order: 1 } },
    { data: { autorSlug: 'autor-prolifico', order: null } },
    { data: { autorSlug: 'autor-menor', order: null } },
  ]),
);
const coplas = prioridadPorCoplas([destacados, prolífico, menosProlífico, sinAutor], {
  'juan-carlos-aragon': 2,
  'autor-prolifico': 40,
  'autor-menor': 10,
});

const ordenSintético = ordenarAcordesYear(
  [sinAutor, menosProlífico, prolífico, destacados],
  prioridad,
  coplas,
).map((f) => f.slug);

comprobar(
  'destacado → prolífico → menos prolífico → sin autoría',
  ordenSintético,
  ['a', 'b', 'c', 'd'],
);

comprobar(
  'el destacado gana aunque tenga menos coplas',
  ordenarAcordesYear([prolífico, destacados], prioridad, coplas)[0].slug,
  'a',
);

const empateA = ficha('e', 'Zeta', 'Pasodoble', '01/01/2024', ['autor-menor']);
const empateB = ficha('f', 'Alfa', 'Pasodoble', '01/01/2024', ['autor-menor']);
comprobar(
  'mismas coplas → agrupación A-Z',
  ordenarAcordesYear([empateA, empateB], prioridad, coplas).map((f) => f.data.agrupacion),
  ['Alfa', 'Zeta'],
);

const mismaA = ficha('g', 'Los Chabolis', 'Popurrí', '02/01/2024', ['autor-prolifico']);
const mismaB = ficha('h', 'Los Chabolis', 'Cuarteta', '03/01/2024', ['autor-prolifico']);
const mismaC = ficha('i', 'Los Chabolis', 'Cuarteta', '01/01/2024', ['autor-prolifico']);
comprobar(
  'misma agrupación → pieza → fecha ↓',
  ordenarAcordesYear([mismaC, mismaB, mismaA], prioridad, coplas).map((f) => f.slug),
  ['g', 'h', 'i'],
);

const copia = [destacados, prolífico];
ordenarAcordesYear(copia, prioridad, coplas);
comprobar('no muta la entrada', copia.map((f) => f.slug), ['a', 'b']);

/* 2. El cancionero real: el orden es monótono en cada escalón. */
const dir = 'src/content/acordes';
const fichas: Ficha[] = fs
  .readdirSync(dir)
  .filter((fichero) => fichero.endsWith('.md'))
  .map((fichero) => {
    const { data } = matter(fs.readFileSync(path.join(dir, fichero), 'utf8'));
    const split = (valor: unknown) =>
      valor ? String(valor).split(',').map((autor) => autor.trim()).filter(Boolean) : [];
    const musicaList = split(data.musica);
    const letraList = split(data.letra);

    return {
      slug: fichero.replace(/\.md$/, ''),
      data: {
        pieza: String(data.pieza ?? ''),
        year: String(data.year ?? ''),
        agrupacion: String(data.agrupacion ?? ''),
        agrupacionSlug: normalizeSlug(String(data.agrupacion ?? '')),
        date: String(data.date ?? ''),
        musicaSlugs: musicaList.map(normalizeSlug),
        letraSlugs: letraList.map(normalizeSlug),
      },
    };
  });

const autores = fs
  .readdirSync('src/content/autores')
  .filter((fichero) => fichero.endsWith('.md'))
  .map((fichero) => {
    const { data } = matter(fs.readFileSync(path.join('src/content/autores', fichero), 'utf8'));
    return {
      data: {
        autorSlug: normalizeSlug(String(data.nombre ?? '')),
        order: typeof data.order === 'number' ? data.order : null,
      },
    };
  });

const prioridadReal = prioridadDeAgrupaciones(fichas, prioridadDeAutores(autores));
const coplasReal = prioridadPorCoplas(fichas, contarCoplasAutores(fichas));

const valor = (mapa: Map<string, number>, clave: string, vacio: number) => mapa.get(clave) ?? vacio;

function comprobarMonotonia(year: string) {
  const orden = ordenarAcordesYear(
    fichas.filter((f) => f.data.year === year),
    prioridadReal,
    coplasReal,
  );

  let rotos = 0;
  for (let i = 1; i < orden.length; i++) {
    const a = orden[i - 1];
    const b = orden[i];
    const prioridadA = valor(prioridadReal, a.data.agrupacionSlug, Number.POSITIVE_INFINITY);
    const prioridadB = valor(prioridadReal, b.data.agrupacionSlug, Number.POSITIVE_INFINITY);

    if (prioridadA < prioridadB) continue;
    if (prioridadA > prioridadB) {
      rotos++;
      continue;
    }

    const coplasA = valor(coplasReal, a.data.agrupacionSlug, 0);
    const coplasB = valor(coplasReal, b.data.agrupacionSlug, 0);
    if (coplasA > coplasB) continue;
    if (coplasA < coplasB) {
      rotos++;
      continue;
    }

    const agrupacionA = normalizeText(a.data.agrupacion).trim();
    const agrupacionB = normalizeText(b.data.agrupacion).trim();
    if (agrupacionA.localeCompare(agrupacionB, 'es', { sensitivity: 'base' }) > 0) rotos++;
  }

  return { orden, rotos };
}

const years = [...new Set(fichas.map((f) => f.data.year))];
const rotosTotal = years.reduce((total, year) => total + comprobarMonotonia(year).rotos, 0);
comprobar(`todos los años respetan destacados → coplas → agrupación`, rotosTotal, 0);

const orden2024 = comprobarMonotonia('2024').orden;
comprobar(
  '2024 abre con La Oveja negra (Ares, el destacado de menor order del año)',
  orden2024[0].data.agrupacion,
  'La Oveja negra',
);
comprobar(
  'la primera ficha de 2024 es su final de popurrí (orden de pieza)',
  orden2024[0].data.pieza,
  'Final de popurrí',
);

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
