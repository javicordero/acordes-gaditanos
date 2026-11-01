// Utilidades comunes del panel /estudio.
//
// Todo lo que toca GitHub pasa por aquí: sesión en cookie cifrada, llamadas a la
// API y comprobación del propietario. El token de GitHub no sale nunca del
// servidor: viaja dentro de la cookie cifrada (HttpOnly) y solo lo leen estas
// funciones.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const REPO = process.env.GITHUB_REPO || 'javicordero/acordes-gaditanos';
export const OWNER = (process.env.OWNER_LOGIN || 'javicordero').toLowerCase();
export const SITE = (process.env.URL || 'https://acordesgaditanos.com').replace(/\/+$/, '');
export const BASE = 'master';
export const COOKIE = 'estudio';
export const COOKIE_ESTADO = 'estudio_estado';
export const CARPETA = 'src/content/acordes';
export const CARPETAS = { acordes: 'src/content/acordes', acordes3: 'src/content/acordes3' };
export const MAX_EDAD = 60 * 60 * 12; // 12 h

const clave = () => createHash('sha256').update(String(process.env.SESSION_SECRET || 'sin-secreto')).digest();

export function cifrar(obj) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), datos]).toString('base64url');
}

export function descifrar(texto) {
  try {
    const bruto = Buffer.from(String(texto), 'base64url');
    const iv = bruto.subarray(0, 12);
    const tag = bruto.subarray(12, 28);
    const datos = bruto.subarray(28);
    const d = createDecipheriv('aes-256-gcm', clave(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(datos), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

export function cookies(req) {
  const crudo = req.headers.get('cookie') || '';
  const out = {};
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return out;
}

export function cookieSesion(valor, maxAge = MAX_EDAD) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Sesión válida o null. */
export function sesion(req) {
  const s = descifrar(cookies(req)[COOKIE]);
  if (!s || !s.token || !s.login) return null;
  if (Date.now() > Number(s.exp || 0)) return null;
  if (String(s.login).toLowerCase() !== OWNER) return null;
  return s;
}

/** Respuesta 401 si no hay sesión. */
export const sinSesion = () => json({ error: 'sin sesión' }, 401);

/** Llamada a la API de GitHub con el token de la sesión. */
export async function gh(ruta, { token, method = 'GET', body } = {}) {
  const r = await fetch(`https://api.github.com${ruta}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'acordes-gaditanos-estudio',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  if (!r.ok) {
    const err = new Error(`GitHub ${r.status}: ${(datos && datos.message) || texto || 'error'}`);
    err.status = r.status;
    err.datos = datos;
    throw err;
  }
  return datos;
}

/** URL de autorización de GitHub. */
export function urlAutorizacion(estado) {
  const p = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: `${SITE}/estudio/api/auth-callback`,
    scope: 'public_repo',
    state: estado,
  });
  return `https://github.com/login/oauth/authorize?${p.toString()}`;
}

/** Contenido de una ficha en una rama (o null si no existe). */
export async function fichaEnRepo(token, slug, ref = BASE, zona = 'acordes') {
  const carpeta = CARPETAS[zona] || CARPETAS.acordes;
  const ruta = `/repos/${REPO}/contents/${carpeta}/${slug}.md?ref=${encodeURIComponent(ref)}`;
  try {
    const d = await gh(ruta, { token });
    return { md: Buffer.from(d.content, 'base64').toString('utf8'), sha: d.sha };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
