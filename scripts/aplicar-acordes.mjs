// Aplica los acordes de una ficha existente a una letra nueva con la misma música.
//
// Pensado para los pasodobles con varias letras sobre la misma música: pegas la
// letra en un .txt, la repartes con `---` (entre líneas) o `|` (entre palabras)
// y el script coloca cada acorde sobre la sílaba equivalente.
//
// Uso:
//   node scripts/aplicar-acordes.mjs --base pasodoble-los-colgaos --letra letra.txt --titulo "Cinco años"
//   node scripts/aplicar-acordes.mjs --base pasodoble-los-colgaos --plan
//
// Opciones:
//   --base <slug[,slug]>   Ficha(s) de src/content/acordes. Con varias elige la que mejor encaje.
//   --hermanas             Añade como candidatas las fichas con la misma pieza, agrupación, año y música.
//   --letra <fichero|->    Letra nueva ('-' = stdin). Marcas: `---`, `|`, `-`.
//   --titulo <texto>       Valor de `letraTitulo` (por defecto, el primer verso).
//   --frase <texto>        Valor de `fraseClave` (por defecto, el primer verso).
//   --autor-letra <texto>  Campo `letra` del frontmatter (por defecto, el de la base).
//   --autor-musica <texto> Campo `musica` del frontmatter (por defecto, el de la base).
//   --video <url>          Campo `video` (por defecto, el de la base).
//   --fecha DD/MM/YYYY     Campo `date` (por defecto, hoy).
//   --salida <ruta>        Fichero de salida.
//   --reparto 2,1,3,..     Fuerza cuántas líneas van en cada verso de la base (`-` = saltar).
//   --destino acordes2|acordes3  Escribe en la colección provisional o en los
//                               borradores del panel (por defecto, acordes).
//   --plan                 Enseña la estructura de la base y de la letra; no escribe nada.
//   --propios a,b,c        Palabras que mantienen la mayúscula en mitad de verso.
//   --dry                  No escribe; solo enseña el informe y el .md.
//   --forzar               Sobrescribe si la ficha ya existe.
//
// Después: npm run acordes:revisar -- --slug <slug>  y  npm run auditar:letras

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { analizarVerso } from './lib/silabas.mjs';
import {
  CARPETA, leerFicha, hermanasDetalle, leerLetra, alinear, repartoManual, repartoPorCortes,
  generar, prefijos,
} from './lib/acordes-letra.mjs';

function leerArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) a[k] = true;
    else { a[k] = sig; i++; }
  }
  return a;
}
const texto = (v) => (v && v !== true ? String(v) : undefined);
const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Líneas que no son letra: pies de ficha, contadores de visitas, autorías y
 * años pegados por la web de origen. Si se cuelan, acaban dentro del `<pre>`
 * como si fueran un verso (pasó con «Los Currelantes» y «Las Huestes»).
 */
const METADATOS = [
  /\b(19|20)\d{2}\b.*\b(carnaval|comparsa|chirigota|coro|cuarteto|autor|letra|m[uú]sica)\b/i,
  /\b(carnaval|comparsa|chirigota|coro|cuarteto)\b.*\b(19|20)\d{2}\b/i,
  /\b(comparsas?|chirigotas?)\b.*\b(19|20)\d{2}\b/i,
  /^(letra|m[uú]sica|autor|autor[ií]a|fuente)\s*:/i,
  /^(vendedor|a[nñ]adir al carrito|seleccionar opciones)\b/i,
  /^(ú|u)ltima modificaci[oó]n\b/i, /^informar de un error$/i,
  /^[\d.,]+\s*K$/i, /^gracias a\s+.+\s+por record/i, /^recopilaci[oó]n de letras/i,
  // Títulos y mandos de la web de origen.
  /^(pasodoble|tango|presentaci[oó]n|cupl[eé]s?|popurr[ií]|estribillo)\b/i,
  /A-\s*A\+/, /^[!¡]$/,
];

