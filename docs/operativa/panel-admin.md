# Panel `/admin` — las pestañas de la lista

Documento operativo y referencia técnica del panel. `AGENTS.md` solo apunta aquí; **lee esto
antes de tocar la lista** (`src/scripts/estudio.js` y `src/pages/admin.astro`).

## Las cuatro pestañas

Cada ficha sale **en una sola** pestaña. La clasificación combina dos datos: si está en git
(es decir, si está en la web) y si está en la cola de revisión.

| Pestaña | Qué entra |
|---|---|
| **Por revisar** | en `src/content/acordes` **y en git** (ya en la web), sin revisar |
| **Borradores** | en `src/content/borradores` **∪** `acordes` sin commit, sin revisar y **nuevas** |
| **Por publicar** | `acordes` con cambios que la web aún no tiene: sin commit (modificadas, borradas, sin push o nuevas ya revisadas) **o** en una PR abierta |
| **Publicadas** | `acordes` en git, revisadas y sin PR abierta |

```
sin revisar ─ en git ────────────→ Por revisar
            └ no git ─ nueva ────→ Borradores
                     └ modificada → Por publicar
revisada    ─ en git ────────────→ Publicadas
            └ no git ────────────→ Por publicar
```

Una ficha **publicada y modificada** (en el ordenador o desde el móvil, en una PR) ya está
en la web: lo único que falta es el commit y el push, o fusionar la PR, así que va a **Por
publicar** aunque siga en la cola de revisión (se le pone la marca `SIN REVISAR`). Solo las
**nuevas** sin revisar se quedan en **Borradores**, porque todavía no están en la web.

«En git» significa rastreado y sin cambios pendientes: lo que hay en `master` y sirve la
web. Un commit local sin push (estado `sin-push`) cuenta como no publicado.

## Cómo se avanza

| Desde | Botón | Qué hace |
|---|---|---|
| **Por revisar** | **Revisado ✓** | guarda, sale de la cola → **Publicadas** |
| **Borradores** (`acordes` sin commit y nueva) | **Revisado ✓** | guarda, sale de la cola → **Por publicar** |
| **Borradores** (`borradores`, en local) | **Revisado ✓** | guarda, sale de la cola **y lo promueve** → **Por publicar** |
| **Borradores** (`borradores`, en producción) | **Revisado ✓** | guarda y marca; **Promover** abre la PR de publicación |
| **Borradores** (`borradores`) | **Promover** | mueve a `acordes`, la saca de la cola y la deja en **Por publicar** (en producción abre la PR `publica/*`) |
| **Por publicar** (sin commit) | **Publicar / Subir** | commit + push → **Publicadas** |
| **Por publicar** (`EN PR`) | **Publicar** | fusiona la PR (squash) → **Publicadas** |

El botón va **en la fila**, sin abrir el editor. En el editor sigue estando **Revisado ✓**
en la cabecera, con el mismo efecto. **Promover** (editor) mueve a `acordes` y la marca
revisada; en producción abre la PR `publica/*` y la deja en `EN PR`.

## Guardar una ficha publicada

Guardar desde el editor una ficha de `acordes` la deja **al momento** en **Por publicar**, sin
recargar la página, porque es una corrección de algo que ya está en la web:

- **En local** escribe el `.md` en el proyecto y sale con la marca `MODIFICADA` (hará falta
  commit y push). Si el archivo queda idéntico al de git no hay nada pendiente y sigue en
  **Publicadas**.
- **En producción** guarda en una rama y sale con la marca `EN PR` (hay que fusionarla; el
  botón **Publicar** de la fila hace el squash merge).

El panel lo refresca con `/admin/api/lista?solo=pendientes` (cola de revisión + `git status`
+ PRs abiertas de fichas publicadas), sin las llamadas a GitHub de la lista completa.

## Vista previa desde el editor

La cabecera del editor lleva **Vista previa** entre **Comprobar** y **Avisos**. Abre la ficha
como la pinta la web en **otra pestaña**, para no perder el editor ni el cursor:

- en local, los borradores van a `/borradores/<slug>/` y las publicadas a `/acordes/<slug>/`
  (la misma ruta que enseña `datos-slug`);
- en producción solo se ofrece en las fichas de `acordes`: un borrador de `borradores` no está
  en el build desplegado y su vista previa es el deploy preview de la PR;
- si hay cambios sin guardar, avisa de que la vista muestra la **última versión guardada**.

## El editor

El mismo `<pre>` en texto que el revisor local, con los acordes coloreados y sugerencias.

- **Alt+←/→** mueve un acorde una columna. Con ratón se puede **arrastrar**; en móvil se
  mantiene pulsado el acorde ~350 ms y se suelta en otra columna o en otra línea de acordes
  (solo líneas de acordes). El gesto conserva `data-postura`, se puede deshacer y usa
  `moverAcordeA()` (`src/lib/editar-lineas.js`, probado en `npm run auditar:editor`).
- En la cabecera: **↶ deshacer** (`Ctrl+Z`), **✂ separar por palabras** (`Alt+Enter`) y
  **⤴ juntar por palabras** (`Alt+Retroceso`). Sobre una línea de acordes, ✂ baja el acorde
  a la siguiente línea de acordes y ⤴ lo sube a la anterior; en un verso de letra con el
  cursor en la columna 0, ✂ le crea su línea de acordes encima (`separarVerso()`) y ⤴ lo
  vuelve a juntar. Un salto de línea a mano se reajusta solo (`realinearEstructura()`), pero
  las líneas nuevas pierden la postura concreta (se avisa).
- Las columnas son **Editor · Base**. Base compara con otra ficha (mismo año y pieza primero);
  si la agrupación no tiene otra, queda vacía en escritorio y oculta en móvil, para que el
  Editor no cambie de ancho.
- El panel **Datos** (frontmatter editable) se pliega al tocar el textarea y la cabecera de
  vistas se oculta al editar. Editar los datos **no cambia el slug**: el archivo conserva su
  nombre y su URL.
- La columna 55 se marca; lo que la pasa sale en rojo. El botón **Ajustar/Ampliar** reduce la
  letra sin partir líneas. En móvil, las dos columnas son pestañas.

## De dónde sale cada dato

- **`/admin/api/lista`** (`netlify/functions/lista.mjs`): los borradores (`src/content/borradores`), las
  fichas con PR abierta, la cola de revisión y, en local, las fichas de `acordes` que no
  están en git (`git status` + `git diff origin/master..HEAD`). Una PR es de publicación si
  la rama empieza por `publica/` o si su cuerpo dice que el archivo está en `acordes/` (así
  se reconoce una corrección guardada desde el móvil, que usa una rama `estudio/*`). Con
  `?solo=pendientes` devuelve solo la cola, lo que falta subir y esas PRs: es lo que pide el
  panel tras **guardar** o **promover** para que la ficha aparezca al momento en «Por
  publicar», sin recargar.
- **`/indice-busqueda.json`**: las fichas publicadas que se compilan. Se carga en la página;
  se fusiona con la anterior **por slug** (la de la API manda en `zona`/`local`/PR y el
  índice aporta música y letra para el buscador).
- La lista marca **BORRADOR**, **LOCAL**, **EN GITHUB**, **EN PR**, **SIN REVISAR**,
  **SIN LETRA** (el `<pre>` está vacío) y **SIN ACORDES** (la letra no lleva ningún `<a>`).
  Las incompletas se ordenan arriba. En **Por publicar**, las fichas `MODIFICADA` (una
  corrección de algo ya publicado) van primero; después las `NUEVA`, las `SIN PUSH` y las
  `BORRADA`; las `EN PR` se ordenan con el resto de su mismo tipo. La marca **PROMOVIDA**
  avisa de que la ficha viene de `borradores` (se promovió y falta publicarla).

Vive en `src/scripts/estudio.js` (`esPorRevisar`, `esBorrador`, `esPorPublicar`,
`esPublicada`) y se pinta en `pintarLista()`.

## Subir en lote

