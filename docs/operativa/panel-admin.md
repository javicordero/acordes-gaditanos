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
- **Clic o toque corto en un acorde** abre el selector de postura: una rejilla con los
  mini-diagramas de las posiciones del glosario, la actual marcada y **Sin postura** para
  quitarla. Aplica `data-postura` a la ocurrencia concreta de ese acorde (por orden dentro de
  la línea), actualiza también la etiqueta original para que `envolver()` no la pierda al
  guardar, entra en **Deshacer** y deja la ficha **sin guardar**. La pulsación larga sigue
  siendo para arrastrar; si no hay glosario para ese acorde se avisa y no se abre el selector.
  La lógica está en `fijarPostura()` (`src/lib/editar-lineas.js`), probada en
  `npm run auditar:editor`.
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
  nombre y su URL. Incluye **Modalidad** como desplegable (Comparsa, Chirigota, Coro,
  Cuarteto, Chirigota callejera); una variante antigua se conserva como opción temporal.
  En **Música** y **Letra** van apareciendo los autores que ya existen en el cancionero
  mientras se escribe, también después de una coma (↑/↓ y Enter para elegir). **Agrupación**
  sugiere igualmente las agrupaciones ya existentes.
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

La fecha de alta de una ficha publicada desde el panel **no es la de hoy**: `estudio.js`
calcula la siguiente a la última publicada con el `date` de `/indice-busqueda.json` y la
manda en el cuerpo de `/publicar`; `publicar.mjs` la usa y solo cae en la fecha de hoy si no
llega (cliente antiguo). Así la ficha no se queda por detrás de las últimas y sale en
novedades. No volver a poner `hoy()` directamente en el endpoint.

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

- El **slug** se genera solo a partir de pieza, agrupación y título de letra; no hay que
  escribirlo. Después no cambia aunque se editen esos datos (conserva la URL).
- **Modalidad** es un desplegable con las cinco modalidades canónicas, también en la pestaña
  **Datos** de una ficha ya abierta.
- **Música** y **Letra** sugieren los autores que ya existen en el cancionero al escribir,
  aunque el campo lleve varios separados por comas. **Agrupación** sugiere también las
  agrupaciones existentes, en Nueva ficha y en Datos.
- El campo **Vídeo de YouTube** acepta el enlace normal (`watch?v=`, `youtu.be`, `shorts`…) y
  al guardar lo convierte a la URL de embed que se guarda en el frontmatter.
- La **ficha de referencia** se elige sola con una ficha de la misma agrupación (prefiere el
  mismo año y la misma pieza, sin título de letra). Si la agrupación ya existe, de esa ficha
  toma el **año, la modalidad, la imagen, los autores y el vídeo**; **no** copia el bloque de la letra, la
  cejilla, la frase clave ni el título de otra letra. Si se elige una ficha a mano, sí se
  copia su bloque de acordes. Sin referencia, la ficha nace vacía y se pega la letra en el
  editor.

## Estadísticas

`/admin/?vista=stats` pide `/admin/api/stats` (proxy del worker de Cloudflare,
D1). El contador empieza el **19/01/2026**: no hay datos anteriores.

- Las tarjetas muestran **hoy** (con variación respecto a ayer), el **total**
  desde el 19/01/2026, la **media diaria** (incluye hoy) y la **media mensual**
  (meses completos).
- **Visitas por mes** y **Evolución últimos 30 días** llevan un mini gráfico de
  barras encima de la tabla, que se mantiene. Añaden una comparación: el último
  mes completo frente al anterior y los últimos 7 días frente a los 7 anteriores.
- **Rutas más visitadas** tiene chips de tipo (**Todo / Fichas / Autores /
  Carnaval / Glosario / Otros**), buscador por substring sin mayúsculas ni
  tildes y cabeceras ordenables. Sin filtros enseña el **top 10** y un botón
  **Ver más rutas** (hasta 300); con filtros enseña las coincidencias (hasta 300)
  y el resumen dice cuántas hay. Cada fila lleva **%** y barra de popularidad.
- **Fuentes de tráfico** enseña las **10 primeras agrupadas por familia**
  (Google, Blogspot, Bing, X…), con una fila **Directo / interno / sin fuente**
  calculada por diferencia con el total para que la tabla sume el 100 %. Lleva
  **%**, barra y un botón para desplegar el resto y volver a contraerlas.
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
- El **selector de periodo** (Hoy, 7, 30 y 90 días) está arriba, junto al
  título. Las tarjetas muestran la variación frente al periodo anterior (ayer,
  o los mismos días anteriores); esa comparación se pide en la misma consulta
  (`totalAnterior`). Van en este orden: **Páginas vistas** (destacada y primera,
  lo comparable con el contador propio y Search Console), **Visitas** (detrás,
  porque Cloudflare solo cuenta una visita en la página de entrada), **Páginas
  por visita** (páginas / visitas, con su propia variación; `—` sin visitas) y
  **Rutas listadas**. El factor de muestreo ya no es tarjeta: sale entre
  paréntesis en la nota «Excluye bots y muestrea (×3,2)» de la cabecera (si no
  muestrea, solo «Excluye bots y muestrea»), con la explicación al pasar el
  cursor. Los diálogos de ruta y país conservan su tarjeta **Muestreo**.
