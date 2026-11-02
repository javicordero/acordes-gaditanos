// Comprueba las operaciones de estructura del editor (separar / juntar) con
// casos fijos, incluidos data-postura y anotaciones como (Sorda).
//
//   node --experimental-strip-types scripts/auditar-editor.mjs

import { separarLetra, juntarLetra, palabraBajoCursor } from '../src/lib/editar-lineas.js';
import { envolver } from '../src/lib/pre-acordes.js';

const conocidos = new Set(['Do', 'Sol', 'Re', 'Mi', 'Si7', 'Lam7', '(Sorda)']);
let fallos = 0;

function comprobar(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    console.log(`✓ ${nombre}`);
  } else {
    fallos++;
    console.log(`✗ ${nombre}\n  esperado: ${b}\n  real:     ${a}`);
  }
}

function pre(r) {
  return envolver(r.lineas.join('\n'), r.registros, r.originales).pre;
}

/* 1. La palabra bajo el cursor: inicio y fin. */
comprobar(
  'palabraBajoCursor dentro de «vengo»',
  palabraBajoCursor('Si vengo, no vengo ni yo lo comprendo', 14),
  { ini: 13, fin: 18 },
);
comprobar(
  'palabraBajoCursor en un espacio',
  palabraBajoCursor('Si vengo, no vengo', 9),
  null,
);

/* 2. Separar por el inicio de la palabra. */
const base = {
  lineas: ['Mi                    Si7       Mi', 'Si vengo, no vengo ni yo lo comprendo'],
  registros: [
    [
      { etiqueta: 'Mi', abre: '<a>' },
      { etiqueta: 'Si7', abre: '<a data-postura="x 2 4 4 4 2">' },
      { etiqueta: 'Mi', abre: '<a>' },
    ],
    [],
  ],
  originales: [
    '<a>Mi</a>                    <a data-postura="x 2 4 4 4 2">Si7</a>       <a>Mi</a>',
    'Si vengo, no vengo ni yo lo comprendo',
  ],
  conocidos,
};
const palabra = palabraBajoCursor(base.lineas[1], 14);
const split = separarLetra({ ...base, i: 1, col: palabra.ini });
comprobar('separar: letras', split.lineas, [
  'Mi',
  'Si vengo, no',
  '         Si7       Mi',
  'vengo ni yo lo comprendo',
]);
comprobar('separar: cursor', split.cursor, { linea: 3, col: 0 });
comprobar('separar: conserva data-postura', pre(split), [
  '<a>Mi</a>',
  'Si vengo, no',
  '         <a data-postura="x 2 4 4 4 2">Si7</a>       <a>Mi</a>',
  'vengo ni yo lo comprendo',
].join('\n'));

/* 3. Juntar por el final de la palabra. */
const join = juntarLetra({ ...split, i: 3, col: 5 });
comprobar('juntar: letras', join.lineas, [
  'Mi',
  'Si vengo, no vengo',
  '   Si7       Mi',
  'ni yo lo comprendo',
]);
comprobar('juntar: conserva data-postura', pre(join), [
  '<a>Mi</a>',
  'Si vengo, no vengo',
  '   <a data-postura="x 2 4 4 4 2">Si7</a>       <a>Mi</a>',
  'ni yo lo comprendo',
].join('\n'));

/* 4. Ida y vuelta: separar al inicio de la palabra y juntar en la columna 0. */
const vuelta = juntarLetra({ ...split, i: 3, col: 0 });
comprobar('ida y vuelta: letras', vuelta.lineas, base.lineas);
comprobar('ida y vuelta: pre', pre(vuelta), pre(base));

/* 5. (Sorda) se queda con su etiqueta al separar. */
const sorda = separarLetra({
  lineas: ['(Sorda)        Do', 'Esto es una letra'],
  registros: [[{ etiqueta: '(Sorda)', abre: '<a>' }, { etiqueta: 'Do', abre: '<a>' }], []],
  originales: ['<a>(Sorda)</a>        <a>Do</a>', 'Esto es una letra'],
  conocidos,
  i: 1,
  col: 12,
});
comprobar('(Sorda) se conserva', pre(sorda), [
  '<a>(Sorda)</a>',
  'Esto es una',
  '   <a>Do</a>',
  'letra',
].join('\n'));

/* 6. Sin línea de acordes arriba no se inventa una línea vacía. */
const sinAcordes = separarLetra({
  lineas: ['Esto es una letra larga'],
  registros: [[]],
  originales: ['Esto es una letra larga'],
  conocidos,
  i: 0,
  col: 12,
});
comprobar('separar sin acordes', sinAcordes.lineas, ['Esto es una', 'letra larga']);

if (fallos) {
  console.log(`\n${fallos} caso(s) fallido(s).`);
  process.exitCode = 1;
} else {
  console.log('\nTodo correcto.');
}