En **Por publicar** cada fila lleva una casilla y la cabecera una barra con **Publicar (n)**,
**Seleccionar todo** y **Limpiar**. La selección se vacía al cambiar de pestaña, de búsqueda
o al recargar la lista, y solo abarca las fichas pintadas (máximo 300).

Al pulsar **Publicar** se separan las dos fuentes de la pestaña:

- las **`EN PR`** se fusionan una a una; si una no está en verde se **para** y se dice cuál
  (las anteriores ya están en la web);
- las **locales** van a `/admin/api/publicar-local` en **tandas de 20** (el límite del
  endpoint). Un trabajo por tanda: fechas consecutivas para las nuevas, un commit por ficha,
  un push y los avisos al final.

Las casillas **Sin tuit** y **Sin etiquetar** valen para todo el lote. **Copiar avisos** pide
el texto de cada ficha publicada y los junta en uno solo, separados por una línea.

Qué filas entran y cómo se reparten lo decide `src/lib/panel-lote.js` (puro):
`puedeSubir`, `accionDe`, `dividirLote` y `enTandas`. `npm run auditar:lote` lo prueba con
casos fijos (nueva, modificada, borrada, sin push, EN PR, borrador y lote mixto).

## La pestaña «Otra web» (solo en local)

Después de **Publicadas** hay una pestaña más, **Otra web**, que **solo se enseña en local**
(en Netlify no existe la colección provisional ni se puede mover un archivo del disco). No
forma parte del flujo de las cuatro pestañas: enseña las fichas de `src/content/otraweb`
—las importadas del cancionero, con los acordes **sin envolver en `<a>`**— para pasarlas a
borradores y revisarlas.

- La lista la devuelve `/admin/api/lista` en el campo `otraweb` (de `importadasLocales()`,
  `netlify/functions/lista.mjs`), ordenada por año y agrupación y con la marca `OTRAWEB`
  (y `SIN LETRA` si el `<pre>` está vacío; no se puede mirar «sin acordes», porque ahí van
  sin etiquetas).
- Cada fila lleva **Ver** (`/otraweb/<slug>/`, la vista previa local) y **A borradores**.
- **A borradores** llama a `POST /admin/api/importar` (`netlify/functions/importar.mjs`), que
  lanza `scripts/importar-a-borradores.mjs`: envuelve los acordes con el mismo envoltorio del
  editor (`src/lib/pre-acordes.js`), mueve el `.md` de `otraweb` a `borradores` y no toca la
  fecha. Si ya hay un borrador o una ficha publicada con ese slug, no lo pisa y avisa. Al
  terminar, el panel recarga la lista: la ficha desaparece de Otra web y aparece en
  **Borradores**.

Por CLI se puede hacer lo mismo: `npm run importar:borrador -- --slug <slug>[,<slug>]
[--dry]`.

## Las carpetas y por qué `borradores` no se quita

- **`acordes`** se compila: todo lo que hay ahí tiene página, entra en el sitemap, en
  `/lista`, en la home y en el buscador.
- **`borradores`** no se compila. Es lo único que impide que un borrador a medias salga en la
  web: no basta con git, porque los borradores también están commiteados.

Por eso una ficha **sin revisar** vive en `borradores`, y solo pasa a `acordes` cuando se
revisa (o se promueve a mano). `npm run ajustar:borradores` deja cada una en su sitio:
mueve a `borradores` las fichas de `acordes` que no están en git y siguen en la cola. Solo
mueve archivos sin rastrear; no toca contenido, no publica y no hace commit.

## Crear una ficha

**Nueva ficha** y **＋** (otra letra de la misma música) crean siempre en `borradores` con
`zona: 'borradores'`, así que aparecen en **Borradores**. En local el archivo se escribe en el
proyecto; en producción, en una rama `estudio/<slug>` con PR de borrador. Para avanzarla:
**Revisado ✓** (y en local ya queda en `acordes`, lista para **Publicar**).

## Estadísticas

`/admin/?vista=stats` pide `/admin/api/stats` (proxy del worker de Cloudflare,
D1). El contador empieza el **19/01/2026**: no hay datos anteriores.

