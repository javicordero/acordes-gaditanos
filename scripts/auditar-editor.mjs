// Comprueba las operaciones de estructura del editor (separar / juntar) con
// casos fijos, incluidos data-postura y anotaciones como (Sorda).
//
//   node --experimental-strip-types scripts/auditar-editor.mjs

import { separarLetra, separarVerso, juntarLetra, palabraBajoCursor, moverAcordeLinea, moverAcordeA, realinearEstructura } from '../src/lib/editar-lineas.js';
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

/* 7. Mover un acorde a la línea de acordes siguiente (al final). */
const dosVersos = {
  lineas: [
    'Mi                    Si7       Mi',
    'Si vengo, no vengo ni yo lo comprendo',
    '   Do#7         Fa#m7',
    'Si pienso en faltarte',
  ],
  registros: [
    [
      { etiqueta: 'Mi', abre: '<a>' },
      { etiqueta: 'Si7', abre: '<a data-postura="x 2 4 4 4 2">' },
      { etiqueta: 'Mi', abre: '<a>' },
    ],
    [],
    [{ etiqueta: 'Do#7', abre: '<a>' }, { etiqueta: 'Fa#m7', abre: '<a>' }],
    [],
  ],
  originales: [
    '<a>Mi</a>                    <a data-postura="x 2 4 4 4 2">Si7</a>       <a>Mi</a>',
    'Si vengo, no vengo ni yo lo comprendo',
    '   <a>Do#7</a>         <a>Fa#m7</a>',
    'Si pienso en faltarte',
  ],
  conocidos,
};
const abajo = moverAcordeLinea({ ...dosVersos, i: 0, col: 22, dir: 1 });
comprobar('mover acorde abajo: sale del origen', abajo.lineas[0].includes('Si7'), false);
comprobar('mover acorde abajo: acaba en el destino', abajo.lineas[2].endsWith('Si7'), true);
comprobar('mover acorde abajo: cursor en el destino', abajo.cursor.linea, 2);
comprobar('mover acorde abajo: conserva data-postura', pre(abajo).includes('<a data-postura="x 2 4 4 4 2">Si7</a>'), true);

const arriba = moverAcordeLinea({ ...dosVersos, i: 2, col: 4, dir: -1 });
comprobar('mover acorde arriba: acaba en el destino', arriba.lineas[0].endsWith('Do#7'), true);
comprobar('mover acorde arriba: sale del origen', arriba.lineas[2].includes('Do#7'), false);

comprobar(
  'mover acorde: sin destino',
  moverAcordeLinea({ ...dosVersos, i: 2, col: 4, dir: 1 }).error,
  'No hay otra línea de acordes debajo.',
);
comprobar(
  'mover acorde: cursor en un espacio',
  moverAcordeLinea({ ...dosVersos, i: 0, col: 5, dir: 1 }).error,
  'Pon el cursor sobre un acorde.',
);

/* 8. Línea de acordes vacía (la que está encima de una letra sin acordes). */
const conVacia = {
  lineas: ['Mi        Si7', 'Letra uno', '   ', 'Letra dos'],
  registros: [[{ etiqueta: 'Mi', abre: '<a>' }, { etiqueta: 'Si7', abre: '<a>' }], [], [], []],
  originales: ['<a>Mi</a>        <a>Si7</a>', 'Letra uno', '   ', 'Letra dos'],
  conocidos,
};
const aVacia = moverAcordeLinea({ ...conVacia, i: 0, col: 10, dir: 1 });
comprobar('mover a línea vacía: destino', aVacia.cursor.linea, 2);
comprobar('mover a línea vacía: acorde al principio', aVacia.lineas[2], 'Si7');
comprobar('mover a línea vacía: sale del origen', aVacia.lineas[0].includes('Si7'), false);

/* 9. Un blanco separador (seguido de otra línea de acordes) no es destino. */
const conSeparador = {
  lineas: ['Mi        Si7', 'Letra uno', '', 'Re        Mi', 'Letra dos'],
  registros: [[{ etiqueta: 'Mi', abre: '<a>' }, { etiqueta: 'Si7', abre: '<a>' }], [], [], [{ etiqueta: 'Re', abre: '<a>' }, { etiqueta: 'Mi', abre: '<a>' }], []],
  originales: ['<a>Mi</a>        <a>Si7</a>', 'Letra uno', '', '<a>Re</a>        <a>Mi</a>', 'Letra dos'],
  conocidos,
};
const conBlanco = moverAcordeLinea({ ...conSeparador, i: 0, col: 10, dir: 1 });
comprobar('blanco separador: salta a la línea de acordes', conBlanco.cursor.linea, 3);
comprobar('blanco separador: acorde al final', conBlanco.lineas[3].endsWith('Si7'), true);

