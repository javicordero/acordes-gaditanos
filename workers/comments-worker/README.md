# comments-worker

API de comentarios y peticiones de coplas: Cloudflare Worker con los comentarios en KV.
Lo consume la web pública (`CommentsSection.astro`) y el panel `/admin` a través de
`netlify/functions/comentarios.mjs`.

## Antes de desplegar: el binding `COMMENTS`

El `wrangler.toml` del repo **no declara el binding de KV** (`COMMENTS`). Si despliegas
desde esta carpeta tal cual, Cloudflare lo borra y el worker deja de leer los comentarios
guardados (las rutas empiezan a responder 503).

Antes de desplegar, añade el binding en el panel de Cloudflare, o en un `wrangler.toml`
local que **no** se versione:

```toml
[[kv_namespaces]]
binding = "COMMENTS"
id = "<id del namespace>"
```

## Secretos

- `ADMIN_TOKEN`: token de administración. El panel lo usa como `COMMENTS_ADMIN_TOKEN` en
  Netlify; es el que acepta la versión desplegada.
- `OWNER_LOGIN`: usuario de GitHub que puede moderar (por defecto `javicordero`). El worker
  también acepta el token de GitHub del propietario, que es lo que manda el panel cuando no
  hay `COMMENTS_ADMIN_TOKEN`.
- `OWNER_LOGIN` viaja en `[vars]`; los dos tokens van como secretos del worker.

## Rutas

- `GET /?path=<ruta>`: comentarios de una página.
- `POST /?path=<ruta>`: crea un comentario (público, con rate limit por IP).
- `GET /stats?path=<ruta>`: total y completados.
- `GET /top?path=<ruta>&limit=<n>`: las peticiones más votadas (o las recientes).
- `POST /vote`: vota o retira el voto.
- `PATCH` y `DELETE` sobre un comentario: moderación; exigen `ADMIN_TOKEN` o el token de
  GitHub del propietario.

Prueba siempre un `GET` y un `POST` desde `/admin/?vista=comentarios` después de desplegar.