function metadatosDe(fuente) {
  return String(fuente).replace(/\r\n/g, '\n').split('\n')
    .map((l) => l.trim()).filter(Boolean)
    .filter((l) => METADATOS.some((r) => r.test(l)));
}


function cambiarFrontmatter(fm, cambios, quitar) {
  let lineas = fm.replace(/\n+$/, '').split('\n').filter((l) => !quitar.some((k) => new RegExp(`^${k}:`).test(l)));
  const cierre = lineas.lastIndexOf('---');
  const cuerpo = lineas.slice(1, cierre).filter((l) => l.trim() !== '');
  const valor = (v) => {
    const s = String(v);
    if (/^[^\n:#'"&-][^:#]*$/.test(s) && !/^\s|\s$/.test(s)) return s;
    return JSON.stringify(s);
  };
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) continue;
    const t = k === 'date' ? `${k}: "${v}"` : k === 'video' ? `${k}: '${v}'` : `${k}: ${valor(v)}`;
    const idx = cuerpo.findIndex((l) => l.startsWith(`${k}:`));
    if (idx >= 0) cuerpo[idx] = t; else cuerpo.push(t);
  }
  // `letraTitulo` va pegado a `letra`; `fraseClave`, al final y con un respiro
  // delante, como en las fichas hechas a mano.
  const moverTras = (campo, despues) => {
    const i = cuerpo.findIndex((l) => l.startsWith(`${campo}:`));
    const j = cuerpo.findIndex((l) => l.startsWith(`${despues}:`));
    if (i < 0 || j < 0 || i === j + 1) return;
    const [linea] = cuerpo.splice(i, 1);
    const destino = cuerpo.findIndex((l) => l.startsWith(`${despues}:`));
    cuerpo.splice(destino + 1, 0, linea);
  };
  moverTras('letraTitulo', 'letra');
  const iFrase = cuerpo.findIndex((l) => l.startsWith('fraseClave:'));
  if (iFrase > 0 && cuerpo[iFrase - 1].trim() !== '') cuerpo.splice(iFrase, 0, '');
  return ['---', ...cuerpo, '---', ''].join('\n');
}

function hoy() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const dif = (v) => (v.dif === null ? '   ' : `${String(v.largoBase).padStart(2)}→${String(v.largo).padStart(2)} (${v.dif >= 0 ? '+' : ''}${v.dif})`);

/** Acordes de un verso con la sílaba que tienen debajo: `Lam«Y» Mi7«lle»… */
function mapaAcordes(acordes, desde, an) {
  return acordes.map((a) => {
    const s = an.reales[a.pos - desde];
    return `${a.etiqueta}«${s ? s.texto : '?'}»`;
  }).join(' ');
}

function informe(gen, prefijo) {
  const lineas = ['', '    nº  síl      acordes                       texto'];
  let i = 0;
  for (const v of gen.versos) {
    const desde = prefijo[gen.plan.cortes[i]] ?? 0;
    const an = analizarVerso(v.texto);
    const marca = v.dif === null ? '   ' : Math.abs(v.dif) > 1 ? '⚠️ ' : Math.abs(v.dif) === 1 ? '~  ' : '   ';
    lineas.push(`${marca}${String(v.n).padStart(3)} ${dif(v)}  ${mapaAcordes(v.acordes, desde, an).padEnd(28)} ${v.texto}`);
    i++;
  }
  return lineas.join('\n');
}

