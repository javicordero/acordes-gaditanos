// Migración del contenido: deja `pieza`, `modalidad`, `agrupación` y los
// autores en su forma canónica.
//
// Reescribe SOLO las líneas de esas claves del frontmatter (respeta comillas,
// orden, saltos de línea y el resto del archivo: no re-serializa con
// gray-matter). El criterio es el mismo que aplica el schema al cargar
// (`src/lib/contenido.ts`) y el que vigila `npm run auditar:contenido`.
//
// Autores: resuelve los alias de `ALIAS_AUTORES` y el punto final, y unifica las
// variantes que solo se diferencian en tildes o mayúsculas (mismo slug, así que
// la URL del autor no cambia) dejando la forma más usada.
//
// Uso:
//   npm run normalizar:contenido                   # escribe
//   npm run normalizar:contenido -- --dry          # solo enseña lo que cambiaría
//   npm run normalizar:contenido -- --dir src/content/borradores

import fs from 'node:fs';
import path from 'node:path';
import {
  etiquetaModalidad,
  normalizarAgrupacion,
  normalizarAutor,
  normalizarPieza,
} from '../src/lib/contenido.ts';
import { normalizeText } from '../src/lib/text.ts';

const argumentos = process.argv.slice(2);
const seco = argumentos.includes('--dry') || argumentos.includes('--simular');
const indiceDir = argumentos.indexOf('--dir');
const DIR = indiceDir === -1 ? 'src/content/acordes' : argumentos[indiceDir + 1];

/** Valor de una línea YAML sin las comillas exteriores. */
function descomillar(valor: string): string {
  const limpio = valor.trim();
  if (limpio.length > 1 && limpio.startsWith('"') && limpio.endsWith('"')) {
    return limpio.slice(1, -1).replace(/\\"/g, '"');
  }
  if (limpio.length > 1 && limpio.startsWith("'") && limpio.endsWith("'")) {
    return limpio.slice(1, -1).replace(/''/g, "'");
  }
  return limpio;
}

/** El valor nuevo con el mismo tipo de comillas que tenía. */
function recomillar(original: string, nuevo: string): string {
  const limpio = original.trim();
  if (limpio.length > 1 && limpio.startsWith('"') && limpio.endsWith('"')) {
    return `"${nuevo.replace(/"/g, '\\"')}"`;
  }
  if (limpio.length > 1 && limpio.startsWith("'") && limpio.endsWith("'")) {
    return `'${nuevo.replace(/'/g, "''")}'`;
  }
  return nuevo;
}

/** Frontmatter del archivo (sin los delimitadores `---`). */
function frontmatter(texto: string): string | null {
  return texto.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? null;
}

/**
 * Autor canónico de cada variante: el nombre más usado y, a igualdad, el que
 * lleva las tildes y no acaba en punto. Solo entra en el mapa lo que comparte
 * slug con el ganador (misma página de autor).
 */
function mapaDeAutores(contenidos: Map<string, string>): Map<string, string> {
  const grupos = new Map<string, Map<string, number>>();

  for (const texto of contenidos.values()) {
    const bloque = frontmatter(texto);
    if (!bloque) continue;

    for (const linea of bloque.split(/\r?\n/)) {
      const campo = linea.match(/^(musica|letra):(\s*)(.*)$/);
      if (!campo) continue;

      const nombres = descomillar(campo[3]).split(',').map(normalizarAutor).filter(Boolean);

      for (const nombre of nombres) {
        const clave = normalizeText(nombre).replace(/[^a-z0-9]/g, '');
        if (!clave) continue;
        if (!grupos.has(clave)) grupos.set(clave, new Map());
        const cuenta = grupos.get(clave)!;
        cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
      }
    }
  }

  const mapa = new Map<string, string>();

  for (const variantes of grupos.values()) {
    if (variantes.size < 2) continue;

    const [ganador] = [...variantes].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const puntos = (nombre: string) =>
        (normalizeText(nombre) !== nombre.toLowerCase() ? 1 : 0) + (nombre.endsWith('.') ? 0 : 1);
      return puntos(b[0]) - puntos(a[0]);
    })[0];

    for (const variante of variantes.keys()) {
      if (variante !== ganador) mapa.set(variante, ganador);
    }
  }

  return mapa;
}

