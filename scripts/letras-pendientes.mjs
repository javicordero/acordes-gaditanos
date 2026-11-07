// Gestiona `letras-pendientes.md`: la cola de coplas cuya letra hay que buscar
// y a las que después se les copian los acordes de otra ficha de la misma
// música.
//
// Uso:
//   node scripts/letras-pendientes.mjs                     (la cola)
//   node scripts/letras-pendientes.mjs siguiente          (el primero pendiente)
//   node scripts/letras-pendientes.mjs estado 5 encontrada --fuente <url>
//   node scripts/letras-pendientes.mjs estado 5 "con acordes" --ficha <slug>
//   node scripts/letras-pendientes.mjs auditar            (estados contra fichas)
//   node scripts/letras-pendientes.mjs anadir "frase" --agrupacion "Los X"
//   node scripts/letras-pendientes.mjs reconocer "nueva letra comparsa el cementerio"
//
// El archivo es la fuente de verdad y se edita solo en la tabla: la cabecera, la
// explicación y el historial se conservan tal cual.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const ARCHIVO = 'letras-pendientes.md';
const CARPETA = 'src/content/acordes';
// Las fichas creadas pero todavía sin publicar viven en borradores.
const CARPETA_BORRADORES = 'src/content/borradores';
const rutaFicha = (slug) => [CARPETA, CARPETA_BORRADORES]
  .map((c) => join(c, `${slug}.md`))
  .find((r) => existsSync(r)) || null;
const ESTADOS = ['pendiente', 'encontrada', 'con acordes', 'no encontrada', 'duplicada'];
const ICONO = {
  pendiente: '·', encontrada: '🔎', 'con acordes': '✓', 'no encontrada': '✗', duplicada: '=' ,
};

const args = process.argv.slice(2);
const orden = args[0] || 'listar';

function leer() {
  const texto = readFileSync(ARCHIVO, 'utf8');
  const lineas = texto.split('\n');
  const filas = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!/^\|\s*\d+\s*\|/.test(l)) continue;
    const celdas = l.split('|').slice(1, -1).map((c) => c.trim());
    filas.push({
      i: filas.length,
      linea: i,
      n: Number(celdas[0]),
      frase: celdas[1],
      agrupacion: celdas[2],
      base: celdas[3],
      estado: celdas[4],
      ficha: celdas[5] || '',
      fuente: celdas[6] || '',
      notas: celdas[7] || '',
    });
  }
  return { texto, lineas, filas };
}

function escribir(filas, lineas) {
  for (const f of filas) {
    lineas[f.linea] = `| ${f.n} | ${f.frase} | ${f.agrupacion} | ${f.base} | ${f.estado} | ${f.ficha} | ${f.fuente} | ${f.notas} |`;
  }
  writeFileSync(ARCHIVO, lineas.join('\n'));
}

function opciones(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) o[k] = true;
    else { o[k] = sig; i++; }
  }
  return o;
}

/** ¿Existe la ficha y es una letra alternativa de su base? */
function comprobar(f) {
  const problemas = [];
  if (!f.base || f.base === '?' || f.base.includes('?')) problemas.push('sin ficha base');
  else if (!rutaFicha(f.base)) problemas.push(`no existe la base ${f.base}`);
  if (f.estado === 'con acordes') {
    if (!f.ficha) problemas.push('estado «con acordes» sin ficha');
    else {
      const ruta = rutaFicha(f.ficha);
      if (!ruta) problemas.push(`no existe ${f.ficha}.md`);
      else if (!readFileSync(ruta, 'utf8').includes('letraTitulo:')) problemas.push(`${f.ficha} no lleva letraTitulo`);
    }
  }
  if (f.estado === 'encontrada' && !f.fuente) problemas.push('estado «encontrada» sin fuente');
  if (f.estado === 'no encontrada' && !f.notas) problemas.push('estado «no encontrada» sin notas de dónde se miró');
  return problemas;
}