- **Rutas más visitadas** tiene un buscador que filtra todas las rutas por
  substring, sin mayúsculas ni tildes (`glosa` encuentra `/glosario/…`). Sin
  texto enseña el top 50; con texto, todas las coincidencias (hasta 300) y el
  total de visitas de esas coincidencias.
- **Media/día** = visitas / días desde el alta. El alta es la fecha del commit
  que añadió el archivo (`git log --diff-filter=A`), nunca el campo `date` del
  frontmatter. Si el alta es anterior al contador, la media empieza el
  19/01/2026.
- Las fechas viven en `public/rutas-fechas.json`, generado por
  `scripts/rutas-fechas.ts` (`npm run fechas:rutas`). Guarda una fecha por ruta
  y `patrones` para secciones dinámicas nuevas; las fechas ya registradas no se
  mueven. Las rutas privadas (`/admin`, `/borradores`, `/otraweb`) no entran.
- Se actualiza sola: `predev` y `prebuild` lo regeneran; `publicar-acorde.mjs`
  hace un commit `fechas de rutas` al publicar; y la Action `fechas.yml` lo
  commitea tras cualquier push a master (páginas y secciones nuevas, PRs
  fusionadas desde el móvil).
- `npm run auditar:fechas` compara el registro con el sitemap del build y falla
  si falta alguna ruta; hay que ejecutar antes `npm run build`.

### Cloudflare Web Analytics

La pestaña **Cloudflare** (dentro de Estadísticas) es una segunda fuente, para
lo que D1 no guarda: **fuente por ruta**, país, dispositivo, navegador y
evolución diaria. La consulta la hace `netlify/functions/cf-analytics.mjs`
contra la GraphQL API de Cloudflare con un token de solo lectura; el token no
llega nunca al navegador.

- Variables: `CLOUDFLARE_API_TOKEN` (secreta, permiso **Account Analytics:
  Read**), `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_WA_SITE_TAG`.
- Vistas: **Hoy** (00:00 Europe/Madrid → ahora, la que abre por defecto), 7, 30 y 90 días;
  rutas con el mismo buscador, fuentes, diario, países y dispositivos. La tabla
  de rutas lleva una columna **Fuente** con las **3 principales en línea**,
  ordenadas de mayor a menor número de páginas
  (`(interno) (358) (directo) (88) Google (56)`), sin abrir nada. Al pinchar la
  celda (en móvil) o **Fuentes** se abre el detalle completo.
- Se pide con `?vista=hoy&limite=3000`, `?vista=resumen&dias=30&limite=3000` o
  `?vista=ruta&ruta=/acordes/x/&dias=30` (`&hoy=1` para el detalle de hoy). La
  respuesta se cachea 10 minutos.
- Cloudflare es **RUM**: excluye bots (`bot: 0`, como `excludeBots=Yes` del
  dashboard), muestrea y redondea. **No cuadra con D1** y no se deben sumar.
- La comparación con el contador propio solo se enseña a 30 días y a nivel
  global: D1 no guarda histórico por ruta. En la tabla de rutas, **D1 total** es
  el acumulado desde el 19/01/2026, con una ventana distinta a Cloudflare.
- En fuentes, `(directo)` e `(interno)` se miden en páginas vistas: una
  navegación interna no abre una visita nueva. Se ocultan previews de Netlify y
  localhost.
- Enlace **Abrir en Cloudflare** al dashboard de Web Analytics.

## Acceso y seguridad

- **Login**: `/admin/api/auth` → GitHub OAuth (`public_repo`) → `/admin/api/auth-callback`,
  que comprueba `OWNER_LOGIN` y deja una cookie `admin` cifrada (12 h, HttpOnly). El token de
  GitHub no llega nunca al navegador; al cambiar el usuario hay que volver a entrar.
- **`SESSION_SECRET`**: obligatorio en producción. `netlify/functions/_lib.mjs` falla cerrado
  si falta (no firma cookies ni el `state` del OAuth); en local vale el ejemplo.