/** Lista de autores en su forma canónica (alias, punto y tildes). */
function unificarAutores(valor: string, mapa: Map<string, string>): string {
  return valor
    .split(',')
    .map((nombre) => {
      const limpio = normalizarAutor(nombre);
      return mapa.get(limpio) ?? limpio;
    })
    .filter(Boolean)
    .join(', ');
}

function normalizarTexto(
  texto: string,
  mapa: Map<string, string>,
): { texto: string; cambios: string[] } {
  const bloque = frontmatter(texto);
  if (!bloque) return { texto, cambios: [] };

  const salto = texto.includes('\r\n') ? '\r\n' : '\n';
  const cambios: string[] = [];

  const nuevoFrontmatter = bloque
    .split(/\r?\n/)
    .map((linea) => {
      const pieza = linea.match(/^pieza:(\s*)(.*)$/);
      if (pieza) {
        const actual = descomillar(pieza[2]);
        const canonica = normalizarPieza(actual);
        if (canonica !== actual) cambios.push(`pieza: ${actual} → ${canonica}`);
        return `pieza:${pieza[1]}${recomillar(pieza[2], canonica)}`;
      }

      const modalidad = linea.match(/^modalidad:(\s*)(.*)$/);
      if (modalidad) {
        const actual = descomillar(modalidad[2]);
        const canonica = etiquetaModalidad(actual);
        if (!canonica) return linea;
        if (canonica !== actual) cambios.push(`modalidad: ${actual} → ${canonica}`);
        return `modalidad:${modalidad[1]}${recomillar(modalidad[2], canonica)}`;
      }

      const agrupacion = linea.match(/^agrupacion:(\s*)(.*)$/);
      if (agrupacion) {
        const actual = descomillar(agrupacion[2]);
        const canonica = normalizarAgrupacion(actual);
        if (canonica !== actual) cambios.push(`agrupacion: ${actual} → ${canonica}`);
        return `agrupacion:${agrupacion[1]}${recomillar(agrupacion[2], canonica)}`;
      }

      const autores = linea.match(/^(musica|letra):(\s*)(.*)$/);
      if (autores) {
        const actual = descomillar(autores[3]);
        const nuevo = unificarAutores(actual, mapa);
        if (nuevo !== actual) cambios.push(`${autores[1]}: ${actual} → ${nuevo}`);
        return `${autores[1]}:${autores[2]}${recomillar(autores[3], nuevo)}`;
      }

      return linea;
    })
    .join(salto);

  if (cambios.length === 0) return { texto, cambios };

  return {
    texto: texto.replace(bloque, nuevoFrontmatter),
    cambios,
  };
}

if (!fs.existsSync(DIR)) {
  console.error(`No existe la carpeta ${DIR}`);
  process.exit(2);
}

const archivos = fs
  .readdirSync(DIR)
  .filter((archivo) => archivo.endsWith('.md'))
  .map((archivo) => ({
    nombre: archivo,
    ruta: path.join(DIR, archivo),
  }));

const contenidos = new Map(archivos.map((archivo) => [archivo.ruta, fs.readFileSync(archivo.ruta, 'utf8')]));
const mapa = mapaDeAutores(contenidos);

if (mapa.size) {
  console.log(`${mapa.size} variante(s) de autor a unificar.`);
  for (const [variante, canonico] of [...mapa].sort()) console.log(`  ${variante} → ${canonico}`);
  console.log('');
}

let fichasTocadas = 0;
let lineasTocadas = 0;

for (const archivo of archivos) {
  const original = contenidos.get(archivo.ruta)!;
  const { texto, cambios } = normalizarTexto(original, mapa);
  if (cambios.length === 0) continue;

  fichasTocadas++;
  lineasTocadas += cambios.length;
  console.log(`${seco ? '·' : '✓'} ${archivo.nombre}`);
  for (const cambio of cambios) console.log(`    ${cambio}`);

  if (!seco) fs.writeFileSync(archivo.ruta, texto);
}

console.log(
  `\n${seco ? 'Cambiarían' : 'Cambiadas'} ${lineasTocadas} línea(s) en ${fichasTocadas} ficha(s) de ${DIR}.`,
);
if (seco && fichasTocadas) console.log('Ejecuta sin --dry para escribir.');
