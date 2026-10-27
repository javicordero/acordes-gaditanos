#!/usr/bin/env node
/**
 * Importa las posiciones de los acordes desde el glosario público de LaCuerda.net
 * y genera src/data/glosario-acordes.json.
 *
 * Uso:
 *   node scripts/importar-glosario.mjs [--dry-run] [--force] [--only DO]
 *
 * - Guarda una caché local de las respuestas crudas en .cache/glosario (ignorada por git).
 * - Espera entre peticiones para no castigar al servidor de origen.
 * - No se ejecuta en build ni en CI: el JSON generado es el que se versiona.
 *
 * Atribución: posiciones basadas en el glosario público de https://lacuerda.net/Recursos/acordes/
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'glosario');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');
const BASE_URL = 'https://acordes.lacuerda.net/TRAN/procDiag.php';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i === -1 ? null : (args[i + 1] || '');
})();

const DELAY_MS = 400;
const CONCURRENCY = 2;

/* ------------------------------------------------------------------ */
/* Catálogo de origen                                                  */
/* ------------------------------------------------------------------ */

const RAICES = [
  'DO', 'DO#', 'REb', 'RE', 'RE#', 'MIb', 'MI', 'FA', 'FA#',
  'SOLb', 'SOL', 'SOL#', 'LAb', 'LA', 'LA#', 'SIb', 'SI',
];

// Modos que devuelven posiciones en LaCuerda (probados uno a uno).
const MODOS = [
  'M', 'm', '7', 'm7', 'maj7', 'aug', 'dim', 'dim7', 'sus', 'sus2', 'sus4',
  '5', '6', 'm6', '9', 'm9', 'add9', '11', '13', '6add9', '7sus4', '7maj5',
  'mmaj7', 'maj9',
];

// Inversiones publicadas por LaCuerda + las que usa el cancionero.
const INVERSIONES = [
  'DO/MI', 'DO/FA', 'DO/SOL', 'RE/FA#', 'RE/DO', 'RE/SI', 'RE/SIb', 'RE/LA',
  'MI/SI', 'MI/DO#', 'MI/RE', 'MI/RE#', 'MI/FA', 'MI/FA#', 'MI/SOL', 'MI/SOL#',
  'MIm/SI', 'MIm/DO#', 'MIm/RE', 'MIm/RE#', 'MIm/FA', 'MIm/FA#', 'MIm/SOL',
  'MIm/SOL#', 'FA/DO', 'FA/RE', 'FA/RE#', 'FA/MI', 'FA/SOL', 'FA/LA', 'FAm/DO',
  'SOL/RE', 'SOL/MI', 'SOL/FA', 'SOL/FA#', 'SOL/SI', 'SOLm/RE', 'LA/SOL#',
  'LA/SOL', 'LA/FA#', 'LA/FA', 'LA/MI', 'LA/DO#', 'LAm/SOL#', 'LAm/SOL',
  'LAm/FA#', 'LAm/FA', 'LAm/MI', 'LAm/DO',
  'REm/FA', 'LAm7/SIb', 'FA7/DO',
];

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const ROOT_LABEL = {
  DO: 'Do', 'DO#': 'Do#', REb: 'Reb', RE: 'Re', 'RE#': 'Re#', MIb: 'Mib',
  MI: 'Mi', FA: 'Fa', 'FA#': 'Fa#', SOLb: 'Solb', SOL: 'Sol', 'SOL#': 'Sol#',
  LAb: 'Lab', LA: 'La', 'LA#': 'La#', SIb: 'Sib', SI: 'Si', 'SI#': 'Si#',
};

const MODE_SUFFIX = {
  M: '',
  m: 'm',
  7: '7',
  m7: 'm7',
  maj7: 'maj7',
  aug: 'aug',
  dim: 'dim',
  dim7: 'dim7',
  sus: 'sus',
  sus2: 'sus2',
  sus4: 'sus4',
  5: '5',
  6: '6',
  m6: 'm6',
  9: '9',
  m9: 'm9',
  add9: 'add9',
  11: '11',
  13: '13',
  '6add9': '6add9',
  '7sus4': '7sus4',
  '7maj5': '7maj5',
  mmaj7: 'mmaj7',
  maj9: 'maj9',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugRaiz(raiz) {
  const m = raiz.match(/^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)$/);
  if (!m) return raiz.toLowerCase();
  const accidental = m[2] === '#' ? '-sostenido' : m[2] === 'b' ? '-bemol' : '';
  return m[1].toLowerCase() + accidental;
}