function planDeBase(base, tok) {
  const out = [`BASE · ${base.slug} (${base.versos.length} versos, ${base.acordes.length} acordes)`];
  base.items.forEach((it) => {
    if (it.tipo === 'blanco') { out.push(''); return; }
    if (it.tipo === 'meta') { out.push(`   ${it.texto}`); return; }
    if (it.tipo === 'instrumental') { out.push(`     [instrumental] ${it.texto}`); return; }
    const n = base.versos.indexOf(it) + 1;
    const desde = base.prefijo[it.palabraInicio] ?? 0;
    out.push(`${String(n).padStart(3)} ${String(it.largo).padStart(2)}s  ${mapaAcordes(it.anclas, desde, it.an).padEnd(30)} ${it.verso}`);
  });
  if (tok) {
    const nLineas = tok.palabras.length ? tok.palabras[tok.palabras.length - 1].linea + 1 : 0;
    const cortes = tok.palabras.filter((p) => p.duro).length;
    out.push('', `LETRA · ${nLineas} líneas · ${tok.palabras.length} palabras · ${cortes} cortes`);
    for (let l = 0; l < nLineas; l++) {
      const ws = tok.palabras.filter((p) => p.linea === l);
      const t = ws.map((p) => p.texto).join(' ');
      out.push(`  L${String(l + 1).padStart(2)} ${String(analizarVerso(t).tonica + 1).padStart(3)}s  ${t}`);
    }
  }
  return out.join('\n');
}

