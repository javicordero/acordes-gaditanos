# Panel `/admin` — las pestañas de la lista

Documento operativo y referencia técnica del panel. `AGENTS.md` solo apunta aquí; **lee esto
antes de tocar la lista** (`src/scripts/estudio.js` y `src/pages/admin.astro`).

## Las cuatro pestañas

Cada ficha sale **en una sola** pestaña. La clasificación combina dos datos: si está en git
(es decir, si está en la web) y si está en la cola de revisión.

| Pestaña | Qué entra |
|---|---|
| **Por revisar** | en `src/content/acordes` **y en git** (ya en la web), sin revisar |
| **Borradores** | en `src/content/acordes3` **∪** `acordes` sin commit, sin revisar y **nuevas** |
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
| **Borradores** (`acordes3`, en local) | **Revisado ✓** | guarda, sale de la cola **y lo promueve** → **Por publicar** |
| **Borradores** (`acordes3`, en producción) | **Revisado ✓** | guarda y marca; **Promover** abre la PR de publicación |
| **Por publicar** (sin commit) | **Publicar / Subir** | commit + push → **Publicadas** |
| **Por publicar** (`EN PR`) | **Publicar** | fusiona la PR (squash) → **Publicadas** |

El botón va **en la fila**, sin abrir el editor. En el editor sigue estando **Revisado ✓**
en la cabecera, con el mismo efecto. **Promover** (editor) mueve a `acordes` sin marcar
revisado.

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

- en local, los borradores van a `/acordes3/<slug>/` y las publicadas a `/acordes/<slug>/`
  (la misma ruta que enseña `datos-slug`);
- en producción solo se ofrece en las fichas de `acordes`: un borrador de `acordes3` no está
  en el build desplegado y su vista previa es el deploy preview de la PR;
- si hay cambios sin guardar, avisa de que la vista muestra la **última versión guardada**.

## De dónde sale cada dato

- **`/admin/api/lista`** (`netlify/functions/lista.mjs`): los borradores (`acordes3`), las
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
  avisa de que la ficha viene de `acordes3` (se promovió y falta publicarla).

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

## La pestaña «Acordes2» (solo en local)

Después de **Publicadas** hay una pestaña más, **Acordes2**, que **solo se enseña en local**
(en Netlify no existe la colección provisional ni se puede mover un archivo del disco). No
forma parte del flujo de las cuatro pestañas: enseña las fichas de `src/content/acordes2`
—las importadas del cancionero, con los acordes **sin envolver en `<a>`**— para pasarlas a
borradores y revisarlas.

- La lista la devuelve `/admin/api/lista` en el campo `acordes2` (de `importadasLocales()`,
  `netlify/functions/lista.mjs`), ordenada por año y agrupación y con la marca `ACORDES2`
  (y `SIN LETRA` si el `<pre>` está vacío; no se puede mirar «sin acordes», porque ahí van
  sin etiquetas).
- Cada fila lleva **Ver** (`/acordes2/<slug>/`, la vista previa local) y **A borradores**.
- **A borradores** llama a `POST /admin/api/importar` (`netlify/functions/importar.mjs`), que
  lanza `scripts/importar-a-borradores.mjs`: envuelve los acordes con el mismo envoltorio del
  editor (`src/lib/pre-acordes.js`), mueve el `.md` de `acordes2` a `acordes3` y no toca la
  fecha. Si ya hay un borrador o una ficha publicada con ese slug, no lo pisa y avisa. Al
  terminar, el panel recarga la lista: la ficha desaparece de Acordes2 y aparece en
  **Borradores**.

Por CLI se puede hacer lo mismo: `npm run importar:borrador -- --slug <slug>[,<slug>]
[--dry]`.

## Las carpetas y por qué `acordes3` no se quita

- **`acordes`** se compila: todo lo que hay ahí tiene página, entra en el sitemap, en
  `/lista`, en la home y en el buscador.
- **`acordes3`** no se compila. Es lo único que impide que un borrador a medias salga en la
  web: no basta con git, porque los borradores también están commiteados.

Por eso una ficha **sin revisar** vive en `acordes3`, y solo pasa a `acordes` cuando se
revisa (o se promueve a mano). `npm run ajustar:borradores` deja cada una en su sitio:
mueve a `acordes3` las fichas de `acordes` que no están en git y siguen en la cola. Solo
mueve archivos sin rastrear; no toca contenido, no publica y no hace commit.

## Crear una ficha