/** Mismo formato de ancla que src/lib/acordes.ts (Mi7 → mi7, Sol#m → sol-sostenido-m). */
function slugAcorde(raiz, sufijo, bajo) {
  const base = slugRaiz(raiz);
  const conAccidente = /[#b]$/.test(raiz);
  const cuerpo = conAccidente && sufijo ? `${base}-${sufijo.toLowerCase()}` : base + sufijo.toLowerCase();
  return bajo ? `${cuerpo}-${slugRaiz(bajo)}` : cuerpo;
}

/** Convierte un nombre de LaCuerda ("DOm7", "RE/FA#") a notación del sitio. */
function nombreSitio(nombre) {
  const [izquierda, bajoNombre] = nombre.split('/');

  const raizMatch = izquierda.match(/^(DO|RE|MI|FA|SOL|LA|SI)([#b]?)/);
  if (!raizMatch) return null;
  const raiz = ROOT_LABEL[raizMatch[1] + raizMatch[2]];
  if (!raiz) return null;

  const resto = izquierda.slice(raizMatch[0].length);
  const sufijo = MODE_SUFFIX[resto === '' ? 'M' : resto];
  if (sufijo === undefined) return null;

  if (bajoNombre) {
    const bajoMatch = bajoNombre.match(/^(DO|RE|MI|FA|SOL|LA|SI)([#b]?)/);
    if (!bajoMatch) return null;
    const bajo = ROOT_LABEL[bajoMatch[1] + bajoMatch[2]];
    if (!bajo) return null;
    return { raiz, sufijo, bajo, etiqueta: raiz + sufijo + '/' + bajo };
  }

  return { raiz, sufijo, bajo: null, etiqueta: raiz + sufijo };
}

/* ------------------------------------------------------------------ */
/* Posiciones                                                          */
/* ------------------------------------------------------------------ */

function decodificarTraste(ch) {
  if (ch === 'X' || ch === 'x' || ch === '-') return -1;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 65 + 10;
  return -1;
}

/**
 * LaCuerda codifica 6 valores en orden 1ª → 6ª cuerda.
 * Nosotros guardamos 6ª → 1ª.
 */
function normalizarPosicion(codigo) {
  if (!codigo || codigo.length !== 6) return null;
  const trastes = codigo.split('').map(decodificarTraste).reverse();
  if (trastes.every((t) => t === -1)) return null;

  const pisados = trastes.filter((t) => t > 0);
  const hayAlAire = trastes.includes(0);
  const min = pisados.length ? Math.min(...pisados) : 0;
  const max = pisados.length ? Math.max(...pisados) : 0;
  const baseTraste = hayAlAire || max <= 5 ? 1 : min;

  // Cejilla: sin cuerdas al aire y la cuerda más grave y la más aguda
  // suenan en el traste mínimo (digitación de cejilla).
  let cejilla = null;
  if (!hayAlAire && pisados.length) {
    const sonoras = trastes.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
    const primera = sonoras[0];
    const ultima = sonoras[sonoras.length - 1];
    if (primera !== ultima && trastes[primera] === min && trastes[ultima] === min) {
      cejilla = { traste: min, desde: primera, hasta: ultima };
    }
  }

  return { trastes, baseTraste, cejilla };
}

/** Formas manuales para acordes que LaCuerda no publica (semidisminuidos, 7b5 y 7b9). */
function posicionesManuales(etiqueta) {
  // Suspendidos con b6 y 9: posturas abiertas de La(susb6/9) y Mi(susb6/9).
  if (etiqueta === 'Lasusb6/9') {
    return [{ trastes: [-1, 0, 3, 4, 3, 0], baseTraste: 1, cejilla: null }];
  }
  if (etiqueta === 'Misusb6/9') {
    return [{ trastes: [0, 3, 4, 2, 0, 0], baseTraste: 1, cejilla: null }];
  }
  if (etiqueta === 'Readd9/Fa#') {
    return [{ trastes: [2, 0, 0, 2, 3, 0], baseTraste: 1, cejilla: null }];
  }
  if (etiqueta === 'Lam(add9)') {
    return [{ trastes: [-1, 0, 2, 4, 1, 0], baseTraste: 1, cejilla: null }];
  }
  if (etiqueta === 'Lam7/Sol') {
    return [{ trastes: [3, 0, 2, 0, 1, 0], baseTraste: 1, cejilla: null }];
  }
  if (etiqueta === 'Fa#m7b5/Do') {
    return [{ trastes: [-1, 3, 4, 2, 0, 0], baseTraste: 1, cejilla: null }];
  }
  // Do m7 con bajo Mib (mismas notas que Mib6, pero con Mib en el bajo).
  if (etiqueta === 'Dom7/Mib') {
    return [{ trastes: [-1, -1, 1, 3, 1, 3], baseTraste: 1, cejilla: null }];
  }
  // Do dim7 (mismas notas que Fa#dim7) con la postura del traste 4.
  if (etiqueta === 'Dodim7/Fa') {
    return [{ trastes: [-1, -1, 4, 5, 4, 5], baseTraste: 1, cejilla: null }];
  }

  const raiz = etiqueta.replace(/(m7b5|7b5|7b9|sus9)$/, '');
  const sufijo = etiqueta.slice(raiz.length);

  // Sus9: fundamental, 4ª, 5ª y 9ª. Forma móvil sobre la 5ª cuerda.
  if (sufijo === 'sus9') {
    const trastesA = {
      Do: 3, 'Do#': 4, Re: 5, 'Re#': 6, Mi: 7, Fa: 8, 'Fa#': 9, Sol: 10,
      'Sol#': 11, La: 0, 'La#': 1, Si: 2, Reb: 4, Mib: 6, Solb: 9, Lab: 11,
      Sib: 1,
    };
    const f = trastesA[raiz];
    if (f === undefined) return null;

    const trastes = [-1, f, f, f + 2, f, f];
    const hayAlAire = trastes.includes(0);
    const pisados = trastes.filter((t) => t > 0);
    const baseTraste = hayAlAire || Math.max(...pisados) <= 5 ? 1 : Math.min(...pisados);

    let cejilla = null;
    if (!hayAlAire && pisados.length) {
      const sonoras = trastes.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
      const primera = sonoras[0];
      const ultima = sonoras[sonoras.length - 1];
      if (primera !== ultima && trastes[primera] === f && trastes[ultima] === f) {
        cejilla = { traste: f, desde: primera, hasta: ultima };
      }
    }

    return [{ trastes, baseTraste, cejilla }];
  }

  // Dominante con novena bemol: forma móvil del Mi7b9 abierto (0 2 3 1 3 0),
  // con cejilla en el traste de la fundamental sobre la 6ª cuerda.
  if (sufijo === '7b9') {
    const trastes6 = {
      Do: 8, 'Do#': 9, Re: 10, 'Re#': 11, Mi: 0, Fa: 1, 'Fa#': 2, Sol: 3,
      'Sol#': 4, La: 5, 'La#': 6, Si: 7, Reb: 9, Mib: 11, Solb: 2, Lab: 4, Sib: 6,
    };
    const f = trastes6[raiz];
    if (f === undefined) return null;
    if (f === 0) {
      return [{ trastes: [0, 2, 3, 1, 3, 0], baseTraste: 1, cejilla: null }];
    }
    const trastes = [f, f + 2, f + 3, f + 1, f + 3, f];
    return [{
      trastes,
      baseTraste: Math.max(...trastes) <= 5 ? 1 : f,
      cejilla: { traste: f, desde: 0, hasta: 5 },
    }];
  }

  if (!['m7b5', '7b5'].includes(sufijo)) return null;

  const trastesA = {
    Do: 3, 'Do#': 4, Re: 5, 'Re#': 6, Mi: 7, Fa: 8, 'Fa#': 9, Sol: 10,
    'Sol#': 11, La: 12, 'La#': 1, Si: 2, Reb: 4, Mib: 6, Solb: 9, Lab: 11,
    Sib: 1,
  };
  const f = trastesA[raiz];
  if (f === undefined) return null;

  const trastes = sufijo === 'm7b5'
    ? [-1, f, f + 1, f, f + 1, -1]
    : [-1, f, f + 1, f, f + 2, -1];

  const pisados = trastes.filter((t) => t > 0);
  const baseTraste = Math.max(...pisados) <= 5 ? 1 : Math.min(...pisados);
  return [{ trastes, baseTraste, cejilla: null }];
}

/* ------------------------------------------------------------------ */
/* Descarga y caché                                                    */
/* ------------------------------------------------------------------ */

async function fetchCrudo(nombre) {
  const cacheFile = path.join(CACHE_DIR, nombre.replace(/[#/]/g, '_') + '.js');
  if (!FORCE && existsSync(cacheFile)) {
    return readFile(cacheFile, 'utf8');
  }
  const desc = nombre.replace('#', '@');
  const url = `${BASE_URL}?desc=${encodeURIComponent(desc)}&guitarOnly=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'acordesgaditanos/1.0 (importacion puntual del glosario; contacto: acordesgaditanos.com)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${nombre}`);
  const texto = await res.text();
  await writeFile(cacheFile, texto, 'utf8');
  await sleep(DELAY_MS);
  return texto;
}

function parsearRespuesta(texto) {
  const m = texto.match(/chordBase\[(.*?)\]\s*=\s*(\[[^\]]*\]);/s);
  if (!m) return [];
  try {
    return JSON.parse(m[2]);
  } catch {
    return [];
  }
}

async function procesar(nombre) {
  const crudo = await fetchCrudo(nombre);
  const codigos = parsearRespuesta(crudo);
  const normalizado = nombreSitio(nombre);
  if (!normalizado) return { nombre, error: 'nombre no reconocido' };

  const vistas = new Set();
  const posiciones = [];
  for (const codigo of codigos) {
    const pos = normalizarPosicion(codigo);
    if (!pos) continue;
    const clave = pos.trastes.join(',');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    posiciones.push(pos);
  }

  return { nombre, etiqueta: normalizado.etiqueta, normalizado, posiciones };
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_FILE), { recursive: true });

  const catalogo = [];
  for (const raiz of RAICES) {
    for (const modo of MODOS) catalogo.push(raiz + (modo === 'M' ? '' : modo));
  }
  catalogo.push(...INVERSIONES);

  const manuales = [];
  for (const raiz of RAICES) {
    const r = ROOT_LABEL[raiz];
    if (!r) continue;
    manuales.push(r + 'm7b5', r + '7b5', r + '7b9', r + 'sus9');
  }
  manuales.push(
    'Lasusb6/9',
    'Misusb6/9',
    'Readd9/Fa#',
    'Lam(add9)',
    'Lam7/Sol',
    'Fa#m7b5/Do',
    'Dom7/Mib',
    'Dodim7/Fa',
  );

  const lista = ONLY ? catalogo.filter((n) => n.includes(ONLY)) : catalogo;
  console.log(`Importando ${lista.length} acordes (+ ${manuales.length} manuales)…`);

  const resultados = [];
  let procesados = 0;
  const cola = [...lista];

  async function worker() {
    while (cola.length) {
      const nombre = cola.shift();
      try {
        resultados.push(await procesar(nombre));
      } catch (err) {
        resultados.push({ nombre, error: err.message });
      }
      procesados += 1;
      if (procesados % 25 === 0) console.log(`  ${procesados}/${lista.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const acordes = {};
  const sinPosiciones = [];
  const fallos = [];

  for (const r of resultados) {
    if (r.error) {
      fallos.push(`${r.nombre}: ${r.error}`);
      continue;
    }
    if (!r.posiciones.length) {
      sinPosiciones.push(r.nombre);
      continue;
    }
    const { etiqueta, normalizado } = r;
    acordes[etiqueta] = {
      raiz: normalizado.raiz,
      sufijo: normalizado.sufijo,
      bajo: normalizado.bajo,
      slug: slugAcorde(normalizado.raiz, normalizado.sufijo, normalizado.bajo),
      posiciones: r.posiciones.slice(0, 6),
    };
  }

  for (const etiqueta of manuales) {
    if (acordes[etiqueta]) continue;
    const posiciones = posicionesManuales(etiqueta);
    if (!posiciones) continue;
    const m = etiqueta.match(/^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)(.*)$/);
    if (!m) continue;
    let resto = m[3];
    let bajo = null;

    // Inversiones: "Lam7/Sol", "Readd9/Fa#".
    const barra = resto.lastIndexOf('/');
    if (barra !== -1) {
      const cola = resto.slice(barra + 1);
      if (/^(Do|Re|Mi|Fa|Sol|La|Si)[#b]?$/.test(cola)) {
        bajo = cola;
        resto = resto.slice(0, barra);
      }
    }

    // Sufijos manuales que no coinciden con el texto tal cual.
    const sufijo = resto === 'm(add9)'
      ? 'madd9'
      : resto === 'susb6/9'
        ? 'susb6add9'
        : resto;

    acordes[etiqueta] = {
      raiz: m[1] + m[2],
      sufijo,
      bajo,
      slug: slugAcorde(m[1] + m[2], sufijo, bajo),
      posiciones,
    };
  }

  // Posturas que sustituyen a las de LaCuerda para un acorde concreto.
  const POSICIONES_OVERRIDE = {
    'Lam/Fa#': [{ trastes: [2, 0, 0, 2, 1, 0], baseTraste: 1, cejilla: null }],
  };

  for (const [etiqueta, posiciones] of Object.entries(POSICIONES_OVERRIDE)) {
    const entrada = acordes[etiqueta];
    if (entrada) entrada.posiciones = posiciones;
  }

  // Posiciones extra para acordes que ya vienen de LaCuerda (se añaden al final).
  const POSICIONES_EXTRA = {
    Lamaj7: [{ trastes: [-1, 0, 2, 2, 2, 4], baseTraste: 1, cejilla: null }],
    'Fa#dim7': [{ trastes: [-1, -1, 4, 5, 4, 5], baseTraste: 1, cejilla: null }],
    'Fa#7b5': [{ trastes: [2, 3, 2, 3, 0, 0], baseTraste: 1, cejilla: null }],
    Fa7b5: [{ trastes: [1, 2, 1, 2, 0, 0], baseTraste: 1, cejilla: null }],
  };

  for (const [etiqueta, extras] of Object.entries(POSICIONES_EXTRA)) {
    const entrada = acordes[etiqueta];
    if (!entrada) continue;
    const existentes = new Set(entrada.posiciones.map((p) => p.trastes.join(',')));
    for (const posicion of extras) {
      const clave = posicion.trastes.join(',');
      if (existentes.has(clave)) continue;
      entrada.posiciones.push(posicion);
      existentes.add(clave);
    }
  }

  // Posiciones que abren el diagrama por defecto (el popover muestra la primera).
  const POSICIONES_PREFERIDAS = {
    Sisus2: [{ trastes: [-1, 2, 4, 4, 2, 2], baseTraste: 1, cejilla: null }],
  };

  for (const [etiqueta, preferidas] of Object.entries(POSICIONES_PREFERIDAS)) {
    const entrada = acordes[etiqueta];
    if (!entrada) continue;
    const existentes = new Set(entrada.posiciones.map((p) => p.trastes.join(',')));
    const nuevas = preferidas.filter((p) => !existentes.has(p.trastes.join(',')));
    entrada.posiciones = [...nuevas, ...entrada.posiciones];
  }

  const ordenado = Object.fromEntries(
    Object.entries(acordes).sort(([a], [b]) => a.localeCompare(b, 'es')),
  );

  const salida = {
    version: 1,
    generado: new Date().toISOString().slice(0, 10),
    fuente: 'LaCuerda.net (glosario público de acordes) - importacion puntual',
    afinacion: ['Mi', 'La', 'Re', 'Sol', 'Si', 'Mi'],
    acordes: ordenado,
  };

  const total = Object.keys(ordenado).length;
  const totalPos = Object.values(ordenado).reduce((n, a) => n + a.posiciones.length, 0);

  console.log(`\nAcordes importados: ${total}`);
  console.log(`Posiciones totales: ${totalPos}`);
  if (sinPosiciones.length) {
    console.log(`Sin posiciones (${sinPosiciones.length}): ${sinPosiciones.join(', ')}`);
  }
  if (fallos.length) {
    console.log(`Fallos (${fallos.length}):`);
    for (const f of fallos) console.log('  - ' + f);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no se escribe el JSON');
    return;
  }

  await writeFile(OUT_FILE, JSON.stringify(salida, null, 2) + '\n', 'utf8');
  console.log(`\nEscrito ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
