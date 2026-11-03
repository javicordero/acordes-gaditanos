// workers/push-worker/src/index.js
//
// Worker de suscripciones para los avisos push de la PWA.
//
// Solo guarda y lista suscripciones: el envío lo hace scripts/push.mjs (Node +
// web-push) desde la GitHub Action, para no reimplementar el cifrado de Web Push
// en el edge y no tener la clave privada VAPID en Cloudflare.
//
// Se despliega A MANO desde el panel (Edit code → pegar → Deploy). No hay
// wrangler.toml a propósito: el binding PUSH se declara en
// Settings → Bindings, y un `wrangler deploy` desde el repo lo borraría.
//
// Vinculaciones que espera:
//   - KV namespace  PUSH              (binding de tipo KV)
//   - Secret        PUSH_SEND_TOKEN   (el mismo que tiene la Action)
//
// Rutas:
//   GET    /count              → { total }                      (público)
//   POST   /subscribe          → { ok, id }                     (navegador)
//   POST   /unsubscribe        → { ok }                         (navegador)
//   GET    /subs               → { subs, cursor }                (Bearer token)
//   DELETE /subs/:id           → { ok }                          (Bearer token)

const VERSION = '2026-11-03';

const ORIGENES = new Set([
  'https://acordesgaditanos.com',
  'https://www.acordesgaditanos.com',
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:4323',
  'http://127.0.0.1:4321',
  'http://127.0.0.1:4322',
  'http://127.0.0.1:4323',
]);

// Límite por IP para las rutas abiertas al navegador. Las de administración ya
// van protegidas con el token.
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 60 * 1000;
const rateBuckets = new Map();

function cubo(ip) {
  const ahora = Date.now();
  const actual = rateBuckets.get(ip);
  if (!actual || ahora - actual.inicio > RATE_WINDOW) {
    rateBuckets.set(ip, { inicio: ahora, cuenta: 1 });
    return true;
  }
  if (actual.cuenta >= RATE_LIMIT) return false;
  actual.cuenta++;
  return true;
}

function cabecerasCors(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGENES.has(origin)
      ? origin
      : 'https://acordesgaditanos.com',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(datos, status = 200, origin = '', extra = {}) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cabecerasCors(origin),
      ...extra,
    },
  });
}

function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function autorizado(request, env) {
  const cabecera = request.headers.get('Authorization') || '';
  if (!cabecera.startsWith('Bearer ')) return false;
  const token = cabecera.slice(7).trim();
  if (!token || !env.PUSH_SEND_TOKEN) return false;
  return igualSeguro(token, env.PUSH_SEND_TOKEN);
}