**Nueva ficha** y **＋** (otra letra de la misma música) crean siempre en `acordes3` con
`zona: 'acordes3'`, así que aparecen en **Borradores**. En local el archivo se escribe en el
proyecto; en producción, en una rama `estudio/<slug>` con PR de borrador. Para avanzarla:
**Revisado ✓** (y en local ya queda en `acordes`, lista para **Publicar**).

## Local y producción

- En **local** (`astro dev`, `ESTUDIO_LOCAL=1`) todo se escribe en el disco y no se crean
  PR. «Por publicar» enseña lo que hay sin commit (`git status`) y, si quedó alguna PR
  abierta (una edición hecha desde el móvil), también, para poder fusionarla. Después de
  fusionar hay que hacer `git pull`.
- En **producción** (Netlify) no hay working tree: «Por publicar» enseña solo las PRs abiertas
  de fichas ya publicadas y «Borradores» se queda en los `acordes3`. Guardar abre/actualiza
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

## Comprobarlo

```bash
npm run ajustar:borradores -- --dry   # qué fichas están fuera de sitio y los 4 recuentos
npm run revisar -- --auditar          # la cola apunta a fichas que existen
npm run astro check
```

Los cuatro recuentos tienen que sumar el total de fichas (`acordes` + `acordes3`).

## Apuntes técnicos de implementación (referencia del antiguo AGENTS.md)

### Contexto, acceso y seguridad
Panel privado desplegado con Netlify Functions. Vive en `/admin`: `noindex`, sin enlaces desde la web y fuera del sitemap. Solo entra el propietario (`OWNER_LOGIN`) con GitHub. Tiene tres secciones con la misma sesión: **Editor**, **Estadísticas** y **Comentarios**. `/admin/stats` y `/admin/comentarios` redirigen a `/admin/?vista=stats` y `/admin/?vista=comentarios`. Las estadísticas pasan por `/admin/api/stats` (el worker no manda CORS). Los comentarios pasan por `/admin/api/comentarios`, que manda el **token de GitHub de la sesión**; el worker de comentarios (proyecto `acordes-gaditanos-pwa`) comprueba con la API de GitHub que el usuario es el propietario. No hay un segundo login ni un token que pedir en el navegador.

