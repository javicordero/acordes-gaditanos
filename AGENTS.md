# AGENTS.md

## Idioma
- Commits y mensajes: siempre en español

## UI
- **Nunca subrayar en hover**: el subrayado no se usa como efecto de hover. Los enlaces cambian de color, sombra o se desplazan; si ya van subrayados en reposo (por ejemplo, dentro de un párrafo legal), conservan su subrayado base.

## Sesiones
- **Renombrar la pestaña al empezar**: en cuanto se sepa qué se va a hacer, poner a la sesión un título explícito y corto (3-6 palabras) con el renombrador de sesión, en vez de dejar el texto del primer mensaje ("siguiente tarea trello", "haz commit de esto"). Formato `<tema>: <qué se hace>` — `Trello: quitar Anuncio2 y Anuncio3`, `Letras: acordes de "Cinco años"`.
- Si a mitad de la sesión el trabajo cambia de tema, se vuelve a renombrar con el encargo nuevo.
- El título es para el usuario (pestañas y lista de sesiones): en español, sin id de tarjeta ni ruta de archivo.

## Commands
| Comando | Uso |
|---|---|
| `npm run dev` | Dev server en `localhost:4321` |
| `npm run build` | Build a `./dist/` |
| `npm run preview` | Preview del build |
| `npm run astro check` | Type-check (único lint/check disponible) |

**Puerto 4321 reservado al usuario.** El agente no debe usarlo nunca (ni `dev` ni `preview`). Si necesita levantar el servidor, que use `npm run dev -- --port 4322` y, en su caso, `npm run preview -- --port 4323`. **Y no lo levante si el del usuario ya está corriendo**: dos `astro dev` comparten `.astro/data-store.json` y se pisan (errores `ENOENT ... data-store.json.tmp` y "collection does not exist"): en ese caso, pedir al usuario que pare el suyo o que pruebe él.

No hay scripts de test ni lint configurados.

## Build Guidelines
- **NO** hacer build tras cada cambio pequeño
- **SÍ** hacer build solo antes de un commit
- **El agente no ejecuta `npm run build` ni `npm run preview` tras cada cambio**: solo cuando el usuario lo pida expresamente o justo antes de un commit. Para verificar mientras se trabaja, se usa el `astro dev` del usuario (4321) o el 4322 si el 4321 no está ocupado.
- Para verificar: `npm run dev` y probar en navegador
- Build exitoso no garantiza funcionamiento, solo que compila

## Architecture

### SSG site
Sitio 100% estático (SSG) con Astro content collections. Middleware solo redirige `/formateadores` y `/coming-soon` → 404.

### Content Collections (`src/content/config.ts`)
- **`acordes`** — más de 570 entradas. Frontmatter: `pieza`, `agrupacion`, `musica`/`letra` (strings separados por coma), `year` (number → string), `date` (formato español `DD/MM/YYYY`), `cejilla` (number → string), `video`, `img`, `cover`, `autorCover`, `fraseClave`, `destacada`, `recomendada`, `modalidad` y `letraTitulo` (opcionales). La `modalidad` está rellena en casi todas las fichas con `npm run modalidad`; las que falten quedan en `.cache/modalidad-dudas.csv`.
- **`autores`** — 12 autores. Frontmatter: `nombre`, `img`, `type` (`musica`|`letra`), `order`, `destacado`.
- **`donaciones`** — un solo `datos.md` con la lista de donantes (`donaciones: [{ fecha, importe, donante? }]`); la pinta `DonationIndicator.astro`.
- **`acordes3`** — borradores del panel `/admin`: fichas nuevas o a medias que aún no se publican. Se promueven a `acordes` con `npm run promover`. Una ficha que solo existe en el ordenador (sin subir) vive aquí, no en `acordes`: el panel la lista con la marca LOCAL y `npm run letras -- auditar` la da por buena aunque no esté publicada.
- **`acordes2`** — colección provisional para los acordes importados del cancionero. Mismo esquema que `acordes`, pero su contenido (`.md`) no se versiona y los acordes van sin envolver en `<a>` hasta que se promueven.

Slugs se generan automáticamente (lowercase, sin tildes, guiones). El transform también produce `musicaSlugs`, `letraSlugs`, `agrupacionSlug`.

**Normalización del contenido.** `pieza`, `agrupacion` y `modalidad` se normalizan al cargar con `normalizarPieza` / `normalizarAgrupacion` / `etiquetaModalidad` (`src/lib/contenido.ts`): el tipo base a su forma canónica (`Final de Popurrí` / `Final de popurri` / `Final de popurí` → `Final de popurrí`, `pasodoble` → `Pasodoble`, `presentación` → `Presentación`), la modalidad (`Chrigota` → `Chirigota`) y la grafía de las agrupaciones que aparecían de varias formas (`Los peregrinos` → `Los Peregrinos`; el mapa está en `AGRUPACIONES`). Se conserva el título entrecomillado (`Cuarteta "Castigo divino"`) y el calificador (`Pasodoble inédito`, `Pasodoble original`, `Pasodoble Noly`; los adjetivos van en minúscula). El slug **no** cambia: sale del nombre del archivo (`normalizeSlug` no distingue mayúsculas ni tildes).
- `npm run normalizar:contenido [-- --dry] [--dir <carpeta>]` escribe la forma canónica en los `.md`; toca solo las líneas de esas claves del frontmatter (no lo re-serializa). También normaliza **autores**: quita el punto final y resuelve los alias de `ALIAS_AUTORES` (`Germán García Rendón` → `Germán Rendón`, `Ángel Luis Silva Benzo` → `Ángel Luis Silva`, `Juan Manuel Romero Bey` → `Juanma Romero Bey`, con su 301 en `netlify.toml` porque cambia la URL del autor) y unifica las variantes que solo se diferencian en tildes o mayúsculas dejando la forma más usada (`German Rendón` → `Germán Rendón`). `Manolo` y `Manolín Santander` son personas distintas y no se tocan. Los **nombres de archivo** (y por tanto los slugs) no se normalizan: cambiarlos rompe la URL y obliga a un 301; el auditor solo avisa de los que no siguen el patrón `pieza-agrupación…`.
- `npm run auditar:contenido [-- --sin-red]` es el auditor de fondo del cancionero: pieza/agrupación/modalidad/autores sin normalizar, campos obligatorios vacíos, claves mal escritas (`fraseclave`), fechas imposibles o anteriores al año, duplicados (misma agrupación + año + pieza + primer verso), variantes del mismo autor, agrupaciones con varias grafías, vídeos sin auditar y **imágenes 404** (caché de 30 días en `.cache/contenido-imagenes.json`; `--sin-red` no sale a internet). `cover` no es una imagen: es el vídeo de la versión a la guitarra (`autorCover`), y no se audita. No repite `auditar:letras`, `auditar:orden` ni `npm run videos`.

### Formato de acordes
Cada acorde envuelto en `<a>etiqueta</a>` dentro de `<pre>`. El script `scripts/generate-pdf.mjs` parsea este formato.
```
<pre><a>LaM7</a>            <a>Mi7</a>               <a>Sim7</a>
Bendita suerte pal aficionao que más de un mes de
```

En los popurrís, los cambios de cejilla a mitad de copla se marcan con `<strong>Cejilla: 4</strong>` (o `<strong>Cejilla: No</strong>` cuando se toca al aire), **solos en su línea y sin espacios alrededor**: `AcordeCard.astro` los pinta como el chip `.acorde-meta` (icono de cejilla + texto en mayúsculas, centrado).

Las anotaciones entre paréntesis que van en la línea de acordes (`<a>(Sorda)</a>`, `(Pito)`…) **también se envuelven en `<a>`**: cuentan como línea de acordes aunque estén solas, y el editor las reconoce (en gris) y las envuelve al guardar, **también las que ya estaban sin etiqueta aunque la línea no se toque**. Con su etiqueta se conserva la `data-postura` si la tenía.

### Letras alternativas de una misma música
Una misma música puede tener varias letras. Cada letra es una ficha propia (`.md` + URL), para que se pueda buscar por el título de esa letra; no se meten varias letras en la misma página.
- Campo opcional `letraTitulo` en el frontmatter (solo en la ficha de la letra alternativa). El título se muestra en el badge de la card, en el bloque «Letras de este pasodoble» y en los avisos; el título de la ficha sigue siendo `Pasodoble Los Colgaos`.
- La relación es **implícita**: misma `agrupacion`, `year` y tipo base (`pasodoble`), siempre que al menos una ficha del grupo tenga `letraTitulo`. La ficha original no se toca.
- En la card, el badge de la letra va debajo del de pieza; en el desplegable de sugerencias, debajo del badge de pieza; en la ficha, un bloque «Letras de este pasodoble».
- De momento solo se agrupan pasodobles (`TIPOS_CON_LETRAS` en `src/lib/letras.ts`). Para otros tipos, añadirlos ahí.
- `npm run auditar:letras` valida que el título no se repita en el grupo, que las fichas compartan música y que las variantes no lleven `destacada` (sí pueden llevar `recomendada`).

