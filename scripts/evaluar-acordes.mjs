// Mide la calidad de los acordes colocados usando fichas hermanas como verdad.
//
// Aplica los acordes de una ficha a la letra de otra (misma música) y compara
// con los acordes que esa otra ficha tiene de verdad. El emparejamiento es por
// orden de aparición (no «el mismo acorde más cercano»): así un Mi7 repetido no
// regala aciertos.
//
// Uso:
//   node scripts/evaluar-acordes.mjs                      (todos los pares hermanos)
//   node scripts/evaluar-acordes.mjs --pares a>b,c>d
//   node scripts/evaluar-acordes.mjs --max-fuera 20        (sale con 1 si empeora)
//   node scripts/evaluar-acordes.mjs --json '{"cortarLinea":3}' -v
//
// El número que importa es el de acordes a MÁS de una sílaba: contra fichas
// hechas a mano el 100 % exacto no existe (las fichas se llevan ±1 entre sí).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CARPETA, leerFicha, leerLetra, alinear, generar, PARAMS, PALABRAS_DEBILES, sinTildes,
} from './lib/acordes-letra.mjs';

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const iJson = args.indexOf('--json');
const iPares = args.indexOf('--pares');
const iMax = args.indexOf('--max-fuera');
const params = { ...PARAMS, ...(iJson >= 0 ? JSON.parse(args[iJson + 1]) : {}) };
const MODO_CORTE = args.includes('--mitades') ? 'mitades' : args.includes('--tercios') ? 'tercios' : 'igual';

function recortar(lineas) {
  if (MODO_CORTE === 'igual') return lineas;
  const partes = MODO_CORTE === 'mitades' ? 2 : 3;
  return lineas.flatMap((l) => {
    const ws = l.split(/\s+/);
    if (ws.length < partes * 2) return [l];
    const cortes = [];
    for (let k = 1; k < partes; k++) {
      const ideal = Math.round((ws.length * k) / partes);
      let mejor = ideal;
      for (let d = 0; d < ws.length; d++) {
        const c = [ideal + d, ideal - d].find((x) => x > (cortes[cortes.length - 1] ?? 0) && x < ws.length
          && !PALABRAS_DEBILES.has(ws[x - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zñ]/g, '')));
        if (c) { mejor = c; break; }
      }
      cortes.push(mejor);
    }
    cortes.push(ws.length);
    const out = []; let ini = 0;
    for (const fin of cortes) { out.push(ws.slice(ini, fin).join(' ')); ini = fin; }
    return out;
  });
}

/** Acordes de una ficha en orden, con su sílaba real global. */
function verdad(ficha) {
  const out = [];
  for (const it of ficha.versos) for (const a of it.anclas) out.push({ etiqueta: a.etiqueta, pos: a.pos });
  return out.sort((a, b) => a.pos - b.pos);
}

/** Empareja dos secuencias de acordes por orden, con la subsecuencia común más larga. */
function emparejar(real, generado) {
  const n = real.length, m = generado.length;
  const D = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = real[i - 1].etiqueta === generado[j - 1].etiqueta
      ? D[i - 1][j - 1] + 1
      : Math.max(D[i - 1][j], D[i][j - 1]);
  }
  const pares = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (real[i - 1].etiqueta === generado[j - 1].etiqueta && D[i][j] === D[i - 1][j - 1] + 1) {
      pares.push([real[i - 1], generado[j - 1]]); i--; j--;
    } else if (D[i - 1][j] >= D[i][j - 1]) i--;
    else j--;
  }
  return pares.reverse();
}

function paresDeArgumentos() {
  if (iPares < 0) return null;
  return String(args[iPares + 1]).split(',').map((p) => p.split('>').map((s) => s.trim())).filter((p) => p.length === 2);
}

