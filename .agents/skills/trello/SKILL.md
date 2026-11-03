---
name: trello
description: Lee las tarjetas de la columna «Pendiente» del tablero de Trello, las pasa a «En curso», escribe el plan como comentario, implementa el cambio y las pasa a «Finalizado». Usar cuando el usuario diga "mira el trello", "coge la siguiente tarea del trello", "¿qué hay pendiente en Trello?", "haz la tarea del trello", "pasa la tarjeta a en curso/finalizado" o similar.
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Tablero de Trello

El trabajo del día a día vive en un tablero de Trello con tres columnas: **Pendiente**,
**En curso** y **Finalizado**. Este proyecto las lee y las mueve con
`scripts/trello.mjs` (API REST de Trello, credenciales en `.env`).

Tablero por defecto: `vwbp5cJ5` (`https://trello.com/b/vwbp5cJ5/acordes-gadiranos`).

## Cuándo usarla

- "mira el trello", "¿qué tengo pendiente?", "coge la siguiente tarea"
- "haz la tarjeta de X", "implementa lo del trello"
- "pasa esa tarjeta a en curso", "márcala como finalizada"

## Credenciales

En `.env` (gitignored):

```
TRELLO_KEY=...
TRELLO_TOKEN=...
TRELLO_TABLERO=vwbp5cJ5
```

Se sacan en <https://trello.com/power-ups/admin> → aplicación → **Autorización** →
**Autenticación Trello** → **Añadir** (clave + enlace «Token»; el secreto no se usa). Si
faltan, el script lo dice y sale con código 2: no inventes valores ni pidas el token en el
chat si ya está en `.env`.

Los nombres de columna se pueden redefinir con `TRELLO_LISTA_PENDIENTE`,
`TRELLO_LISTA_CURSO` y `TRELLO_LISTA_FINAL`.

## Dos caminos

- **Herramientas MCP** (`trello_*` en la sesión): existen porque `opencode.json` arranca
  `scripts/lib/mcp-trello.mjs`, que lee `.env`. Sirven para leer y mover tarjetas sueltas
  (`trello_get_list_cards`, `move_card`, `trello_add_comment`).
- **CLI** (`npm run trello`): hace el ciclo completo de una vez y devuelve texto limpio.
  Es el camino preferido para el flujo de abajo, porque `empezar` / `terminar` mueven y
  comentan en una sola llamada.

## Flujo obligatorio

1. **Leer la cola**

   ```bash
   npm run trello -- pendientes
   ```

   Si el usuario no dice cuál, se coge la **primera** de la lista (el orden del tablero).
   Si hay varias y no está claro, se listan y se pregunta; no se elige a ciegas una tarea
   grande.

2. **Leer la tarjeta entera**

   ```bash
   npm run trello -- ver <id|shortLink>
   ```

   La descripción y los comentarios son el encargo. Si falta contexto, se pregunta antes
   de tocar código.

3. **Pasarla a «En curso» antes de empezar**

   ```bash
   npm run trello -- empezar <tarjeta>
   ```

   Así se ve desde el móvil qué se está haciendo. No se empieza a editar archivos antes
   de este paso.

4. **Plan primero, siempre.** Se escribe el plan y se deja en la tarjeta **antes** de
   implementar:

   ```bash
   npm run trello -- comentar <tarjeta> --texto "$(cat .cache/plan-trello.md)"
   ```

   El plan lleva: qué hay que cambiar, en qué archivos, cómo se comprueba y qué puede
   romperse. Si el plan cambia a mitad, se comenta el cambio. Para textos largos en
   Windows, mejor `--texto-archivo .cache/plan-trello.md` que comillas anidadas.

5. **Implementar** siguiendo las reglas de `AGENTS.md` (build solo antes del commit,
   `auditar:pre` / `auditar:acordes` cuando se toquen `<pre>`, etc.).

6. **Verificar** de verdad: `npm run astro check`, los auditores que apliquen y, si toca
   interfaz, el servidor de desarrollo en el **puerto 4322** (el 4321 es del usuario).

7. **Pasar a «Finalizado»** con el resumen de lo hecho:

   ```bash
   npm run trello -- terminar <tarjeta> --texto "Hecho: …" --commit <sha>
   ```

   `--pr <url>` añade la PR si la hubo. Con `--commit` se enlaza el cambio a la tarjeta.

## Reglas

- Una tarjeta = un plan = una entrega. Nada de cerrar una tarjeta con trabajo a medias.
- Si se bloquea (falta un dato, un token, una decisión del usuario), **no** se pasa a
  Finalizado: se comenta el bloqueo y se deja en «En curso» (o se devuelve a «Pendiente»
  con `npm run trello -- mover <tarjeta> Pendiente`).
- Comentarios en español, cortos y con el resultado por delante. Markdown de Trello
  (negritas con `**`).
- No se mueven ni se cierran tarjetas que no se hayan trabajado en esta sesión sin
  pedirlo.
- `--simular` en cualquier orden de escritura enseña qué haría sin tocar el tablero:
  úsalo cuando la tarjeta no esté clara.
- Al terminar, di al usuario el título de la tarjeta, qué se ha hecho y en qué columna
  ha quedado.

## Órdenes disponibles

| Orden | Qué hace |
|---|---|
| `listas` | columnas con su id y nº de tarjetas (comprueba que existen las tres) |
| `pendientes [--json]` | tarjetas de «Pendiente» por orden del tablero |
| `ver <tarjeta>` | descripción, checklists y últimos comentarios |
| `empezar <tarjeta>` | → «En curso» + comentario |
| `terminar <tarjeta>` | → «Finalizado» + comentario (`--commit`, `--pr`) |
| `mover <tarjeta> <lista>` | mover a una columna concreta |
| `comentar <tarjeta>` | comentar sin mover |

`<tarjeta>` acepta el id, el `shortLink` o un trozo del título (si es ambiguo, lista los
candidatos y sale con código 4).
