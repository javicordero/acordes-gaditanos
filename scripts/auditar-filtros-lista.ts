// scripts/auditar-filtros-lista.ts
//
// Comprueba los filtros de /lista: el tipo de pieza con las variantes del
// cancionero, las décadas, las combinaciones de facetas y el ida y vuelta con
// la URL. Con el cancionero completo comprueba además que cada ficha cae en una
// sola opción de pieza, década y año (los recuentos del panel).
//
// Uso:
//   node --experimental-strip-types scripts/auditar-filtros-lista.ts
//
// Requiere Node >= 22.6 (igual que scripts/auditar-glosario.ts).

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { tipoPiezaId } from '../src/lib/orden.ts';
import { normalizeSlug } from '../src/lib/text.ts';
import {
  aFichaFiltrable,
  contarFiltrosActivos,
  decadaDe,
  filtrarFicha,
  opcionesAnio,
  opcionesAutores,
  opcionesDecada,
  opcionesPieza,
  parsearFiltros,
  serializarFiltros,
  type FichaConDatos,
  type FiltrosLista,
} from '../src/lib/filtros-lista.ts';

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

/* 1. Tipo de pieza: las variantes que hay en el cancionero. */
comprobar('Pasodoble', tipoPiezaId('Pasodoble'), 'pasodoble');
comprobar('pasodoble (minúsculas)', tipoPiezaId('pasodoble'), 'pasodoble');
comprobar('Pasodoble Inédito', tipoPiezaId('Pasodoble Inédito'), 'pasodoble');
comprobar('Pasodoble "La caracola"', tipoPiezaId('Pasodoble "La caracola"'), 'pasodoble');
comprobar('Final de popurrí', tipoPiezaId('Final de popurrí'), 'final-de-popurri');
comprobar('Final de popurri', tipoPiezaId('Final de popurri'), 'final-de-popurri');
comprobar('Final de popurí', tipoPiezaId('Final de popurí'), 'final-de-popurri');
comprobar('Final de Popurrí (mayúsculas)', tipoPiezaId('Final de Popurrí'), 'final-de-popurri');
comprobar('Popurrí', tipoPiezaId('Popurrí'), 'popurri');
comprobar('Presentación Original', tipoPiezaId('Presentación Original'), 'presentacion');
comprobar('Cuarteta "Suspiros"', tipoPiezaId('Cuarteta "Suspiros"'), 'cuarteta');
comprobar('Estribillo', tipoPiezaId('Estribillo'), 'estribillo');
comprobar('Tango', tipoPiezaId('Tango'), 'tango');
comprobar('Credo → cuarteta', tipoPiezaId('Credo'), 'cuarteta');
comprobar('Testamento → cuarteta', tipoPiezaId('Testamento'), 'cuarteta');
comprobar('Cuplé desconocido', tipoPiezaId('Cuplé'), 'otro');

/* 2. Décadas. */
comprobar('1905 → antes de los 50', decadaDe(1905), 'pre50');
comprobar('1955 → 50s', decadaDe(1955), '50s');
comprobar('1969 → 60s', decadaDe('1969'), '60s');
comprobar('1975 → 70s', decadaDe(1975), '70s');
comprobar('1999 → 90s', decadaDe(1999), '90s');
comprobar('2000 → 2000s', decadaDe(2000), '2000s');
comprobar('2019 → 2010s', decadaDe(2019), '2010s');
comprobar('2026 → 2020s', decadaDe(2026), '2020s');

/* 3. El filtro: OR dentro de una faceta, AND entre facetas. */
const ficha = {
  slug: 'pasodoble-los-colgaos',
  tipo: 'pasodoble' as const,
  decada: '2020s',
  year: '2024',
  agrupacion: 'los-colgaos',
  musica: ['juan-carlos-aragon'],
  letra: ['el-chapa'],
};

const vacios: FiltrosLista = {
  pieza: [],
  musica: [],
  letra: [],
  anio: [],
  decada: [],
};

comprobar('sin filtros pasa', filtrarFicha(ficha, vacios), true);
comprobar('pieza que coincide', filtrarFicha(ficha, { ...vacios, pieza: ['pasodoble'] }), true);
comprobar('pieza que no coincide', filtrarFicha(ficha, { ...vacios, pieza: ['tango'] }), false);
comprobar(
  'dos piezas (OR dentro de la faceta)',
  filtrarFicha(ficha, { ...vacios, pieza: ['tango', 'pasodoble'] }),
  true,
);
comprobar('década', filtrarFicha(ficha, { ...vacios, decada: ['2020s'] }), true);
comprobar('década distinta', filtrarFicha(ficha, { ...vacios, decada: ['90s'] }), false);
comprobar('década con varias (OR)', filtrarFicha(ficha, { ...vacios, decada: ['90s', '2020s'] }), true);
comprobar('año', filtrarFicha(ficha, { ...vacios, anio: ['2024'] }), true);
comprobar('año distinto', filtrarFicha(ficha, { ...vacios, anio: ['2023'] }), false);
comprobar('varios años (OR)', filtrarFicha(ficha, { ...vacios, anio: ['2023', '2024'] }), true);
comprobar('autor de música', filtrarFicha(ficha, { ...vacios, musica: ['juan-carlos-aragon'] }), true);
comprobar(
  'otro autor de música que no firma',
  filtrarFicha(ficha, { ...vacios, musica: ['tino-tovar'] }),
  false,
);
comprobar(
  'dos autores de música (OR)',
  filtrarFicha(ficha, { ...vacios, musica: ['tino-tovar', 'juan-carlos-aragon'] }),
  true,
);
comprobar('autor de letra', filtrarFicha(ficha, { ...vacios, letra: ['el-chapa'] }), true);
comprobar(
  'AND entre facetas',
  filtrarFicha(ficha, { ...vacios, pieza: ['pasodoble'], decada: ['90s'] }),
  false,
);
comprobar('filtros activos (2 piezas + año)', contarFiltrosActivos({ ...vacios, pieza: ['pasodoble', 'tango'], anio: ['2024'] }), 3);