function gruposHermanos() {
  const campo = (fm, k) => (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)?.[1] || '').trim().replace(/^['"]|['"]$/g, '');
  const porClave = new Map();
  for (const f of readdirSync(CARPETA).filter((x) => x.endsWith('.md'))) {
    const texto = readFileSync(join(CARPETA, f), 'utf8');
    if (!texto.includes('<pre>')) continue;
    const fm = texto.split('<pre>')[0];
    // Solo pasodobles: es donde una misma música se canta con varias letras.
    const tipo = sinTildes(campo(fm, 'pieza').replace(/"[^"]*"/g, '')).trim();
    if (tipo !== 'pasodoble') continue;
    const clave = [tipo, sinTildes(campo(fm, 'agrupacion')), campo(fm, 'year'), sinTildes(campo(fm, 'musica'))].join('|');
    if (!porClave.has(clave)) porClave.set(clave, []);
    porClave.get(clave).push(f.slice(0, -3));
  }
  return [...porClave.values()].filter((g) => g.length > 1).map((g) => g.sort());
}

const pares = paresDeArgumentos()
  || gruposHermanos().flatMap((g) => g.flatMap((b) => g.filter((t) => t !== b).map((t) => [b, t])));
if (!pares.length) {
  console.error('No hay fichas hermanas que comparar. Usa --pares a>b.');
  process.exit(1);
}

let total = 0, exactos = 0, cercanos = 0, fuera = 0, sinPar = 0;
const filas = [];
for (const [b, t] of pares) {
  const base = leerFicha(b);
  const target = leerFicha(t);
  const linea = target.versos.map((v) => v.verso.trim()).filter(Boolean);
  const tok = leerLetra(recortar(linea).join('\n'));
  const alin = alinear(base.versos, tok, params);
  if (!alin) { filas.push(`${b} → ${t}: sin alineación`); continue; }
  const gen = generar(base, tok, alin, params);
  const generados = gen.versos.flatMap((v) => v.acordes.map((c) => ({ etiqueta: c.etiqueta, pos: c.pos }))).sort((x, y) => x.pos - y.pos);
  const real = verdad(target);
  const emp = emparejar(real, generados);

  let ex = 0, ce = 0, fu = 0;
  for (const [r, g] of emp) {
    const d = Math.abs(r.pos - g.pos);
    if (d === 0) ex++;
    else if (d === 1) ce++;
    else fu++;
  }
  const sp = real.length - emp.length;
  total += real.length; exactos += ex; cercanos += ce; fuera += fu; sinPar += sp;
  const pct = (n) => `${(100 * n / Math.max(1, real.length)).toFixed(0)}%`;
  const circular = ex === real.length && real.length > 0 ? '  ← 100 %: ¿ficha generada por el script?' : '';
  filas.push(`${b} → ${t}: ${real.length} acordes · exactos ${pct(ex)} · ±1 ${pct(ce)} · >1 ${pct(fu)}${sp ? ` · sin par ${sp}` : ''} · coste ${alin.coste.toFixed(1)}${circular}`);
  if (verbose) {
    for (const v of gen.versos) console.log(`${Math.abs(v.dif ?? 0) > 1 ? '⚠' : ' '} ${v.n} ${v.largoBase}→${v.largo} ${v.texto}`);
  }
}

console.log(filas.join('\n'));
const pctT = (n) => `${(100 * n / Math.max(1, total)).toFixed(1)}%`;
console.log(`\nTOTAL: ${total} acordes · exactos ${pctT(exactos)} · ±1 ${pctT(cercanos)} · >1 ${pctT(fuera)}${sinPar ? ` · sin par ${pctT(sinPar)}` : ''}`);

if (iMax >= 0) {
  const maxFuera = Number(args[iMax + 1]);
  const pctFuera = 100 * fuera / Math.max(1, total);
  if (pctFuera > maxFuera) {
    console.error(`\n✗ ${pctFuera.toFixed(1)} % de acordes a más de una sílaba (tope ${maxFuera} %).`);
    process.exit(1);
  }
  console.log(`✓ por debajo del tope de ${maxFuera} % a más de una sílaba.`);
}
