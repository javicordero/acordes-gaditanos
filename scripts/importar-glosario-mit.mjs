#!/usr/bin/env node
/**
 * Amplía src/data/glosario-acordes.json con posiciones de datasets con licencia
 * MIT, sin regenerar el archivo ni perder el trabajo manual.
 *
 * Uso:
 *   node scripts/importar-glosario-mit.mjs --plan [--fase A|B|C]
 *   node scripts/importar-glosario-mit.mjs --aplicar [--fase A|B|C]
 *
 * Fases (acumulativas):
 *   A  Solo completa posiciones de acordes que ya existen. Cero URLs nuevas.
 *   B  A + huecos de familias básicas: sus2, sus4 y madd9.
 *   C  B + primer lote de familias nuevas: 7#9, 9b5, m11, maj11 y maj13.
 *
 * Invariantes:
 *   - El JSON versionado es la fuente de verdad: nunca se regenera.
 *   - Solo se añaden posiciones al final; jamás se borra, reordena ni antepone.
 *   - Un acorde nuevo solo se crea si su nombre no existe.
 *   - `--aplicar` hace copia de seguridad en .cache/glosario-mit/ antes de escribir.
 *
 * Fuente: https://github.com/tombatossals/chords-db (MIT).
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data', 'glosario-acordes.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'glosario-mit');
const CACHE_FILE = path.join(CACHE_DIR, 'guitar.json');
const URL_DB = 'https://raw.githubusercontent.com/tombatossals/chords-db/master/lib/guitar.json';

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const REFRESCAR = args.includes('--refrescar');
const DETALLE = args.includes('--detalle');

const REVISAR = (() => {
  const arg = args.find((a) => a === '--revisar' || a.startsWith('--revisar='));
  if (arg === undefined) return null;
  if (arg.includes('=')) return arg.split('=')[1].split(',').filter(Boolean);
  return ['Do', 'La', 'Mi', 'Re', 'Sol', 'Fa', 'Do#m', 'Lam', 'Mi7', 'Do9'];
})();

const FASE = (() => {
  const i = args.findIndex((a) => a === '--fase' || a.startsWith('--fase='));
  if (i === -1) return 'A';
  const bruto = args[i].includes('=') ? args[i].split('=')[1] : args[i + 1] || '';
  const fase = bruto.toUpperCase();
  if (!['A', 'B', 'C'].includes(fase)) {
    console.error(`Fase no válida: "${bruto}". Usa A, B o C.`);
    process.exit(1);
  }
  return fase;
})();

/* ------------------------------------------------------------------ */
/* Nomenclatura                                                        */
/* ------------------------------------------------------------------ */

const NOTAS = {
  C: 'Do',
  'C#': 'Do#',
  Csharp: 'Do#',
  D: 'Re',
  Eb: 'Mib',
  E: 'Mi',
  F: 'Fa',
  'F#': 'Fa#',
  Fsharp: 'Fa#',
  G: 'Sol',
  Ab: 'Lab',
  A: 'La',
  Bb: 'Sib',
  B: 'Si',
};

/** Sufijos de chords-db que se escriben de otra forma en el glosario. */
const SUFIJOS = {
  major: '',
  minor: 'm',
  69: '6add9',
  m69: 'm6add9',
  aug7: '7maj5',
  aug9: '9#5',
};

/** Familias que pueden crear acordes nuevos en cada fase. */
const FAMILIAS_B = new Set(['sus2', 'sus4', 'madd9']);
const FAMILIAS_C = new Set(['7#9', '9b5', 'm11', 'maj11', 'maj13']);

const FAMILIAS_PERMITIDAS =
  FASE === 'A'
    ? new Set()
    : FASE === 'B'
      ? FAMILIAS_B
      : new Set([...FAMILIAS_B, ...FAMILIAS_C]);

const CLASE_ALTURA = {
  Do: 0,
  'Do#': 1,
  Reb: 1,
  Re: 2,
  'Re#': 3,
  Mib: 3,
  Mi: 4,
  Fa: 5,
  'Fa#': 6,
  Solb: 6,
  Sol: 7,
  'Sol#': 8,
  Lab: 8,
  La: 9,
  'La#': 10,
  Sib: 10,
  Si: 11,
};

function slugRaiz(raiz) {
  const m = raiz.match(/^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)$/);
  if (!m) return raiz.toLowerCase();
  const accidental = m[2] === '#' ? '-sostenido' : m[2] === 'b' ? '-bemol' : '';
  return m[1].toLowerCase() + accidental;
}