/* 10. Una línea de acordes «sucia» también vale como destino. */
const conSucia = {
  lineas: ['Mi        Si7', 'Letra uno', '   Re   Mi raro', 'Letra dos'],
  registros: [[{ etiqueta: 'Mi', abre: '<a>' }, { etiqueta: 'Si7', abre: '<a>' }], [], [{ etiqueta: 'Re', abre: '<a>' }, { etiqueta: 'Mi', abre: '<a>' }], []],
  originales: ['<a>Mi</a>        <a>Si7</a>', 'Letra uno', '   <a>Re</a>   <a>Mi</a> raro', 'Letra dos'],
  conocidos,
};
const aSucia = moverAcordeLinea({ ...conSucia, i: 0, col: 10, dir: 1 });
comprobar('línea sucia: destino', aSucia.cursor.linea, 2);
comprobar('línea sucia: acorde al final', aSucia.lineas[2].endsWith('Si7'), true);

/* 11. Arrastrar un acorde dentro de la misma línea. */
const arrastreBase = {
  lineas: ['Mi        Si7       Mi', 'Si vengo, no vengo ni yo lo comprendo'],
  registros: [
    [
      { etiqueta: 'Mi', abre: '<a>' },
      { etiqueta: 'Si7', abre: '<a data-postura="x 2 4 4 4 2">' },
      { etiqueta: 'Mi', abre: '<a>' },
    ],
    [],
  ],
  originales: [
    '<a>Mi</a>        <a data-postura="x 2 4 4 4 2">Si7</a>       <a>Mi</a>',
    'Si vengo, no vengo ni yo lo comprendo',
  ],
  conocidos,
};
const mismo = moverAcordeA({ ...arrastreBase, i: 0, col: 10, destino: { linea: 0, col: 0 } });
comprobar('arrastre: mueve Si7 al principio', mismo.lineas[0].startsWith('Si7'), true);
comprobar('arrastre: conserva data-postura', pre(mismo).includes('<a data-postura="x 2 4 4 4 2">Si7</a>'), true);
comprobar('arrastre: cursor en el acorde', mismo.cursor, { linea: 0, col: 0 });

/* 12. Arrastrar a otra línea de acordes. */
const otraLinea = moverAcordeA({ ...dosVersos, i: 0, col: 22, destino: { linea: 2, col: 0 } });
comprobar('arrastre abajo: sale del origen', otraLinea.lineas[0].includes('Si7'), false);
comprobar('arrastre abajo: entra al principio', otraLinea.lineas[2].startsWith('Si7'), true);
comprobar('arrastre abajo: conserva data-postura', pre(otraLinea).includes('<a data-postura="x 2 4 4 4 2">Si7</a>'), true);

/* 13. No se puede soltar en una línea de letra. */
comprobar(
  'arrastre a letra: error',
  moverAcordeA({ ...dosVersos, i: 0, col: 22, destino: { linea: 1, col: 0 } }).error,
  'Los acordes solo se pueden soltar en una línea de acordes.',
);

/* 14. Soltar sobre el mismo acorde no hace nada. */
comprobar(
  'arrastre al mismo sitio: noop',
  moverAcordeA({ ...dosVersos, i: 0, col: 22, destino: { linea: 0, col: 22 } }).noop,
  true,
);

/* 15. Línea de acordes vacía (la que está encima de una letra sin acordes). */
const arrastreVacia = moverAcordeA({ ...conVacia, i: 0, col: 10, destino: { linea: 2, col: 0 } });
comprobar('arrastre a línea vacía: acorde al principio', arrastreVacia.lineas[2], 'Si7');
comprobar('arrastre a línea vacía: sale del origen', arrastreVacia.lineas[0].includes('Si7'), false);

/* 16. Los acordes sin etiqueta del destino se envuelven al guardar. */
const sinEtiqueta = {
  lineas: ['Mi        Si7', 'Letra', 'Re'],
  registros: [
    [{ etiqueta: 'Mi', abre: '<a>' }, { etiqueta: 'Si7', abre: '<a data-postura="x 2 4 4 4 2">' }],
    [],
    [],
  ],
  originales: ['<a>Mi</a>        <a data-postura="x 2 4 4 4 2">Si7</a>', 'Letra', 'Re'],
  conocidos,
};
const aSinEtiqueta = moverAcordeA({ ...sinEtiqueta, i: 0, col: 10, destino: { linea: 2, col: 0 } });
comprobar(
  'arrastre: envuelve los acordes del destino',
  pre(aSinEtiqueta),
  ['<a>Mi</a>', 'Letra', '<a data-postura="x 2 4 4 4 2">Si7</a> <a>Re</a>'].join('\n'),
);

