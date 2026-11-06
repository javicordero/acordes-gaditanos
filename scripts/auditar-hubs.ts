/**
 * Auditor de los hubs (`/modalidad`, `/pieza`, `/decada`).
 *
 * Comprueba con el cancionero real que:
 *  - los tres ejes reparten todas las fichas que les tocan,
 *  - ningún hub queda vacío y los slugs no se repiten,
 *  - cada hub tiene título, descripción e intro,
 *  - el agrupado por año suma lo mismo que el hub,
 *  - la normalización de modalidad y los slugs de década son estables.
 *
 * Uso: `node --experimental-strip-types scripts/auditar-hubs.ts`
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { normalizeSlug } from '../src/lib/text.ts';
import { tipoPiezaId } from '../src/lib/orden.ts';
import {
  baseDeEje,
  construirHubs,
  nombreDecada,
  normalizarModalidad,
  resumirHub,
  slugDecada,
  type FichaHub,
} from '../src/lib/hubs.ts';

const DIR = 'src/content/acordes';
const errores: string[] = [];

function comprobar(condicion: boolean, mensaje: string) {
  if (!condicion) errores.push(mensaje);
}

const fichas: FichaHub[] = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const { data } = matter(fs.readFileSync(path.join(DIR, file), 'utf8'));
    return {
      slug: file.replace(/\.md$/, ''),
      data: {
        pieza: String(data.pieza ?? ''),
        agrupacion: String(data.agrupacion ?? ''),
        agrupacionSlug: normalizeSlug(data.agrupacion ?? ''),
        year: String(data.year ?? ''),
        date: String(data.date ?? ''),
        letraTitulo: data.letraTitulo,
        modalidad: data.modalidad,
        musicaSlugs: [],
        letraSlugs: [],
      },
    };
  });

const hubs = construirHubs(fichas);

// --- Normalización y slugs -------------------------------------------------
comprobar(normalizarModalidad('Chrigota') === 'chirigota', 'Chrigota debe normalizar a chirigota');
comprobar(normalizarModalidad('Comparsa') === 'comparsa', 'Comparsa debe normalizar a comparsa');
comprobar(normalizarModalidad('') === null, 'La modalidad vacía debe ser null');
comprobar(nombreDecada('90s') === 'los 90s', 'nombreDecada(90s) debe ser «los 90s»');
comprobar(slugDecada('90s') === 'anos-90', 'slugDecada(90s) debe ser «anos-90»');
comprobar(slugDecada('pre60') === 'pre-60', 'slugDecada(pre60) debe ser «pre-60»');
comprobar(baseDeEje('pieza') === '/pieza', 'baseDeEje(pieza) debe ser «/pieza»');
comprobar(baseDeEje('modalidad') === '/modalidad', 'baseDeEje(modalidad) debe ser «/modalidad»');
comprobar(baseDeEje('decada') === '/decada', 'baseDeEje(decada) debe ser «/decada»');

// --- Los tres ejes reparten lo que les toca --------------------------------
for (const [nombre, lista] of Object.entries(hubs)) {
  for (const hub of lista) {
    comprobar(hub.total > 0, `El hub ${nombre}/${hub.slug} está vacío`);
    comprobar(hub.titulo.trim().length > 0, `El hub ${nombre}/${hub.slug} no tiene título`);
    comprobar(hub.descripcion.trim().length > 0, `El hub ${nombre}/${hub.slug} no tiene descripción`);
    comprobar(hub.intro.trim().length > 0, `El hub ${nombre}/${hub.slug} no tiene intro`);
    comprobar(
      hub.porAnio.reduce((total, grupo) => total + grupo.fichas.length, 0) === hub.total,
      `El agrupado por año de ${nombre}/${hub.slug} no suma su total`,
    );
    comprobar(
      hub.anios !== null || hub.total === 0,
      `El hub ${nombre}/${hub.slug} no tiene rango de años`,
    );
  }

  const slugs = new Set(lista.map((hub) => hub.slug));
  comprobar(slugs.size === lista.length, `Hay slugs repetidos en el eje ${nombre}`);
}

const totalPieza = hubs.pieza.reduce((total, hub) => total + hub.total, 0);
const totalDecada = hubs.decada.reduce((total, hub) => total + hub.total, 0);
const totalModalidad = hubs.modalidad.reduce((total, hub) => total + hub.total, 0);
const fichasConModalidad = fichas.filter((ficha) => normalizarModalidad(ficha.data.modalidad));
const fichasSinModalidad = fichas.filter((ficha) => !normalizarModalidad(ficha.data.modalidad));
const fichasSinTipo = fichas.filter((ficha) => tipoPiezaId(ficha.data.pieza) === 'otro');

comprobar(
  totalPieza === fichas.length - fichasSinTipo.length,
  `El eje de pieza cubre ${totalPieza} de ${fichas.length - fichasSinTipo.length} fichas`,
);
comprobar(
  totalDecada === fichas.length,
  `El eje de década cubre ${totalDecada} de ${fichas.length} fichas`,
);
comprobar(
  totalModalidad === fichasConModalidad.length,
  `El eje de modalidad cubre ${totalModalidad} de ${fichasConModalidad.length} fichas con modalidad`,
);
comprobar(fichasSinTipo.length === 0, `Hay ${fichasSinTipo.length} fichas con un tipo de pieza desconocido`);

// --- Enlaces entre hubs ----------------------------------------------------
for (const lista of Object.values(hubs)) {
  for (const hub of lista) {
    const resumen = resumirHub(hub);
    comprobar(!('fichas' in resumen), `resumirHub(${hub.slug}) no debe arrastrar fichas`);
    comprobar(
      `${baseDeEje(hub.eje)}/${hub.slug}`.startsWith('/'),
      `La ruta de ${hub.slug} no empieza por /`,
    );
  }
}

// --- Resumen ---------------------------------------------------------------
console.log(`Fichas: ${fichas.length}`);
console.log(
  `Hubs: ${hubs.modalidad.length} modalidades · ${hubs.pieza.length} tipos de pieza · ${hubs.decada.length} décadas`,
);
console.log(
  `Reparto: modalidad ${totalModalidad} · pieza ${totalPieza} · década ${totalDecada}`,
);
console.log(
  `Sin modalidad: ${fichasSinModalidad.length}${
    fichasSinModalidad.length
      ? ` (${fichasSinModalidad.map((f) => f.data.agrupacion).join(', ')})`
      : ''
  }`,
);
console.log(
  `Modalidades: ${hubs.modalidad.map((hub) => `${hub.nombre} ${hub.total}`).join(' · ')}`,
);
console.log(`Décadas: ${hubs.decada.map((hub) => `${hub.nombre} ${hub.total}`).join(' · ')}`);

if (errores.length) {
  console.error(`\n❌ ${errores.length} error(es):`);
  for (const error of errores) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('\n✅ Hubs OK');