// El id es el hash del endpoint: así la misma suscripción siempre cae en la
// misma clave y repetir la petición no duplica nada.
async function idDe(endpoint) {
  const bytes = new TextEncoder().encode(endpoint);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

const PREFIJO = 'sub:';

function suscripcionValida(body) {
  if (!body || typeof body !== 'object') return 'Cuerpo inválido';
  const { endpoint, keys } = body;
  if (typeof endpoint !== 'string') return 'Falta endpoint';
  if (endpoint.length > 1000) return 'endpoint demasiado largo';
  if (!/^https:\/\//i.test(endpoint)) return 'endpoint debe ser https';
  if (!keys || typeof keys !== 'object') return 'Faltan keys';
  for (const campo of ['p256dh', 'auth']) {
    const valor = keys[campo];
    if (typeof valor !== 'string' || !valor || valor.length > 200) {
      return `keys.${campo} inválido`;
    }
  }
  return '';
}

async function total(env) {
  let cursor;
  let suma = 0;
  do {
    const pagina = await env.PUSH.list({ prefix: PREFIJO, limit: 1000, cursor });
    suma += pagina.keys.length;
    cursor = pagina.list_complete ? undefined : pagina.cursor;
  } while (cursor);
  return suma;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ruta = url.pathname;
    const metodo = request.method;
    const origin = request.headers.get('Origin') || '';

    if (metodo === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecerasCors(origin) });
    }

    if (!env.PUSH) {
      return json({ error: 'Falta el binding KV llamado PUSH' }, 500, origin);
    }

    if (ruta === '/' && metodo === 'GET') {
      return json({ ok: true, worker: 'push-worker', version: VERSION }, 200, origin);
    }

    // Número de suscriptores. Público: no expone ningún dato, solo el total.
    if (ruta === '/count' && metodo === 'GET') {
      try {
        return json({ total: await total(env) }, 200, origin);
      } catch {
        return json({ error: 'No se pudo contar' }, 503, origin);
      }
    }

    if (ruta === '/subscribe' && metodo === 'POST') {
      if (origin && !ORIGENES.has(origin)) {
        return json({ error: 'Origen no permitido' }, 403, origin);
      }
      const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
      if (!cubo(ip)) {
        return json({ error: 'Demasiadas peticiones, prueba más tarde' }, 429, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'JSON inválido' }, 400, origin);
      }

      const error = suscripcionValida(body);
      if (error) return json({ error }, 400, origin);

      const id = await idDe(body.endpoint);
      const registro = {
        id,
        endpoint: body.endpoint,
        keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
        creado: new Date().toISOString(),
        ua: (request.headers.get('user-agent') || '').slice(0, 160),
      };

      try {
        await env.PUSH.put(`${PREFIJO}${id}`, JSON.stringify(registro));
        return json({ ok: true, id }, 201, origin);
      } catch {
        return json({ error: 'No se pudo guardar' }, 503, origin);
      }
    }

    if (ruta === '/unsubscribe' && metodo === 'POST') {
      if (origin && !ORIGENES.has(origin)) {
        return json({ error: 'Origen no permitido' }, 403, origin);
      }
      const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
      if (!cubo(ip)) {
        return json({ error: 'Demasiadas peticiones, prueba más tarde' }, 429, origin);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'JSON inválido' }, 400, origin);
      }
      if (typeof body?.endpoint !== 'string' || !body.endpoint) {
        return json({ error: 'Falta endpoint' }, 400, origin);
      }

      try {
        await env.PUSH.delete(`${PREFIJO}${await idDe(body.endpoint)}`);
        return json({ ok: true }, 200, origin);
      } catch {
        return json({ error: 'No se pudo borrar' }, 503, origin);
      }
    }

    // A partir de aquí, solo la Action (o el PC del propietario).
    if (ruta === '/subs' && metodo === 'GET') {
      if (!autorizado(request, env)) {
        return json({ error: 'No autorizado' }, 401, origin);
      }
      const limite = Math.min(Math.max(Number(url.searchParams.get('limit')) || 200, 1), 500);
      const cursor = url.searchParams.get('cursor') || undefined;

      try {
        const pagina = await env.PUSH.list({ prefix: PREFIJO, limit: limite, cursor });
        const subs = [];
        // KV no tiene "get many": se leen en tandas para no abrir 500 a la vez.
        for (let i = 0; i < pagina.keys.length; i += 50) {
          const tanda = pagina.keys.slice(i, i + 50);
          const valores = await Promise.all(
            tanda.map((k) => env.PUSH.get(k.name, { type: 'json' })),
          );
          for (const v of valores) {
            if (v && v.endpoint && v.keys) {
              subs.push({ id: v.id, endpoint: v.endpoint, keys: v.keys });
            }
          }
        }
        return json(
          { subs, cursor: pagina.list_complete ? null : pagina.cursor, devuelto: subs.length },
          200,
          origin,
        );
      } catch {
        return json({ error: 'No se pudo listar' }, 503, origin);
      }
    }

    const borrar = ruta.match(/^\/subs\/([a-f0-9]{8,64})$/i);
    if (borrar && metodo === 'DELETE') {
      if (!autorizado(request, env)) {
        return json({ error: 'No autorizado' }, 401, origin);
      }
      try {
        await env.PUSH.delete(`${PREFIJO}${borrar[1].toLowerCase()}`);
        return json({ ok: true }, 200, origin);
      } catch {
        return json({ error: 'No se pudo borrar' }, 503, origin);
      }
    }

    return json({ error: 'No encontrado' }, 404, origin);
  },
};