// ---------------------------------------------------------------------------
// Reconocer una petición de letra escrita a mano (tarjeta de Trello, chat…)
// ---------------------------------------------------------------------------

const CARPETAS_FICHAS = [
  ['acordes', 'src/content/acordes'],
  ['borradores', 'src/content/borradores'],
];

const sinTildes = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const norm = (t) => sinTildes(t).replace(/[^a-z0-9]+/g, ' ').trim();

/** Distancia de Levenshtein, para tolerar erratas en nombres cortos. */
function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
}

/** Fichas de `acordes` y `borradores`. Si un slug está en las dos, manda `acordes`. */
function leerFichas() {
  const porSlug = new Map();
  for (const [carpeta, ruta] of CARPETAS_FICHAS) {
    if (!existsSync(ruta)) continue;
    for (const archivo of readdirSync(ruta)) {
      if (!archivo.endsWith('.md')) continue;
      const slug = archivo.slice(0, -3);
      if (porSlug.has(slug)) continue;
      const { data } = matter(readFileSync(join(ruta, archivo), 'utf8'));
      porSlug.set(slug, {
        slug,
        carpeta,
        pieza: String(data.pieza || ''),
        agrupacion: String(data.agrupacion || ''),
        year: String(data.year || ''),
        musica: String(data.musica || ''),
        letraTitulo: String(data.letraTitulo || ''),
        fraseClave: String(data.fraseClave || ''),
      });
    }
  }
  return [...porSlug.values()];
}

// Palabras que forman parte del encargo y no del nombre de la agrupación.
const DISPARADORES = [
  /nueva\s+letra/g,
  /letra\s+nueva/g,
  /\bletra\b/g,
  /\bfinal\s+de\s+popurri\b/g,
  /\bpopurri\b/g,
  /\bpresentacion\b/g,
  /\bcuarteta\b/g,
  /\bestribillo\b/g,
  /\bpasodoble\b/g,
  /\btango\b/g,
  /\bcomparsa\b/g,
  /\bchirigota\b/g,
  /\bcoro\b/g,
  /\bcuarteto\b/g,
  /\bponer(le)?\s+acordes\b/g,
  /\bacordes\b/g,
];

const TIPOS = [
  ['final de popurrí', /final de popurri/],
  ['popurrí', /popurri/],
  ['presentación', /presentacion/],
  ['cuarteta', /cuarteta/],
  ['estribillo', /estribillo/],
  ['pasodoble', /pasodoble/],
  ['tango', /tango/],
];

function tipoDeTexto(texto) {
  const t = norm(texto);
  return TIPOS.find(([, re]) => re.test(t))?.[0] || 'pasodoble';
}

