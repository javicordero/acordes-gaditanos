#!/usr/bin/env node
/**
 * Rellena la modalidad de las fichas de `src/content/acordes` que no la tienen.
 *
 * Fuentes, en orden:
 *   1. La propia agrupación (si alguna ficha suya ya trae modalidad).
 *   2. El cancionero de guitarradegades (la tabla de cada ficha trae modalidad).
 *   3. El título del vídeo de YouTube (oEmbed).
 *
 * Por defecto NO escribe: deja un informe y un CSV con las dudas en `.cache/`.
 * Con `--aplicar` escribe `modalidad:` en el frontmatter (y corrige `Chrigota`).
 *
 * Uso:
 *   node scripts/completar-modalidad.mjs [--aplicar] [--sin-youtube]
 *        [--sin-cancionero] [--solo <texto>] [--max-videos N] [--verbose]
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { load } from 'cheerio';

const DIR = 'src/content/acordes';
const CACHE = '.cache';
const CACHE_YT = path.join(CACHE, 'modalidad-youtube.json');
const CACHE_CANCIONERO = path.join(CACHE, 'cancionero');
const INFORME = path.join(CACHE, 'modalidad-informe.md');
const DUDAS_CSV = path.join(CACHE, 'modalidad-dudas.csv');
const RESOLUCION_CSV = path.join(CACHE, 'modalidad-resolucion.csv');

const args = process.argv.slice(2);
const opt = {
  aplicar: args.includes('--aplicar'),
  sinYoutube: args.includes('--sin-youtube'),
  sinCancionero: args.includes('--sin-cancionero'),
  verbose: args.includes('--verbose'),
  solo: valorDe('--solo'),
  maxVideos: Number(valorDe('--max-videos') ?? 3),
};
function valorDe(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const PIEZAS = [
  'final-de-popurri',
  'pasodoble',
  'presentacion',
  'popurri',
  'cuarteta',
  'estribillo',
  'tango',
  'credo',
  'testamento',
];

function slug(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normModalidad(valor) {
  const s = slug(valor);
  if (!s) return null;
  if (s === 'comparsa') return 'Comparsa';
  if (s === 'chirigota' || s === 'chrigota') return 'Chirigota';
  if (s === 'chirigota-callejera' || s === 'chirigota-callejeras') return 'Chirigota Callejera';
  if (s === 'coro' || s === 'coros') return 'Coro';
  if (s === 'cuarteto' || s === 'cuartetos') return 'Cuarteto';
  return null;
}

function detectarEnTitulo(titulo) {
  const t = String(titulo ?? '');
  if (/\bchirigota\s+callejera\b/i.test(t)) return 'Chirigota Callejera';
  if (/\bcomparsa\b/i.test(t)) return 'Comparsa';
  if (/\bchirigota\b|\bchrigota\b/i.test(t)) return 'Chirigota';
  if (/\bcuarteto\b/i.test(t)) return 'Cuarteto';
  if (/\bcoro\b/i.test(t)) return 'Coro';
  return null;
}

function idDeVideo(video) {
  const m = String(video ?? '').match(/(?:embed\/|v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function leerCacheJson(ruta, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return porDefecto;
  }
}

function guardarCacheJson(ruta, datos) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2));
}

function cargarFichas() {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const ruta = path.join(DIR, file);
      const raw = fs.readFileSync(ruta, 'utf8');
      const { data } = matter(raw);
      return {
        file,
        ruta,
        raw,
        agrupacion: String(data.agrupacion ?? ''),
        agrupacionSlug: slug(data.agrupacion),
        year: String(data.year ?? ''),
        modalidad: data.modalidad ?? '',
        video: String(data.video ?? ''),
        pieza: String(data.pieza ?? ''),
      };
    });
}

/** Escribe (o corrige) `modalidad:` en el frontmatter conservando el resto. */
function escribirModalidad(raw, modalidad) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lineas = raw.split(/\r?\n/);
  if (lineas[0]?.trim() !== '---') return null;
  let fin = -1;
  for (let i = 1; i < lineas.length; i++) {
    if (lineas[i].trim() === '---') {
      fin = i;
      break;
    }
  }
  if (fin < 0) return null;

  const idx = lineas.findIndex((l, i) => i > 0 && i < fin && /^modalidad\s*:/.test(l));
  const nueva = `modalidad: ${modalidad}`;
  if (idx >= 0) {
    if (lineas[idx].trim() === nueva) return raw;
    lineas[idx] = nueva;
  } else {
    const idxYear = lineas.findIndex((l, i) => i > 0 && i < fin && /^year\s*:/.test(l));
    if (idxYear < 0) return null;
    lineas.splice(idxYear + 1, 0, nueva);
  }
  return lineas.join(eol);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTexto(url, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      ultimo = e;
      await esperar(400 * (i + 1));
    }
  }
  throw ultimo;
}

