// scripts/auditar-enlaces.mjs
//
// Comprueba que ningún enlace interno del build apunte a una URL que Netlify
// redirige: las páginas se sirven con barra final (/acordes/x/) y sin ella
// Netlify responde 301. Un enlace interno sin barra cuesta una ida y vuelta
// extra en cada clic, así que el build debe salir con todo normalizado (lo
// hace la integración `enlaces-con-barra`).
//
// Uso:
//   npm run build
//   node scripts/auditar-enlaces.mjs [--dir dist]
//
// Además informa de enlaces internos que no existen en el build (sin fallar,
// porque la colección local acordes2 enlaza a páginas que no se publican).

import fs from 'node:fs';
import {
  ficherosHtml,
  normalizarHrefs,
  rutasDeDirectorio,
} from '../src/integrations/enlaces-con-barra.mjs';

const args = process.argv.slice(2);
const dirIndex = args.indexOf('--dir');
const dir = dirIndex === -1 ? 'dist' : args[dirIndex + 1];

const rutas = rutasDeDirectorio(dir);
const ficheros = ficherosHtml(dir);

let conBarra = 0;
let sinBarra = 0;
const muertos = new Set();

for (const fichero of ficheros) {
  const original = fs.readFileSync(fichero, 'utf8');

  for (const [, valor] of original.matchAll(/href="(\/[^"]*)"/g)) {
    if (valor.startsWith('//')) continue;

    const corte = valor.search(/[#?]/);
    const ruta = corte === -1 ? valor : valor.slice(0, corte);

    if (ruta === '/' || ruta.startsWith('/api/')) continue;
    if (ruta.startsWith('/_astro/')) continue;
    if (/\.[a-z0-9]{1,5}$/i.test(ruta.slice(ruta.lastIndexOf('/') + 1))) continue;

    const clave = ruta.replace(/\/$/, '').slice(1);

    if (!rutas.has(clave)) {
      muertos.add(ruta);
    } else if (ruta.endsWith('/')) {
      conBarra++;
    } else {
      sinBarra++;
    }
  }
}

console.log(`HTML analizados: ${ficheros.length}`);
console.log(`Enlaces internos con barra final: ${conBarra}`);
console.log(`Enlaces internos sin barra final: ${sinBarra}`);

if (muertos.size > 0) {
  console.log(`\nAviso: ${muertos.size} enlaces internos apuntan a páginas que no existen en el build.`);
  console.log('(Normalmente son de acordes2, que no se publica.) Muestra:');
  console.log([...muertos].slice(0, 5).map((u) => '  ' + u).join('\n'));
}

if (sinBarra > 0) {
  console.error('\n✗ Hay enlaces internos sin barra final: cada clic pagará un 301.');
  console.error('  Revisa que la integración enlaces-con-barra siga en astro.config.mjs.');
  process.exit(1);
}

console.log('\n✓ Todos los enlaces internos apuntan a la URL que responde 200.');