### Poner los acordes de una ficha a una letra nueva
Cuando una música tiene otra letra, los acordes caen sobre las mismas sílabas. `scripts/aplicar-acordes.mjs` reparte la letra con la métrica de la ficha base y coloca cada acorde alineando el patrón de acentos del verso. La parte que decide (qué líneas forman cada verso) la lleva el agente siguiendo la skill `letra-alternativa`; el script solo hace la aritmética de sílabas y columnas.

- `npm run acordes:plan -- --base <slug>` — esqueleto de la base (nº de verso, sílabas y el acorde sobre su sílaba: `Lam«Y» Mi7«nor»`) y de la letra pegada (`L1 5s Cinco años`). Sirve para decidir el reparto antes de generar.
- Marcas en el `.txt` de la letra: `---` sola corta entre líneas, `|` corta entre palabras (`Apaleado | y humillado`) y `-` sola salta un verso de la base sin gastar letra. Sin marcas, el reparto es automático (programación dinámica).
- `npm run acordes:aplicar -- --base <slug> --letra <txt> --titulo "..."` — escribe `src/content/acordes/<pieza>-<agrupación>-<título>.md` con el frontmatter de la base (cambia `letraTitulo`, `fraseClave` y `date`, y autores/vídeo si se pasan). `--hermanas` añade las fichas de la misma pieza, agrupación, año **y autoría de música** como candidatas; `--destino acordes2` escribe en la colección provisional. El informe marca `⚠️` (más de una sílaba de desfase) y `~` (una).
- `npm run acordes:revisar -- --slug <slug> [--base <slug>]` — editor local en el puerto 4324, **en modo texto**: tres columnas con la ficha original a la izquierda, el `<pre>` editable en el centro (acordes sin las etiquetas, encima de su sílaba) y la ficha base a la derecha. **Alt+←/→** mueve el acorde una columna, se puede escribir y pegar como en cualquier editor, y al guardar se vuelven a envolver los acordes en `<a>` conservando los `data-postura`. Antes de escribir comprueba que no haya tokens inválidos, acordes perdidos ni columnas fuera de la letra, y deja respaldo en `.cache/planes/<slug>.bak.md`. Los acordes que no están en el glosario salen en ámbar (y avisan al guardar). Marca igual que el panel lo que pasa de 55 columnas. Con `--silabas` se abre el revisor antiguo, que mueve por sílaba en vez de por columna.
- `npm run auditar:pre` — red de seguridad del editor: desenvolver y volver a envolver todas las fichas de `acordes` tiene que dar exactamente el mismo `<pre>` (incluidos `data-postura`, `(Sorda)` y los espacios). Si falla, el editor no es de fiar.

- `npm run auditar:editor` — prueba las operaciones de estructura del editor (separar y juntar por palabras) con casos fijos: `data-postura`, `(Sorda)`, corte por el inicio/fin de la palabra, ida y vuelta y ficha sin línea de acordes. Falla si el `<pre>` resultante no es el esperado.

- `npm run acordes:evaluar` — mide aplicando los acordes de una ficha a la letra de su hermana. Empareja por orden de aparición (no «el mismo acorde más cercano») y cuenta exactos / ±1 / **>1 sílaba**. Contra fichas hechas a mano el 100 % exacto no existe (se llevan ±1 entre sí), así que el número que importa es el de >1. `--pares a>b,c>d` elige pares, `--max-fuera 12` lo usa como tope y sale con 1 si empeora. Baseline de las fichas actuales: ~61 % exactos, ~28 % ±1, ~9 % >1.
- `npm run auditar:acordes` — relee y repinta todas las fichas de `acordes` y comprueba que no se pierde ningún acorde ni cambia de sitio. La primera pasada normaliza (quita espacios de más y pega cada acorde a su sílaba); a partir de ahí el dibujo tiene que ser idéntico. Falla si una ficha no se puede leer o pierde acordes.

### Buscar la letra en internet y llevar la cola
`letras-pendientes.md` es la lista de coplas de las que solo tenemos una frase y el nombre de la agrupación (a veces aproximado). La tabla es la fuente de verdad y lleva el estado de cada una.

- `npm run letras` — resumen por estado y la cola completa (`-- listar --estado pendiente` filtra; el primer argumento es la orden, así que `-- --estado pendiente` da «orden desconocida»).
- `npm run letras -- siguiente` — el primer pendiente con su ficha base.
- `npm run letras -- estado <n> encontrada|"con acordes"|"no encontrada"|duplicada --ficha <slug> --fuente <url> --notas "..."` — actualiza la fila.
- `npm run letras -- auditar` — comprueba que cada `con acordes` tiene ficha real con `letraTitulo` y que la base existe.
- `npm run letras -- anadir "frase" --agrupacion "Los X" --base <slug> [--fuente <url>] [--notas "..."]` — añade una fila nueva.
- `npm run letras -- reconocer "<título o frase>" [--json]` — interpreta una petición escrita a mano (tarjeta de Trello, chat): saca agrupación, año, pieza, fichas, **base propuesta** y avisa si la letra o el título ya existen. Solo lee.

También se puede entrar por una **tarjeta de Trello** («nueva letra comparsa el cementerio», «pasodoble el cementerio»): se reconoce la copla, se apunta en la cola, se busca y formatea la letra y se deja en «Por revisar». Ver «Tarjetas de letras» en *Tareas en Trello*.

La búsqueda se hace con `Pasodoble "<frase>"` y, si no aparece, con la agrupación o sin la palabra «pasodoble». Se acepta la letra solo si la frase aparece literal y la agrupación y el año cuadran; se descartan traducciones y montajes.

`npm run letra:web -- <url> --desde "<primera frase>" [--hasta "<corte>"] --salida .cache/letra-<n>.txt` descarga una página y la deja en un `.txt` con un verso por línea: recorta al contenedor del artículo, quita menús y recomendados, decodifica entidades y parte los textos que vienen de corrido. Con `--blogger` tira del feed Atom (muchos blogs no sirven la letra en el HTML) y con `--mapa` enseña el número de línea y el principio de cada verso para revisar el recorte. `--sin-cortar` desactiva el troceo por puntuación.

`npm run letra:blog -- "<frase>" [--agrupacion "Los X"] [--blog dominio]` busca la copla en un blog de Blogger por el feed, exige que la frase aparezca entera en el cuerpo y devuelve título, fecha y URL. Por defecto busca en *Letras desde el Paraíso*, que es la que mejor separa los versos.

`npm run letra:decarnaval -- <url> [--salida .cache/letra-x.txt]` saca la letra de una página de letrasdecarnaval.com del contenedor `<p id="letra">`, que trae un `<br>` por verso. Es la vía limpia para esa web (el extractor general a veces coge el bloque de «relacionados»).

El `.txt` tiene que llevar **solo la letra**: si arrastra el título («Pasodoble…»), el contador de visitas, el año con la agrupación o el pie de autoría, `acordes:aplicar` se para y las enumera. Se quitan a mano (o se fuerza con `--permitir-meta`, que casi nunca es lo que quieres). Si la ficha base empieza con un verso de entrada que la letra nueva no tiene, se pone una línea `-` sola al principio y se separan los versos con `---`; así los acordes caen donde suenan.

Cuando la fuente no trae saltos de verso, `acordes:aplicar` puede recibir `--lineas-duras`, que trata cada línea del `.txt` como un verso de la base.

Criterio de estado: si el informe sale con muchos `⚠️` (más de ~8), la letra se deja en `encontrada` con la fuente anotada y no se publica la ficha; el reparto se termina revisando a mano. Si la letra no aparece, `no encontrada` con las webs miradas en `Notas`.

### Panel `/admin` (editar desde el móvil)
Panel privado desplegado con Netlify Functions. Vive en `/admin`: `noindex`, sin enlaces desde la web y fuera del sitemap. Solo entra el propietario (`OWNER_LOGIN`) con GitHub. Tiene tres secciones con la misma sesión: **Editor**, **Estadísticas** y **Comentarios**. `/admin/stats` y `/admin/comentarios` redirigen a `/admin/?vista=stats` y `/admin/?vista=comentarios`. Las estadísticas pasan por `/admin/api/stats` (el worker no manda CORS). Los comentarios pasan por `/admin/api/comentarios`, que manda el **token de GitHub de la sesión**; el worker de comentarios (proyecto `acordes-gaditanos-pwa`) comprueba con la API de GitHub que el usuario es el propietario. No hay un segundo login ni un token que pedir en el navegador.