- **Cabeceras**: `netlify.toml` aplica CSP, `noindex`, `nosniff`, `DENY` y `no-referrer` a
  `/admin/*`. El panel vivía en `/estudio`: Netlify responde 301 y en `astro dev` queda una
  página de salto que conserva la query.
- **Comentarios**: `/admin/api/comentarios` manda al worker el token de la sesión. Si hay
  `COMMENTS_ADMIN_TOKEN` usa ese (la versión desplegada del worker solo acepta ese) y
  reintenta con el otro en un 401. Al redesplegar el worker, mira
  `workers/comments-worker/README.md`: hay que conservar el binding `COMMENTS`.
- **XSS**: en el panel el HTML se monta por strings, así que se escapa siempre con
  `escaparHtml()` (`src/lib/escape.js`). En la web pública los comentarios se pintan con
  `textContent`/`dataset`, nunca con `innerHTML`. Lo comprueba `npm run auditar:comentarios`.
- Variables en Netlify: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (secreta),
  `SESSION_SECRET` (secreta) y `OWNER_LOGIN`. El callback de la OAuth App tiene que ser
  `https://acordesgaditanos.com/admin/api/auth-callback`. Para la pestaña Cloudflare:
  `CLOUDFLARE_API_TOKEN` (secreta), `CLOUDFLARE_ACCOUNT_ID` y
  `CLOUDFLARE_WA_SITE_TAG`.

## Local y producción

- En **local** (`astro dev`, `ESTUDIO_LOCAL=1`) todo se escribe en el disco y no se crean
  PR. «Por publicar» enseña lo que hay sin commit (`git status`) y, si quedó alguna PR
  abierta (una edición hecha desde el móvil), también, para poder fusionarla. Después de
  fusionar hay que hacer `git pull`.
- En **producción** (Netlify) no hay working tree: «Por publicar» enseña solo las PRs abiertas
  de fichas ya publicadas y «Borradores» se queda en los `borradores`. Guardar abre/actualiza
  una PR `estudio/*`; **Promover** abre una `publica/*`.

## Avisos al publicar

Al pulsar **Publicar** en «Por publicar» (solo local) se abre un diálogo con las opciones de
aviso:

- **Sin tuit**: solo se manda WhatsApp.
- **Sin etiquetar a nadie en el tuit**: el tuit sale sin etiquetas.
- Sin marcar nada: WhatsApp y X normales.

Las casillas se recuerdan en `localStorage`. Al publicar:

1. El commit y el push disparan **Telegram** solos (`difundir.yml`).
2. Al terminar, el panel lanza los canales marcados (`publicar-acorde.mjs --avisar`).
   Necesitan tu Chrome con la sesión abierta.
3. Si alguno falla, la ficha **queda publicada igual**: el panel dice cuál ha fallado y
   **Copiar aviso** deja el texto para mandarlo a mano.

Las fichas `MODIFICADA`, `SIN PUSH` que no son nuevas y `BORRADA` no llevan aviso: el diálogo
lo dice y no se lanza nada. Desde Netlify no se puede lanzar ninguno (no hay navegador ni
sesión): allí solo se publica (PR) y el texto queda para copiar.

## Las mismas acciones por CLI

- `npm run prs` lista las PRs abiertas del panel (`estudio/*`, `publica/*` y `letras/*`).
  `npm run prs -- --merge [--si]` fusiona con squash las de borrador y las de letra;
  `--todas` incluye las de publicar (eso publica y avisa). Necesita `GITHUB_TOKEN` en `.env`
  (permiso `public_repo` o `repo`) o `gh` autenticado. Después, `git pull`.
- `npm run promover -- --slug <slug>[,<slug>] | --todos [--dry]` pasa un borrador de
  `borradores` a `acordes`, le pone la fecha del día y borra el borrador. Después,
  `auditar:pre`, `auditar:acordes` y el commit con `subir-acorde`.

## Comprobarlo

```bash
npm run ajustar:borradores -- --dry   # qué fichas están fuera de sitio y los 4 recuentos
npm run revisar -- --auditar          # la cola apunta a fichas que existen
npm run astro check
```

Los cuatro recuentos tienen que sumar el total de fichas (`acordes` + `borradores`).
