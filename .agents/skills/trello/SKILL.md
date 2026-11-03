---
name: trello
description: Lee las tarjetas de la columna «Pendiente» del tablero de Trello, las pasa a «En curso», escribe el plan como comentario y PARA. Solo implementa y pasa a «Finalizado» cuando el usuario aprueba el plan. Usar cuando el usuario diga "mira el trello", "coge la siguiente tarea del trello", "¿qué hay pendiente en Trello?", "planifica la tarea del trello", "implementa el plan aprobado", "pasa la tarjeta a en curso/finalizado" o similar.
license: MIT
metadata:
  author: local
  version: "1.1"
---

# Tablero de Trello

El trabajo del día a día vive en un tablero de Trello con tres columnas: **Pendiente**,
**En curso** y **Finalizado**. Este proyecto las lee y las mueve con
`scripts/trello.mjs` (API REST de Trello, credenciales en `.env`).

Tablero por defecto: `vwbp5cJ5` (`https://trello.com/b/vwbp5cJ5/acordes-gadiranos`).

## Cuándo usarla

- "mira el trello", "¿qué tengo pendiente?", "coge la siguiente tarea"
- "haz la tarjeta de X", "planifica lo del trello"
- "adelante con el plan", "implementa esto"
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

> **Primero se planifica y se para.** «Siguiente tarea del Trello», «coge la siguiente»,
> «mira qué hay pendiente» son órdenes de **planificar**, no de implementar. Sin un
> «adelante» explícito del usuario no se edita ni un archivo.

1. **Leer la cola**

   ```bash
   npm run trello -- pendientes
   ```

   Si el usuario no dice cuál, se coge la **primera** de la lista: primero las de
   **Prioritarias** y después las de **Pendiente**, y dentro de cada columna la **más
   antigua** (la cola va por fecha de creación, no por la posición en la columna, porque
   Trello apila las nuevas arriba). Si hay varias y no está claro, se listan y se pregunta;
   no se elige a ciegas una tarea grande.

2. **Leer la tarjeta entera**

   ```bash
   npm run trello -- ver <id|shortLink>
   ```

   La descripción y los comentarios son el encargo. Si falta contexto, se pregunta **en el
   plan**, no se rellena a base de suposiciones.

3. **Pasarla a «En curso» y renombrar la sesión** (solo la que se va a trabajar)

   ```bash
   npm run trello -- empezar <tarjeta> --texto "En curso: preparando el plan"
   ```

   Y en cuanto se sepa el encargo, se renombra la pestaña de la sesión con el título de la
   tarjeta, en corto: `Trello: <título de la tarjeta>` (3-6 palabras, sin id). Así la
   pestaña dice qué se está haciendo en vez de «siguiente tarea trello».

   Si el usuario pide el plan de **varias** tarjetas a la vez para comparar, no se mueve
   ninguna.

4. **Escribir el plan, en modo plan.** Sin editar archivos, sin builds, sin comandos que
   cambien el repo: solo lectura. El plan se entrega en el chat **y** se deja como
   comentario en la tarjeta:

   ```bash
   npm run trello -- comentar <tarjeta> --texto-archivo .cache/plan-trello.md
   ```

   Estructura del plan:

   - **Objetivo**: qué problema se resuelve y cómo se sabrá que está bien.
   - **Cambios**: archivo por archivo, qué se toca.
   - **Pasos**: en orden.
   - **Comprobación**: qué comandos (`astro check`, auditores, dev en el 4322) y qué se
     mira a mano.
   - **Riesgos y dudas**: lo que puede romperse y las preguntas abiertas.

   Para textos largos en Windows, mejor `--texto-archivo .cache/plan-trello.md` que
   comillas anidadas.

5. **Parar y pedir aprobación.** El turno termina con el plan y una pregunta clara
   («¿lo implemento así?»). No se encadenan los pasos 6-8 en el mismo turno.

   - Cuenta como aprobación: «adelante», «dale», «implementa», «hazlo».
   - **No** cuenta: silencio, un «ok» suelto cuando el plan llevaba preguntas abiertas, o
     responder solo a una de las dudas.
   - Si el usuario corrige el plan, se reescribe el plan, se vuelve a comentar y se para
     otra vez.

6. **Implementar** solo tras la aprobación, siguiendo las reglas de `AGENTS.md` (build solo
   antes del commit, `auditar:pre` / `auditar:acordes` cuando se toquen `<pre>`, etc.). Si
   aparece algo que no estaba en el plan y cambia el alcance, se para y se comenta antes de
   seguir.

7. **Verificar** de verdad: `npm run astro check`, los auditores que apliquen y, si toca
   interfaz, el servidor de desarrollo en el **puerto 4322** (el 4321 es del usuario).

8. **Pasar a «Finalizado»** con el resumen de lo hecho:

   ```bash
   npm run trello -- terminar <tarjeta> --texto "Hecho: …" --commit <sha>
   ```

   `--pr <url>` añade la PR si la hubo. Con `--commit` se enlaza el cambio a la tarjeta.

## Reglas

- **Nunca** se implementa en el mismo turno en que se planifica, salvo que el usuario lo
  pida explícitamente («planifícalo y hazlo»).
- Una tarjeta = un plan = una entrega. Nada de cerrar una tarjeta con trabajo a medias.
- Si se bloquea (falta un dato, un token, una decisión del usuario), **no** se pasa a
  Finalizado: se comenta el bloqueo y se deja en «En curso».
- Si el usuario descarta el plan, la tarjeta vuelve a «Pendiente» y se comenta por qué.
- Comentarios en español, cortos y con el resultado por delante. Markdown de Trello
  (negritas con `**`).
- No se mueven ni se cierran tarjetas que no se hayan trabajado en esta sesión sin
  pedirlo.
- **«Despriorizadas» no se toca nunca**: ni se planifica ni se implementa lo que esté en esa
  columna. Si una tarjeta sale de ahí a Pendiente o Prioritarias, entonces sí, y se trata
  como nueva.
- `--simular` en cualquier orden de escritura enseña qué haría sin tocar el tablero:
  úsalo cuando la tarjeta no esté clara.
- Al terminar, di al usuario el título de la tarjeta, qué se ha hecho y en qué columna
  ha quedado.

## Órdenes disponibles

| Orden | Qué hace |
|---|---|
| `listas` | columnas con su id y nº de tarjetas (comprueba que existen las tres) |
| `pendientes [--json]` | tarjetas de «Pendiente», de la más antigua a la más nueva |
| `ver <tarjeta>` | descripción, checklists y últimos comentarios |
| `empezar <tarjeta>` | → «En curso» + comentario |
| `terminar <tarjeta>` | → «Finalizado» + comentario (`--commit`, `--pr`) |
| `mover <tarjeta> <lista>` | mover a una columna concreta |
| `comentar <tarjeta>` | comentar sin mover |

`<tarjeta>` acepta el id, el `shortLink` o un trozo del título (si es ambiguo, lista los
candidatos y sale con código 4).