- **Login**: `/admin/api/auth` → GitHub OAuth (`public_repo`) → `/admin/api/auth-callback`, que comprueba el usuario y deja una cookie cifrada (12 h) con el token. El token no llega nunca al navegador. La cookie se llama `admin`; al cambiar el nombre hay que volver a entrar una vez.
- **Seguridad**: `netlify.toml` manda CSP y cabeceras (`noindex`, `nosniff`, `DENY`, `no-referrer`) en `/admin/*`. `SESSION_SECRET` es obligatorio en producción (sin él, `_lib.mjs` falla cerrado y no firma cookies ni el `state`); en local se mantiene el valor de ejemplo. El panel vivía en `/estudio`: Netlify responde 301 a `/admin` y en `astro dev` queda una página de salto que conserva la query.
- **Listado**: buscador + pestañas `Todas`, `Por revisar` (ya en la web, les falta el repaso a mano), `Borradores` (aún no están en la web), `Por publicar` (en `acordes`, revisadas o modificadas y sin commit, o con una PR abierta) y `Publicadas`, agrupadas por año y con lo pendiente arriba. Cada ficha sale en **una sola** pestaña y la fila lleva **Revisado ✓** (la marca y, si es un borrador en local, la promueve), **Publicar** (en las que ya están en `acordes`), **Editar** y **＋** (crear otra ficha a partir de esa misma música). El modelo y el flujo están en `docs/operativa/panel-admin.md`. Los estilos de la página van con `<style is:global>`: el HTML que pinta el JS no lleva el `data-astro-cid` y con estilos *scoped* la lista salía sin ellos.
- **Acordes2** (solo en local): pestaña después de `Publicadas` con las fichas de `src/content/acordes2` (importadas del cancionero, con los acordes sin envolver). **A borradores** envuelve los acordes y mueve la ficha a `acordes3` con `scripts/importar-a-borradores.mjs` (`POST /admin/api/importar`), así que aparece en **Borradores** para revisarla; **Ver** abre su vista previa `/acordes2/<slug>/`. En Netlify la pestaña no sale: la función responde 501.
- **Por publicar** (local y producción): pestaña con las fichas de `acordes` que la web todavía no tiene. En local, lo que está en el ordenador pero aún no en git: nuevas (`??`), modificadas, borradas o en commits locales sin push (`lista.mjs` lo calcula con `git status`/`git diff`). En los dos modos, las fichas con una **PR abierta** (una corrección guardada desde el móvil): salen como `EN PR` y su **Publicar** fusiona la PR con squash (en producción es la única fuente de la pestaña). Las nuevas salen como `NUEVA` (con la fecha que se les asignará); el resto, `MODIFICADA`, `BORRADA` o `SIN PUSH`. Una ficha **publicada y modificada** entra aquí aunque siga en la cola de revisión (va con la marca `SIN REVISAR`); solo las **nuevas** sin revisar se quedan en Borradores. Al **guardar** en el editor una ficha de `acordes` aparece al momento en esta pestaña, sin recargar: el panel refresca cola + `git status` + PRs con `/admin/api/lista?solo=pendientes`. Cada fila de las de local lleva **Ver**, que abre en la misma pestaña la ficha tal como la pinta el `astro dev` (`/acordes/<slug>/`, sin anuncios; se vuelve con «atrás» y la pestaña de la lista se recupera porque se guarda en `sessionStorage`); una ficha `BORRADA` no lo lleva porque ya no está en el disco.
- **Publicar en local**: botón por fila (no hay «publicar todo»), que abre un diálogo con **Sin tuit** y **Sin etiquetar** (recordadas en `localStorage`). Ejecuta `scripts/publicar-acorde.mjs`: ajusta la fecha de las nuevas (día siguiente al último de `HEAD`), limpia los espacios finales de línea del `<pre>` de cada ficha del plan (no commitea si quedara alguno), pasa `auditar:pre` y `auditar:acordes`, hace un commit por ficha (solo sus rutas, con la baja de `acordes3` si toca) y push. Telegram avisa solo y, al terminar, el panel lanza **WhatsApp y X** desde el PC (`--avisar`, con `--sin-x` / `--sin-etiquetas` según las casillas; necesitan tu Chrome con sesión). Si un aviso falla, la ficha queda publicada igual, el panel dice **cuál** ha fallado y **Copiar aviso** sigue dejando el texto para mandarlo a mano. Solo funciona con `astro dev` (en Netlify la función responde 501, y las fichas de `acordes3` se publican con **Promover**, que solo abre la PR).
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

### Autores
`AutorCardsGroup` pinta el grid de autores (2 columnas en desktop, 1 en móvil). Cada `AutorCard` enlaza a la página principal del autor según `type` y añade chips a `/autor/musica/{slug}` y `/autor/letra/{slug}` cuando tiene créditos, calculados en build con `contarCreditosAutores` (`src/lib/autores.ts`). La home muestra los 6 primeros por `order` (5 en móvil) y `/autores` los muestra todos. Toda la card (imagen y cuerpo) usa `--primary-contrast-color`; el título y la línea de los chips van en `--on-bright-color` y los chips usan fondo `--on-bright-color` con texto `--primary-contrast-color` (sin cambio al hover). La sombra es `--on-bright-color` en reposo y en hover (solo crece y la card se desplaza).

### Orden de las cards en los listados
Todo en `src/lib/orden.ts`, con dos comparadores que comparten las piezas (`compararTipo`, `compararPrioridad`, `compararCoplas`, `compararAgrupacion`, `compararResto`).

**Prioridad por autor destacado**: la agrupación (por `agrupacionSlug`) de un autor del listado de `/autores` va delante, en el orden de su campo `order`, usando la mejor posición entre sus autores de música y letra. Las agrupaciones sin autor del listado quedan detrás.

**Prioridad por coplas** (`prioridadPorCoplas` + `contarCoplasAutores`): dentro de lo que queda, primero las agrupaciones de los autores más prolíficos, según las coplas distintas que tienen en **todo el cancionero** (una ficha cuenta una vez aunque el autor firme música y letra). De cada agrupación se usa su autor con más coplas. Es el escalón que va justo después de los destacados, antes de la agrupación A-Z.

- `/autor/musica` y `/autor/letra` (`ordenarAcordesAutor`, `compararFichas`): **año ↓** → agrupación A-Z → tipo de pieza → `date` ↓ → pieza A-Z → slug A-Z. No reciben prioridad: todas las cards son del mismo autor.
- `/carnaval/[year]` y `/lista` (`ordenarAcordesYear`, `compararFichasYear`): **autor destacado** → **coplas del autor más prolífico ↓** → agrupación A-Z → tipo de pieza → `date` ↓ → pieza A-Z → slug A-Z. `/lista` lo aplica dentro de cada año (los años siguen de más reciente a más antiguo).

**Tipo de pieza** (`ORDEN_PIEZAS`): popurrí, final de popurrí, cuarteta, estribillo, pasodoble, tango, presentación. Se compara por prefijo, así encajan «Final de popurrí/popurri/popurí», «Presentación Original» o «Pasodoble Inédito»; lo que no case va al final por orden alfabético. Las equivalencias puntuales van en `EQUIVALENCIAS_PIEZAS`: el `Credo` y el `Testamento` cuentan como cuarteta.

**`date` ↓** es la fecha de alta en la web, no la de la copla; para cerrar empates se usa pieza A-Z y slug A-Z. `npm run auditar:orden` comprueba la secuencia de escalones con fichas de mentira y con el cancionero real.

**Recuento de `/lista`**: la página separa **coplas** y **letras extras** («554 coplas y 22 letras extras») con `contarCoplas` (`src/lib/letras.ts`), que agrupa igual que las letras alternativas (tipo base + agrupación + año): cada grupo es una copla y el resto de fichas son letras. No sirve mirar qué fichas llevan `letraTitulo`: las originales de DSAS3, La Azotea y Los Colgaos también lo llevan. Si un año no tiene letras, solo se ponen las coplas («38 coplas»). `/lista2` usa el mismo recuento.

