// scripts/auditar-videos.mjs
//
// Comprueba que los vídeos de YouTube de las fichas siguen vivos y, si alguno
// ha caído, busca la actuación COMPLETA de esa agrupación en los canales de
// referencia (ONDA CÁDIZ CARNAVAL, carnavalsur y CADIZBOOKTV).
//
// Uso:
//   npm run videos                       # audita y escribe src/data/videos-estado.json
//   npm run videos -- --buscar           # además busca recambio y escribe videos-candidatos.md
//   npm run videos -- --aplicar          # escribe el vídeo elegido en las fichas caídas
//   npm run videos -- --solo <texto>     # limita a fichas/agrupaciones que coincidan
//   npm run videos -- --dry-run          # no escribe nada en las fichas
//   npm run videos -- --json             # resumen en JSON
//
// Estados:
//   ok        200 en oEmbed: el vídeo existe y se puede incrustar.
//   muerto    404/401: borrado o privado. No hay nada que hacer salvo buscar otro.
//   bloqueado 403: el vídeo existe, pero el autor no permite incrustarlo.
//
// El JSON de estado lo lee src/lib/videos.ts para no pintar un iframe roto.
// Si una consulta falla por red o por límite de peticiones, se conserva el
// estado anterior: nunca se marca un vídeo como muerto por un 429.
//
// La búsqueda de recambio va por el buscador interno de cada canal
// (/@handle/search?query=), que es mucho más fiable que la búsqueda global, y
// verifica el autor real con el author_name de oEmbed. Nunca aplica nada sin
// pasar el filtro: si el título no contiene todas las palabras de la
// agrupación, o lleva otro año, o es una pieza suelta, se descarta.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR_FICHAS = 'src/content/acordes';
const RUTA_ESTADO = 'src/data/videos-estado.json';
const RUTA_CANDIDATOS = 'src/data/videos-candidatos.json';
const RUTA_INFORME = 'videos-candidatos.md';

// Canales de referencia, por orden de preferencia. Si el primero no tiene la
// actuación, se prueba el siguiente.
const CANALES = [
  { handle: '@ONDACADIZCARNAVAL', nombre: 'ONDA CÁDIZ CARNAVAL' },
  { handle: '@carnavalsur', nombre: 'carnavalsur' },
  { handle: '@CarnavalPorUnTubo', nombre: 'Carnaval Por Un Tubo' },
  { handle: '@cadizbooktv8695', nombre: 'CADIZBOOKTV' },
];