function limpiar(texto) {
  let t = norm(texto);
  for (const re of DISPARADORES) t = t.replace(re, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** Puntos de 0 a ~100 de lo bien que encaja una agrupación con el texto. */
function puntuarAgrupacion(nombre, limpio, palabras) {
  const n = norm(nombre);
  if (!n) return 0;
  const suyas = n.split(' ');
  if (` ${limpio} `.includes(` ${n} `)) return 100 + n.length;
  const presentes = suyas.filter((p) => palabras.includes(p)).length;
  if (presentes === suyas.length) return 80 + n.length;
  let cerca = 0;
  for (const p of suyas) {
    if (
      palabras.some(
        (x) => x === p || (p.length >= 4 && x.length >= 4 && distancia(p, x) <= 1),
      )
    ) {
      cerca++;
    }
  }
  if (cerca === suyas.length) return 60 + n.length;
  if (presentes) return 40 * (presentes / suyas.length);
  return 0;
}

/** ¿Dos textos son el mismo título (o uno contiene al otro)? */
function seParecen(a, b) {
  const A = norm(a);
  const B = norm(b);
  if (A.length < 8 || B.length < 8) return false;
  return A === B || A.includes(B) || B.includes(A);
}

function reconocer(texto) {
  const fichas = leerFichas();
  const limpio = limpiar(texto);
  const palabras = limpio.split(' ').filter(Boolean);

  const porAgrupacion = new Map();
  for (const f of fichas) {
    const clave = norm(f.agrupacion);
    if (!clave) continue;
    const puntos = puntuarAgrupacion(f.agrupacion, limpio, palabras);
    if (!porAgrupacion.has(clave) || porAgrupacion.get(clave).puntos < puntos) {
      porAgrupacion.set(clave, { agrupacion: f.agrupacion, clave, puntos });
    }
  }

  const candidatos = [...porAgrupacion.values()]
    .filter((c) => c.puntos >= 40)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 3)
    .map((c) => {
      const suyas = fichas
        .filter((f) => norm(f.agrupacion) === c.clave)
        .sort(
          (a, b) =>
            (Number(b.year) || 0) - (Number(a.year) || 0) ||
            a.pieza.localeCompare(b.pieza) ||
            a.slug.localeCompare(b.slug),
        );
      const pasodobles = suyas.filter((f) => /^pasodoble/i.test(f.pieza));
      const sinLetra = pasodobles.filter((f) => !f.letraTitulo);
      const base = sinLetra[0] || pasodobles[0] || null;
      const años = [...new Set(pasodobles.map((f) => f.year).filter(Boolean))];
      return {
        agrupacion: c.agrupacion,
        year: suyas[0]?.year || '',
        base: base?.slug || '',
        baseYear: base?.year || '',
        ambiguoBase: años.length > 1,
        fichas: suyas.map(({ slug, pieza, year, letraTitulo }) => ({
          slug,
          pieza,
          year,
          letraTitulo,
        })),
      };
    });

  // Duplicados: una ficha que ya es letra alternativa de esa música.
  const cabecera = norm(texto).slice(0, 300);
  const duplicados = [];
  for (const f of fichas) {
    if (!f.letraTitulo) continue;
    const porTitulo = seParecen(f.letraTitulo, texto);
    const porSlug = seParecen(f.slug.replace(/-/g, ' '), texto);
    if (porTitulo || porSlug) {
      duplicados.push({ slug: f.slug, titulo: f.letraTitulo, tipo: 'letra' });
    } else if (f.fraseClave && seParecen(f.fraseClave, cabecera)) {
      duplicados.push({ slug: f.slug, titulo: f.letraTitulo || f.fraseClave, tipo: 'frase' });
    }
  }
  // Una ficha ya publicada con ese título entrecomillado en la pieza.
  for (const f of fichas) {
    const tituloPieza = f.pieza.match(/"([^"]+)"/)?.[1];
    if (tituloPieza && seParecen(tituloPieza, texto)) {
      duplicados.push({ slug: f.slug, titulo: tituloPieza, tipo: 'pieza' });
    }
  }

  const url = String(texto).match(/https?:\/\/\S+/)?.[0] || '';
  const lineas = String(texto).split(/\r?\n/).filter((l) => l.trim()).length;
  const letraPegada = lineas >= 6 || String(texto).trim().length > 400;
  const pieza = tipoDeTexto(texto);

  return {
    texto: String(texto).trim(),
    pieza,
    soportado: pieza === 'pasodoble',
    limpio,
    candidatos,
    duplicados: [...new Map(duplicados.map((d) => [d.slug, d])).values()],
    url,
    letraPegada,
  };
}