**Filtros de `/lista`**: el panel filtra por pieza, música, letra, año y década **en el navegador**, sobre las coplas ya pintadas: no genera páginas ni URLs nuevas, la canonical sigue siendo `/lista` y el estado se guarda en la query (`?pieza=pasodoble,tango&musica=juan-carlos-aragon`) con `history.replaceState`. La lógica pura está en `src/lib/filtros-lista.ts` (décadas, opciones de cada faceta, `filtrarFicha`, `parsearFiltros`/`serializarFiltros`) y el panel lo pinta `FiltrosLista.astro` con un `FiltroMultiple.astro` por faceta, en ese orden: **se admiten varios valores por faceta** (OR dentro de una faceta, AND entre facetas). Cada filtro parece un `<select>` pero despliega un panel con **checkboxes** nativos (y caja de búsqueda en música y letra, que son las listas largas); no se cierra al marcar, se cierra con Escape, con el botón o pulsando fuera, y devuelve el foco al botón. El panel cuelga con `position: fixed` y `z-index` por encima de la cabecera fija (`9999`), se recoloca al hacer scroll o al abrirse el teclado del móvil, no se mete debajo de la cabecera y se limita al hueco disponible. Las opciones de pieza van en el orden presentación · pasodoble · tango · estribillo · cuarteta · final de popurrí · popurrí (distinto del orden de pieza de las cards, que empieza por el popurrí). El panel de filtros se pliega con una animación de altura (`grid-template-rows` de `0fr` a `1fr`, sin transición con `prefers-reduced-motion`; al plegarse el contenido queda `inert`) y el botón dice «Abrir filtros» / «Ocultar filtros». Los `<li>` de la página llevan los `data-*` que lee el script: `data-t` (tipo de pieza) para filtrar y `data-p` (pieza original) para recalcular coplas/letras con la misma regla que `contarCoplas`. Al filtrar, los años sin coplas se ocultan y los recuentos se actualizan. Las opciones de autor se agrupan por slug, muestran la variante de nombre más usada y van **ordenadas por número de coplas** (de más a menos, A-Z para desempatar). **Las facetas se recalculan entre sí**: al cambiar un filtro, las opciones de los demás se limitan a lo que sigue teniendo coplas (y sus recuentos se actualizan); el filtro que se recalcula se mira sin su propio valor, para poder marcar varios dentro de la misma faceta. Un valor ya marcado que se queda sin coplas sigue visible con 0, para poder quitarlo. `npm run auditar:filtros` comprueba el tipo de pieza, las décadas, las combinaciones, la URL y que los recuentos reparten todas las fichas.

### Hubs por modalidad, tipo de pieza y década
Tres familias de páginas de navegación, todas públicas y en el sitemap:
- `/modalidad/<slug>` — comparsas, chirigotas, coros, cuartetos (solo las que tienen fichas).
- `/pieza/<slug>` — pasodobles, presentaciones, cuartetas, finales de popurrí, popurrís, tangos y estribillos.
- `/decada/<slug>` — pre 60, los 60s…los 2020s.

La lógica pura vive en `src/lib/hubs.ts`: `normalizarModalidad` (`Chrigota`→`chirigota`), `nombreDecada`/`slugDecada` (`90s` → «los 90s» / `anos-90`; `pre60` → «pre 60» / `pre-60`), `construirHubs` (agrupa y ordena con `ordenarAcordesYear`, descarta hubs vacíos) y `resumirHub` (para los enlaces cruzados sin arrastrar fichas). `src/lib/hubs-contenido.ts` (`cargarHubs`) carga `acordes` y `autores` y aplica la misma prioridad y recuento de coplas que `/carnaval` y `/lista`.

`src/components/page/HubLista.astro` pinta la cabecera (H1 y recuento de coplas y agrupaciones), «Explora también» (un panel claro con los hermanos del mismo eje) y el listado compacto agrupado por año (texto, sin rejilla de imágenes). `src/components/ui/HubCard.astro` es la card de los índices, ámbar con borde negro y sombra dura, como las de autores. `src/components/page/HubsHome.astro` pinta el bloque «Explora el cancionero» de la home en tres subbloques, en este orden: «Por décadas» (las 8), «Por modalidad» (comparsas y chirigotas) y «Por pieza» (los 7). En la home van comparsas, chirigotas, las 7 piezas y las 8 décadas; coros sigue teniendo su página de hub (cuartetos aún no tiene fichas). Las tres páginas (`modalidad/[modalidad].astro`, `pieza/[tipo].astro`, `decada/[decada].astro`) usan `getStaticPaths` desde `cargarHubs`. Cada hub emite un `ItemList` y usa el `Breadcrumb` con `current`.

Enlaces de entrada: el bloque `HubsHome` de la home (eventos `click_hub_<eje>_<slug>`, por ejemplo `click_hub_decada_anos_2020`, `click_hub_modalidad_comparsas` o `click_hub_pieza_pasodobles`; los guiones del slug pasan a `_` porque GA4 no los admite). El bloque «Todos los carnavales» de la home usa el fondo navy de autores (`section--colored section--carnavales`), con el título en blanco (`--years-list-heading-color`). El botón «Ver lista de todas las coplas» va al final del bloque «Explora el cancionero».

Sitemap: entran solas (el `filter` de `astro.config.mjs` es una lista negra); no llevan `lastmod` (solo fichas, `/`, `/novedades/` y `/carnaval/<año>/`).

`npm run auditar:hubs` comprueba con el cancionero real que los tres ejes reparten lo que toca (pieza y década 586 fichas, modalidad las que la tienen), que no hay hubs vacíos ni slugs repetidos, que el agrupado por año suma y que la normalización/slugs son estables.

**Modalidad**: `npm run modalidad` (`scripts/completar-modalidad.mjs`) rellena la modalidad de las fichas que no la tienen. Fuentes en orden: la propia agrupación, el cancionero de guitarradegades (la tabla de cada ficha) y el título del vídeo de YouTube (oEmbed), más un mapa manual de revisión (hemeroteca/COAC). Por defecto no escribe: deja `.cache/modalidad-informe.md`, `.cache/modalidad-dudas.csv` y `.cache/modalidad-resolucion.csv`; con `--aplicar` escribe `modalidad:` (y corrige `Chrigota`). Opciones: `--sin-youtube`, `--sin-cancionero`, `--solo <texto>`, `--max-videos N`. Las fichas que no son modalidad COAC se quedan sin el campo (hoy «El Balsero», obra teatral, y «Kike Remolino 2021»). «Los Belloteros» (1975) se guarda como Chirigota: se inscribió como chirigota, aunque el jurado le dio el premio de comparsa.

### Postura predeterminada por acorde
En el `<pre>` se puede fijar la postura con la que se abre un acorde con `data-postura`:
```html
<a data-postura="x 0 2 2 2 4">LaM7</a>
```
La postura se escribe de la 6ª a la 1ª cuerda (`x` = muda) y debe coincidir exactamente con una posición del glosario. El popover abre en esa posición, el acorde se marca con un asterisco y, si la pieza tiene alguna, aparece la leyenda «* Postura concreta para esta pieza» en «Acordes usados». La lógica está en `parsearPostura`/`indicePostura` (`src/lib/acordes.ts`). Ver skill `postura-predeterminada`.

### Dynamic Routes (`src/pages/`)
| Route | File |
|---|---|
| `/acordes/[id]` | `pages/acordes/[id].astro` |
| `/acordes3/[id]` | `pages/acordes3/[id].astro` — previsualización de una ficha en borrador (`noindex`, fuera del sitemap; no se enlaza desde ningún listado) |
| `/acordes2/[id]` | `pages/acordes2/[id].astro` — previsualización local de acordes importados (no versionada; `noindex`, fuera del sitemap) |
| `/lista2` | `pages/lista2.astro` — listado local de `acordes2` (no versionada; `noindex`, fuera del sitemap) |
| `/autor/musica/[autorSlug]` | `pages/autor/musica/[autorSlug].astro` |
| `/autor/letra/[autorSlug]` | `pages/autor/letra/[autorSlug].astro` |
| `/autores` | `pages/autores.astro` — listado de todos los autores (grid 2/1) |
| `/agrupacion/[agrupacionSlug]` | `pages/agrupacion/[agrupacionSlug].astro` |
| `/carnaval/[year]` | `pages/carnaval/[year].astro` |
| `/modalidad/[modalidad]` | `pages/modalidad/[modalidad].astro` — coplas de una modalidad |
| `/pieza/[tipo]` | `pages/pieza/[tipo].astro` — coplas de un tipo de pieza |
| `/decada/[decada]` | `pages/decada/[decada].astro` — coplas de una década |
| `/buscar` | `pages/buscar.astro` (búsqueda cliente con datos serializados) |
| `/glosario` | `pages/glosario.astro` — glosario de acordes con diagramas y buscador |
| `/glosario/[acorde]` | `pages/glosario/[acorde].astro` — página de un acorde (digitación, notas, coplas y relacionados) |
| `/reconocer-acorde` | `pages/reconocer-acorde.astro` — mástil interactivo que identifica el acorde por la postura (pública, con texto y ejemplos) |
| `/admin/stats` | Redirige a `/admin/?vista=stats` (301, `netlify.toml`) |
| `/admin/comentarios` | Redirige a `/admin/?vista=comentarios` (301, `netlify.toml`) |
| `/api/fetch-url` | `pages/api/fetch-url.ts` — proxy CORS (GET `?url=...`) |
| `/formateadores/*` | Redirigido a 404 por middleware (páginas existen pero ocultas) |

**Importante**: la lista de rutas que quedan fuera del sitemap está en `astro.config.mjs` (es la fuente de verdad: `/coming-soon`, `/en-construccion`, `/acordes2`, `/acordes3`, `/lista2`, `/admin`, `/estudio` y `/buscar`). Además emiten `noindex` `/acordes2`, `/acordes3`, `/lista2`, `/admin` y `/buscar`. `/formateadores` redirige a 404.