/** Sufijo en la URL: un `#` en 7#9 rompería el enlace, se escribe como las raíces. */
function slugSufijo(sufijo) {
  return sufijo
    .toLowerCase()
    .replace(/#/g, '-sostenido-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
}

/** Mismo formato de ancla que src/lib/acordes.ts. */
function slugAcorde(raiz, sufijo, bajo) {
  const base = slugRaiz(raiz);
  const conAccidente = /[#b]$/.test(raiz);
  const cuerpo = conAccidente && sufijo ? `${base}-${slugSufijo(sufijo)}` : base + slugSufijo(sufijo);
  return bajo ? `${cuerpo}-${slugRaiz(bajo)}` : cuerpo;
}

/** Etiqueta visible de un acorde nuevo. */
function etiquetaNueva(raiz, sufijo, bajo) {
  if (bajo) return `${raiz}${sufijo}/${bajo}`;
  // El glosario ya escribe los menores con add9 así: Lam(add9).
  if (sufijo === 'madd9') return `${raiz}m(add9)`;
  return `${raiz}${sufijo}`;
}

/** Convierte la entrada de chords-db en raíz, sufijo y bajo del glosario. */
function normalizarAcorde(tonalidad, sufijoDb) {
  const raiz = NOTAS[tonalidad] ?? tonalidad;
  let sufijo = sufijoDb;
  let bajo = null;

  const barra = sufijo.match(/^(.*)\/([A-G](?:#|b)?)$/);
  if (barra) {
    sufijo = barra[1];
    bajo = NOTAS[barra[2]] ?? barra[2];
  }

  sufijo = SUFIJOS[sufijo] ?? sufijo;
  return { raiz, sufijo, bajo };
}

/* ------------------------------------------------------------------ */
/* Posiciones                                                          */
/* ------------------------------------------------------------------ */

const CUERDAS_AL_AIRE = [40, 45, 50, 55, 59, 64]; // Mi2 a Mi4 en MIDI

/**
 * Notas exigidas y permitidas de cada tipo, en semitonos desde la fundamental.
 * Permite descartar posiciones que chords-db etiqueta mal: por ejemplo, un Do9
 * sin séptima (que en realidad es Do add9) o un Sibm7 que suena Am7.
 */
const CALIDAD = {
  '': { esenciales: [0, 4], permitidas: [0, 4, 7] },
  m: { esenciales: [0, 3], permitidas: [0, 3, 7] },
  '5': { esenciales: [0, 7], permitidas: [0, 7] },
  '6': { esenciales: [0, 4, 9], permitidas: [0, 4, 7, 9] },
  m6: { esenciales: [0, 3, 9], permitidas: [0, 3, 7, 9] },
  '7': { esenciales: [0, 4, 10], permitidas: [0, 4, 7, 10] },
  m7: { esenciales: [0, 3, 10], permitidas: [0, 3, 7, 10] },
  maj7: { esenciales: [0, 4, 11], permitidas: [0, 4, 7, 11] },
  maj9: { esenciales: [0, 4, 11, 2], permitidas: [0, 4, 7, 11, 2] },
  '9': { esenciales: [0, 4, 10, 2], permitidas: [0, 4, 7, 10, 2] },
  m9: { esenciales: [0, 3, 10, 2], permitidas: [0, 3, 7, 10, 2] },
  add9: { esenciales: [0, 4, 2], permitidas: [0, 4, 7, 2] },
  madd9: { esenciales: [0, 3, 2], permitidas: [0, 3, 7, 2] },
  '11': { esenciales: [0, 10, 5], permitidas: [0, 4, 7, 10, 2, 5] },
  '13': { esenciales: [0, 4, 10, 9], permitidas: [0, 4, 7, 10, 2, 5, 9] },
  sus: { esenciales: [0, 5], permitidas: [0, 5, 7] },
  sus2: { esenciales: [0, 2], permitidas: [0, 2, 7] },
  sus4: { esenciales: [0, 5], permitidas: [0, 5, 7] },
  sus9: { esenciales: [0, 2], permitidas: [0, 2, 7] },
  susb6add9: { esenciales: [0, 5, 8, 2], permitidas: [0, 5, 7, 8, 2] },
  '7sus4': { esenciales: [0, 5, 10], permitidas: [0, 5, 7, 10] },
  dim: { esenciales: [0, 3, 6], permitidas: [0, 3, 6] },
  dim7: { esenciales: [0, 3, 6, 9], permitidas: [0, 3, 6, 9] },
  aug: { esenciales: [0, 4, 8], permitidas: [0, 4, 8] },
  mmaj7: { esenciales: [0, 3, 11], permitidas: [0, 3, 7, 11] },
  '6add9': { esenciales: [0, 4, 9, 2], permitidas: [0, 4, 7, 9, 2] },
  '7b5': { esenciales: [0, 4, 6, 10], permitidas: [0, 4, 6, 10] },
  '7maj5': { esenciales: [0, 4, 8, 10], permitidas: [0, 4, 8, 10] },
  m7b5: { esenciales: [0, 3, 6, 10], permitidas: [0, 3, 6, 10] },
  '7b9': { esenciales: [0, 4, 10, 1], permitidas: [0, 4, 7, 10, 1] },
  '7#9': { esenciales: [0, 4, 10, 3], permitidas: [0, 4, 7, 10, 3] },
  '9b5': { esenciales: [0, 4, 6, 10, 2], permitidas: [0, 4, 6, 10, 2] },
  m11: { esenciales: [0, 3, 10, 5], permitidas: [0, 3, 7, 10, 2, 5] },
  maj11: { esenciales: [0, 11, 5], permitidas: [0, 4, 7, 11, 2, 5] },
  maj13: { esenciales: [0, 4, 11, 9], permitidas: [0, 4, 7, 11, 2, 5, 9] },
};

function pitchClasses(trastes) {
  const clases = new Set();
  trastes.forEach((traste, i) => {
    if (traste >= 0) clases.add((CUERDAS_AL_AIRE[i] + traste) % 12);
  });
  return clases;
}

/** Comprueba que la posición contiene las notas del acorde y ninguna ajena. */
function calidadValida(clases, raiz, sufijo, bajo) {
  const regla = CALIDAD[sufijo];
  const pcRaiz = CLASE_ALTURA[raiz];
  if (!regla || pcRaiz === undefined) return true;

  const relativas = new Set(
    [...clases].map((pc) => (((pc - pcRaiz) % 12) + 12) % 12),
  );

  if (regla.esenciales.some((semitono) => !relativas.has(semitono))) return false;

  // En una inversión el bajo puede no ser una nota del acorde (Do/Fa, Mi/Re).
  const permitidas = new Set(regla.permitidas);
  const pcBajo = bajo === null ? undefined : CLASE_ALTURA[bajo];
  if (pcBajo !== undefined) permitidas.add((((pcBajo - pcRaiz) % 12) + 12) % 12);

  return [...relativas].every((semitono) => permitidas.has(semitono));
}

/**
 * Convierte una posición de chords-db al formato del glosario.
 * Devuelve `null` si la posición no es utilizable.
 */
function convertirPosicion(posicion, raiz) {
  const frets = posicion.frets;
  if (!Array.isArray(frets) || frets.length !== 6) return null;

  const base = posicion.baseFret || 1;
  const trastes = frets.map((f) => (f <= 0 ? f : base + f - 1));

  if (trastes.some((t) => t < -1 || t > 15)) return null;
  if (trastes.filter((t) => t >= 0).length < 2) return null;

  const pisados = trastes.filter((t) => t > 0);
  const min = Math.min(...pisados);
  const max = Math.max(...pisados);
  if (max - min > 5) return null;

  // La fundamental debe sonar en alguna cuerda.
  const claseRaiz = CLASE_ALTURA[raiz];
  if (claseRaiz !== undefined && !pitchClasses(trastes).has(claseRaiz)) {
    return null;
  }

  const hayAlAire = trastes.includes(0);
  const baseTraste = hayAlAire || max <= 5 ? 1 : min;

  // Cejilla: trastes de `barres` que pisan varias cuerdas contiguas.
  let cejilla = null;
  for (const barre of posicion.barres ?? []) {
    const absoluto = base + barre - 1;
    const cuerdas = [];
    trastes.forEach((t, i) => {
      if (t === absoluto) cuerdas.push(i);
    });
    if (cuerdas.length < 2) continue;
    const desde = cuerdas[0];
    const hasta = cuerdas[cuerdas.length - 1];
    if (hasta - desde + 1 === cuerdas.length) {
      cejilla = { traste: absoluto, desde, hasta };
      break;
    }
  }

  // Si chords-db no marca la cejilla, se deduce como en el importador histórico.
  if (!cejilla && !hayAlAire && pisados.length) {
    const sonoras = trastes.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
    const primera = sonoras[0];
    const ultima = sonoras[sonoras.length - 1];
    if (primera !== ultima && trastes[primera] === min && trastes[ultima] === min) {
      cejilla = { traste: min, desde: primera, hasta: ultima };
    }
  }

  return { trastes, baseTraste, cejilla };
}

/* ------------------------------------------------------------------ */
/* Datos                                                               */
/* ------------------------------------------------------------------ */

async function cargarDataset() {
  await mkdir(CACHE_DIR, { recursive: true });

  if (!REFRESCAR && existsSync(CACHE_FILE)) {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  }

  console.log(`Descargando ${URL_DB}…`);
  const respuesta = await fetch(URL_DB);
  if (!respuesta.ok) throw new Error(`No se pudo descargar chords-db: ${respuesta.status}`);
  const texto = await respuesta.text();
  await writeFile(CACHE_FILE, texto, 'utf8');
  return JSON.parse(texto);
}

const clave = (raiz, sufijo, bajo) => `${raiz}|${sufijo}|${bajo ?? ''}`;

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const datos = JSON.parse(await readFile(DATA, 'utf8'));
  const glosario = datos.acordes;
  const original = structuredClone(glosario);
  const posicionesOriginales = Object.values(original).reduce(
    (n, a) => n + a.posiciones.length,
    0,
  );

  const porClave = new Map();
  for (const [etiqueta, entrada] of Object.entries(glosario)) {
    porClave.set(clave(entrada.raiz, entrada.sufijo, entrada.bajo), { etiqueta, entrada });
  }

  const db = await cargarDataset();

  const descartes = new Map();
  const detallesDescarte = [];
  const agregadas = new Map(); // etiqueta -> posiciones añadidas
  const nuevas = new Map(); // clave -> { etiqueta, entrada }
  const nuevasEtiquetas = new Set();
  let posicionesNuevas = 0;

  const descartar = (motivo) => descartes.set(motivo, (descartes.get(motivo) ?? 0) + 1);

  for (const [tonalidad, acordes] of Object.entries(db.chords)) {
    for (const acordeDb of acordes) {
      const { raiz, sufijo, bajo } = normalizarAcorde(tonalidad, acordeDb.suffix);
      const id = clave(raiz, sufijo, bajo);
      const existente = porClave.get(id);

      const puedeCrearse =
        !existente && bajo === null && FAMILIAS_PERMITIDAS.has(sufijo);
      if (!existente && !puedeCrearse) continue;

      let entrada;
      let etiqueta;
      if (existente) {
        entrada = existente.entrada;
        etiqueta = existente.etiqueta;
      } else {
        const guardada = nuevas.get(id);
        if (guardada) {
          entrada = guardada.entrada;
          etiqueta = guardada.etiqueta;
        } else {
          etiqueta = etiquetaNueva(raiz, sufijo, bajo);
          if (glosario[etiqueta] || nuevasEtiquetas.has(etiqueta)) {
            descartar('el nombre ya existe con otra grafía');
            continue;
          }
          entrada = {
            raiz,
            sufijo,
            bajo,
            slug: slugAcorde(raiz, sufijo, bajo),
            posiciones: [],
          };
          nuevas.set(id, { etiqueta, entrada });
          nuevasEtiquetas.add(etiqueta);
        }
      }

      const vistas = new Set(entrada.posiciones.map((p) => p.trastes.join(',')));
      for (const posicionDb of acordeDb.positions ?? []) {
        const posicion = convertirPosicion(posicionDb, raiz);
        if (!posicion) {
          descartar('posición inválida o sin la fundamental');
          if (DETALLE) {
            detallesDescarte.push(
              `${etiqueta} · trastes [${posicionDb.frets.join(', ')}] base ${posicionDb.baseFret}`,
            );
          }
          continue;
        }
        if (!calidadValida(pitchClasses(posicion.trastes), raiz, sufijo, bajo)) {
          descartar('no contiene las notas del acorde');
          if (DETALLE) {
            detallesDescarte.push(
              `${etiqueta} · trastes [${posicionDb.frets.join(', ')}] base ${posicionDb.baseFret}`,
            );
          }
          continue;
        }
        const firma = posicion.trastes.join(',');
        if (vistas.has(firma)) {
          descartar('duplicada');
          continue;
        }
        vistas.add(firma);
        entrada.posiciones.push(posicion);
        posicionesNuevas += 1;

        const lista = agregadas.get(etiqueta) ?? [];
        lista.push(posicion);
        agregadas.set(etiqueta, lista);
      }
    }
  }

  // Acordes nuevos, al final y en orden alfabético entre ellos.
  for (const [, destino] of [...nuevas.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    if (!destino.entrada.posiciones.length) continue;
    glosario[destino.etiqueta] = destino.entrada;
  }

  const totalAcordes = Object.keys(glosario).length;
  const totalPosiciones = Object.values(glosario).reduce(
    (n, a) => n + a.posiciones.length,
    0,
  );

  const detalleGanan = [];
  for (const [etiqueta, antes] of Object.entries(original)) {
    const ganadas = glosario[etiqueta].posiciones.length - antes.posiciones.length;
    if (ganadas > 0) detalleGanan.push([etiqueta, antes.posiciones.length, ganadas]);
  }

  console.log(`Fase ${FASE} · ${APLICAR ? 'aplicar' : 'plan'}`);
  console.log(`Acordes: ${Object.keys(original).length} → ${totalAcordes}`);
  console.log(`Posiciones: ${posicionesOriginales} → ${totalPosiciones}`);
  console.log(`Posiciones nuevas: ${posicionesNuevas}`);
  console.log(`Acordes existentes que ganan posiciones: ${detalleGanan.length}`);
  console.log(`Acordes nuevos: ${nuevasEtiquetas.size}`);

  if (nuevas.size) {
    const familias = new Map();
    for (const [, destino] of nuevas) {
      const familia = familias.get(destino.entrada.sufijo) ?? { acordes: 0, posiciones: 0 };
      familia.acordes += 1;
      familia.posiciones += destino.entrada.posiciones.length;
      familias.set(destino.entrada.sufijo, familia);
    }
    console.log('\nAcordes nuevos por familia:');
    for (const [sufijo, datosFamilia] of [...familias.entries()].sort(
      (a, b) => b[1].acordes - a[1].acordes,
    )) {
      console.log(
        `  ${sufijo}: ${datosFamilia.acordes} acordes, ${datosFamilia.posiciones} posiciones`,
      );
    }
  }

  if (detalleGanan.length) {
    console.log('\nAcordes que más ganan:');
    for (const [etiqueta, tenia, gana] of detalleGanan
      .sort((a, b) => b[2] - a[2])
      .slice(0, 15)) {
      console.log(`  ${etiqueta}: ${tenia} → ${tenia + gana}`);
    }
  }

  if (nuevasEtiquetas.size) {
    const muestra = [...nuevasEtiquetas].sort((a, b) => a.localeCompare(b, 'es'));
    console.log(`\nAcordes nuevos: ${muestra.join(', ')}`);
  }

  if (descartes.size) {
    console.log('\nPosiciones descartadas:');
    for (const [motivo, cantidad] of [...descartes.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${motivo}: ${cantidad}`);
    }
    if (DETALLE && detallesDescarte.length) {
      console.log('\nDetalle de las descartadas:');
      for (const linea of detallesDescarte) console.log(`  ${linea}`);
    }
  }

  if (REVISAR) {
    console.log('\nRevisión de posiciones nuevas:');
    for (const nombre of REVISAR) {
      const entrada = glosario[nombre];
      if (!entrada) {
        console.log(`  ${nombre}: no existe en el glosario`);
        continue;
      }
      const antes = original[nombre]?.posiciones.length ?? 0;
      const lista = agregadas.get(nombre) ?? [];
      console.log(`  ${nombre}: ${antes} → ${entrada.posiciones.length}`);
      for (const posicion of lista) {
        const texto = posicion.trastes.map((t) => (t < 0 ? 'x' : t)).join(' ');
        console.log(`      ${texto}   (base ${posicion.baseTraste})`);
      }
    }
  }

  // Ninguna posición existente puede desaparecer ni cambiar de orden.
  for (const [etiqueta, entrada] of Object.entries(original)) {
    const actual = glosario[etiqueta];
    if (!actual || actual.posiciones.length < entrada.posiciones.length) {
      throw new Error(`Se perderían posiciones en ${etiqueta}`);
    }
    for (let i = 0; i < entrada.posiciones.length; i += 1) {
      if (JSON.stringify(entrada.posiciones[i]) !== JSON.stringify(actual.posiciones[i])) {
        throw new Error(`Cambiaría el orden de las posiciones en ${etiqueta}`);
      }
    }
  }

  if (!posicionesNuevas) {
    console.log('\nNada que añadir. No se escribe el JSON.');
    return;
  }

  if (!APLICAR) {
    console.log('\n--plan: no se escribe el JSON. Usa --aplicar para guardar.');
    return;
  }

  const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const copia = path.join(CACHE_DIR, `glosario-acordes-${sello}.json`);
  await copyFile(DATA, copia);
  console.log(`\nCopia de seguridad: ${path.relative(ROOT, copia)}`);

  datos.acordes = glosario;
  datos.fuente = 'LaCuerda.net (histórico) + chords-db MIT (ampliación)';
  datos.actualizado = new Date().toISOString().slice(0, 10);

  await writeFile(DATA, JSON.stringify(datos, null, 2) + '\n', 'utf8');
  console.log(`Escrito ${path.relative(ROOT, DATA)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