- **Login**: `/admin/api/auth` → GitHub OAuth (`public_repo`) → `/admin/api/auth-callback`, que comprueba el usuario y deja una cookie cifrada (12 h) con el token. El token no llega nunca al navegador. La cookie se llama `admin`; al cambiar el nombre hay que volver a entrar una vez.
- **Seguridad**: `netlify.toml` manda CSP y cabeceras (`noindex`, `nosniff`, `DENY`, `no-referrer`) en `/admin/*`. `SESSION_SECRET` es obligatorio en producción (sin él, `_lib.mjs` falla cerrado y no firma cookies ni el `state`); en local se mantiene el valor de ejemplo. El panel vivía en `/estudio`: Netlify responde 301 a `/admin` y en `astro dev` queda una página de salto que conserva la query.
- **Listado**: buscador + pestañas `Todas`, `Por revisar` (ya en la web, les falta el repaso a mano), `Borradores` (aún no están en la web), `Por publicar` (en `acordes`, revisadas o modificadas y sin commit, o con una PR abierta) y `Publicadas`, agrupadas por año y con lo pendiente arriba. Cada ficha sale en **una sola** pestaña y la fila lleva **Revisado ✓** (la marca y, si es un borrador en local, la promueve), **Publicar** (en las que ya están en `acordes`), **Editar** y **＋** (crear otra ficha a partir de esa misma música). La clasificación se detalla en «Las cuatro pestañas» más arriba. Los estilos de la página van con `<style is:global>`: el HTML que pinta el JS no lleva el `data-astro-cid` y con estilos *scoped* la lista salía sin ellos.
- **Acordes2** (solo en local): pestaña después de `Publicadas` con las fichas de `src/content/acordes2` (importadas del cancionero, con los acordes sin envolver). **A borradores** envuelve los acordes y mueve la ficha a `acordes3` con `scripts/importar-a-borradores.mjs` (`POST /admin/api/importar`), así que aparece en **Borradores** para revisarla; **Ver** abre su vista previa `/acordes2/<slug>/`. En Netlify la pestaña no sale: la función responde 501.
- **Por publicar** (local y producción): pestaña con las fichas de `acordes` que la web todavía no tiene. En local, lo que está en el ordenador pero aún no en git: nuevas (`??`), modificadas, borradas o en commits locales sin push (`lista.mjs` lo calcula con `git status`/`git diff`). En los dos modos, las fichas con una **PR abierta** (una corrección guardada desde el móvil): salen como `EN PR` y su **Publicar** fusiona la PR con squash (en producción es la única fuente de la pestaña). Las nuevas salen como `NUEVA` (con la fecha que se les asignará); el resto, `MODIFICADA`, `BORRADA` o `SIN PUSH`. Una ficha **publicada y modificada** entra aquí aunque siga en la cola de revisión (va con la marca `SIN REVISAR`); solo las **nuevas** sin revisar se quedan en Borradores. Al **guardar** en el editor una ficha de `acordes` aparece al momento en esta pestaña, sin recargar: el panel refresca cola + `git status` + PRs con `/admin/api/lista?solo=pendientes`. Cada fila de las de local lleva **Ver**, que abre en la misma pestaña la ficha tal como la pinta el `astro dev` (`/acordes/<slug>/`, sin anuncios; se vuelve con «atrás» y la pestaña de la lista se recupera porque se guarda en `sessionStorage`); una ficha `BORRADA` no lo lleva porque ya no está en el disco.
- **Vista previa**: la cabecera del editor lleva **Vista previa** entre **Comprobar** y **Avisos**; abre la ficha como la pinta la web en otra pestaña para no perder el editor (en local, `/acordes3/<slug>/` si es borrador y `/acordes/<slug>/` si ya está publicada; en producción solo las publicadas, porque un borrador no está en el build). Si hay cambios sin guardar, avisa de que la vista muestra la última versión guardada.
- **Publicar en local**: botón por fila **y subida en lote** (ver el punto siguiente), que abre un diálogo con **Sin tuit** y **Sin etiquetar** (recordadas en `localStorage`). Ejecuta `scripts/publicar-acorde.mjs`: ajusta la fecha de las nuevas (día siguiente al último de `HEAD`), limpia los espacios finales de línea del `<pre>` de cada ficha del plan (no commitea si quedara alguno), pasa `auditar:pre` y `auditar:acordes`, hace un commit por ficha (solo sus rutas, con la baja de `acordes3` si toca) y push. Telegram avisa solo y, al terminar, el panel lanza **WhatsApp y X** desde el PC (`--avisar`, con `--sin-x` / `--sin-etiquetas` según las casillas; necesitan tu Chrome con sesión). Si un aviso falla, la ficha queda publicada igual, el panel dice **cuál** ha fallado y **Copiar aviso** sigue dejando el texto para mandarlo a mano. Solo funciona con `astro dev` (en Netlify la función responde 501, y las fichas de `acordes3` se publican con **Promover**, que solo abre la PR).
- **Subir en lote**: en «Por publicar», cada fila lleva una casilla y la cabecera una barra con **Publicar (n)**, **Seleccionar todo** y **Limpiar**; la selección se vacía al cambiar de pestaña o de búsqueda. Separa las `EN PR` (se fusionan una a una y se para al primer error, diciendo cuál) de las locales (un solo trabajo de `/admin/api/publicar-local`), que van en **tandas de 20** porque es su límite. Fechas, commits y avisos los sigue calculando `publicar-acorde.mjs`; **Copiar avisos** junta los textos de todas. Qué filas entran lo decide `src/lib/panel-lote.js` (puro) y lo prueba `npm run auditar:lote`.
- **Por revisar**: la cola vive en `src/data/revision-acordes.json` (`pendientes: [slug]`), la lee `lista.mjs` y la comparte `npm run revisar` (`--marcar`, `--anadir`, `--auditar`, `--sincronizar` desde `pendientes-revision.md`). Vale para fichas de `acordes` y de `acordes3`. El botón **Revisado ✓** está en la fila de la lista y en el editor: guarda, quita la copla de la cola y, si es un borrador en local, lo **promueve** a `acordes` (queda en «Por publicar»); en producción solo marca y la PR se fusiona desde el editor. `npm run ajustar:borradores [--dry]` deja cada ficha en su carpeta: mueve a `acordes3` las de `acordes` que no están en git y siguen en la cola.
- **＋ Letra**: añade una entrada a `letras-pendientes.md` (frase y agrupación obligatorias; fuente y notas opcionales) con estado `pendiente`, para buscarla y ponerle los acordes después. La **base se calcula sola**: el pasodoble de esa agrupación (la ficha original, sin `letraTitulo`); si no hay ninguna, se apunta `?`. En local escribe el archivo; en producción abre una PR en `letras/<n>-…` (la lista `npm run prs` las marca como `letra` y las fusiona con `--merge`).
- **Editor**: el mismo `<pre>` en texto que el revisor local, con acordes coloreados, sugerencias y **Alt+←/→** para mover una columna. También se pueden **arrastrar**: con ratón, arrastrando unos píxeles; en móvil, manteniendo pulsado el acorde ~350 ms y soltándolo en otra columna o línea de acordes (solo líneas de acordes). El gesto conserva `data-postura`, se puede deshacer y usa `moverAcordeA()` (`src/lib/editar-lineas.js`), probada en `npm run auditar:editor`. En móvil, pestañas para cambiar de columna (sin botones de mover: el editor se queda con toda la altura). En la cabecera hay tres botones: **↶ deshacer** (`Ctrl+Z`), **✂ separar por palabras** (`Alt+Enter`, la palabra del cursor baja a una línea nueva con sus acordes) y **⤴ juntar por palabras** (`Alt+Retroceso`, la palabra del cursor sube al verso anterior). Si el cursor está en una **línea de acordes**, esos mismos botones mueven el acorde bajo el cursor: ✂ lo baja al final de la siguiente línea de acordes y ⤴ lo sube al final de la anterior (el `title` cambia según el contexto). Si la línea de destino está **vacía** (un verso sin acordes), el acorde se coloca al principio. Con el cursor **al principio de un verso de letra** (columna 0), ✂ le crea su propia línea de acordes vacía encima (`separarVerso()`): así el verso se despega del bloque de arriba y se le pueden bajar acordes; ⤴ en ese mismo verso lo vuelve a juntar y se lleva el blanco. Un salto de línea a mano (Enter, borrar un salto o pegar varias líneas) ya no descuadra la estructura: en el evento `input` se reajustan las capas (`realinearEstructura()`), a costa de que las líneas nuevas se queden sin postura concreta (se avisa). Las operaciones están en `src/lib/editar-lineas.js` (puras) y conservan `data-postura` y `(Sorda)`; `npm run auditar:editor` las prueba. La cabecera de vistas (Editor/Estadísticas/Comentarios) se oculta al editar y el panel **Datos** se pliega al tocar el textarea, para dejar más alto el editor; las pestañas Editor/Base son más pequeñas. Arriba, un panel **Datos** plegable con el frontmatter editable (pieza, agrupación, año, cejilla, autores, título de la letra, frase clave, imagen, vídeo, destacada, recomendada, cover). **Editar los datos no cambia el slug**: el archivo conserva su nombre y la URL (el título de la letra es solo frontmatter, lo que pinta la card). Las columnas van **Editor · Base**; la de **Base** (la segunda, a la derecha) lleva un **selector** para cambiar con cuál comparar (mismo año y misma pieza primero) y, si la agrupación no tiene otra ficha, se queda **en gris, vacía pero ocupando su sitio en escritorio** (en móvil se oculta, que ahí cada columna es una pestaña): así el Editor no cambia de ancho entre fichas. El editor tiene **un solo scroll** (`.lienzo`): el `<textarea>` y el `<pre>` van dentro de una hoja del tamaño del texto, así el arrastre lateral funciona en toda el área. Una regla marca la **columna 55** y lo que la pasa se pinta en rojo subrayado (también en Base); la cabecera lleva el contador `máx/55` y, cuando no caben las 55 columnas, un botón **Ajustar/Ampliar** (en Editor y Base) que reduce la letra sin partir líneas.
- **Guardar**: crea la rama `estudio/<slug>-<rand>`, hace el commit y abre (o actualiza) la **PR**. Netlify deja el deploy preview en la PR.
- **En local (`astro dev`) no hay PR**: el panel ejecuta las funciones con `ESTUDIO_LOCAL=1`, así que **Guardar escribe el `.md` en el proyecto** y **Publicar mueve el archivo** de `acordes3` a `acordes` con la fecha del día. `lista.mjs` y `ficha.mjs` leen también del disco, y en la lista salen los borradores locales con la marca LOCAL. Un borrador que solo está en GitHub sale con la marca **EN GITHUB** y sin **Promover** (hay que abrirlo, guardarlo para traerlo al ordenador y entonces promoverlo); uno que ya está en `acordes` en el disco no se repite como borrador. Al abrir una ficha local, el estado (LOCAL y, si toca, «en GitHub hay otra versión») sale en una **banda sobre las pestañas**, no en un aviso flotante: así no tapa el editor ni estorba al scroll en móvil. Para subirlo a la web, después, `subir-acorde`.
- **En local no se pide login**: con `ESTUDIO_SIN_LOGIN=1` en `.env`, `sesion()` (`_lib.mjs`) devuelve una sesión de desarrollo con el `GITHUB_TOKEN` del mismo `.env` y `/me` añade `local: true`, que el panel usa para `MODO_LOCAL`. Así el panel se puede abrir desde el móvil por el túnel o por la IP del Wi-Fi, donde el OAuth no puede volver (el callback registrado es `localhost`) y además solo escucha en `::1` sin `--host`. Los tres cerrojos son `ESTUDIO_LOCAL` (solo lo pone la ruta de dev), el opt-in y el token; en Netlify no se cumplen, así que producción sigue con OAuth. Ojo: mientras `astro dev` esté abierto, quien llegue al puerto puede editar y hacer push con tu token; con `--host` eso incluye a toda la red local. La sección de **Comentarios** manda al worker `COMMENTS_ADMIN_TOKEN` (el `ADMIN_TOKEN` del worker) si está configurado y, si no, el token de GitHub de la sesión; en un 401 reintenta con la otra credencial. La versión desplegada del worker solo acepta `COMMENTS_ADMIN_TOKEN`: sin él las respuestas salían con «Anónimo» (el `POST` no da 401, guarda el comentario con `isAdmin: false`) y «Completar» devolvía `Unauthorized`. Para quitarlo, desplegar `workers/comments-worker`, pero **antes hay que añadir su `[[kv_namespaces]]`**: `wrangler.toml` no declara el binding `COMMENTS` y un `wrangler deploy` desde el repo lo borraría.
- **Comentarios y XSS**: en la web pública (`CommentsSection.astro`) los comentarios se crean con `textContent`/`dataset`, **nunca** metiendo datos del worker en un `innerHTML`: el nombre del autor y el contenido pueden traer HTML y se ven como texto. El panel sí monta HTML por strings, así que escapa con `escaparHtml()` (`src/lib/escape.js`, que escapa también las comillas y sirve para texto y atributos). `npm run auditar:comentarios` falla si vuelve un `innerHTML` con `${…}` en el componente, si se escapa a mano o si el panel deja de usar el escapador compartido.
- **Borradores**: todo lo que se crea o se está trabajando vive en `acordes3`; la lista del panel los saca primero, con la marca BORRADOR. Al guardar se actualiza la rama y la PR.
- **Publicar / Promover**: en producción, botón que mueve el borrador de `acordes3` a `acordes` en una rama nueva y abre la PR; al fusionar, Netlify reconstruye y el aviso de Telegram sale solo (un `.md` añadido). En local el botón se llama **Promover** y solo mueve el archivo en el proyecto (sin PR y sin tocar la web, que no cambia hasta el commit y push).
- **Fichas publicadas**: se pueden abrir y corregir; al guardar, la PR va a `acordes`.
- **Fusionar**: botón que hace squash merge de la PR abierta de esa ficha. Si la ficha se ha renombrado, la PR se localiza por la rama (`rama`), no por el slug. Es lo mismo que hace **Publicar** en la fila `EN PR` de «Por publicar», y también funciona en local (para las PRs guardadas desde el móvil): después hay que hacer `git pull`.
- **Avisos**: el panel compone el aviso con la ficha abierta (manda su frontmatter por `POST /admin/api/aviso`, así sale aunque no esté subida, en una PR o solo en el ordenador). El texto va en formato **WhatsApp** (negrita con `*…*`) para copiar; para X se manda sin marcas (`textoX`). Botones de copiar y de abrir X. WhatsApp y X siguen saliendo desde el PC (`npm run wa`, `npm run x`): necesitan tu Chrome con sesión.

Variables en Netlify: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (secreta), `SESSION_SECRET` (secreta) y `OWNER_LOGIN`. El callback de la OAuth App tiene que ser `https://acordesgaditanos.com/admin/api/auth-callback`.

`npm run prs` lista las PRs abiertas del panel (borradores `estudio/*` y publicaciones `publica/*`).
`npm run prs -- --merge [--si]` fusiona con squash los borradores; `--todas` incluye las de publicar (eso publica y avisa).
Necesita `GITHUB_TOKEN` en `.env` (permiso `public_repo` o `repo`) o `gh` autenticado. Después, `git pull`.

`npm run promover -- --slug <slug>[,<slug>] | --todos [--dry]` pasa los borradores de `acordes3` a `acordes`, les pone la fecha del día y borra el borrador. Después, `auditar:pre`, `auditar:acordes` y el commit con `subir-acorde`.