const AGENTE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function leerArgumentos(argv) {
  const opciones = {
    buscar: false,
    aplicar: false,
    seco: false,
    json: false,
    solo: [],
    espera: 600,
    ayuda: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const siguiente = argv[i + 1];

    if (arg === '--buscar') opciones.buscar = true;
    else if (arg === '--aplicar') opciones.aplicar = true;
    else if (arg === '--dry-run' || arg === '--seco') opciones.seco = true;
    else if (arg === '--json') opciones.json = true;
    else if (arg === '--ayuda' || arg === '--help' || arg === '-h') opciones.ayuda = true;
    else if (arg === '--espera') {
      opciones.espera = Number(siguiente) || 600;
      i++;
    } else if (arg === '--solo') {
      opciones.solo.push(...String(siguiente || '').split(',').map((s) => s.trim()).filter(Boolean));
      i++;
    } else if (arg.startsWith('--solo=')) {
      opciones.solo.push(arg.slice(7));
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  return opciones;
}

function ayuda() {
  console.log(`
Auditoría de los vídeos de YouTube de las fichas.

  npm run videos                    audita y escribe ${RUTA_ESTADO}
  npm run videos -- --buscar        busca recambio para los caídos
  npm run videos -- --aplicar       aplica los recambios (respeta "aplicar": false)
  npm run videos -- --solo <texto>  limita a lo que coincida (slug o agrupación)

Opciones:
  --espera <ms>   pausa entre búsquedas por canal (por defecto 600)
  --dry-run       enseña los cambios pero no toca las fichas
  --json          resumen final en JSON

Edita ${RUTA_CANDIDATOS} y pon "aplicar": false en los grupos que no quieras.
`);
}

// ---------------------------------------------------------------------------
// Lectura de fichas
// ---------------------------------------------------------------------------

function leerFichas(opciones) {
  const ficheros = readdirSync(DIR_FICHAS).filter((f) => f.endsWith('.md'));
  const fichas = [];

  for (const fichero of ficheros) {
    const slug = fichero.replace(/\.md$/, '');
    const texto = readFileSync(path.join(DIR_FICHAS, fichero), 'utf8');
    const video = (texto.match(/^video:\s*(.+)$/m) || [])[1] || '';
    const agrupacion = ((texto.match(/^agrupacion:\s*(.+)$/m) || [])[1] || '').trim();
    const year = ((texto.match(/^year:\s*(\d{4})/m) || [])[1] || '').trim();
    const pieza = ((texto.match(/^pieza:\s*(.+)$/m) || [])[1] || '').trim();

    if (opciones.solo.length) {
      const heno = normalizar(slug + ' ' + agrupacion);
      const coincide = opciones.solo.some((s) => heno.includes(normalizar(s)));
      if (!coincide) continue;
    }

    fichas.push({ fichero, slug, agrupacion, year, pieza, video: video.trim().replace(/^['"]|['"]$/g, '') });
  }

  return fichas;
}

function idDe(url) {
  if (!url) return '';
  const m = String(url).match(/(?:embed\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VACIAS = new Set(['los', 'las', 'la', 'el', 'de', 'del', 'y', 'una', 'un', 'mi', 'que', 'con', 'por', 'cai']);

function palabras(texto) {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p.length > 2 && !VACIAS.has(p));
}

function minutosDeEtiqueta(etiqueta) {
  const m = String(etiqueta || '').match(/(\d+)\s*(hora|minuto)/);
  if (!m) return 0;
  return m[2] === 'hora' ? 60 * Number(m[1]) : Number(m[1]);
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pedir(url, opciones = {}) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 20000);

  try {
    return await fetch(url, {
      ...opciones,
      signal: control.signal,
      headers: {
        'accept-language': 'es-ES,es;q=0.9',
        'user-agent': AGENTE,
        cookie: 'CONSENT=YES+1',
        ...(opciones.headers || {}),
      },
    });
  } finally {
    clearTimeout(temporizador);
  }
}

// oEmbed dice si el vídeo existe y si se puede incrustar, y de paso devuelve el
// autor y el título, que es lo que usamos para validar el canal.
async function oembed(id, intentos = 3) {
  const url =
    'https://www.youtube.com/oembed?url=' +
    encodeURIComponent('https://www.youtube.com/watch?v=' + id) +
    '&format=json';

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await pedir(url);
      const texto = await respuesta.text();

      if (respuesta.status === 429 || respuesta.status >= 500) {
        await esperar(1500 * intento);
        continue;
      }

      let datos = null;
      try {
        datos = JSON.parse(texto);
      } catch {
        datos = null;
      }

      return {
        http: respuesta.status,
        autor: (datos && datos.author_name) || '',
        titulo: (datos && datos.title) || '',
      };
    } catch {
      await esperar(800 * intento);
    }
  }

  // Sin respuesta fiable: no se puede afirmar que esté muerto.
  return { http: 0, autor: '', titulo: '' };
}

const ESTADOS_POR_HTTP = {
  200: 'ok',
  401: 'muerto',
  403: 'bloqueado',
  404: 'muerto',
  410: 'muerto',
};

async function auditar(ids) {
  const cola = [...ids];
  const resultado = {};

  async function trabajador() {
    while (cola.length) {
      const id = cola.pop();
      const datos = await oembed(id);
      const estado = ESTADOS_POR_HTTP[datos.http];
      resultado[id] = { estado, http: datos.http, autor: datos.autor, titulo: datos.titulo };
    }
  }

  await Promise.all(Array.from({ length: 8 }, trabajador));
  return resultado;
}

// Buscador interno del canal. Devuelve los vídeos con su título y la etiqueta
// de accesibilidad (que incluye la duración).
async function buscarEnCanal(handle, consulta) {
  const url = `https://www.youtube.com/${handle}/search?query=${encodeURIComponent(consulta)}`;
  const expresion =
    /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})".{0,2500}?"title":\{"runs":\[\{"text":"(.*?)"\}\].{0,200}?"accessibilityData":\{"label":"(.*?)"/gs;

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const respuesta = await pedir(url);
      const html = await respuesta.text();
      const encontrados = [...html.matchAll(expresion)].map((m) => ({
        id: m[1],
        titulo: desescapar(m[2]),
        etiqueta: desescapar(m[3]),
      }));

      if (encontrados.length) return encontrados;
      if (intento === 1) await esperar(1500);
    } catch {
      if (intento === 1) await esperar(1500);
    }
  }

  return [];
}

function desescapar(texto) {
  return String(texto)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

// Año de subida del vídeo. Sirve para no colar la actuación de otro año cuando
// el título no lo dice: el COAC se sube el mismo año (o como mucho al
// siguiente, si la tele lo publica tarde). En los vídeos antiguos re-subidos
// esto no vale, así que solo se comprueba a partir de 2015.
async function fechaSubida(id) {
  try {
    const respuesta = await pedir(`https://www.youtube.com/watch?v=${id}`);
    const html = await respuesta.text();
    const coincidencia = html.match(/"uploadDate":"(\d{4})-/);
    return coincidencia ? Number(coincidencia[1]) : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Puntuación de candidatos
// ---------------------------------------------------------------------------

// Eventos que no son el concurso, o piezas sueltas: no sirven como actuación.
const DESCARTES = /antolog|homenaje|entrevista|resumen|carnaval chiquito|\bcalle\b|clasificatorio/;
const PIEZAS = /pasodoble|cuple|popurri|presentacion|tango|cuarteta|estribillo/;
const AVISOS = /juvenil|infantil/;

function evaluar(candidato, agrupacion, year) {
  const titulo = normalizar(candidato.titulo);
  const faltan = palabras(agrupacion).filter((p) => !titulo.includes(p));

  const years = [...titulo.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => m[0]);
  const coac = [...titulo.matchAll(/coac\s*(\d{2,4})/g)].map((m) => (m[1].length === 2 ? '20' + m[1] : m[1]));
  const yearsTitulo = [...new Set([...years, ...coac])];
  const yearDistinto = yearsTitulo.length > 0 && year && !yearsTitulo.includes(year);

  const minutos = minutosDeEtiqueta(candidato.etiqueta);
  const descarte = DESCARTES.test(titulo);
  const piezaSuelta = PIEZAS.test(titulo) && !PIEZAS.test(normalizar(agrupacion));
  const aviso = AVISOS.test(titulo) && !AVISOS.test(normalizar(agrupacion));
  const concurso = /coac|preliminar|cuarto|semifinal|final|concurso|actuacion/.test(titulo);

  const valido =
    faltan.length === 0 &&
    !yearDistinto &&
    !descarte &&
    !piezaSuelta &&
    (minutos >= 10 || minutos === 0);

  let puntos = 0;
  if (faltan.length === 0) puntos += 10;
  if (concurso) puntos += 3;
  if (yearsTitulo.length) puntos += 2;
  if (minutos >= 20) puntos += 2;
  else if (minutos >= 10) puntos += 1;
  // Una actuación dura 20-35 min. Si pasa de 40 suele ser una sesión doble con
  // otra agrupación, que se come el vídeo sin necesidad.
  if (minutos > 40) puntos -= 5;

  return { valido, faltan, yearDistinto, descarte, piezaSuelta, aviso, minutos, puntos };
}

async function buscarCandidatos(fichas, opciones, estado) {
  // Solo los grupos cuya ficha apunta a un vídeo caído.
  const grupos = new Map();

  for (const ficha of fichas) {
    const id = idDe(ficha.video);
    const situacion = estado[id];
    if (!id || !situacion || situacion.estado === 'ok') continue;

    const clave = normalizar(ficha.agrupacion) + '|' + ficha.year;
    if (!grupos.has(clave)) {
      grupos.set(clave, { agrupacion: ficha.agrupacion, year: ficha.year, fichas: [], ids: new Set() });
    }
    grupos.get(clave).fichas.push(ficha.slug);
    grupos.get(clave).ids.add(id);
  }

  const resultados = [];
  let numero = 0;

  for (const grupo of grupos.values()) {
    numero++;
    const consulta = `${grupo.agrupacion} ${grupo.year}`;
    let elegido = null;
    const alternativas = [];
    const avisos = [];

    if (!opciones.json) {
      process.stdout.write(`[${numero}/${grupos.size}] ${grupo.agrupacion} (${grupo.year}) ... `);
    }

    for (const canal of CANALES) {
      const encontrados = await buscarEnCanal(canal.handle, consulta);
      const evaluados = encontrados
        .map((c) => ({ ...c, ...evaluar(c, grupo.agrupacion, grupo.year) }))
        .filter((c) => c.valido)
        .sort((a, b) => b.puntos - a.puntos || b.minutos - a.minutos);

      for (const candidato of evaluados.slice(0, 3)) {
        const info = await oembed(candidato.id);
        if (info.http !== 200) continue;

        // El buscador del canal cae a resultados generales cuando no tiene el
        // vídeo, así que el autor real manda.
        if (normalizar(info.autor) !== normalizar(canal.nombre)) continue;

        const subida = await fechaSubida(candidato.id);
        const yearNumero = Number(grupo.year);
        if (yearNumero >= 2015 && subida && (subida < yearNumero || subida > yearNumero + 1)) continue;

        const ficha = {
          id: candidato.id,
          titulo: info.titulo || candidato.titulo,
          canal: info.autor,
          minutos: candidato.minutos,
          subida,
          url: `https://www.youtube.com/watch?v=${candidato.id}`,
          aviso: candidato.aviso ? 'juvenil/infantil' : '',
        };

        if (!elegido) {
          elegido = ficha;
          if (ficha.aviso) avisos.push(ficha.aviso);
        } else if (alternativas.length < 2) {
          alternativas.push(ficha);
        }
      }

      if (elegido) break;
      await esperar(opciones.espera);
    }

    if (!elegido && !opciones.json) console.log('sin candidato');
    else if (!opciones.json) console.log(`${elegido.canal} · ${elegido.minutos} min · ${elegido.id}`);

    resultados.push({
      agrupacion: grupo.agrupacion,
      year: grupo.year,
      fichas: grupo.fichas,
      videos_caidos: [...grupo.ids],
      elegido,
      alternativas,
      avisos,
      aplicar: Boolean(elegido),
    });
  }

  return resultados;
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------

function aplicarCandidatos(fichas, estado, opciones) {
  if (!existsSync(RUTA_CANDIDATOS)) {
    throw new Error(`No existe ${RUTA_CANDIDATOS}. Ejecuta antes: npm run videos -- --buscar`);
  }

  const datos = JSON.parse(readFileSync(RUTA_CANDIDATOS, 'utf8'));
  const cambios = [];

  for (const grupo of datos.grupos || []) {
    if (!grupo.elegido || grupo.aplicar === false) continue;

    for (const ficha of fichas) {
      if (normalizar(ficha.agrupacion) !== normalizar(grupo.agrupacion) || ficha.year !== grupo.year) continue;

      const idActual = idDe(ficha.video);
      const situacion = estado[idActual];

      // Solo se toca lo que está caído: un vídeo que funciona no se cambia.
      if (!idActual || !situacion || situacion.estado === 'ok') continue;

      const nuevo = `video: 'https://www.youtube.com/embed/${grupo.elegido.id}'`;
      const ruta = path.join(DIR_FICHAS, ficha.fichero);
      const texto = readFileSync(ruta, 'utf8');

      if (!/^video:.*$/m.test(texto)) continue;

      if (!opciones.seco) writeFileSync(ruta, texto.replace(/^video:.*$/m, nuevo), 'utf8');
      cambios.push({ ficha: ficha.slug, de: idActual, a: grupo.elegido.id });
    }
  }

  return cambios;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opciones = leerArgumentos(process.argv);

  if (opciones.ayuda) {
    ayuda();
    return;
  }

  const fichas = leerFichas(opciones);
  if (!fichas.length) {
    console.error('No hay fichas que auditar (revisa --solo).');
    process.exitCode = 1;
    return;
  }

  const ids = [...new Set(fichas.map((f) => idDe(f.video)).filter(Boolean))];
  const anteriores = existsSync(RUTA_ESTADO)
    ? JSON.parse(readFileSync(RUTA_ESTADO, 'utf8')).videos || {}
    : {};

  console.log(`Fichas: ${fichas.length} · vídeos distintos: ${ids.length}`);

  const nuevos = await auditar(ids);

  // Se fusiona con el estado anterior: si una consulta no dio respuesta fiable
  // (http 0), se conserva lo que ya sabíamos. Con --solo se conserva además el
  // resto del cancionero, que en esa pasada no se ha mirado.
  const videos = opciones.solo.length ? { ...anteriores } : {};
  for (const id of ids) {
    const nuevo = nuevos[id];
    if (!nuevo.estado && anteriores[id]) videos[id] = anteriores[id];
    else videos[id] = nuevo;
  }

  const cuenta = { ok: 0, muerto: 0, bloqueado: 0, desconocido: 0 };
  for (const info of Object.values(videos)) {
    if (info.estado === 'ok') cuenta.ok++;
    else if (info.estado === 'muerto') cuenta.muerto++;
    else if (info.estado === 'bloqueado') cuenta.bloqueado++;
    else cuenta.desconocido++;
  }

  const estado = {
    actualizado: new Date().toISOString().slice(0, 10),
    resumen: cuenta,
    videos,
  };

  if (!opciones.seco) {
    writeFileSync(RUTA_ESTADO, JSON.stringify(estado, null, 2) + '\n', 'utf8');
  }

  console.log(
    `Estado: ${cuenta.ok} ok · ${cuenta.muerto} muertos · ${cuenta.bloqueado} bloqueados` +
      (cuenta.desconocido ? ` · ${cuenta.desconocido} sin respuesta` : '')
  );

  const caidos = Object.entries(videos)
    .filter(([, info]) => info.estado !== 'ok')
    .map(([id, info]) => ({
      id,
      estado: info.estado,
      titulo: info.titulo,
      fichas: fichas.filter((f) => idDe(f.video) === id).map((f) => f.slug),
    }));

  if (caidos.length) {
    console.log('\nVídeos caídos:');
    for (const caido of caidos) {
      console.log(`  ${caido.estado.padEnd(9)} ${caido.id}  ${caido.fichas.join(', ')}`);
    }
  }

  let candidatos = null;
  if (opciones.buscar) {
    console.log('\nBuscando actuaciones completas...');
    const grupos = await buscarCandidatos(fichas, opciones, videos);
    const conRecambio = grupos.filter((g) => g.elegido).length;

    if (!opciones.seco) {
      // Con --solo se fusiona con lo que ya había: así se puede repasar una
      // agrupación concreta sin perder el trabajo de las demás.
      let gruposFinales = grupos;
      if (opciones.solo.length && existsSync(RUTA_CANDIDATOS)) {
        const previos = JSON.parse(readFileSync(RUTA_CANDIDATOS, 'utf8')).grupos || [];
        const clave = (g) => normalizar(g.agrupacion) + '|' + g.year;
        const mapa = new Map(previos.map((g) => [clave(g), g]));
        for (const grupo of grupos) mapa.set(clave(grupo), grupo);
        gruposFinales = [...mapa.values()].sort((a, b) => a.agrupacion.localeCompare(b.agrupacion, 'es'));
      }

      writeFileSync(
        RUTA_CANDIDATOS,
        JSON.stringify({ actualizado: new Date().toISOString().slice(0, 10), grupos: gruposFinales }, null, 2) + '\n',
        'utf8'
      );
      writeFileSync(RUTA_INFORME, informe(gruposFinales), 'utf8');
    }

    console.log(`\nRecambio encontrado: ${conRecambio}/${grupos.length} agrupaciones.`);
    console.log(`Revisa ${RUTA_INFORME} y aplica con: npm run videos -- --aplicar`);
    candidatos = { grupos, conRecambio };
  }

  if (opciones.aplicar) {
    const cambios = aplicarCandidatos(fichas, videos, opciones);
    console.log(
      `\n${opciones.seco ? 'Se aplicarían' : 'Aplicados'} ${cambios.length} vídeos en fichas caídas.`
    );
    for (const cambio of cambios) {
      console.log(`  ${cambio.ficha}: ${cambio.de} -> ${cambio.a}`);
    }
    if (!opciones.seco && cambios.length) {
      console.log('\nVuelve a pasar la auditoría para refrescar el estado: npm run videos');
    }
  }

  if (opciones.json) {
    console.log(JSON.stringify({ resumen: cuenta, caidos, candidatos }, null, 2));
  }
}

function informe(grupos) {
  const lineas = [
    '# Candidatos de vídeo para las fichas caídas',
    '',
    'Generado por `npm run videos -- --buscar`. Cada línea propone una **actuación completa**',
    'de la agrupación en los canales de referencia, ya verificada con oEmbed (existe y se puede',
    'incrustar) y con el autor real del canal.',
    '',
    'Para descartar un grupo, pon `"aplicar": false` en `src/data/videos-candidatos.json` y',
    'después ejecuta `npm run videos -- --aplicar`.',
    '',
    '| Agrupación | Año | Canal | Min | Vídeo | Fichas |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const grupo of grupos) {
    const fichas = grupo.fichas.join(', ');
    if (!grupo.elegido) {
      lineas.push(`| ${grupo.agrupacion} | ${grupo.year} | — | — | sin candidato | ${fichas} |`);
      continue;
    }
    const aviso = grupo.avisos.length ? ' ⚠️' : '';
    lineas.push(
      `| ${grupo.agrupacion}${aviso} | ${grupo.year} | ${grupo.elegido.canal} | ${grupo.elegido.minutos} | ` +
        `[${grupo.elegido.id}](${grupo.elegido.url}) | ${fichas} |`
    );
  }

  const sinCandidato = grupos.filter((g) => !g.elegido);
  if (sinCandidato.length) {
    lineas.push('', '## Sin candidato', '');
    lineas.push('Se quedan con el aviso de «vídeo no disponible» y el enlace de búsqueda.', '');
    for (const grupo of sinCandidato) {
      lineas.push(`- ${grupo.agrupacion} (${grupo.year})`);
    }
  }

  const conAviso = grupos.filter((g) => g.elegido && g.avisos.length);
  if (conAviso.length) {
    lineas.push('', '## ⚠️ Revisar antes de aplicar', '');
    lineas.push('El título indica juvenil o infantil: comprueba que sea la misma agrupación.', '');
    for (const grupo of conAviso) {
      lineas.push(
        `- ${grupo.agrupacion} (${grupo.year}) → ${grupo.elegido.titulo} · ${grupo.elegido.url}`
      );
    }
  }

  lineas.push('');
  return lineas.join('\n');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