- **Rutas**: top **20** y botón **Ver más rutas** (hasta 300), con buscador,
  chips de tipo (**Todo / Fichas / Autores / Carnaval / Glosario / Otros**, los
  mismos del contador propio) y cabeceras ordenables. Ordena por **páginas
  vistas** (no por visitas: Cloudflare solo cuenta una visita en la página de
  entrada de la sesión, así que casi todas las rutas quedarían en 0). La
  columna **Fuente** enseña las 3 principales en línea con formato
  `(Google - 55) (blog - 3) (directo - 1)`, con las externas primero y
  directo/interno al final; el botón **Fuentes** abre el detalle. El **D1 total**
  ya no está en la tabla principal: sigue en el detalle de la ruta.
- **Fuentes de tráfico**: top 10 agrupadas por familia, con **%**, barra y botón
  para desplegar el resto. **Se recalculan con el filtro de rutas**: al buscar o
  elegir un tipo solo suman las fuentes de esas rutas, usando los pares
  ruta × fuente que ya trae la API (límite de 10 000 pares y solo **páginas**:
  con filtro se oculta la columna **Visitas**, porque Cloudflare no las desglosa
  por ruta y fuente). La nota recuerda que directo e interno se miden en
  páginas vistas.
- **Evolución diaria** mantiene la tabla y añade un mini gráfico de barras.
- La tabla de **Países** sigue el mismo patrón: **Páginas**, **Visitas** y una
  columna **Páginas más vistas** con las **3 rutas principales desde ese país**
  en formato `(/acordes/glosa/ - 12) (… - 3)` (etiqueta corta; el nombre
  completo sale al pasar el cursor). El botón **Ver** abre el detalle del país
  con sus **100 páginas** más visitadas, páginas y visitas del periodo, y un
  aviso si el país tiene más. Las páginas por país se piden con una consulta por
  país (aliases de GraphQL): con una sola agrupación se las comía el país con
  más tráfico y los demás se quedaban sin datos. Si el país tiene menos de 100
  rutas, su total de páginas se suma de las rutas (más fino que el redondeo del
  grupo país); si tiene más, se usa el total del país. Los códigos ISO se muestran
  con su nombre (`ES` → España), y la nota de la tabla avisa del muestreo y de
  los ceros en visitas con muy poco tráfico.
- **Dispositivos** lleva **%** y barra de popularidad.
- Se pide con `?vista=hoy&limite=3000`, `?vista=resumen&dias=30&limite=3000` o
  `?vista=ruta&ruta=/acordes/x/&dias=30` (`&hoy=1` para el detalle de hoy). La
  respuesta se cachea 10 minutos.
- Cloudflare es **RUM**: excluye bots (`bot: 0`, como `excludeBots=Yes` del
  dashboard), muestrea y redondea. **No cuadra con D1** y no se deben sumar.
- La comparación con el contador propio solo se enseña a 30 días y a nivel
  global, en una línea compacta: D1 no guarda histórico por ruta.
- En fuentes, `(directo)` e `(interno)` se miden en páginas vistas: una
  navegación interna no abre una visita nueva. Se ocultan previews de Netlify y
  localhost.
- Enlace **Abrir en Cloudflare** al dashboard de Web Analytics.

### Google: Search Console, Analytics y AdSense

Las tres pestañas de Google (Search Console, Analytics y AdSense), sus variables,
límites y notas de comparación están en
[`estadisticas-google.md`](estadisticas-google.md).

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
  `CLOUDFLARE_WA_SITE_TAG`. Para las pestañas de Google: `GOOGLE_SERVICE_ACCOUNT_EMAIL` y
  `GOOGLE_PRIVATE_KEY` (o `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y
  `GOOGLE_REFRESH_TOKEN`), `GSC_SITE_URL`, `GA4_PROPERTY_ID`, `ADSENSE_ACCOUNT_ID` y
  `ADSENSE_CURRENCY`; todas las credenciales son secretas y no salen del servidor.

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
  `borradores` a `acordes`, le pone la fecha siguiente a la última publicada y borra el
  borrador. Después, `auditar:pre`, `auditar:acordes` y el commit con `subir-acorde`.

## Comprobarlo

```bash
npm run ajustar:borradores -- --dry   # qué fichas están fuera de sitio y los 4 recuentos
npm run revisar -- --auditar          # la cola apunta a fichas que existen
npm run astro check
```

Los cuatro recuentos tienen que sumar el total de fichas (`acordes` + `borradores`).