/* 17. Con dos acordes iguales, la postura sigue al acorde movido. */
const gemelos = {
  lineas: ['Mi        Mi       Si7', 'Letra'],
  registros: [
    [
      { etiqueta: 'Mi', abre: '<a data-postura="x 0 2 2 2 0">' },
      { etiqueta: 'Mi', abre: '<a data-postura="x 0 2 2 0 0">' },
      { etiqueta: 'Si7', abre: '<a>' },
    ],
    [],
  ],
  originales: [
    '<a data-postura="x 0 2 2 2 0">Mi</a>        <a data-postura="x 0 2 2 0 0">Mi</a>       <a>Si7</a>',
    'Letra',
  ],
  conocidos,
};
const gemelosMov = moverAcordeA({ ...gemelos, i: 0, col: 10, destino: { linea: 0, col: 0 } });
comprobar(
  'arrastre: la postura sigue al acorde movido',
  pre(gemelosMov).startsWith('<a data-postura="x 0 2 2 0 0">Mi</a>'),
  true,
);

/* 18. ✂ al principio de un verso lo separa del bloque de arriba. */
const pegados = {
  lineas: [
    'Mi   Lam7',
    'Dando equilibrio con tu porte y elegancia',
    'En salesianos en el complejo en el portillo',
  ],
  registros: [
    [
      { etiqueta: 'Mi', abre: '<a>' },
      { etiqueta: 'Lam7', abre: '<a data-postura="x 0 2 2 0 0">' },
    ],
    [],
    [],
  ],
  originales: [
    '<a>Mi</a>   <a data-postura="x 0 2 2 0 0">Lam7</a>',
    'Dando equilibrio con tu porte y elegancia',
    'En salesianos en el complejo en el portillo',
  ],
  conocidos,
};
const verso = separarVerso({ ...pegados, i: 2 });
comprobar('separar verso: aparece la línea vacía', verso.lineas, [
  'Mi   Lam7',
  'Dando equilibrio con tu porte y elegancia',
  '',
  'En salesianos en el complejo en el portillo',
]);
comprobar('separar verso: cursor al principio de la letra', verso.cursor, { linea: 3, col: 0 });
comprobar('separar verso: conserva la postura de arriba', pre(verso), [
  '<a>Mi</a>   <a data-postura="x 0 2 2 0 0">Lam7</a>',
  'Dando equilibrio con tu porte y elegancia',
  '',
  'En salesianos en el complejo en el portillo',
].join('\n'));
comprobar(
  'separar verso: ya tiene acordes encima',
  separarVerso({ ...pegados, i: 1 }).error,
  'Este verso ya tiene su línea de acordes encima.',
);
comprobar(
  'separar verso: ya está separado',
  separarVerso({ ...conVacia, i: 3 }).error,
  'Este verso ya está separado del de arriba.',
);

/* 19. Enter a mano: las capas se reajustan y no se pierde la postura de arriba. */
const lineasRoto = [
  'Mi   Lam7',
  'Dando equilibrio con tu porte',
  'y elegancia',
  'En salesianos en el complejo en el portillo',
];
const re = realinearEstructura({
  lineas: lineasRoto,
  registros: pegados.registros,
  originales: pegados.originales,
  conocidos,
});
comprobar('realinear: las tres capas cuadran', [re.registros.length, re.originales.length], [4, 4]);
comprobar('realinear: la línea de arriba conserva la postura', pre({ lineas: lineasRoto, registros: re.registros, originales: re.originales }), [
  '<a>Mi</a>   <a data-postura="x 0 2 2 0 0">Lam7</a>',
  'Dando equilibrio con tu porte',
  'y elegancia',
  'En salesianos en el complejo en el portillo',
].join('\n'));
comprobar('realinear: sin pérdidas (lo partido es letra)', re.perdidas, 0);

const juntadas = realinearEstructura({
  lineas: ['Mi   Lam7', 'Dando equilibrio con tu porte y elegancia En salesianos en el complejo en el portillo'],
  registros: pegados.registros,
  originales: pegados.originales,
  conocidos,
});
comprobar('realinear: juntar dos líneas cuadra', [juntadas.registros.length, juntadas.originales.length], [2, 2]);

const nuevaAcordes = realinearEstructura({
  lineas: ['Mi   Lam7', 'Re   Mi', 'Dando equilibrio con tu porte y elegancia'],
  registros: pegados.registros,
  originales: pegados.originales,
  conocidos,
});
comprobar('realinear: avisa de la línea de acordes nueva', nuevaAcordes.perdidas, 1);

/* 20. ⤴ en un verso separado lo junta con el de arriba y no deja el blanco suelto. */
const junto = juntarLetra({
  lineas: verso.lineas,
  registros: verso.registros,
  originales: verso.originales,
  conocidos,
  i: 3,
  col: 0,
});
comprobar('juntar verso separado: letras', junto.lineas, [
  'Mi   Lam7',
  'Dando equilibrio con tu porte y elegancia En salesianos en el complejo en el portillo',
]);
comprobar('juntar verso separado: conserva la postura de arriba', pre(junto), [
  '<a>Mi</a>   <a data-postura="x 0 2 2 0 0">Lam7</a>',
  'Dando equilibrio con tu porte y elegancia En salesianos en el complejo en el portillo',
].join('\n'));

if (fallos) {
  console.log(`\n${fallos} caso(s) fallido(s).`);
  process.exitCode = 1;
} else {
  console.log('\nTodo correcto.');
}