// ---------------------------------------------------------------------------
// Cancionero
// ---------------------------------------------------------------------------

async function indiceCancionero() {
  const url = 'https://www.guitarradegades.com/p/cancionero.html';
  const html = await fetchTexto(url);
  const $ = load(html);
  const entradas = [];
  const vistos = new Set();
  $('a[href*="cancionero-"]').each((_, a) => {
    const href = ($(a).attr('href') || '').replace(/^http:\/\//, 'https://');
    const m = href.match(/cancionero-([a-z0-9_-]+)\.html/i);
    if (!m) return;
    let s = m[1].toLowerCase();
    for (const pieza of PIEZAS) {
      if (s.startsWith(`${pieza}-`)) {
        s = s.slice(pieza.length + 1);
        break;
      }
    }
    const anio = (href.match(/\/(\d{4})\//) || [])[1] ?? '';
    const clave = `${s}|${anio}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    entradas.push({ url: href, agrupacionSlug: s, year: anio });
  });
  return entradas;
}

async function cancioneroDeAgrupacion(entradas, agrupacionSlug, years, cache) {
  const candidatas = entradas.filter(
    (e) =>
      e.agrupacionSlug === agrupacionSlug ||
      (e.agrupacionSlug.length > 6 &&
        (e.agrupacionSlug.includes(agrupacionSlug) || agrupacionSlug.includes(e.agrupacionSlug))),
  );
  if (!candidatas.length) return null;
  // Preferir la que coincida en año; luego la primera.
  candidatas.sort((a, b) => {
    const ya = years.has(a.year) ? 0 : 1;
    const yb = years.has(b.year) ? 0 : 1;
    return ya - yb;
  });

  for (const candidata of candidatas.slice(0, 3)) {
    const clave = candidata.url;
    let html = cache[clave];
    if (html === undefined) {
      fs.mkdirSync(CACHE_CANCIONERO, { recursive: true });
      const fichero = path.join(CACHE_CANCIONERO, `${slug(clave)}.html`);
      if (fs.existsSync(fichero)) {
        html = fs.readFileSync(fichero, 'utf8');
      } else {
        try {
          html = await fetchTexto(clave);
          fs.writeFileSync(fichero, html);
        } catch (e) {
          html = null;
        }
      }
      cache[clave] = html ?? null;
    }
    if (!html) continue;
    const $ = load(html);
    const post = $('div.post-body').first();
    const scope = post.length ? post : $.root();
    let table = null;
    scope.find('table').each((_, t) => {
      if (table) return;
      if (/Acordes/.test($(t).text()) && $(t).find('tr').length >= 3) table = $(t);
    });
    if (!table) continue;
    const celdas = table
      .find('tr')
      .eq(0)
      .find('td, th')
      .map((_, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get();
    const modalidad = normModalidad(celdas[1]);
    if (!modalidad) continue;
    const agrupacionCancionero = slug(celdas[2]);
    // Verificación estricta: la agrupación de la página tiene que ser exactamente
    // la buscada. Evita falsos positivos por prefijos ("Los Piratas" vs
    // "Los piratas informáticos").
    if (agrupacionCancionero !== agrupacionSlug) continue;
    return { modalidad, fuente: 'cancionero', detalle: candidata.url };
  }
  return null;
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

async function tituloYoutube(id, cache) {
  if (cache[id] !== undefined) return cache[id];
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
    );
    if (!res.ok) {
      cache[id] = null;
      return null;
    }
    const json = await res.json();
    const datos = { title: json.title ?? '', author: json.author_name ?? '' };
    cache[id] = datos;
    return datos;
  } catch {
    cache[id] = null;
    return null;
  }
}

async function modalidadPorYoutube(fichas, cache) {
  const intentos = fichas
    .map((f) => idDeVideo(f.video))
    .filter(Boolean)
    .slice(0, opt.maxVideos);
  const vistos = [];
  for (const id of intentos) {
    const datos = await tituloYoutube(id, cache);
    if (!datos) continue;
    vistos.push({ id, title: datos.title });
    const modalidad = detectarEnTitulo(datos.title);
    if (modalidad) {
      return { modalidad, fuente: 'youtube', detalle: datos.title, titulos: vistos };
    }
  }
  return { modalidad: null, fuente: null, detalle: null, titulos: vistos };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const fichas = cargarFichas();
  const filtradas = opt.solo
    ? fichas.filter(
        (f) =>
          f.agrupacion.toLowerCase().includes(opt.solo.toLowerCase()) ||
          f.file.includes(slug(opt.solo)),
      )
    : fichas;

  console.log(`Fichas: ${fichas.length}${opt.solo ? ` (filtradas: ${filtradas.length})` : ''}`);

  // Modalidad por agrupación a partir de lo que ya hay.
  const porAgrupacion = new Map();
  for (const f of fichas) {
    if (!porAgrupacion.has(f.agrupacionSlug)) {
      porAgrupacion.set(f.agrupacionSlug, { nombre: f.agrupacion, fichas: [], mods: new Map() });
    }
    const g = porAgrupacion.get(f.agrupacionSlug);
    g.fichas.push(f);
    const m = normModalidad(f.modalidad);
    if (m) g.mods.set(m, (g.mods.get(m) ?? 0) + 1);
  }

  const resolucion = new Map(); // agrupacionSlug -> { modalidad, fuente, detalle }
  const dudas = [];
  const conflictos = [];

  for (const [agrupacionSlug, g] of porAgrupacion) {
    if (opt.solo && !g.fichas.some((f) => filtradas.includes(f))) continue;

    const mods = [...g.mods.entries()];
    if (mods.length === 1) {
      resolucion.set(agrupacionSlug, {
        modalidad: mods[0][0],
        fuente: 'propia',
        detalle: `${mods[0][1]} ficha(s) ya la tenían`,
      });
    } else if (mods.length > 1) {
      conflictos.push({ agrupacionSlug, nombre: g.nombre, mods: Object.fromEntries(mods) });
    }
  }

  // Cancionero para las que siguen sin modalidad.
  let entradasCancionero = [];
  if (!opt.sinCancionero) {
    try {
      entradasCancionero = await indiceCancionero();
      console.log(`Cancionero: ${entradasCancionero.length} enlaces en el índice`);
    } catch (e) {
      console.warn(`⚠️  No se pudo leer el cancionero: ${e.message}`);
    }
  }

  const cacheCancionero = {};
  const cacheYoutube = leerCacheJson(CACHE_YT, {});

  const pendientes = [...porAgrupacion.entries()].filter(
    ([k, g]) =>
      !resolucion.has(k) &&
      !(opt.solo && !g.fichas.some((f) => filtradas.includes(f))),
  );
  console.log(`Agrupaciones sin modalidad tras lo propio: ${pendientes.length}`);

  let hechasCancionero = 0;
  if (entradasCancionero.length) {
    for (let i = 0; i < pendientes.length; i++) {
      const [agrupacionSlug, g] = pendientes[i];
      const years = new Set(g.fichas.map((f) => f.year));
      const r = await cancioneroDeAgrupacion(
        entradasCancionero,
        agrupacionSlug,
        years,
        cacheCancionero,
      );
      if (r) {
        resolucion.set(agrupacionSlug, r);
        hechasCancionero++;
      }
      if (opt.verbose && (i + 1) % 20 === 0) {
        console.log(`  cancionero ${i + 1}/${pendientes.length} (${hechasCancionero} resueltas)`);
      }
    }
    console.log(`Resueltas por cancionero: ${hechasCancionero}`);
  }

  // YouTube para el resto, con concurrencia limitada.
  let hechasYoutube = 0;
  if (!opt.sinYoutube) {
    const restantes = pendientes.filter(([k]) => !resolucion.has(k));
    console.log(`Agrupaciones a consultar en YouTube: ${restantes.length}`);
    const CONCURRENCIA = 6;
    let cursor = 0;
    let procesadas = 0;

    async function worker() {
      while (cursor < restantes.length) {
        const [agrupacionSlug, g] = restantes[cursor++];
        const r = await modalidadPorYoutube(g.fichas, cacheYoutube);
        if (r.modalidad) {
          resolucion.set(agrupacionSlug, r);
          hechasYoutube++;
        } else {
          dudas.push({
            agrupacionSlug,
            nombre: g.nombre,
            fichas: g.fichas.length,
            years: [...new Set(g.fichas.map((f) => f.year))].sort(),
            videos: g.fichas.map((f) => idDeVideo(f.video)).filter(Boolean),
            titulos: (r.titulos || []).map((t) => t.title),
            motivo: g.fichas.some((f) => f.video)
              ? 'título de vídeo sin modalidad'
              : 'sin vídeo',
          });
        }
        procesadas++;
        if (opt.verbose && procesadas % 20 === 0) {
          console.log(`  youtube ${procesadas}/${restantes.length} (${hechasYoutube} resueltas)`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCIA }, worker));
    console.log(`Resueltas por YouTube: ${hechasYoutube}`);
  } else {
    for (const [agrupacionSlug, g] of pendientes.filter(([k]) => !resolucion.has(k))) {
      dudas.push({
        agrupacionSlug,
        nombre: g.nombre,
        fichas: g.fichas.length,
        years: [...new Set(g.fichas.map((f) => f.year))].sort(),
        videos: g.fichas.map((f) => idDeVideo(f.video)).filter(Boolean),
        titulos: [],
        motivo: 'sin consultar YouTube (--sin-youtube)',
      });
    }
  }

  // Clasificaciones revisadas a mano con hemeroteca / autores / COAC.
  // Fuentes: Diario de Cádiz, Código Carnaval, COAC y archivo del carnaval.
  const MANUAL = {
    'a-los-pies-de-la-caleta': 'Comparsa',
    'la-bella-escondida': 'Comparsa',
    'las-del-tacata': 'Comparsa',
    'las-adolfas': 'Comparsa',
    'los-corrusquillos-gaditanos': 'Comparsa',
    'los-murciegolos': 'Chirigota',
    'los-plazoletas': 'Comparsa',
    'los-senadores-romanos': 'Comparsa',
    'neptuno-ten-cuidaito-con-los-trasmallos': 'Chirigota',
    'suspiros-de-cai': 'Comparsa',
    'una-comparsa-divina': 'Comparsa',
    'los-beduinos': 'Comparsa',
    'los-golfus-de-roma': 'Chirigota',
    'los-campaneros': 'Comparsa',
    'los-quitapupas': 'Chirigota',
    'no-te-quemes-todavia': 'Chirigota',
    'pa-gusto-los-colores': 'Comparsa',
    'los-julianes': 'Chirigota',
    'a-los-que-se-les-ve-la-pluma': 'Comparsa',
    'la-escuela-de-carnaval': 'Comparsa',
    'las-maleducadas': 'Comparsa',
    'los-naturales': 'Chirigota',
    'las-huestes-de-don-nuno': 'Chirigota',
    'los-belloteros': 'Chirigota',
  };
  let hechasManual = 0;
  for (const [agrupacionSlug, modalidad] of Object.entries(MANUAL)) {
    if (!porAgrupacion.has(agrupacionSlug)) {
      console.warn(`⚠️  Manual: no existe la agrupación ${agrupacionSlug}`);
      continue;
    }
    resolucion.set(agrupacionSlug, {
      modalidad,
      fuente: 'manual',
      detalle: 'revisión manual (hemeroteca / COAC)',
    });
    hechasManual++;
  }
  for (let i = dudas.length - 1; i >= 0; i--) {
    if (resolucion.has(dudas[i].agrupacionSlug)) dudas.splice(i, 1);
  }
  console.log(`Resueltas a mano: ${hechasManual}`);

  guardarCacheJson(CACHE_YT, cacheYoutube);

  // Resumen por ficha.
  const cambios = [];
  let conModalidad = 0;
  let sinModalidad = 0;
  const porFuente = new Map();
  const porModalidad = new Map();

  for (const f of fichas) {
    const r = resolucion.get(f.agrupacionSlug);
    const actual = normModalidad(f.modalidad);
    if (r) {
      conModalidad++;
      porFuente.set(r.fuente, (porFuente.get(r.fuente) ?? 0) + 1);
      porModalidad.set(r.modalidad, (porModalidad.get(r.modalidad) ?? 0) + 1);
      if (f.modalidad !== r.modalidad) {
        cambios.push({ f, modalidad: r.modalidad, fuente: r.fuente, detalle: r.detalle });
      }
    } else {
      sinModalidad++;
      if (actual) {
        // Tenía una modalidad que no reconocemos: contarla como conflicto.
      }
    }
  }

  // Informe.
  const lineas = [];
  lineas.push('# Informe de modalidad');
  lineas.push('');
  lineas.push(`- Fichas totales: **${fichas.length}**`);
  lineas.push(`- Con modalidad: **${conModalidad}** · sin modalidad: **${sinModalidad}**`);
  lineas.push(`- Cambios a escribir: **${cambios.length}**${opt.aplicar ? ' (aplicados)' : ' (simulación)'}`);
  lineas.push('');
  lineas.push('## Por fuente');
  for (const [fuente, n] of [...porFuente.entries()].sort((a, b) => b[1] - a[1])) {
    lineas.push(`- ${fuente}: ${n} fichas`);
  }
  lineas.push('');
  lineas.push('## Por modalidad');
  for (const [mod, n] of [...porModalidad.entries()].sort((a, b) => b[1] - a[1])) {
    lineas.push(`- ${mod}: ${n} fichas`);
  }
  if (conflictos.length) {
    lineas.push('');
    lineas.push('## Conflictos (misma agrupación con varias modalidades)');
    for (const c of conflictos) {
      lineas.push(`- ${c.nombre}: ${JSON.stringify(c.mods)}`);
    }
  }
  lineas.push('');
  lineas.push(`## Dudas (${dudas.length} agrupaciones, ${dudas.reduce((n, d) => n + d.fichas, 0)} fichas)`);
  for (const d of dudas.sort((a, b) => b.fichas - a.fichas)) {
    lineas.push(`- **${d.nombre}** (${d.fichas} fichas, ${d.years.join(', ')}): ${d.motivo}`);
  }
  fs.mkdirSync(CACHE, { recursive: true });

  // CSV de dudas.
  const csv = ['agrupacion,fichas,years,videos,motivo'];
  for (const d of dudas.sort((a, b) => b.fichas - a.fichas)) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    csv.push(
      [esc(d.nombre), d.fichas, esc(d.years.join(' ')), esc(d.videos.join(' ')), esc(d.motivo)].join(','),
    );
  }
  fs.writeFileSync(DUDAS_CSV, csv.join('\n') + '\n');

  // CSV de resolución completa (para revisar falsos positivos).
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const resCsv = ['agrupacion,modalidad,fuente,fichas,years,detalle'];
  for (const [agrupacionSlug, g] of [...porAgrupacion.entries()].sort((a, b) =>
    a[1].nombre.localeCompare(b[1].nombre, 'es'),
  )) {
    const r = resolucion.get(agrupacionSlug);
    resCsv.push(
      [
        esc(g.nombre),
        esc(r?.modalidad ?? ''),
        esc(r?.fuente ?? ''),
        g.fichas.length,
        esc([...new Set(g.fichas.map((f) => f.year))].sort().join(' ')),
        esc(r?.detalle ?? ''),
      ].join(','),
    );
  }
  fs.writeFileSync(RESOLUCION_CSV, resCsv.join('\n') + '\n');

  // Sospechosas: el nombre de la agrupación dice una modalidad y la resuelta es otra.
  const sospechosas = [];
  for (const [agrupacionSlug, g] of porAgrupacion) {
    const r = resolucion.get(agrupacionSlug);
    if (!r) continue;
    const delNombre = detectarEnTitulo(g.nombre);
    if (delNombre && delNombre !== r.modalidad) {
      sospechosas.push({ nombre: g.nombre, delNombre, resuelta: r.modalidad, fuente: r.fuente });
    }
  }
  if (sospechosas.length) {
    lineas.push('');
    lineas.push(`## Sospechosas (${sospechosas.length}): el nombre dice una cosa y la fuente otra`);
    for (const s of sospechosas) {
      lineas.push(`- **${s.nombre}**: nombre «${s.delNombre}» vs resuelta «${s.resuelta}» (${s.fuente})`);
    }
  }

  fs.writeFileSync(INFORME, lineas.join('\n') + '\n');

  // Aplicar.
  if (opt.aplicar) {
    let escritas = 0;
    for (const c of cambios) {
      const nuevo = escribirModalidad(c.f.raw, c.modalidad);
      if (nuevo && nuevo !== c.f.raw) {
        fs.writeFileSync(c.f.ruta, nuevo);
        escritas++;
      }
    }
    console.log(`✍️  Fichas escritas: ${escritas}`);
  }

  console.log('');
  console.log(`Informe: ${INFORME}`);
  console.log(`Dudas:   ${DUDAS_CSV}`);
  console.log(`Con modalidad: ${conModalidad} · sin modalidad: ${sinModalidad} · cambios: ${cambios.length}`);
  if (dudas.length) {
    console.log(`\nSin resolver (${dudas.length}):`);
    for (const d of dudas.sort((a, b) => b.fichas - a.fichas)) {
      console.log(`  ${String(d.fichas).padStart(3)} | ${d.nombre} | ${d.motivo}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
