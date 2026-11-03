# push-worker

Worker de Cloudflare con las **suscripciones de los avisos push** de la PWA.
Solo guarda, lista y borra suscripciones; el envío de las notificaciones lo hace
`scripts/push.mjs` (Node + `web-push`) desde la GitHub Action.

## Despliegue (a mano, sin wrangler)

No hay `wrangler.toml` a propósito: el binding del KV se declara en el panel y un
`wrangler deploy` desde el repo lo borraría (es lo que pasó con `comments-worker`).

1. **KV**: *Storage & Databases* → *Workers KV* → **Create a KV namespace** →
   nombre `PUSH`. Sin claves: las escribe el worker.
2. **Worker**: *Workers & Pages* → *Create* → *Create application* →
   *Start with Hello World!* → nombre `push-worker` → **Deploy**.
3. **Binding**: worker → *Settings* → *Bindings* → **Add** → *KV namespace* →
   variable name `PUSH`, namespace `PUSH` → **Save**.
4. **Secreto**: misma pantalla → **Add** → *Secret* → nombre
   `PUSH_SEND_TOKEN` → valor aleatorio
   (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
5. **Código**: *Edit code* → borrar el ejemplo → pegar `src/index.js` → **Deploy**.
6. **Comprobar**: `https://push-worker.<subdominio>.workers.dev/count` →
   `{"total":0}`. Y en *Settings* → *Domains & Routes*, `workers.dev` activo.

Cada cambio en `src/index.js` hay que volver a pegarlo en el editor del panel.

## Rutas

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `GET /count` | público | `{ total }` de suscriptores |
| `POST /subscribe` | navegador | guarda `{endpoint, keys:{p256dh,auth}}` (idempotente) |
| `POST /unsubscribe` | navegador | borra por `endpoint` |
| `GET /subs?limit=200&cursor=…` | Bearer `PUSH_SEND_TOKEN` | lista paginada `{subs, cursor}` |
| `DELETE /subs/:id` | Bearer `PUSH_SEND_TOKEN` | borra por id (suscripciones muertas, 404/410) |

Los POST del navegador solo se aceptan desde `https://acordesgaditanos.com` y
desde `localhost:4321-4323` (para probar en el 4322/4323) y tienen un límite de
20 peticiones por IP y hora. La clave de KV es `sub:<sha256(endpoint)>`, así que
repetir la suscripción no duplica registros.

## Variables

| Nombre | Tipo | Para qué |
| --- | --- | --- |
| `PUSH` | binding KV | suscripciones |
| `PUSH_SEND_TOKEN` | secreto | autoriza `/subs` y `DELETE /subs/:id` |
