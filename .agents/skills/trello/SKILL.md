---
name: trello
description: Lee las tarjetas de la columna «Pendiente» del tablero de Trello, las pasa a «En curso», escribe el plan como comentario y PARA. Solo implementa y pasa a «Finalizado» cuando el usuario aprueba el plan. Las tarjetas de letras nuevas se hacen directamente, sin plan previo. Usar cuando el usuario diga "mira el trello", "coge la siguiente tarea del trello", "¿qué hay pendiente en Trello?", "planifica la tarea del trello", "implementa el plan aprobado", "pasa la tarjeta a en curso/finalizado", o cuando la tarjeta pida una letra nueva («nueva letra comparsa el cementerio», «pasodoble el cementerio»).
license: MIT
metadata:
  author: local
  version: "1.3"
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
- una tarjeta que pide una letra nueva: «nueva letra comparsa el cementerio», «pasodoble el cementerio»

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

**Comentar siempre con el CLI.** Trello no notifica tus propias acciones, así que el
comentario tiene que escribirlo la **cuenta bot** (`TRELLO_BOT_KEY` / `TRELLO_BOT_TOKEN` en
`.env`): es lo que hace `scripts/trello.mjs` al comentar, y además le añade `@<usuario>` al
final (`TRELLO_AVISAR_A`, por defecto `javicordero1`) porque sin mención Trello no avisa de
un comentario en una tarjeta de la que no eres miembro. Si faltan las claves del bot no se
rompe nada, pero el comentario no enciende la campanita (el CLI lo advierte).

## Flujo obligatorio

> **Antes de nada, leer la tarjeta entera.** El orden es siempre: **título → descripción
> → comentarios** (de más antiguo a más nuevo). Muchas veces el encargo de verdad está en
> tu comentario, no en el título, y corrige lo que dice la descripción. No se mueve la
> tarjeta, no se planifica y no se toca nada hasta haber leído las tres partes.
>
> **Primero se planifica y se para.** «Siguiente tarea del Trello», «coge la siguiente»,
> «mira qué hay pendiente» son órdenes de **planificar**, no de implementar. Sin un
> «adelante» explícito del usuario no se edita ni un archivo.
>
> **Excepción: tarjetas de letras.** Si la tarjeta pide una letra nueva, se hace el flujo
> de «Tarjetas de letras» **directamente, sin plan previo**, y solo se para para preguntar
> (base, letra o ambigüedad). El barrido de la cola de letras pendientes es otra tarea.

1. **Leer la cola**

   ```bash
   npm run trello -- pendientes
   ```

   Si el usuario no dice cuál, se coge la **primera** de la lista: primero las de
   **Prioritarias** y después las de **Pendiente**, y dentro de cada columna la **más
   antigua** (la cola va por fecha de creación, no por la posición en la columna, porque
   Trello apila las nuevas arriba). Si hay varias y no está claro, se listan y se pregunta;
   no se elige a ciegas una tarea grande.

2. **Leer la tarjeta entera, en orden: título → descripción → comentarios**

   ```bash
   npm run trello -- ver <id|shortLink>
   ```

   Cada parte es un encargo distinto y se leen **las tres antes de hacer nada**:

   1. **Título**: qué pide la tarjeta en corto (a veces es todo el texto, porque el usuario
      escribe la tarea entera ahí).
   2. **Descripción**: el detalle, los enlaces y las capturas.
   3. **Comentarios**: **los lee todos**, de más antiguo a más nuevo. Tu comentario suele
      llevar la corrección, el criterio o el «esto al final no» que no está en el título ni
      en la descripción. Manda sobre lo anterior cuando se contradicen.

   `ver` los saca enteros desde la versión 1.3 del script (antes los recortaba a 300
   caracteres). Si una tarjeta tiene muchísimos, `--limite N`; `--breve` vuelve al resumen.
   Con `--json` sale el objeto crudo de Trello (útil si el texto trae comillas raras).

   Si después de las tres partes falta contexto, se pregunta **en el plan**, no se rellena a
   base de suposiciones.

