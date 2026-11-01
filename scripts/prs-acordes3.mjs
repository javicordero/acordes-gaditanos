// Lista y fusiona las PRs pendientes del panel /estudio.
//
// Uso:
//   npm run prs                     # ver las PRs abiertas (borradores y publicaciones)
//   npm run prs -- --merge          # fusionar (squash) todas las de borrador (estudio/*)
//   npm run prs -- --merge --si     # sin preguntar
//   npm run prs -- --merge --todas  # incluye también las de publicar (publica/*)
//   npm run prs -- --json           # salida para máquinas
//
// Necesita un token de GitHub con permiso sobre el repo:
//   - `GITHUB_TOKEN` en el entorno, o
//   - en `.env` como `GITHUB_TOKEN=...` (el `.env` está gitignored).
// También funciona con `gh` si está instalado y autenticado (se usa de reserva).
//
// Solo fusiona lo que GitHub da por bueno (`mergeable` y estado limpio). Con
// `--forzar` se salta esa comprobación, pero no se recomienda: el deploy
// preview puede estar aún construyendo.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const REPO = process.env.GITHUB_REPO || 'javicordero/acordes-gaditanos';
const args = process.argv.slice(2);
const fusionar = args.includes('--merge');
const todas = args.includes('--todas');
const si = args.includes('--si');
const forzar = args.includes('--forzar');
const soloJson = args.includes('--json');

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (existsSync('.env')) {
    const m = readFileSync('.env', 'utf8').match(/^GITHUB_TOKEN\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

/** Si no hay token, se intenta `gh api` (por si está instalado). */
function ghDisponible() {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const T = token();

async function api(ruta, opciones = {}) {
  if (T) {
    const r = await fetch(`https://api.github.com${ruta}`, {
      method: opciones.method || 'GET',
      headers: {
        Authorization: `Bearer ${T}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'acordes-prs',
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
    const texto = await r.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${datos?.message || texto}`);
    return datos;
  }
  if (ghDisponible()) {
    const salida = execFileSync('gh', ['api', ruta, ...(opciones.method && opciones.method !== 'GET' ? ['-X', opciones.method] : []), ...(opciones.body ? ['--input', '-'] : [])], {
      input: opciones.body ? JSON.stringify(opciones.body) : undefined,
      encoding: 'utf8',
    });
    return salida ? JSON.parse(salida) : null;
  }
  throw new Error('Falta GITHUB_TOKEN (en el entorno o en .env) y `gh` no está instalado.');
}

const color = (t, c) => (process.stdout.isTTY ? `\x1b[${c}m${t}\x1b[0m` : t);
const verde = (t) => color(t, 32);
const ambar = (t) => color(t, 33);
const rojo = (t) => color(t, 31);
const gris = (t) => color(t, 90);

const campo = (t, n) => String(t ?? '').padEnd(n).slice(0, n);
const cabecera = () => {
  console.log(campo('Nº', 5) + campo('Tipo', 10) + campo('Ficha', 52) + campo('Estado', 14) + 'Título');
};

function tipo(pr) {
  const rama = pr.head.ref;
  if (rama.startsWith('publica/')) return 'publicar';
  if (rama.startsWith('estudio/')) return 'borrador';
  if (rama.startsWith('letras/')) return 'letra';
  return 'otra';
}

function fichaDe(pr) {
  const m = (pr.body || '').match(/Ficha:\s*`([^`]+)`/);
  if (m) return m[1];
  if (pr.head.ref.startsWith('letras/')) {
    return 'nº ' + pr.head.ref.replace(/^letras\//, '').replace(/-[a-z0-9]+$/, '');
  }
  return pr.head.ref.replace(/^(estudio|publica)\//, '').replace(/-[a-z0-9]+$/, '');
}

function estado(pr) {
  if (pr.mergeable === false) return 'conflicto';
  if (pr.mergeable_state === 'blocked') return 'checks';
  if (pr.mergeable_state === 'behind') return 'desfasada';
  if (pr.mergeable === null) return 'calculando';
  return 'lista';
}

async function main() {
  const abiertas = await api(`/repos/${REPO}/pulls?state=open&per_page=100`);
  const lista = [];
  for (const pr of abiertas) {
    const t = tipo(pr);
    if (t === 'otra') continue;
    if (!todas && t === 'publicar') continue;
    let detalle = pr;
    try { detalle = await api(`/repos/${REPO}/pulls/${pr.number}`); } catch { /* se queda el básico */ }
    lista.push({ ...detalle, _tipo: t, _ficha: fichaDe(pr) });
  }

  if (soloJson) {
    console.log(JSON.stringify(lista.map((p) => ({
      numero: p.number, tipo: p._tipo, ficha: p._ficha,
      titulo: p.title, mergeable: p.mergeable, estado: p.mergeable_state, url: p.html_url,
    })), null, 2));
    return;
  }

  if (!lista.length) {
    console.log('No hay PRs pendientes' + (todas ? '.' : ' de borradores. (Usa --todas para ver también las de publicar.)'));
    return;
  }

  cabecera();
  for (const p of lista) {
    console.log(
      campo('#' + p.number, 5) +
      campo(p._tipo, 10) +
      campo(p._ficha, 52) +
      campo(estado(p), 14) +
      p.title,
    );
    console.log(gris('     ' + p.html_url));
  }

  if (!fusionar) {
    console.log('\nPara fusionar: npm run prs -- --merge' + (todas ? '' : ' [--todas]') + ' [--si]');
    return;
  }

  const candidatas = lista.filter((p) => forzar || (p.mergeable === true && ['clean', 'unstable', 'has_hooks'].includes(p.mergeable_state)));
  const descartadas = lista.filter((p) => !candidatas.includes(p));
  if (descartadas.length) {
    console.log(ambar(`\n${descartadas.length} PR(s) no se fusionan automáticamente (conflicto o checks pendientes):`));
    for (const p of descartadas) console.log(`  #${p.number} ${p._ficha} · ${p.mergeable_state}`);
  }
  if (!candidatas.length) return;

  if (!si) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`\n¿Fusionar ${candidatas.length} PR(s) con squash? [s/N] `);
    rl.close();
    if (!/^s/i.test(r.trim())) { console.log('Nada fusionado.'); return; }
  }

  let ok = 0;
  for (const p of candidatas) {
    try {
      await api(`/repos/${REPO}/pulls/${p.number}/merge`, {
        method: 'PUT',
        body: { merge_method: 'squash', commit_title: p.title },
      });
      ok++;
      console.log(verde(`✓ #${p.number} ${p._ficha}`));
    } catch (e) {
      console.log(rojo(`✗ #${p.number} ${p._ficha}: ${e.message}`));
    }
  }
  console.log(`\n${ok}/${candidatas.length} fusionada(s). Netlify reconstruye en un par de minutos.`);
}

if (!T && !ghDisponible()) {
  console.error('❌ Falta GITHUB_TOKEN.');
  console.error('   Crea un token en https://github.com/settings/tokens (permiso `public_repo` o `repo`)');
  console.error('   y ponlo en `.env` como `GITHUB_TOKEN=ghp_...`. O instala y autentica `gh`.');
  process.exit(1);
}

main().catch((e) => {
  console.error('❌ ' + (e.message || e));
  process.exit(1);
});