### Glosario de acordes
Los acordes del `<pre>` son interactivos: al pulsarlos se abre un popover con su diagrama.
- Datos: `src/data/glosario-acordes.json` (529 acordes, ~1.342 posiciones), generados una sola vez con `node scripts/importar-glosario.mjs` a partir del glosario público de LaCuerda.net. El script cachea en `.cache/glosario` (ignorado por git) y no se ejecuta en build.
- Renderizador único: `src/lib/diagrama.ts` (`svgDiagrama`) genera el SVG en build y en el navegador. No hay imágenes externas.
- Parser de notación española: `src/lib/acordes.ts` (`parsearAcorde`, `buscarEnIndice`, `slugAcorde`). Admite enarmonías, `7M`/`M7`, `m7/5`, `/add9`, bajos con barra y raíces en mayúsculas (`MIm`, `SI7`).
- Componentes: `DiagramaAcorde.astro`, `GlosarioPopover.astro` y `AcordesDeLaPieza.astro` (incluye la nota «Pincha en cualquier acorde…», encima del transportador). El popover vive en las fichas (cifrado y «Acordes usados»), no en `/glosario`.
- Anclas estables en `/glosario`: `#mi7`, `#do-sostenido-m7`, `#sol-sostenido-m`.
- **Páginas individuales**: cada acorde con posiciones tiene la suya en `/glosario/<slug>/` (`src/pages/glosario/[acorde].astro`, 529 en build). Lleva H1 con las dos notaciones («Acorde Do7 (C7) en guitarra»), un apartado «Cómo tocar Do7 en guitarra», todas las posiciones con diagrama grande y tabla de cuerdas, las **notas del acorde** (con la letra que les toca por grado), las coplas del cancionero que lo usan (índice invertido en `src/lib/coplas-por-acorde.ts`, memoizado) y un muro de acordes relacionados. Los textos y la notación inglesa están en `src/lib/glosario-acordes.ts` (puro). No llevan el JSON del índice ni el popover: los diagramas van en SVG desde el build. `node scripts/auditar-glosario-paginas.mjs` (después del build; también `npm run auditar:glosario-paginas`) comprueba que están las 529, con su H1 y diagrama.
- **Índice**: `/glosario` arranca plegado y no pinta diagramas. Las 17 fundamentales son `<details>` y dentro van los 529 enlaces a las páginas (nombre, notación inglesa y tipo). Los enlaces siguen en el HTML (se rastrean) y al pinchar uno se va directo a su página, sin popover. Pesa ~230 KB (~26 KB gzip) frente a los 1,38 MB de antes. El buscador filtra por nombre, notación inglesa y tipo, abre las fundamentales con resultados y las vuelve a plegar al borrar; el hash `#raiz-do` abre el grupo.
- El enlace manda `click_glosario_ver_acorde` (`ubicacion: indice`); en las fichas está en el panel «Acordes usados» (`ubicacion: ficha`) y en los relacionados (`ubicacion: relacionado`). El popover de las fichas/cifrado lleva «Ver acorde» encima de las flechas de posiciones (evento `click_glosario_popover_ver_acorde`).
- El buscador del glosario encuentra también por **notación inglesa**: `C7` → Do7, `Bb` → Sib.
- Reconocedor de acordes: `/reconocer-acorde` usa `src/lib/reconocer.ts` (`reconocerAcorde`) para identificar la postura por clases de altura, con el nombre más probable y alternativas. Funciona por teoría, esté o no la postura en el glosario: calcula las notas de las 6 cuerdas y busca el acorde que las contiene. `src/lib/reconocer-glosario.ts` (`mapaPosturas`) añade el nombre que usa la web y el enlace a `/glosario/<slug>/` cuando la postura exacta ya está en el glosario; si no, se usa el resultado teórico. La página es pública (texto, ejemplos, FAQ, `WebApplication` y `FAQPage`) y se enlaza desde `/glosario`, desde las 529 páginas de acorde, desde el panel «Acordes usados» de las coplas y desde el footer. Eventos: `click_reconocer_acorde_glosario` / `_pagina` / `_ficha` / `_footer`, `reconocer_acorde`, `click_glosario_desde_reconocer`, `limpiar_mastil` y `click_ejemplo_reconocer`. `npm run auditar:reconocer` comprueba 17 acordes comunes y 3 posturas inventadas fuera del glosario.
- Cobertura: `node --experimental-strip-types scripts/auditar-glosario.ts` falla si algún acorde válido del cancionero no tiene diagrama.

### Autoscroll
Implementado en `src/components/page/AcordeCard.astro`. Activado por el botón de play y regulado con 1x–5x, que se despliegan en vertical bajo el botón. El control flota en la esquina superior derecha del cifrado (`top: -22px`) y el contenedor del `<pre>` lleva `padding-top: 26px` para que no tape la primera línea; en móvil el botón mide 28 px.

### Transportador
Los botones viven en el bloque «Transportar acordes» de `AcordesDeLaPieza.astro` (debajo de la cejilla). La lógica está en `src/lib/transporte.ts` (`transportarEtiqueta`): cambia solo la raíz y el bajo, y conserva el sufijo y los espacios. `#glosario-datos` incluye las 12 transposiciones de cada acorde de la pieza, así que el popover y los diagramas del panel funcionan en cualquier tono. Tras transportar, `AcordeCard.astro` reparte los espacios de cada línea para que los acordes sigan sobre su sílaba. Sin persistencia; la cejilla no cambia.

### URLs y barra final
- **Las páginas se sirven siempre con barra final**: `/acordes/pasodoble-guenagente/`. Netlify responde **301** en `/acordes/pasodoble-guenagente` y **200** en la versión con barra. La canonical (`Layout.astro`, desde `Astro.url.pathname`) y el sitemap ya usan la barra, así que solo hay una URL indexable y no hay contenido duplicado.
- Los enlaces internos se escriben sin barra en el código, y la integración `src/integrations/enlaces-con-barra.mjs` (registrada en `astro.config.mjs`) reescribe el HTML generado para añadirla. Solo toca rutas que existan en el build (`dist/<ruta>/index.html`), así que nunca toca assets, `/api/` ni enlaces rotos. Sin esto, cada clic pagaba un 301 de más (una ida y vuelta completa) e inutilizaba parte del prefetch.
- Si se añade un enlace interno nuevo, **no hace falta poner la barra a mano**: la integración lo hace en el build. En `astro dev` los enlaces salen sin barra (Astro sirve las dos variantes), es normal.
- `node scripts/auditar-enlaces.mjs` (después de `npm run build`) falla si algún enlace interno apunta a una URL sin barra que Netlify redirigiría; también avisa de enlaces a páginas inexistentes (los de `acordes2`, que no se publica).
- **Si un script lee un `href` del DOM, quita la barra final antes de usarlo**: `href.replace('/acordes/', '').replace(/\/+$/, '')`. El buscador de `/buscar` se rompió justo por esto al añadir la barra.

