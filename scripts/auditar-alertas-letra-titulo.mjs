import assert from 'node:assert/strict';
import { avisosPasodoblesSinTitulo } from '../src/lib/alertas-letra-titulo.js';

const fichas = [
  { slug: 'pasodoble-los-gaditanos-uno', pieza: 'Pasodoble', agrupacion: 'Los Gaditanos', letraTitulo: 'Uno' },
  { slug: 'pasodoble-los-gaditanos-dos', pieza: 'Pasodoble', agrupacion: 'los gaditános', letraTitulo: 'Dos' },
  { slug: 'pasodoble-los-gaditanos-tres', pieza: 'Pasodoble', agrupacion: 'LOS GADITANOS' },
  { slug: 'pasodoble-otra-agrupacion', pieza: 'Pasodoble', agrupacion: 'Otra' },
  { slug: 'presentacion-los-gaditanos', pieza: 'Presentación', agrupacion: 'Los Gaditanos' },
];

assert.deepEqual(
  avisosPasodoblesSinTitulo(fichas, ['pasodoble-los-gaditanos-uno']),
  [{
    agrupacion: 'Los Gaditanos',
    titulo: 'Uno',
    ficha: 'pasodoble-los-gaditanos-uno',
    faltan: [{ slug: 'pasodoble-los-gaditanos-tres', letraTitulo: '' }],
  }],
  'avisa de hermanas sin título aunque cambien mayúsculas o tildes',
);
assert.equal(
  avisosPasodoblesSinTitulo(fichas, ['pasodoble-los-gaditanos-uno', 'pasodoble-los-gaditanos-dos']).length,
  1,
  'el aviso se deduplica por agrupación, no por ficha',
);
assert.deepEqual(
  avisosPasodoblesSinTitulo(fichas.filter((x) => x.slug !== 'pasodoble-los-gaditanos-tres'), ['pasodoble-los-gaditanos-uno']),
  [],
  'no avisa si todas las hermanas tienen título',
);
assert.deepEqual(
  avisosPasodoblesSinTitulo(fichas, ['pasodoble-los-gaditanos-tres']),
  [],
  'no avisa cuando la ficha que se publica no tiene letraTitulo',
);

console.log('✓ Avisos no bloqueantes de letraTitulo correctos.');
