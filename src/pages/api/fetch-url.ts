import type { APIRoute } from 'astro';

// 🔴 Muy importante: que NO se prerenderice
// export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // request.url es la URL completa: http://localhost:4321/api/fetch-url?url=...
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');

  if (!target) {
    return new Response('Missing url param en /api/fetch-url?url=...', { status: 400 });
  }

  try {
    const res = await fetch(target);

    if (!res.ok) {
      return new Response(`Upstream error (${res.status}) fetching ${target}`, { status: 502 });
    }

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('Error haciendo fetch al target:', target, err);
    return new Response(`Failed to fetch ${target}: ${err?.message ?? String(err)}`, {
      status: 500,
    });
  }
};