function imprimirReconocimiento(r) {
  console.log(`«${r.texto}»\n`);
  console.log(`Pieza: ${r.pieza}`);
  if (!r.soportado) {
    console.log('⚠ Las letras alternativas solo están previstas para pasodobles (TIPOS_CON_LETRAS).');
    console.log('  Para este tipo hay que decidir si va como ficha propia o si se amplía la agrupación de letras.');
  }

  if (!r.candidatos.length) {
    console.log('\nNo he encontrado ninguna agrupación que case con el texto.');
    console.log('Prueba con el nombre exacto de la agrupación, o apunta la letra con --base ? y se resuelve luego.');
  } else {
    r.candidatos.forEach((c, i) => {
      if (i === 0) {
        console.log(`\nAgrupación: ${c.agrupacion}${c.year ? ` (${c.year})` : ''}`);
      } else {
        console.log(`\nOtra posible agrupación: ${c.agrupacion}${c.year ? ` (${c.year})` : ''}`);
      }
      if (c.base) {
        console.log(`Base propuesta: ${c.base}${c.baseYear ? ` (${c.baseYear})` : ''}`);
        if (c.ambiguoBase) {
          console.log('⚠ Hay pasodobles de varios años: confirma cuál es la música antes de aplicar los acordes.');
        }
      } else {
        console.log('⚠ No hay ningún pasodoble de esta agrupación: no puedo proponer base.');
      }
      console.log('Fichas:');
      for (const f of c.fichas) {
        const marca = f.slug === c.base ? '  ← base' : '';
        console.log(`  ${f.year || '—'} · ${f.pieza || '—'} · ${f.slug}${marca}`);
      }
    });
  }

  if (r.duplicados.length) {
    console.log('');
    for (const d of r.duplicados) {
      if (d.tipo === 'letra') {
        console.log(`⚠ Ya existe una ficha para esa letra: ${d.slug} («${d.titulo}»).`);
      } else if (d.tipo === 'pieza') {
        console.log(`⚠ Ya existe una ficha con ese título: ${d.slug} («${d.titulo}»).`);
      } else {
        console.log(`⚠ Parece que ya hay una ficha que empieza así: ${d.slug} («${d.titulo}»). Compruébalo antes de crearla.`);
      }
    }
  }

  if (r.candidatos.length > 1) {
    console.log('\n⚠ Hay más de una agrupación posible: confirma cuál es antes de seguir.');
  }

  if (r.url) {
    console.log(`\nHe visto una URL: ${r.url}`);
    console.log('  → npm run letra:decarnaval -- <url>  (letrasdecarnaval)');
    console.log('  → npm run letra:web -- <url> --salida .cache/letra-<n>.txt');
  }
  if (r.letraPegada) {
    console.log('\nEl texto parece la letra pegada: guárdala en `.cache/letra-<n>.txt` antes de aplicar los acordes.');
  }

  const primero = r.candidatos[0];
  if (primero?.base && r.soportado && !r.duplicados.some((d) => d.tipo !== 'frase')) {
    console.log('\nSiguiente:');
    console.log(`  npm run letras -- anadir "<frase o título>" --agrupacion "${primero.agrupacion}" --base ${primero.base}`);
    console.log(`  npm run acordes:plan -- --base ${primero.base} --letra .cache/letra-<n>.txt`);
  }
}

function listar(filas, filtro) {
  const porEstado = {};
  for (const f of filas) porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
  const resumen = ESTADOS.map((e) => `${ICONO[e]} ${e}: ${porEstado[e] || 0}`).join(' · ');
  console.log(`${resumen}\n`);
  const visibles = filtro ? filas.filter((f) => f.estado === filtro) : filas;
  for (const f of visibles) {
    console.log(`${String(f.n).padStart(2)} ${ICONO[f.estado]} ${f.frase}`);
    console.log(`   ${f.agrupacion}${f.base && f.base !== '?' ? ` · base ${f.base}` : ''}${f.ficha ? ` · ${f.ficha}` : ''}`);
    if (f.notas) console.log(`   ${f.notas}`);
  }
}