### Buscador y sugerencias
- Motor en `src/lib/busqueda.ts` (`preparar`, `buscar`): normaliza sin tildes ni puntuación, exige que **cada palabra de la consulta case en algún campo y en cualquier orden**, y puntúa con pesos (agrupación 10 · autores 6 · pieza 5 · año 4). Tolera erratas (distancia ≤1, ≤2 en palabras largas, subsecuencia solo en palabras de longitud parecida) y busca años exactos. Si no hay resultados devuelve una `sugerencia` («quizá quisiste decir»). Es puro, sin DOM.
- Índice: `src/pages/indice-busqueda.json.ts` genera `/indice-busqueda.json` (~84 KB crudos, ~10 KB comprimido). El header **no lo descarga al cargar la página**: solo al abrir el buscador. `public/_headers` le da 1 día de caché.
- UI: `src/components/layout/SugerenciasBusqueda.astro`, montado dentro de `.search-container` en `Header.astro`. Muestra 6 sugerencias desde 2 caracteres (debounce 120 ms), con teclado (↑ ↓ Home End Enter Esc), `role=combobox/listbox/option`, `aria-activedescendant` y recuento en `aria-live`. Precarga la sugerencia resaltada con `prefetch()`. Se posiciona con JS para no salirse de la pantalla en móvil (`.search-wrapper` tiene `overflow: hidden`, así que el panel cuelga de `.search-container`).
- Sin JS el `<form action="/buscar/" method="get">` sigue funcionando igual. Las filas van directas a la ficha; no llevan `view-transition-name` a propósito (chocaría con la card del mismo slug que ya está en la página).
- `/buscar` es `noindex` y está fuera del sitemap: es una página de resultados. Las variantes `?q=` no se indexan y la canonical las neutraliza. **El `noindex` no afecta a las visitas ni a AdSense**: solo a la indexación.
- **`/buscar` no trae las cards en el HTML** (eran 3,8 MB): pide `src/pages/indice-tarjetas.json.ts` (`/indice-tarjetas.json`, ~290 KB crudos y ~33 KB comprimido, caché de 1 h en `_headers`) y las pinta en el navegador desde la URL (`?q=`), con la misma regla de siempre (texto normalizado sin tildes + `includes`) y el mismo orden (año ↓, fecha ↓). No es un listado: la página solo renderiza **una** card dentro de un `<template>` (el prototipo), y el script la clona y rellena sus `data-campo` (`ancla`, `imagen`, `pieza`, `letra`, `year`, `titulo`, `autores`). El bloque de resultados lleva un título pequeño («N resultados para» + el término buscado entre comillas y en negrita), sin la raya naranja que marca el H1 de la página. Al clonar se quita el `data-astro-transition-scope` de la instancia y se pone el `view-transition-name` de cada ficha en línea, para que el morph card → ficha siga funcionando. Como los estilos de la card son *scoped*, los nodos que haya que crear en JS copian las marcas `data-astro-cid-…` del prototipo. Los nodos nuevos se miden solos (`ResizeObserver` de `CardsGroup`) y los badges se ajustan con un `resize` (lo escucha `FitTextInit`). La lógica de presentación de la card (pieza visible, color del badge, autores y nombre completo) vive en `src/lib/tarjeta.ts` (`prepararTarjeta`) y la comparten `Card.astro` y el catálogo, para que no se desincronicen.
- `npm run auditar:buscar` (después del build) falla si `/buscar` vuelve a traer más de una card o pasa de 250 KB, si falta el `<template>` o algún `data-campo`, o si el catálogo no tiene una entrada por ficha con sus campos, sus `href` de autor con barra final y su página en el build.
- `node --experimental-strip-types scripts/auditar-busqueda.ts` comprueba el top-1 de 12 consultas reales (erratas, prefijos, orden libre, año, autor, tipo) y falla si el ranking se degrada.
- Eventos: `buscar_sugerencia_click` (con `origen`: `raton`|`teclado`), `buscar_ver_resultados` (con `origen`: `panel`|`formulario` y `total` en el panel) y `buscar_sin_resultados` (consulta truncada a 40 caracteres). Los que navegan fuera de la página se mandan con `transport_type: 'beacon'` para que no se pierdan al descargar la siguiente.

### Canales de avisos (WhatsApp, Telegram, X y push)

Resumen: los enlaces de los canales viven en `src/data/canales.json` y `CanalCallout.astro` los pinta en la home y en `/pedir-copla`. **Telegram se publica solo** desde `.github/workflows/difundir.yml` cuando el push añade `.md` en `src/content/acordes/`; con `[sin aviso]` en el asunto (o `SALTAR_AVISO=1`) no sale nada. El mismo workflow lanza `scripts/push.mjs` para las notificaciones de la PWA. WhatsApp (`npm run wa`) y X (`npm run x`) se lanzan desde el PC con tu Chrome, nunca desde CI, y no tienen API oficial. El texto de todos los canales sale de `scripts/lib/aviso.mjs`.

El detalle (formato del mensaje, flags de cada script, worker de push, VAPID, secretos y eventos) está en `docs/operativa/avisos.md`: **léelo antes de tocar avisos**.

### Prefetch y transiciones de página
- **Prefetch**: `prefetch: { prefetchAll: true, defaultStrategy: 'hover' }` en `astro.config.mjs`. Precarga el HTML de los enlaces al pasar el ratón o al enfocar con teclado, descarta conexiones lentas (`saveData`, 2g) y enlaces externos. En táctil no hay hover, así que `src/components/utils/PrefetchTap.astro` precarga en `pointerdown` con `prefetch()` de `astro:prefetch` (comparte la lista de URLs ya precargadas; no duplica peticiones).
- **Transiciones**: view transitions cross-document nativas con `@view-transition { navigation: auto }` en `global.css`. **No** se usa `ClientRouter` (se quitó para que funcione AdSense Auto Ads): la navegación sigue siendo una carga completa, así que AdSense, GTM, GA4, el contador propio y el CMP funcionan igual. Chrome/Edge 126+ y Safari 18.2+; con `prefers-reduced-motion: reduce` se desactivan.
- El morph card → ficha se hace con el título y con la imagen: `transition:name` con `titulo-${slug}` en el `h3.card-title` (`Card.astro`) y en el `h2` de `AcordeCard.astro`, e `img-${slug}` en las dos imágenes. Astro emite las animaciones `astroFadeIn`/`astroFadeOut` pero no sus keyframes: están definidos en `global.css`.
- **La imagen conserva su recorte original**: la card usa `height: 220px` (180 px en móvil) y la ficha `360px` de ancho con `min/max-height` 225/240. Como las proporciones no coinciden (la card es casi cuadrada y la ficha 3:2), el morph de la imagen es un zoom con cambio de encuadre, no un morph perfecto. Si algún día se igualan las proporciones, el morph queda limpio; si se desactiva, basta con quitar `img-${slug}` de las dos imágenes.
- `node scripts/auditar-view-transitions.mjs` (después de `npm run build`) falla si algún HTML repite un `view-transition-name` en la misma página o si `@view-transition` no sobrevive al build.

### Tareas en Trello
El trabajo pendiente vive en el tablero `https://trello.com/b/vwbp5cJ5/acordes-gadiranos` (tres columnas: **Pendiente**, **En curso**, **Finalizado**). Se llega a él con el **CLI** (`npm run trello`), sin MCP ni watcher.

Credenciales en `.env` (gitignored): `TRELLO_KEY` y `TRELLO_TOKEN` con scope `read,write`, sacados en <https://trello.com/power-ups/admin> → aplicación → **Autorización** → **Autenticación Trello** → **Añadir** (el `SECRETO` no se usa). `TRELLO_TABLERO` (por defecto `vwbp5cJ5`) y, si se renombran las columnas, `TRELLO_LISTA_PENDIENTE`, `TRELLO_LISTA_CURSO` y `TRELLO_LISTA_FINAL`. Sin credenciales, el CLI sale con código 2 y el motivo.

**Avisos al móvil (`TRELLO_BOT_KEY`, `TRELLO_BOT_TOKEN`)**: Trello no notifica tus propias acciones, así que un comentario escrito con tu token no enciende la campanita. Si están las claves de la cuenta bot (miembro del tablero), `scripts/trello.mjs` escribe **solo los comentarios** con ella y le añade `@<usuario>` al final (es lo único que dispara la notificación; sin mención no avisa), con el usuario de `TRELLO_AVISAR_A` (por defecto `javicordero1`). Leer y mover siguen con tu token. Sin las claves todo funciona igual, con un aviso por consola.

- **Órdenes del CLI**: `listas`, `pendientes [--json]`, `ver <tarjeta>`, `empezar <tarjeta>`, `terminar <tarjeta>`, `mover <tarjeta> <lista>`, `comentar <tarjeta>` y `titular <tarjeta> --titulo "…"` (pasa el título largo a la descripción y pone un título corto numerado). `<tarjeta>` acepta el id, el `shortLink` o un trozo del título (si es ambiguo lista los candidatos y sale con código 4). El texto de los comentarios va con `--texto`, `--texto-archivo` o por stdin; `--simular` enseña lo que haría sin escribir.
- **Flujo** (skill `trello`): leer `pendientes` → `ver` la tarjeta **en orden: título →
  descripción → comentarios** (los comentarios van enteros y mandan si contradicen al
  título) → `empezar` (la pasa a En curso, al final de la columna) → comentar el **plan** en modo plan (solo lectura) → **parar y pedir aprobación** → solo entonces implementar y verificar, sin commit → comentar «ya está implementado» y quedarse en En curso → solo cuando el usuario lo pida («haz commit y push») commit + push y `terminar` con la URL del commit; si no lleva commit, «finaliza sin commit» pasa directo a Finalizado. «Siguiente tarea» es una orden de planificar: nunca se implementa en el mismo turno sin un «adelante» explícito. Si se bloquea o el plan se descarta, no se cierra: se comenta y se queda en En curso o vuelve a Pendiente.
- **Tarjetas de letras**: una tarjeta puede pedir una letra nueva en vez de una tarea («nueva letra comparsa el cementerio», «pasodoble el cementerio», o con la letra/URL en la descripción). Se reconocen con `npm run letras -- reconocer "<título + descripción>"`, se apuntan en `letras-pendientes.md`, se busca y formatea la letra con la skill `letra-alternativa` (ficha en `acordes`, sin commit) y se dejan en «Por revisar» con `npm run revisar -- --anadir <slug>`. Se hacen **directamente, sin plan previo**; solo se para a preguntar si falta la base, no aparece la letra o hay varias candidatas. El barrido de la cola de letras es otra tarea. El panel `/admin` sigue siendo el sitio de revisión y publicación.
- La API de Trello exige `key`+`token` incluso en tableros públicos: sin credenciales no hay lectura. Si el token caduca, se repite el enlace `https://trello.com/1/authorize?...&key=<TRELLO_KEY>`.