/* 4. URL: ida y vuelta, y valores desconocidos fuera. */
const filtros: FiltrosLista = {
  pieza: ['pasodoble', 'tango'],
  musica: ['juan-carlos-aragon'],
  letra: ['el-chapa'],
  anio: ['1994'],
  decada: ['90s'],
};
const query = serializarFiltros(filtros).toString();
comprobar('query completa', query, 'pieza=pasodoble%2Ctango&musica=juan-carlos-aragon&letra=el-chapa&anio=1994&decada=90s');
comprobar('ida y vuelta', parsearFiltros(new URLSearchParams(query)), filtros);
comprobar('query vacía', serializarFiltros(vacios).toString(), '');
comprobar('un solo valor también vale', parsearFiltros(new URLSearchParams('pieza=popurri')).pieza, ['popurri']);
comprobar('pieza desconocida se descarta', parsearFiltros(new URLSearchParams('pieza=cuple,popurri')).pieza, ['popurri']);
comprobar('década desconocida se descarta', parsearFiltros(new URLSearchParams('decada=40s,90s')).decada, ['90s']);
comprobar('año inválido se descarta', parsearFiltros(new URLSearchParams('anio=19x4')).anio, []);
comprobar('la agrupación ya no filtra', parsearFiltros(new URLSearchParams('agrupacion=los-colgaos')), vacios);

/* 5. El cancionero completo: cada ficha en una sola opción. */
const dir = 'src/content/acordes';
const fichas: FichaConDatos[] = fs
  .readdirSync(dir)
  .filter((fichero) => fichero.endsWith('.md'))
  .map((fichero) => {
    const { data } = matter(fs.readFileSync(path.join(dir, fichero), 'utf8'));
    const musicaList: string[] = (data.musica ? String(data.musica).split(',') : [])
      .map((autor) => autor.trim())
      .filter(Boolean);
    const letraList: string[] = (data.letra ? String(data.letra).split(',') : [])
      .map((autor) => autor.trim())
      .filter(Boolean);

    return {
      slug: fichero.replace(/\.md$/, ''),
      data: {
        pieza: String(data.pieza ?? ''),
        year: String(data.year ?? ''),
        agrupacion: String(data.agrupacion ?? ''),
        agrupacionSlug: normalizeSlug(String(data.agrupacion ?? '')),
        musicaList,
        musicaSlugs: musicaList.map(normalizeSlug),
        letraList,
        letraSlugs: letraList.map(normalizeSlug),
      },
    };
  });

const filtrables = fichas.map(aFichaFiltrable);

const suma = (opciones: { total: number }[]) => opciones.reduce((total, opcion) => total + opcion.total, 0);
comprobar('total de fichas', filtrables.length, 611);
comprobar('pieza reparte todas las fichas', suma(opcionesPieza(filtrables)), filtrables.length);
comprobar('década reparte todas las fichas', suma(opcionesDecada(filtrables)), filtrables.length);
comprobar('año reparte todas las fichas', suma(opcionesAnio(filtrables)), filtrables.length);
comprobar('ninguna ficha sin tipo de pieza', filtrables.filter((f) => f.tipo === 'otro').length, 0);
comprobar('piezas distintas', opcionesPieza(filtrables).length, 7);
comprobar('décadas distintas', opcionesDecada(filtrables).length, 9);
comprobar('años distintos', opcionesAnio(filtrables).length, 61);
comprobar('autores de música distintos', opcionesAutores(fichas, 'musica').length, 83);
comprobar('autores de letra distintos', opcionesAutores(fichas, 'letra').length, 93);
comprobar(
  'orden de las opciones de pieza',
  opcionesPieza(filtrables).map((opcion) => opcion.id),
  ['presentacion', 'pasodoble', 'tango', 'estribillo', 'cuarteta', 'final-de-popurri', 'popurri'],
);
comprobar(
  'top de piezas',
  opcionesPieza(filtrables).slice(0, 3).map((opcion) => `${opcion.id}=${opcion.total}`),
  ['presentacion=115', 'pasodoble=376', 'tango=3'],
);
comprobar(
  'autores ordenados por número de coplas',
  opcionesAutores(fichas, 'musica')
    .slice(0, 3)
    .map((opcion) => `${opcion.id}=${opcion.total}`),
  ['juan-carlos-aragon=73', 'antonio-martinez-ares=42', 'el-noly=37'],
);
comprobar(
  'un autor con nombre más usado',
  opcionesAutores(fichas, 'musica').find((opcion) => opcion.id === 'juan-carlos-aragon'),
  { id: 'juan-carlos-aragon', nombre: 'Juan Carlos Aragón', total: 73 },
);

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