if (orden === 'listar') {
  const { filas } = leer();
  listar(filas, opciones(args.slice(1)).estado);
} else if (orden === 'siguiente') {
  const { filas } = leer();
  const f = filas.find((x) => x.estado === 'pendiente');
  if (!f) { console.log('✓ No queda ninguna pendiente.'); process.exit(0); }
  console.log(`Siguiente: ${f.n}. ${f.frase}`);
  console.log(`  Agrupación: ${f.agrupacion}`);
  console.log(`  Base:       ${f.base}`);
  if (f.notas) console.log(`  Notas:      ${f.notas}`);
  console.log(`\n  node scripts/letra-web.mjs <url> --salida .cache/letra-${f.n}.txt`);
} else if (orden === 'estado') {
  const n = Number(args[1]);
  const estado = args[2];
  if (!Number.isInteger(n) || !estado) {
    console.error('Uso: npm run letras -- estado <n> "<estado>" [--ficha <slug>] [--fuente <url>] [--notas "..."]');
    process.exit(1);
  }
  if (!ESTADOS.includes(estado)) {
    console.error(`Estado desconocido: «${estado}». Válidos: ${ESTADOS.join(' · ')}`);
    process.exit(1);
  }
  const { filas, lineas } = leer();
  const f = filas.find((x) => x.n === n);
  if (!f) { console.error(`No hay ninguna entrada con el número ${n}.`); process.exit(1); }
  const o = opciones(args.slice(3));
  f.estado = estado;
  if (o.ficha) f.ficha = String(o.ficha);
  if (o.fuente) f.fuente = String(o.fuente);
  if (o.notas) f.notas = String(o.notas).replace(/\|/g, '/');
  if (o.base) f.base = String(o.base);
  if (o.agrupacion) f.agrupacion = String(o.agrupacion);
  escribir(filas, lineas);
  console.log(`${ICONO[estado]} ${n}. ${f.frase} → ${estado}${f.ficha ? ` (${f.ficha})` : ''}`);
} else if (orden === 'auditar') {
  const { filas } = leer();
  let errores = 0;
  for (const f of filas) {
    for (const p of comprobar(f)) { errores++; console.error(`✗ ${f.n}. ${f.frase}: ${p}`); }
  }
  // Fichas con letraTitulo que no están en la lista: solo informativo.
  const enLista = new Set(filas.map((f) => f.ficha).filter(Boolean));
  const sueltas = readdirSync(CARPETA).filter((x) => x.endsWith('.md')).map((x) => x.slice(0, -3))
    .filter((s) => !enLista.has(s) && readFileSync(join(CARPETA, `${s}.md`), 'utf8').includes('letraTitulo:'));
  if (sueltas.length) {
    console.log(`\nLetras alternativas fuera de la lista (${sueltas.length}):`);
    for (const s of sueltas) console.log(`  ${s}`);
  }
  if (errores) { console.error(`\n✗ ${errores} problema(s).`); process.exit(1); }
  console.log(`✓ ${filas.length} entrada(s) coherentes.`);
} else if (orden === 'anadir') {
  const frase = args[1];
  const o = opciones(args.slice(2));
  if (!frase) { console.error('Uso: npm run letras -- anadir "frase" [--agrupacion "Los X"] [--base slug] [--fuente url] [--notas "..."]'); process.exit(1); }
  const { lineas } = leer();
  const { filas } = leer();
  const n = Math.max(0, ...filas.map((f) => f.n)) + 1;
  const celda = (t) => String(t || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  const fila = `| ${n} | ${celda(frase)} | ${celda(o.agrupacion) || '?'} | ${celda(o.base) || '?'} | pendiente | | ${celda(o.fuente)} | ${celda(o.notas)} |`;
  const iCabecera = lineas.findIndex((l) => /^\|\s*#\s*\|/.test(l));
  let iUltima = iCabecera;
  for (let i = iCabecera; i < lineas.length; i++) {
    if (/^\|\s*\d+\s*\|/.test(lineas[i])) iUltima = i;
  }
  lineas.splice(iUltima + 1, 0, fila);
  writeFileSync(ARCHIVO, lineas.join('\n'));
  console.log(`+ ${n}. ${frase}`);
} else if (orden === 'reconocer') {
  const texto = args[1];
  if (!texto) {
    console.error('Uso: npm run letras -- reconocer "<título o frase>" [--json]');
    process.exit(1);
  }
  const r = reconocer(texto);
  if (opciones(args.slice(2)).json) console.log(JSON.stringify(r, null, 2));
  else imprimirReconocimiento(r);
} else {
  console.error('Órdenes: listar · siguiente · estado · auditar · anadir · reconocer');
  process.exit(1);
}
