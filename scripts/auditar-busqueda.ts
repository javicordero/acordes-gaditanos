// scripts/auditar-busqueda.ts
//
// Comprueba el ranking del buscador con consultas reales, incluidas erratas y
// palabras en distinto orden. Falla si alguna consulta deja de devolver lo que
// se espera, para detectar regresiones al tocar los pesos.
//
// Uso:
//   node --experimental-strip-types scripts/auditar-busqueda.ts
//
// Requiere Node >= 22.6 (igual que scripts/auditar-glosario.ts).

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { buscar, preparar } from '../src/lib/busqueda.ts';
import type { EntradaIndice } from '../src/lib/busqueda.ts';

const dir = 'src/content/acordes';

const entradas: EntradaIndice[] = fs
  .readdirSync(dir)
  .filter((fichero) => fichero.endsWith('.md'))
  .map((fichero) => {
    const { data } = matter(fs.readFileSync(path.join(dir, fichero), 'utf8'));

    return {
      slug: fichero.replace(/\.md$/, ''),
      agrupacion: data.agrupacion || '',
      pieza: data.pieza || '',
      year: String(data.year || ''),
      musica: data.musica || '',
      letra: data.letra || '',
      letraTitulo: data.letraTitulo || '',
    };
  });

const indice = preparar(entradas);

interface Caso {
  consulta: string;
  /** Se comprueba contra el primer resultado. */
  espera: (primero: EntradaIndice, total: number) => boolean;
  descripcion: string;
}

const casos: Caso[] = [
  {
    consulta: 'guenagente',
    descripcion: 'acierta la agrupación completa',
    espera: (primero) => primero.slug === 'pasodoble-guenagente',
  },
  {
    consulta: 'guena',
    descripcion: 'basta un prefijo',
    espera: (primero) => primero.slug === 'pasodoble-guenagente',
  },
  {
    consulta: 'gnagente',
    descripcion: 'tolera una errata',
    espera: (primero) => primero.slug === 'pasodoble-guenagente',
  },
  {
    consulta: 'prada guenagente',
    descripcion: 'palabras en distinto orden',
    espera: (primero) => primero.slug === 'pasodoble-guenagente',
  },
  {
    consulta: 'guenagente prada',
    descripcion: 'palabras en orden natural',
    espera: (primero) => primero.slug === 'pasodoble-guenagente',
  },
  {
    consulta: 'equilibrista',
    descripcion: 'singular encuentra el plural',
    espera: (primero) => primero.slug.includes('equilibristas'),
  },
  {
    consulta: 'equilibrsitas',
    descripcion: 'tolera letras cambiadas de sitio',
    espera: (primero) => primero.slug.includes('equilibristas'),
  },
  {
    consulta: '1994',
    descripcion: 'busca por año exacto',
    espera: (primero, total) => total > 0 && primero.year === '1994',
  },
  {
    consulta: 'pasodoble 1994',
    descripcion: 'combina tipo y año',
    espera: (primero, total) =>
      total > 0 && primero.year === '1994' && /pasodoble/i.test(primero.pieza),
  },
  {
    consulta: 'cuarteta campana',
    descripcion: 'el nombre de la cuarteta va dentro de pieza',
    espera: (primero) => /campana/i.test(primero.pieza),
  },
  {
    consulta: 'prada',
    descripcion: 'busca por autor de música',
    espera: (primero) => /prada/i.test(`${primero.musica} ${primero.letra}`),
  },
  {
    consulta: 'popurri',
    descripcion: 'encuentra el tipo aunque la grafía varíe',
    espera: (primero, total) => total > 0 && /popurr/i.test(primero.pieza),
  },
];

// La ficha de «La mujer nube» es local hasta que se publique el pasodoble. Si
// no está, la prueba se omite para que la auditoría pase en un clon limpio.
if (entradas.some((entrada) => entrada.slug === 'pasodoble-los-colgaos-la-mujer-nube')) {
  casos.push({
    consulta: 'la mujer nube',
    descripcion: 'encuentra la letra alternativa por su título',
    espera: (primero) => primero.slug === 'pasodoble-los-colgaos-la-mujer-nube',
  });
}

let fallos = 0;

for (const caso of casos) {
  const { resultados, total, sugerencia } = buscar(indice, caso.consulta, 3);
  const primero = resultados[0];

  const ok = Boolean(primero) && caso.espera(primero, total);
  if (!ok) fallos++;

  const etiqueta = ok ? '✓' : '✗';
  const muestra = resultados
    .map((r) => `${r.agrupacion} (${r.year})`)
    .join(' | ');

  console.log(`${etiqueta} "${caso.consulta}" → ${total} resultado(s): ${muestra || '(ninguno)'}`);
  if (!ok) {
    console.log(`   esperaba: ${caso.descripcion}`);
    if (sugerencia) console.log(`   sugerencia: ${sugerencia}`);
  }
}

console.log('');

if (fallos > 0) {
  console.error(`✗ ${fallos} de ${casos.length} consultas no devuelven lo esperado.`);
  process.exit(1);
}

console.log(`✓ ${casos.length} consultas correctas.`);
