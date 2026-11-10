// Utilidades comunes para las APIs de Google (Search Console, GA4 y AdSense).
//
// La autenticación se hace siempre en el servidor. Se admite:
//   - Cuenta de servicio: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.
//   - OAuth de usuario: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN.
//
// AdSense no suele aceptar cuentas de servicio; para esa pestaña lo normal es
// usar el refresh token de un usuario con acceso a la cuenta.
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const cacheTokens = new Map();

const limpiarClave = (valor) => String(valor || '').replace(/\\n/g, '\n');

/** Modo de autenticación disponible y variables que faltan. */
export function configuracionGoogle(preferir = 'auto') {
  const servicio = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  const oauth = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN,
  );

  // AdSense suele necesitar OAuth de usuario. Si hay las dos formas, se prefiere
  // OAuth para esa pestaña; las demás usan la cuenta de servicio si existe.
  if (preferir === 'oauth' && oauth) return { modo: 'oauth', faltan: [] };
  if (servicio) return { modo: 'servicio', faltan: [] };
  if (oauth) return { modo: 'oauth', faltan: [] };

  return {
    modo: '',
    faltan: [
      'GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY',
      'o GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN',
    ],
  };
}

/** Añade a la lista de faltantes las variables propias de cada servicio. */
export function faltanServicio(extra = [], preferir = 'auto') {
  const cfg = configuracionGoogle(preferir);
  return { ...cfg, faltan: [...cfg.faltan, ...extra] };
}

function base64url(valor) {
  return Buffer.from(valor).toString('base64url');
}

async function pedirToken(datos) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(datos),
    signal: AbortSignal.timeout(15000),
  });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
  if (!r.ok || !json || !json.access_token) {
    const detalle = (json && (json.error_description || json.error)) || texto.slice(0, 180);
    throw new Error('Google rechazó las credenciales: ' + detalle);
  }
  return {
    token: json.access_token,
    expira: Date.now() + Math.max(60, Number(json.expires_in || 3600) - 60) * 1000,
  };
}

/**
 * Token de acceso para los scopes indicados. Se cachea en memoria mientras la
 * instancia de la función siga caliente.
 */
export async function tokenGoogle(scopes, preferir = 'auto') {
  const cfg = configuracionGoogle(preferir);
  const clave = cfg.modo + ' ' + [...scopes].sort().join(' ');
  const guardado = cacheTokens.get(clave);
  if (guardado && guardado.expira > Date.now() + 60000) return guardado.token;

  if (cfg.faltan.length) throw new Error('Faltan credenciales de Google: ' + cfg.faltan.join(', '));

  let token;
  if (cfg.modo === 'servicio') {
    const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
    const privateKey = limpiarClave(process.env.GOOGLE_PRIVATE_KEY);
    const ahora = Math.floor(Date.now() / 1000);
    const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const cuerpo = base64url(JSON.stringify({
      iss: email,
      scope: scopes.join(' '),
      aud: TOKEN_URL,
      iat: ahora,
      exp: ahora + 3600,
    }));
    const entrada = cabecera + '.' + cuerpo;
    let firma;
    try {
      firma = createSign('RSA-SHA256').update(entrada).sign(privateKey).toString('base64url');
    } catch {
      throw new Error('GOOGLE_PRIVATE_KEY no es una clave RSA válida. Revisa los saltos de línea.');
    }
    const respuesta = await pedirToken({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: entrada + '.' + firma,
    });
    token = respuesta.token;
  } else {
    const respuesta = await pedirToken({
      grant_type: 'refresh_token',
      client_id: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
      client_secret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      refresh_token: String(process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
    });
    token = respuesta.token;
  }

  cacheTokens.set(clave, { token, expira: Date.now() + 50 * 60000 });
  return token;
}

/** Llamada JSON a una API de Google con el token de acceso. */
export async function pedirGoogle(url, token, { method = 'GET', body } = {}) {
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });

  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : {}; } catch { datos = { raw: texto }; }

  if (!r.ok) {
    const detalle = (datos && datos.error && (datos.error.message || datos.error.status)) ||
      (datos && datos.raw) || texto.slice(0, 200);
    throw new Error('Google ' + r.status + ': ' + detalle);
  }
  return datos;
}

const iso = (fecha) => fecha.toISOString().slice(0, 10);

/** Medianoche UTC del día actual en Europe/Madrid (evita el desfase de UTC). */
function hoyMadrid() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day));
}

/** Rango de N días que termina `retraso` días antes de hoy (calendario Madrid). */
export function rangoDias(dias, retraso = 0) {
  const fin = new Date(hoyMadrid());
  fin.setUTCDate(fin.getUTCDate() - retraso);
  const ini = new Date(fin);
  ini.setUTCDate(ini.getUTCDate() - (dias - 1));
  return { desde: iso(ini), hasta: iso(fin) };
}

/** Periodo inmediatamente anterior de la misma duración. */
export function rangoAnterior(desde, hasta) {
  const fin = new Date(Date.parse(hasta + 'T00:00:00Z'));
  const ini = new Date(Date.parse(desde + 'T00:00:00Z'));
  const dias = Math.max(1, Math.round((fin - ini) / 86400000) + 1);
  const hastaAnt = new Date(ini.getTime() - 86400000);
  const desdeAnt = new Date(hastaAnt.getTime() - (dias - 1) * 86400000);
  return { desde: iso(desdeAnt), hasta: iso(hastaAnt), dias };
}

export const numero = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const s = String(valor ?? '').trim();
  if (!s) return 0;
  let limpio = s.replace(/\s/g, '');
  if (limpio.includes(',') && limpio.includes('.')) {
    // Formato 1.234,56 (es) o 1,234.56 (en): manda el último separador.
    if (limpio.lastIndexOf(',') > limpio.lastIndexOf('.')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    } else {
      limpio = limpio.replace(/,/g, '');
    }
  } else if (limpio.includes(',')) {
    limpio = limpio.replace(',', '.');
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
};

export const diasPedidos = (url) => {
  const n = Number(url && url.searchParams.get('dias'));
  return Math.min(180, Math.max(7, Number.isFinite(n) && n > 0 ? n : 30));
};
