// Comprueba el reparto de la selección de «Por publicar» (subir en lote) con
// casos fijos: qué filas se pueden publicar, cuáles se fusionan y cómo se
// trocea en tandas de 20 (el máximo de `/admin/api/publicar-local`).
//
//   node scripts/auditar-panel-lote.mjs

import { puedeSubir, accionDe, dividirLote, enTandas, avisa } from '../src/lib/panel-lote.js';

let fallos = 0;

function comprobar(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    console.log(`✔ ${nombre}`);
  } else {
    fallos++;
    console.log(`✘ ${nombre}\n  esperado: ${b}\n  real:     ${a}`);
  }
}

// Filas tal como las pinta `filaPorPublicar`.
const nueva = { slug: 'pasodoble-nueva', estado: 'nueva' };
const modificada = { slug: 'pasodoble-modificada', estado: 'modificada' };
const borrada = { slug: 'pasodoble-borrada', estado: 'borrada' };
const sinPush = { slug: 'pasodoble-sin-push', estado: 'sin-push', cambio: 'nueva' };
const conPR = { slug: 'pasodoble-en-pr', estado: 'sin-push', cambio: 'modificada', enPR: 12, rama: 'estudio/x' };
const publicada = { slug: 'pasodoble-publicada' };
const borrador = { slug: 'pasodoble-borrador', zona: 'borradores', local: true };
const importada = { slug: 'pasodoble-otraweb', zona: 'otraweb' };

/* 1. Qué entra en el lote. */
comprobar('nueva se puede subir', puedeSubir(nueva, true), true);
comprobar('modificada se puede subir', puedeSubir(modificada, true), true);
comprobar('borrada se puede subir', puedeSubir(borrada, true), true);
comprobar('sin push se puede subir', puedeSubir(sinPush, true), true);
comprobar('en PR se puede publicar', puedeSubir(conPR, true), true);
comprobar('en PR también en producción', puedeSubir(conPR, false), true);
comprobar('publicada sin cambios no entra', puedeSubir(publicada, true), false);
comprobar('borrador de borradores no entra', puedeSubir(borrador, true), false);
comprobar('otraweb no entra', puedeSubir(importada, true), false);
comprobar('sin item no entra', puedeSubir(null, true), false);
comprobar('sin PR en producción no entra', puedeSubir(modificada, false), false);

/* 2. Cómo se publica cada una. */
comprobar('nueva → subir', accionDe(nueva), 'subir');
comprobar('en PR → fusionar', accionDe(conPR), 'fusionar');

/* 3. Aviso: solo las nuevas. */
comprobar('nueva avisa', avisa(nueva), true);
comprobar('sin push nueva avisa', avisa(sinPush), true);
comprobar('sin push modificada no avisa', avisa({ estado: 'sin-push', cambio: 'modificada' }), false);
comprobar('modificada no avisa', avisa(modificada), false);
comprobar('borrada no avisa', avisa(borrada), false);

/* 4. Reparto de un lote mixto. */
const lote = dividirLote([nueva, conPR, modificada, publicada, borrador], true);
comprobar('lote: se suben las locales', lote.subir.map((x) => x.slug), ['pasodoble-nueva', 'pasodoble-modificada']);
comprobar('lote: se fusiona la PR', lote.fusionar.map((x) => x.slug), ['pasodoble-en-pr']);
comprobar('lote: se omiten las que no tocan', lote.omitidos.map((x) => x.slug), ['pasodoble-publicada', 'pasodoble-borrador']);

const soloPublicadas = dividirLote([publicada, borrador], true);
comprobar('lote sin nada publicable', [soloPublicadas.subir.length, soloPublicadas.fusionar.length], [0, 0]);

/* 5. Tandas de 20 (límite de publicar-local). */
const veinte = Array.from({ length: 20 }, (_, i) => ({ slug: 'x' + i }));
const cuarenta = [...veinte, ...veinte.map((x) => ({ slug: x.slug + 'b' }))];
comprobar('20 caben en una tanda', enTandas(veinte).length, 1);
comprobar('40 van en dos tandas', enTandas(cuarenta).length, 2);
comprobar('la primera tanda lleva 20', enTandas(cuarenta)[0].length, 20);
comprobar('la segunda lleva 20', enTandas(cuarenta)[1].length, 20);
comprobar('45 → 20 + 20 + 5', enTandas([...cuarenta, ...cuarenta.slice(0, 5)]).map((t) => t.length), [20, 20, 5]);
comprobar('vacío no genera tandas', enTandas([]).length, 0);

if (fallos) {
  console.log(`\n${fallos} caso(s) fallido(s).`);
  process.exit(1);
}
console.log('\nTodo OK.');