### Redirects
- `public/ads.txt` — archivo estático de AdSense (`google.com, pub-3280015847198273, DIRECT, f08c47fec0942fa0`)
- `public/redirects.json` — mapa de 300+ URLs legacy → nuevas rutas (usado client-side)
- `public/redirects-from.json` — lista de URLs legacy

### Vídeos de YouTube
- Cada ficha tiene un `video:` (embed) y, si hay, un `cover:` (guitarra). El estado del vídeo principal se guarda en `src/data/videos-estado.json`: `ok`, `muerto` (404/401) o `bloqueado` (403, el autor no permite incrustarlo).
- `npm run videos` audita con el oEmbed de YouTube y reescribe ese JSON. No se ejecuta en build (son ~440 peticiones): se pasa antes de publicar o cuando se toque el cancionero. Si una consulta falla por red o 429 se conserva el estado anterior; con `--solo` se conserva el resto del cancionero.
- `npm run videos -- --detalles` (o `npm run videos:detalles`) completa `fecha` (fecha de subida) y `duracion` (segundos) leyendo la página del vídeo, **solo en los que les faltan**: son los datos que necesita el `VideoObject` de la ficha. YouTube limita las peticiones (429), así que si quedan vídeos sin datos se vuelve a pasar más tarde (solo pide los pendientes).
- `src/lib/videos.ts` lo lee en la ficha (`estadoDeVideo`, `datosDeVideo`, `enlaceYoutube`, `busquedaYoutube`) y monta la fachada (`miniaturaYoutube`, `urlIncrustada`). `YoutubeCard` pinta la fachada solo si está `ok`: si está `muerto` muestra un bloque con enlace a la búsqueda en YouTube, y si está `bloqueado` un enlace directo a `watch?v=`. Sin datos se asume `ok`, para no ocultar un vídeo nuevo.
- **Recambio**: `npm run videos -- --buscar` busca la **actuación completa** de la agrupación en `@ONDACADIZCARNAVAL`, `@carnavalsur` y `@cadizbooktv8695`, en ese orden. Escribe `videos-candidatos.md` y `src/data/videos-candidatos.json`. Filtros: el título debe llevar todas las palabras de la agrupación, no puede ser de otro año (título, `COACnn` o fecha de subida si es ≥2015), ni una pieza suelta, ni antología/homenaje/entrevista/resumen/carnaval chiquito, y tiene que durar ≥10 min. El canal se verifica con el `author_name` de oEmbed, porque el buscador de CADIZBOOKTV cae a resultados generales.
- `npm run videos -- --aplicar` escribe el vídeo elegido **solo en las fichas caídas** de esa agrupación y año (nunca cambia uno que funciona). Para descartar un grupo, `"aplicar": false` en el JSON. `--solo <texto>` limita a una agrupación y fusiona con lo ya revisado.
- **Fachada**: el reproductor no se carga al abrir la ficha. `YoutubeCard.astro` pinta un enlace a YouTube con la miniatura (`i.ytimg.com/vi/<id>/mqdefault.jpg`, 2x `hqdefault.jpg`) y un play; al pulsarlo, un script delegado del propio componente inyecta el `<iframe>` con `youtube-nocookie.com/embed/<id>?autoplay=1` y manda `click_video_youtube` (parámetro `tipo`: `oficial` | `cover`). Sin JS el enlace abre YouTube, y con Ctrl/Cmd/Shift/Alt o botón central también. Si el vídeo no está `ok` o de la URL no se saca el id no hay fachada: se queda el bloque de estado. La miniatura que da 404 oculta la imagen y deja el play sobre el fondo. `npm run auditar:fachada` (después del build) falla si queda un iframe de YouTube en el HTML o si falta una fachada.
- Los covers no se auditan (se asume `ok`).

### PDF Generation
`node scripts/generate-pdf.mjs src/content/acordes/<slug>.md`
Genera un PDF al lado del .md. Requiere `fonts/RobotoMono-*.ttf` (fallback a Courier).

### Glosario de acordes (datos)
`node scripts/importar-glosario.mjs [--dry-run] [--force] [--only <texto>]`
Genera `src/data/glosario-acordes.json` desde el glosario público de LaCuerda.net. Cachea las respuestas en `.cache/glosario` y espera 400 ms entre peticiones. No se ejecuta en build.

`node --experimental-strip-types scripts/auditar-glosario.ts`
Audita la cobertura: recorre `src/content/acordes` y falla si algún acorde válido no tiene diagrama. Requiere Node ≥ 22.6.

`node --experimental-strip-types scripts/sugerir-acorde.ts "Mi9"`
Comprueba si un acorde existe en el glosario y, si no, sugiere acordes parecidos disponibles (misma fundamental, enarmonía y sufijos similares).

### Limpieza de espacios en los `<pre>`
`node scripts/trim-pre-whitespace.mjs [--dir <carpeta>] [--archivo <ruta>] [--publicadas] [--check] [--dry-run] [--quiet]`
Quita espacios y tabuladores al final de línea **solo dentro de `<pre>…</pre>`** (la indentación inicial se conserva). Por defecto recorre `src/content/acordes` y `src/content/acordes2`. `--archivo` limita a fichas concretas (repetible), `--publicadas` solo mira las que están en `HEAD` (deja fuera las nuevas sin commitear) y `--check` no escribe: lista `ruta:línea` y sale con 1 si queda alguna cola. Es idempotente; útil después de importar o formatear acordes.

La cola no se ve pero cuenta: `AnchoPreInit` mide el `scrollWidth` del `<pre>` para encoger la letra de la copla y el editor del panel la suma al límite de 55 columnas. Por eso la publicación la limpia **por ficha**: `scripts/publicar-acorde.mjs` limpia las fichas de su plan antes de las auditorías, lo deja en el resumen (`limpiadas`) y falla si quedara alguna (igual que hace el paso 4-bis de la skill `subir-acorde`). Las fichas ya commiteadas pero sin push no se tocan, para no dejar cambios fuera del commit. Las publicadas antiguas se limpiaron en bloque con `--publicadas` (160 fichas, 1.936 líneas) en un commit propio, sin tocar las nuevas sin publicar.

### Importación de cancionero (local, no versionada)
Las herramientas y el contenido de esta importación viven solo en local y están en `.gitignore`: `scripts/importar-cancionero.mjs`, `src/pages/lista2.astro`, `src/pages/acordes2/`, `.agents/skills/promover-acorde/` y los `.md` de `src/content/acordes2/`. La colección `acordes2` sí se declara en `src/content/config.ts` para que esas páginas compilen.

`node scripts/importar-cancionero.mjs [opciones]`
Extrae las fichas de `guitarradegades.com/p/cancionero.html` y genera `.md` en `src/content/acordes2/` (colección provisional, acordes sin envolver).
- `--inventory` lista solo las URLs; `--dry-run` no escribe; `--only <valor>` y `--limit <n>` filtran.
- `--index-file <ruta>` / `--ficha-file <ruta>` permiten trabajar con HTML local sin red.
- Busca el vídeo en YouTube (query `Modalidad Agrupación`, primer resultado, sin API key); `--no-youtube` lo desactiva y `--fill-videos` rellena los vídeos por defecto de los `.md` ya generados.
- Omite los acordes que ya existen en `acordes` (slug `pieza-agrupacion`) y avisa de posibles duplicados.
- La promoción `acordes2` → `acordes` se hace con la skill `promover-acorde`, que envuelve los acordes en `<a>` y pone la fecha del día.
- `npm run importar:borrador -- --slug <slug>[,<slug>] [--dry]` pasa una ficha de `acordes2` a los borradores (`acordes3`) envolviendo ya los acordes con el mismo envoltorio del editor; es lo que hace el botón **A borradores** de la pestaña **Acordes2** del panel (solo en local). Después se revisa y se promueve como cualquier borrador.

