// Cloudflare Worker - API de Comentarios y Peticiones de Coplas
// Almacena comentarios en Cloudflare KV con key por página

const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const rateLimitMap = new Map();

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
    },
  });
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((RATE_WINDOW - (now - record.start)) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

function verifyAdmin(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === env.ADMIN_TOKEN;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getAllChildIds(comments, parentId) {
  const children = comments.filter((c) => c.parentId === parentId);
  let ids = [parentId];
  for (const child of children) {
    ids = ids.concat(getAllChildIds(comments, child.id));
  }
  return ids;
}

async function getComments(path, env) {
  const key = `comments:${path}`;
  const data = await env.COMMENTS.get(key, { type: 'json' });
  return data || [];
}

async function saveComments(path, comments, env) {
  const key = `comments:${path}`;
  await env.COMMENTS.put(key, JSON.stringify(comments));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders() });
    }

    // GET / — Obtener comentarios
    if (method === 'GET' && path === '/') {
      const pagePath = url.searchParams.get('path');
      if (!pagePath) {
        return jsonResponse({ error: 'Missing required parameter: path' }, 400);
      }

      try {
        const comments = await getComments(pagePath, env);
        return jsonResponse({ comments });
      } catch (err) {
        return jsonResponse({ error: 'Service temporarily unavailable. Please try again.' }, 503);
      }
    }

    // POST / — Crear comentario
    if (method === 'POST' && path === '/') {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const rateCheck = checkRateLimit(ip);

      if (!rateCheck.allowed) {
        return jsonResponse(
          { error: 'Rate limit exceeded. Try again later.', retryAfter: rateCheck.retryAfter },
          429
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      const { path: pagePath, author, content, parentId } = body;

      if (!pagePath) {
        return jsonResponse({ error: 'path is required' }, 400);
      }

      if (!content || !content.trim()) {
        return jsonResponse({ error: 'Content is required' }, 400);
      }

      const isAdmin = verifyAdmin(request, env);

      const comment = {
        id: generateId(),
        path: pagePath,
        author: (author && author.trim()) || '',
        content: content.trim(),
        date: new Date().toISOString(),
        isAdmin,
        completed: false,
        parentId: parentId || null,
      };

      try {
        const comments = await getComments(pagePath, env);
        comments.push(comment);
        await saveComments(pagePath, comments, env);
        return jsonResponse({ comment }, 201);
      } catch (err) {
        return jsonResponse({ error: 'Service temporarily unavailable. Please try again.' }, 503);
      }
    }

    // PATCH /:id — Actualizar comentario (solo admin)
    const patchMatch = path.match(/^\/([^/]+)$/);
    if (method === 'PATCH' && patchMatch) {
      const commentId = patchMatch[1];

      if (!verifyAdmin(request, env)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      try {
        // Search across all pages for this comment
        const list = await env.COMMENTS.list({ prefix: 'comments:' });
        for (const key of list.keys) {
          const comments = await env.COMMENTS.get(key.name, { type: 'json' });
          if (!comments) continue;

          const idx = comments.findIndex((c) => c.id === commentId);
          if (idx !== -1) {
            if (body.completed !== undefined) {
              comments[idx].completed = body.completed;
            }
            if (body.content !== undefined) {
              comments[idx].content = body.content;
            }
            await env.COMMENTS.put(key.name, JSON.stringify(comments));
            return jsonResponse({ comment: comments[idx] });
          }
        }

        return jsonResponse({ error: 'Comment not found' }, 404);
      } catch (err) {
        return jsonResponse({ error: 'Service temporarily unavailable' }, 503);
      }
    }

    // DELETE /:id — Eliminar comentario con cascada (solo admin)
    const deleteMatch = path.match(/^\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const commentId = deleteMatch[1];

      if (!verifyAdmin(request, env)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      try {
        const list = await env.COMMENTS.list({ prefix: 'comments:' });
        for (const key of list.keys) {
          const comments = await env.COMMENTS.get(key.name, { type: 'json' });
          if (!comments) continue;

          const idx = comments.findIndex((c) => c.id === commentId);
          if (idx !== -1) {
            const idsToDelete = getAllChildIds(comments, commentId);
            const filtered = comments.filter((c) => !idsToDelete.includes(c.id));
            await env.COMMENTS.put(key.name, JSON.stringify(filtered));
            return jsonResponse({ deleted: idsToDelete.length });
          }
        }

        return jsonResponse({ error: 'Comment not found' }, 404);
      } catch (err) {
        return jsonResponse({ error: 'Service temporarily unavailable' }, 503);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