3. **Pasarla a «En curso»** (solo la que se va a trabajar)

   Antes de moverla, si el título es largo (el usuario suele escribirlo todo en el título),
   límpialo con `titular`, que pasa el título largo a la descripción y le antepone un número:

   ```bash
   npm run trello -- titular <tarjeta> --titulo "Título corto con sentido"
   ```

   El número (`#1`, `#2`…) sale solo del contador de `.cache/trello-contador.json`. Si el
   título ya es corto y claro, no hace falta.

   ```bash
   npm run trello -- empezar <tarjeta> --texto "🤖 En curso: preparando el plan"
   ```

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
   antes del commit, `auditar:pre` / `auditar:acordes` cuando se toquen `<pre>`, etc.), sin
   commit ni push. Si aparece algo que no estaba en el plan y cambia el alcance, se para y
   se comenta antes de seguir.

7. **Verificar** de verdad: `npm run astro check`, los auditores que apliquen y, si toca
   interfaz, el servidor de desarrollo en el **puerto 4322** (el 4321 es del usuario).

8. **Comentar «ya está implementado» y quedarse en «En curso».** No se hace commit, ni push,
   ni se pasa a «Finalizado» todavía:

   ```bash
   npm run trello -- comentar <tarjeta> --texto "🤖 Ya está implementado: …"
   ```

9. **Cerrar solo cuando el usuario lo diga:**

   - «haz commit y push» (o «sube», «publícalo») → commit + push (skill `subir-acorde` si
     toca) y **después**:

     ```bash
     npm run trello -- terminar <tarjeta> --texto "Hecho: …" --commit <url-del-commit>
     ```

     `--commit` lleva la **URL completa del commit** (p. ej.
     `https://github.com/<repo>/commit/<sha>`), no solo el sha. `--pr <url>` añade la PR si
     la hubo. Se da el enlace del commit en el comentario y en el chat.

   - «finaliza sin commit» → se pasa a «Finalizado» directamente con el resumen, sin commit.
     También van directas las tareas que no llevan commit (p. ej. las letras nuevas).

## Tarjetas de letras

Una tarjeta puede pedir una **letra nueva** en vez de una tarea de código. No hace falta
formato: vale «nueva letra comparsa el cementerio», «pasodoble el cementerio» o
«letra de <frase>». La descripción puede traer la letra entera, una URL, frases sueltas o
nada.

El panel `/admin` **no se toca**: sigue siendo el sitio donde revisas y publicas.

### Reconocer la copla

```bash
npm run letras -- reconocer "<título + descripción>"
npm run letras -- reconocer "<...>" --json
```

Devuelve agrupación, año, pieza, fichas y **base propuesta** (el pasodoble original de la
misma música), y avisa si la letra ya existe o si el título ya está en otra ficha. Si no
hay candidata clara o la base es dudosa, se pregunta en la tarjeta.

Si la pieza no es un pasodoble, el script avisa: las letras alternativas solo están
previstas para pasodobles (`TIPOS_CON_LETRAS`).

### Flujo

1. **Leer la tarjeta**: `npm run trello -- ver <id>`, en orden **título → descripción →
   comentarios**. La letra puede venir en cualquiera de los tres: en el título («pasodoble
   el cementerio»), en la descripción o pegada en un comentario. Si es larga, `--json` (el
   resumen normal solo recorta con `--breve`).
2. **Reconocer** con el título y la descripción juntos.
3. **Si ya existe** la letra, comenta cuál es la ficha y para. No se duplica.
4. **Apuntarla en la cola**:

   ```bash
   npm run letras -- anadir "<frase o título>" --agrupacion "<...>" --base <slug> --notas "tarjeta <url>"
   ```