### SEO & Analytics
- Site: `https://acordesgaditanos.com`
- Google Tag Manager: `GTM-MZG7K2Q4`
- Google Adsense: `ca-pub-3280015847198273`
- Claves en `src/lib/constants.ts`
- **Imagen social**: la ficha manda como `og:image`/`twitter:image` la **foto de la agrupación** (`img` del frontmatter). El resto de páginas usa `/og-image.jpg`. No hay tarjetas generadas en el build.
- **Datos estructurados**: `src/lib/schema.ts` monta el `VideoObject` del vídeo de YouTube (solo si está `ok` y se conoce la fecha de subida; incluye miniatura, duración y `embedUrl`). El resto de esquemas se quedaron como estaban (Article, WebPage, MusicComposition y BreadcrumbList sin cambios).
- **Sitemap con `lastmod`**: `scripts/lib/fechas-sitemap.mjs` lee las fechas del frontmatter (fichas, `/`, `/novedades/` y `/carnaval/<año>/`) y `astro.config.mjs` las pone en `serialize`. No es la fecha del build.
- **Auditor SEO**: `npm run auditar:seo` (después de `npm run build`) comprueba que cada ficha con vídeo operativo tiene su `VideoObject` completo y que el sitemap lleva el `lastmod` de cada ficha. Sale con 1 si algo falla.
- **`<title>` de la ficha** (`tituloSeo` en `src/lib/letras.ts`): pieza, agrupación, nombre de la copla, guion y año, sin la marca. `Acordes Pasodoble Los Colgaos "Y en el Gran Astillero" - Carnaval 2024`. El nombre sale de `letraTitulo` o, si no lo hay, de la `fraseClave` recortada a 35 caracteres por palabra completa (`recortarFrase`), y se descarta si es puro tarareo (`esRelleno`); si la `pieza` ya lo trae entrecomillado (`Cuarteta "Castigo divino"`), no se repite. La agrupación se acorta con puntos suspensivos (`acortarNombre`) solo cuando el título pasa de 100 caracteres. Sin nombre queda `Acordes Popurrí Los Ángeles Caídos - Carnaval 2002`. De ahí salen también `og:title` y `twitter:title`; el H1, el breadcrumb y los schemas no cambian.
- Eventos del glosario: `click_novedad_glosario`, `click_acordes_usados_ver_mas` / `click_acordes_usados_ver_menos`, `click_acorde_pre`, `click_acorde_usado`, `click_acorde_glosario`, `click_glosario_acordes_usados`, `click_glosario_ver_acorde` (parámetros `acorde` y `ubicacion`: `indice` | `ficha` | `relacionado`) y `click_glosario_popover_ver_acorde` (el enlace «Ver acorde» del popover; parámetros `acorde` y `origen`: `indice` | `ficha` | `cifrado`, con `transport_type: beacon`).
- Eventos del reconocedor: `reconocer_acorde` (parámetros `acorde`, `exacto` y `postura`), `click_glosario_desde_reconocer` (`acorde` y `slug`), `limpiar_mastil`, `click_ejemplo_reconocer` (`acorde`) y los enlaces de entrada `click_reconocer_acorde_glosario`, `click_reconocer_acorde_pagina`, `click_reconocer_acorde_ficha` y `click_reconocer_acorde_footer` (un evento por sitio, sin `ubicacion`).
- Eventos del transportador: `transpose_acorde` (parámetros `direccion` y `semitonos`).
- Eventos de "ver más" de la home: `ver_mas_novedades_click` y `ver_mas_autores_click` (parámetros `link_type` y `location`).
- Eventos de los hubs de la home: uno por card, `click_hub_<eje>_<slug>` (`click_hub_decada_anos_2020`, `click_hub_pieza_pasodobles`…), con los guiones del slug cambiados por `_` porque GA4 no los admite; parámetros `hub` (slug exacto, con guiones) y `ubicacion`.
- Eventos de las cards de autor: `click_autor_card`, `click_autor_card_musicas` y `click_autor_card_letras` (parámetros `autor` y `ubicacion`).
- Eventos de los canales de avisos: `click_canal_home`, `click_canal_pedir_copla` y `click_canal_suscribirse` (parámetros `canal` y `ubicacion`), más `click_canal_info_pedir_copla` para el enlace a `/suscribirse`. Un evento por página para verlo directo en GA4.
- Eventos de los filtros de `/lista`: `filtrar_lista` (parámetros `faceta`, `valor`, `marcado` y `total`, las coplas que quedan), `limpiar_filtros_lista` (parámetros `alcance` —`uno` o `todos`— y `faceta`), `abrir_filtros` (parámetro `filtros`, cuántos había puestos al desplegar) y `buscar_en_filtro` (parámetros `faceta`, `consulta` truncada a 40 caracteres y `resultados`, con 600 ms de espera desde la última tecla).

### Anuncios: solo fuera de desarrollo
Los anuncios de AdSense (y la medición de GA) **no se cargan** en los hosts de desarrollo ni en las rutas privadas. El criterio es una **lista negra**, no una lista blanca: la web sigue anunciando en cualquier dominio que no esté en la lista (incluidos dominios nuevos o previews de otros servicios).

- La lista vive en `src/lib/anuncios.ts`: `HOSTS_SIN_ANUNCIOS` (local), `SUFIJOS_SIN_ANUNCIOS` (`.local`, `.devtunnels.ms`, `.ngrok*`, `.trycloudflare.com`, `.loca.lt`, `.netlify.app`), cualquier IPv4 literal y `RUTAS_PRIVADAS` (`/estudio`, `/acordes2`, `/acordes3`, `/lista2`, `/admin`). `anunciosPermitidos(hostname, pathname)` es la función pura que lo decide.
- **Si aparece un proveedor de túnel nuevo** (o un preview de otro servicio), hay que añadir su sufijo en `SUFIJOS_SIN_ANUNCIOS`. Es el único sitio que hay que tocar.
- `Layout.astro` lleva un `<script is:inline>` en el `<head>` (recibe las listas con `define:vars`) que calcula `window.__agAnuncios` y, si no se permite, marca `<html data-anuncios="off">` y apaga GA (`ga-disable-…`). Justo después, otro `<script is:inline>` **inyecta** el loader de `adsbygoogle.js` solo si `__agAnuncios`; **no** volver a ponerlo como `<script src>` fijo en el head (se cargaría en túneles, previews y local).
- `global.css` oculta los `.adsbygoogle` y sus contenedores (`[data-anuncios="off"]`), para que no queden huecos ni márgenes.
- Los componentes `<ins>` no se tocan: sin la librería cargada son un `<ins>` vacío y el `push({})` no hace nada.
- `SCRIPT_ADSENSE` (en `src/lib/anuncios.ts`) monta la URL desde `SEO.adsenseAccount`; `loadAdsense()` de `cookiesConsent.ts` mantiene el mismo guardia como red de seguridad.
- El `<meta google-adsense-account>` y el `ca-pub` de los `.ins` siguen en el HTML: son estáticos y sirven para verificar el dominio.

### PostCSS
`postcss.config.cjs` usa `postcss-nesting` (anidamiento CSS nativo) y `postcss-preset-env` (stage 1). Sin Tailwind.

## Available Agent Skills
Skills en `.agents/skills/`. Solo hay dos externas a propósito: **no añadir genéricas** (Node, TypeScript, SEO, diseño, README…) salvo que se vayan a usar de verdad, y apuntarlas aquí.

**Propias** (el flujo del proyecto):
- `chord-formatting` — envolver acordes en `<a>` tags
- `postura-predeterminada` — fijar la postura con la que se abre un acorde concreto con `data-postura`
- `cifrado-a-formato` — convertir cifrado pegado de otra web al formato propio (línea de acordes + letra con palabras completas)
- `create-acorde` — crear nuevo archivo markdown de acorde
- `promover-acorde` — mover acordes revisados de `acordes2` a `acordes` (local, no versionada)
- `letra-alternativa` — aplicar los acordes de una ficha a una letra nueva de la misma música
- `prs-acordes3` — listar y fusionar las PRs de los borradores que se guardaron desde el móvil
- `trello` — leer las tarjetas pendientes del tablero, pasarlas a «En curso», planificarlas, implementarlas y cerrarlas; también atiende las tarjetas de letras nuevas (reconocer la copla, buscar la letra, poner acordes y mandarla a «Por revisar»)
- `subir-acorde` — ajustar la fecha al día siguiente del último publicado y hacer commit + push
- `transportar` — transponer acordes de tonalidad
- `tweet-acorde` — generar tweet para anunciar acorde
- `create-readme` — crear o actualizar el README del proyecto (es genérica, pero se usa)

**Externas** (opcionales):
- `astro-framework` — APIs de Astro 5 que este documento no cubre (content layer, view transitions, server islands, sessions). Referencias en `.agents/skills/astro-framework/references/`.
- `accessibility` — auditoría WCAG 2.2.

## Content Template
Usar `src/content/template.md` como referencia:
```yaml
pieza: Pasodoble|Presentacion|Popurri|Cuarteta|Tango|Estribillo
agrupacion: Nombre de la agrupación
year: 2025
musica: Autor1, Autor2 (separados por coma)
letra: Autor1, Autor2
letraTitulo: "Título de la letra alternativa" (opcional, solo en la variante)
modalidad: comparsa (opcional)
img: URL de imagen
cejilla: 1-12 (opcional)
video: URL YouTube embed
date: "DD/MM/YYYY"
fraseClave: "Frase destacada" (opcional)
destacada: 1-999 (orden en portada, opcional)
recomendada: true (opcional)
cover: URL (opcional)
autorCover: Nombre (opcional)
```

