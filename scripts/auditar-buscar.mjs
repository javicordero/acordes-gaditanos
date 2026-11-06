// scripts/auditar-buscar.mjs
//
// `/buscar` ya no trae las 586 cards renderizadas: pide `/indice-tarjetas.json`
// y las pinta en el navegador a partir de una card de verdad que va dentro de un
// `<template>` (el prototipo que clona el script). Esto vigila que no se vuelva
// a colar el listado completo y que el catálogo y el prototipo estén completos.
//
// Uso:
//   npm run build
//   node scripts/auditar-buscar.mjs [--dir dist]
//
// Falla si:
//   · el HTML de /buscar pasa de 250 KB o lleva más de una card;
//   · falta el `<template>` del prototipo o algún `data-campo` que rellena el script;
//   · el catálogo no tiene una entrada por ficha, le falta un campo, un `href` de
//     autor no acaba en barra o una ficha no está en el build.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const dirIndex = args.indexOf('--dir');
const dir = dirIndex === -1 ? 'dist' : args[dirIndex + 1];

const MAX_HTML = 250 * 1024;
// Campos que no pueden venir vacíos en cada entrada del catálogo.
const CAMPOS_OBLIGATORIOS = ['slug', 'year', 'img', 'agrupacion', 'pieza', 'piezaDisplay', 'piezaTipo', 'nombreCompleto'];
// Campos que tienen que existir, aunque puedan estar vacíos (hay fichas sin
// autoría de letra).
const CAMPOS_OPCIONALES = ['musica', 'letra', 'autores'];
const TIPOS_PIEZA = new Set(['presentacion', 'pasodoble', 'tango', 'estribillo', 'default']);

let errores = 0;
let comprobaciones = 0;

function comprobar(nombre, condicion, detalle = '') {
  comprobaciones++;
  if (condicion) return;
  console.error(`✗ ${nombre}${detalle ? `: ${detalle}` : ''}`);
  errores++;
}

// ---------------------------------------------------------------------------
// 1. El HTML de /buscar
// ---------------------------------------------------------------------------

const rutaHtml = path.join(dir, 'buscar', 'index.html');
comprobar('existe el HTML de /buscar (¿has hecho el build?)', fs.existsSync(rutaHtml), rutaHtml);

let html = '';
if (fs.existsSync(rutaHtml)) {
  html = fs.readFileSync(rutaHtml, 'utf8');

  comprobar(
    'el HTML de /buscar no pasa de 250 KB',
    html.length <= MAX_HTML,
    `${(html.length / 1024).toFixed(0)} KB (antes eran ~3.850 KB)`,
  );

  const cards = (html.match(/class="card"/g) || []).length;
  comprobar('solo se renderiza la card del prototipo', cards === 1, `${cards} cards en el HTML`);

  const indicePlantilla = html.indexOf('<template id="plantilla-resultados"');
  comprobar('está el <template> del prototipo', indicePlantilla !== -1);
  comprobar(
    'el prototipo va dentro del <template>',
    indicePlantilla !== -1 && html.indexOf('class="card"', indicePlantilla) !== -1,
  );

  comprobar('no vuelve el listado serializado (acordesData)', !html.includes('acordesData'));

  for (const campo of ['ancla', 'imagen', 'pieza', 'year', 'titulo', 'autores']) {
    comprobar(
      `el prototipo trae data-campo="${campo}"`,
      html.includes(`data-campo="${campo}"`),
      'qv Card.astro',
    );
  }
}

// ---------------------------------------------------------------------------
// 2. El catálogo /indice-tarjetas.json
// ---------------------------------------------------------------------------

const rutaJson = path.join(dir, 'indice-tarjetas.json');
comprobar('existe /indice-tarjetas.json', fs.existsSync(rutaJson), rutaJson);

if (fs.existsSync(rutaJson)) {
  const crudo = fs.readFileSync(rutaJson);
  let catalogo = null;

  try {
    catalogo = JSON.parse(crudo.toString('utf8'));
  } catch (error) {
    comprobar('el catálogo es JSON válido', false, String(error));
  }

  if (Array.isArray(catalogo)) {
    const fichas = fs
      .readdirSync(path.join('src', 'content', 'acordes'), { recursive: true })
      .filter((nombre) => String(nombre).endsWith('.md'));

    comprobar(
      'hay una entrada por ficha',
      catalogo.length === fichas.length,
      `${catalogo.length} entradas para ${fichas.length} .md`,
    );

    comprobar(
      'el catálogo va de año más nuevo a más viejo',
      catalogo.every(
        (entrada, i) => i === 0 || Number(catalogo[i - 1].year) >= Number(entrada.year),
      ),
    );

    const slugs = new Set();
    for (const entrada of catalogo) {
      const etiqueta = entrada?.slug || '(sin slug)';

      for (const campo of CAMPOS_OBLIGATORIOS) {
        comprobar(`${etiqueta}: tiene ${campo}`, entrada[campo] !== undefined && entrada[campo] !== '');
      }

      for (const campo of CAMPOS_OPCIONALES) {
        comprobar(`${etiqueta}: tiene ${campo}`, entrada[campo] !== undefined);
      }

      comprobar(`${etiqueta}: slug repetido`, !slugs.has(entrada.slug));
      slugs.add(entrada.slug);

      comprobar(`${etiqueta}: año numérico`, /^\d{4}$/.test(String(entrada.year)));
      comprobar(`${etiqueta}: tipo de pieza conocido`, TIPOS_PIEZA.has(entrada.piezaTipo));
      comprobar(`${etiqueta}: tiene autores`, Array.isArray(entrada.autores));

      for (const autor of entrada.autores || []) {
        comprobar(`${etiqueta}: autor con nombre`, Boolean(autor?.nombre));
        comprobar(
          `${etiqueta}: ${autor?.nombre} lleva a su página con barra final`,
          autor?.href === null || (String(autor?.href).startsWith('/autor/') && String(autor?.href).endsWith('/')),
          String(autor?.href),
        );
      }

      comprobar(
        `${etiqueta}: su ficha está en el build`,
        fs.existsSync(path.join(dir, 'acordes', String(entrada.slug), 'index.html')),
      );
    }
  }

  console.log(
    `Catálogo: ${(crudo.length / 1024).toFixed(0)} KB crudos, ${(
      zlib.gzipSync(crudo, { level: 9 }).length / 1024
    ).toFixed(0)} KB gzip`,
  );
}

if (html) console.log(`HTML de /buscar: ${(html.length / 1024).toFixed(0)} KB`);
console.log(`Comprobaciones: ${comprobaciones}`);

if (errores > 0) {
  console.error(`\n✗ ${errores} problema(s) en /buscar.`);
  process.exit(1);
}

console.log('\n✓ /buscar pide los datos y pinta las cards en el navegador.');