5. **Conseguir la letra**:
   - pegada en la tarjeta → guárdala tal cual en `.cache/letra-<n>.txt`;
   - URL de letrasdecarnaval → `npm run letra:decarnaval -- <url>`;
   - otra URL → `npm run letra:web -- <url> --desde "<primera frase>" --salida .cache/letra-<n>.txt`;
   - Blogger → `npm run letra:blog -- "<frase>" [--agrupacion "<...>"]`;
   - sin pistas → buscar por la frase y la agrupación.

   Se acepta solo si la frase aparece literal y la agrupación y el año cuadran; se
   descartan traducciones y montajes.
6. **Poner los acordes** con la skill `letra-alternativa`: `acordes:plan`, reparto verso a
   verso, `acordes:aplicar` (escribe en `acordes` por defecto). Lee el informe y corrige
   los `⚠️` antes de seguir.
7. **Cerrar**:

   ```bash
   npm run letras -- estado <n> "con acordes" --ficha <slug> --fuente <url>
   npm run revisar -- --anadir <slug>
   npm run auditar:letras
   ```

   `auditar:letras` comprueba el grupo; `auditar:pre` y `auditar:acordes` si se han tocado
   los `<pre>`.
8. **Comentar** en la tarjeta: copla, base, fuente, informe (exactos / ±1 / >1), ruta del
   `.md` y que está en «Por revisar». Después, **Finalizado**: la ficha queda guardada en
   local y tú la publicas cuando quieras (`subir-acorde` o panel).
9. **Si falta la base, la letra o hay varias candidatas**: comenta la pregunta y deja la
   tarjeta en «En curso». No inventes una base ni una letra.

El barrido de la cola (pasar todas las `pendiente`/`encontrada` por el flujo) es **otra
tarea**: no se hace al atender una tarjeta de letra.

## Reglas

- **Antes de mover, planificar o tocar nada**: título, descripción y **todos** los
  comentarios de la tarjeta. Si el comentario contradice al título o a la descripción, manda
  el comentario.
- **Nunca** se implementa en el mismo turno en que se planifica, salvo que el usuario lo
  pida explícitamente («planifícalo y hazlo»). **Las tarjetas de letras son la excepción**:
  se hacen directamente, sin plan previo.
- Una tarjeta = un plan = una entrega. Nada de cerrar una tarjeta con trabajo a medias.
- **No se pasa a «Finalizado» hasta que el usuario lo diga**: se implementa sin commit, se
  comenta «ya está implementado» y se espera. Se cierra con «haz commit y push» (commit +
  push + `terminar` con la URL del commit) o con «finaliza sin commit» (o si la tarea no
  lleva commit, como las letras nuevas).
- Si se bloquea (falta un dato, un token, una decisión del usuario), **no** se pasa a
  Finalizado: se comenta el bloqueo y se deja en «En curso».
- Si el usuario descarta el plan, la tarjeta vuelve a «Pendiente» y se comenta por qué.
- Para reabrir una tarjeta ya finalizada: se arrastra de «Finalizado» a «Pendiente» en
  Trello y se trata como nueva; `ver <tarjeta>` (o `ver <tarjeta> --json`) recupera el
  resumen y los comentarios anteriores.
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
| `ver <tarjeta>` | título, descripción, checklists y comentarios enteros (de más antiguo a más nuevo; `--limite N`, `--breve`, `--json`) |
| `empezar <tarjeta>` | → «En curso» (al final de la columna) + comentario |
| `terminar <tarjeta>` | → «Finalizado» (al final de la columna) + comentario (`--commit`, `--pr`) |
| `mover <tarjeta> <lista>` | mover al final de una columna concreta |
| `comentar <tarjeta>` | comentar sin mover |
| `titular <tarjeta> --titulo …` | título largo → descripción + título corto numerado |

`<tarjeta>` acepta el id, el `shortLink` o un trozo del título (si es ambiguo, lista los
candidatos y sale con código 4).
