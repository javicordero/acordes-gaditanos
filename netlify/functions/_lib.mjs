// Utilidades comunes del panel /admin.
//
// Todo lo que toca GitHub pasa por aquí: sesión en cookie cifrada, llamadas a la
// API y comprobación del propietario. El token de GitHub no sale nunca del
// servidor: viaja dentro de la cookie cifrada (HttpOnly) y solo lo leen estas
// funciones.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const REPO = process.env.GITHUB_REPO || 'javicordero/acordes-gaditanos';
export const OWNER = (process.env.OWNER_LOGIN || 'javicordero').toLowerCase();
export const SITE = (process.env.URL || 'https://acordesgaditanos.com').replace(/\/+$/, '');
export const BASE = 'master';
export const COOKIE = 'admin';
export const CARPETA = 'src/content/acordes';
export const CARPETAS = { acordes: 'src/content/acordes', acordes3: 'src/content/acordes3' };
// En `astro dev` el panel trabaja contra los archivos del ordenador, no contra
// GitHub: guardar escribe el `.md` y publicar mueve el archivo de carpeta.
export const LOCAL = process.env.ESTUDIO_LOCAL === '1';
export const MAX_EDAD = 60 * 60 * 12; // 12 h

// En producción no se admite el secreto de ejemplo: si falta SESSION_SECRET,
// las cookies y el state del OAuth no se pueden firmar de forma segura. En
// local se mantiene el valor de ejemplo para no obligar a configurarlo.
function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s && !LOCAL) throw new Error('Falta SESSION_SECRET en el entorno del panel');
  return String(s || 'sin-secreto');
}

const clave = () => createHash('sha256').update(secreto()).digest();

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
    const valor = parte.slice(i + 1).trim();
    try { out[parte.slice(0, i).trim()] = decodeURIComponent(valor); }
    catch { out[parte.slice(0, i).trim()] = valor; }
  }
  return out;
}

export function cookieSesion(valor, maxAge = MAX_EDAD) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Sesión de desarrollo: en `astro dev` no se pasa por GitHub. Se activa solo con
// los tres cerrojos puestos: la marca que pone la ruta de dev (ESTUDIO_LOCAL), el
// opt-in explícito del `.env` y un token disponible. En Netlify el primero nunca
// está, así que esto no se ejecuta en producción.
function sesionLocal() {
  if (!LOCAL) return null;
  if (process.env.ESTUDIO_SIN_LOGIN !== '1') return null;
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return { login: OWNER, token, exp: Number.MAX_SAFE_INTEGER, local: true };
}

/** Sesión válida o null. */
export function sesion(req) {
  const local = sesionLocal();
  if (local) return local;

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

/** Firma HMAC-SHA256 con SESSION_SECRET (para el `state` del OAuth). */
export function firmar(valor) {
  return createHmac('sha256', secreto())
    .update(String(valor)).digest('base64url');
}

/** `state` para el OAuth: `nonce.firma`, sin depender de cookies. */
export function estadoNuevo() {
  const nonce = randomBytes(16).toString('base64url');
  return `${nonce}.${firmar(nonce)}`;
}

/** Comprueba que un `state` devuelto por GitHub lleve la firma correcta. */
export function estadoValido(estado) {
  if (typeof estado !== 'string') return false;
  const i = estado.lastIndexOf('.');
  if (i <= 0) return false;
  const nonce = estado.slice(0, i);
  const firma = estado.slice(i + 1);
  const esperada = firmar(nonce);
  return firma.length === esperada.length &&
    timingSafeEqual(Buffer.from(firma), Buffer.from(esperada));
}

/** URL de autorización de GitHub. */
export function urlAutorizacion(estado) {
  const p = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: `${SITE}/admin/api/auth-callback`,
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