function main() {
  const args = leerArgs(process.argv.slice(2));
  if (!args.base) {
    console.error('Uso: node scripts/aplicar-acordes.mjs --base <slug> --letra <fichero> [--titulo "..."] [--hermanas]');
    console.error('     node scripts/aplicar-acordes.mjs --base <slug> --plan');
    process.exit(1);
  }

  let brutotexto = '';
  if (args.letra) {
    brutotexto = args.letra === '-' ? readFileSync(0, 'utf8') : readFileSync(args.letra, 'utf8');
  } else if (!args.plan) {
    console.error('❌ Falta --letra (o usa --plan para ver la base).');
    process.exit(1);
  }
  // --lineas-duras: cada línea del .txt es un verso de la base. Útil cuando la
  // fuente ya trae un salto por verso (letrasdecarnaval, blogs) y el reparto
  // automático tiende a fundir líneas para ahorrar coste.
  if (args['lineas-duras']) {
    brutotexto = String(brutotexto).replace(/\r\n/g, '\n').split('\n')
      .map((l) => l.trim()).filter(Boolean).join('\n---\n');
  }

  // Guardia: si el .txt trae pies de página o autorías, se para antes de
  // escribir nada. Es más fácil limpiar el .txt que descubrir después una
  // línea de «Carnaval 2011 Comparsas» dentro de la copla.
  if (!args['permitir-meta']) {
    const sueltas = metadatosDe(brutotexto);
    if (sueltas.length) {
      console.error('❌ La letra parece llevar metadatos de la web, no versos:');
      for (const l of sueltas) console.error(`   ${l}`);
      console.error('\nQuita esas líneas del .txt (o usa --permitir-meta si de verdad son parte de la letra).');
      process.exit(1);
    }
  }
  const tok = leerLetra(brutotexto);

  let slugs = String(args.base).split(',').map((s) => s.trim());
  const avisos = [];
  if (args.hermanas) {
    const detalle = hermanasDetalle(slugs[0]);
    avisos.push(...detalle.avisos);
    slugs = [...new Set(slugs.flatMap((s) => hermanasDetalle(s).slugs))];
  }

  if (args.plan) {
    console.log(planDeBase(leerFicha(slugs[0]), tok.palabras.length ? tok : null));
    if (slugs.length > 1) console.log(`\nOtras candidatas: ${slugs.slice(1).join(', ')}`);
    console.log('\nMarca los cortes en el .txt con «---» entre líneas o «|» entre palabras; con «-» solo, saltas un verso de la base.');
    return;
  }

  const reparto = texto(args.reparto);
  let elegida = null;
  const ranking = [];
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const letraNorm = norm(tok.palabras.map((p) => p.texto).join(' '));
  for (const slug of slugs) {
    const base = leerFicha(slug);
    // Una variante con la misma letra no sirve de base: se copiaría a sí misma.
    if (norm(base.palabras.map((p) => p.texto).join(' ')) === letraNorm) {
      ranking.push(`${slug} (ya tiene esta misma letra; no la uso como base)`);
      continue;
    }
    let alin;
    try {
      if (reparto) alin = repartoManual(reparto.split(',').map((t) => (t.trim() === '-' ? null : Number(t))), tok, base.versos.length);
      else if (tok.hayCortes) alin = repartoPorCortes(tok, base.versos.length);
      else alin = alinear(base.versos, tok);
    } catch (e) {
      ranking.push(`${slug} (descartada: ${e.message})`);
      continue;
    }
    if (!alin) { ranking.push(`${slug} (sin alineación)`); continue; }
    // El coste solo sirve para elegir base; con cortes manuales no se usa para repartir.
    const coste = alinear(base.versos, tok)?.coste ?? 0;
    ranking.push(`${slug} (coste ${coste.toFixed(1)})`);
    if (!elegida || coste < elegida.coste) elegida = { base, alin, coste };
  }
  if (!elegida) {
    console.error(`❌ No he podido alinear la letra con la base.\n${ranking.join('\n')}`);
    process.exit(1);
  }

  const { base, alin } = elegida;
  if (ranking.length > 1) console.error(`Candidatas: ${ranking.join(' · ')}`);
  console.error(`Base: ${base.slug} · ${alin.usados}/${base.versos.length} versos de la base cubiertos`);
  for (const a of avisos) console.error(`! ${a}`);
  if (alin.usados < base.versos.length * 0.8) {
    console.error(`⚠️  La letra solo cubre ${alin.usados} de ${base.versos.length} versos. ¿Seguro que es la misma música?`);
  }

  const gen = generar(base, tok, alin);
  const prefijo = prefijos(gen.plan.palabras);
  console.error(informe(gen, prefijo));
  for (const a of gen.avisos) console.error(`! ${a}`);

  const malos = gen.versos.filter((v) => v.dif !== null && Math.abs(v.dif) > 1);
  if (malos.length) {
    console.error(`\n⚠️  ${malos.length} verso(s) con más de una sílaba de desfase: ${malos.map((v) => v.n).join(', ')}.`);
    console.error('   Revísalos con `npm run acordes:revisar` o ajusta los cortes del .txt.');
  }
  console.error('\n⚠️ = más de una sílaba · ~ = una sílaba. Después: npm run acordes:revisar -- --slug <slug>');

  const titulo = texto(args.titulo) || gen.versos[0]?.texto || 'Sin título';
  const frase = texto(args.frase) || gen.versos[0]?.texto || '';
  const fm = cambiarFrontmatter(base.frontmatter, {
    letraTitulo: titulo,
    fraseClave: frase,
    date: texto(args.fecha) || hoy(),
    letra: texto(args['autor-letra']),
    musica: texto(args['autor-musica']),
    video: texto(args.video),
  }, ['destacada', 'recomendada']);
  const md = `${fm}<pre>\n${gen.salida.join('\n')}\n</pre>\n`;

  const pieza = /^pieza:\s*(.+)$/m.exec(base.frontmatter)?.[1] || 'pasodoble';
  const agrup = /^agrupacion:\s*(.+)$/m.exec(base.frontmatter)?.[1] || '';
  const carpetas = { acordes2: 'src/content/acordes2', acordes3: 'src/content/acordes3' };
  const carpeta = carpetas[args.destino] || CARPETA;
  const slug = `${slugify(pieza)}-${slugify(agrup)}-${slugify(titulo)}`;
  const destino = texto(args.salida) || join(carpeta, `${slug}.md`);

  if (args.dry) { process.stdout.write(md); return; }
  if (existsSync(destino) && !args.forzar) {
    console.error(`\n❌ ${destino} ya existe (usa --forzar para sobrescribir).`);
    process.exit(1);
  }
  writeFileSync(destino, md);
  console.error(`\n✅ Escrito ${destino}`);
  console.error(`   Revísalo: npm run acordes:revisar -- --slug ${slug} --base ${base.slug}`);
}

main();
