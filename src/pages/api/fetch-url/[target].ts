import type { APIRoute } from 'astro';

// 🔴 IMPORTANTE: esto le dice a Astro que NO intente prerender esta ruta
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  // El segmento dinámico de la ruta: /api/fetch-url/:target
  const encoded = params.target as string | undefined;
  const target = encoded ? decodeURIComponent(encoded) : null;

  if (!target) {
    return new Response('Missing target param en /api/fetch-url/:target', {
      status: 400,
    });
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
