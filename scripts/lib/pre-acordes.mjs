// Envoltorio de `src/lib/pre-acordes.js` para los scripts de Node: carga el
// glosario del disco y reexporta el resto.
//
// El módulo de verdad vive en `src/lib/pre-acordes.js` para que lo use también
// el panel `/estudio` desde el navegador.

import { readFileSync } from 'node:fs';
import { initPreAcordes } from '../../src/lib/pre-acordes.js';

initPreAcordes(JSON.parse(readFileSync('src/data/glosario-acordes.json', 'utf8')));

export * from '../../src/lib/pre-acordes.js';
