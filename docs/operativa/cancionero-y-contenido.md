# Cancionero y contenido

Referencia técnica del modelo de contenido, el formato de las fichas y las herramientas del cancionero. Consulta solo las secciones relevantes para la tarea; los flujos de trabajo están en las skills indicadas en `AGENTS.md`.

## Arquitectura SSG
Sitio 100% estático (SSG) con Astro content collections. Middleware solo redirige `/formateadores` y `/coming-soon` → 404.

## Colecciones de contenido (`src/content/config.ts`)
- **`acordes`** — más de 570 entradas. Frontmatter: `pieza`, `agrupacion`, `musica`/`letra` (strings separados por coma), `year` (number → string), `date` (formato español `DD/MM/YYYY`), `cejilla` (number → string), `video`, `img`, `cover`, `autorCover`, `fraseClave`, `destacada`, `recomendada`, `modalidad` y `letraTitulo` (opcionales). La `modalidad` está rellena en casi todas las fichas con `npm run modalidad`; las que falten quedan en `.cache/modalidad-dudas.csv`.
- **`autores`** — 12 autores. Frontmatter: `nombre`, `img`, `type` (`musica`|`letra`), `order`, `destacado`.
- **`donaciones`** — un solo `datos.md` con la lista de donantes (`donaciones: [{ fecha, importe, donante? }]`); la pinta `DonationIndicator.astro`. El rotativo del hero baraja los nombres en cada visita (Fisher–Yates) para que el primero no sea siempre el más reciente; las demás variantes (`pills`, `inline`, `destacado`) siguen por fecha.
- **`acordes3`** — borradores del panel `/admin`: fichas nuevas o a medias que aún no se publican. Se promueven a `acordes` con `npm run promover`. Una ficha que solo existe en el ordenador (sin subir) vive aquí, no en `acordes`: el panel la lista con la marca LOCAL y `npm run letras -- auditar` la da por buena aunque no esté publicada.
- **`acordes2`** — colección provisional para los acordes importados del cancionero. Mismo esquema que `acordes`, pero su contenido (`.md`) no se versiona y los acordes van sin envolver en `<a>` hasta que se promueven.

Slugs se generan automáticamente (lowercase, sin tildes, guiones). El transform también produce `musicaSlugs`, `letraSlugs`, `agrupacionSlug`.

**Normalización del contenido.** `pieza`, `agrupacion` y `modalidad` se normalizan al cargar con `normalizarPieza` / `normalizarAgrupacion` / `etiquetaModalidad` (`src/lib/contenido.ts`): el tipo base a su forma canónica (`Final de Popurrí` / `Final de popurri` / `Final de popurí` → `Final de popurrí`, `pasodoble` → `Pasodoble`, `presentación` → `Presentación`), la modalidad (`Chrigota` → `Chirigota`) y la grafía de las agrupaciones que aparecían de varias formas (`Los peregrinos` → `Los Peregrinos`; el mapa está en `AGRUPACIONES`). Se conserva el título entrecomillado (`Cuarteta "Castigo divino"`) y el calificador (`Pasodoble inédito`, `Pasodoble original`, `Pasodoble Noly`; los adjetivos van en minúscula). El slug **no** cambia: sale del nombre del archivo (`normalizeSlug` no distingue mayúsculas ni tildes).
- `npm run normalizar:contenido [-- --dry] [--dir <carpeta>]` escribe la forma canónica en los `.md`; toca solo las líneas de esas claves del frontmatter (no lo re-serializa). También normaliza **autores**: quita el punto final y resuelve los alias de `ALIAS_AUTORES` (`Germán García Rendón` → `Germán Rendón`, `Ángel Luis Silva Benzo` → `Ángel Luis Silva`, `Juan Manuel Romero Bey` → `Juanma Romero Bey`, con su 301 en `netlify.toml` porque cambia la URL del autor) y unifica las variantes que solo se diferencian en tildes o mayúsculas dejando la forma más usada (`German Rendón` → `Germán Rendón`). `Manolo` y `Manolín Santander` son personas distintas y no se tocan. Los **nombres de archivo** (y por tanto los slugs) no se normalizan: cambiarlos rompe la URL y obliga a un 301; el auditor solo avisa de los que no siguen el patrón `pieza-agrupación…`.
- `npm run auditar:contenido [-- --sin-red]` es el auditor de fondo del cancionero: pieza/agrupación/modalidad/autores sin normalizar, campos obligatorios vacíos, claves mal escritas (`fraseclave`), fechas imposibles o anteriores al año, duplicados (misma agrupación + año + pieza + primer verso), variantes del mismo autor, agrupaciones con varias grafías, vídeos sin auditar y **imágenes 404** (caché de 30 días en `.cache/contenido-imagenes.json`; `--sin-red` no sale a internet). `cover` no es una imagen: es el vídeo de la versión a la guitarra (`autorCover`), y no se audita. No repite `auditar:letras`, `auditar:orden` ni `npm run videos`.

## Formato de acordes
Cada acorde envuelto en `<a>etiqueta</a>` dentro de `<pre>`. El script `scripts/generate-pdf.mjs` parsea este formato.
```
<pre><a>LaM7</a>            <a>Mi7</a>               <a>Sim7</a>
Bendita suerte pal aficionao que más de un mes de
```

En los popurrís, los cambios de cejilla a mitad de copla se marcan con `<strong>Cejilla: 4</strong>` (o `<strong>Cejilla: No</strong>` cuando se toca al aire), **solos en su línea y sin espacios alrededor**: `AcordeCard.astro` los pinta como el chip `.acorde-meta` (icono de cejilla + texto en mayúsculas, centrado).

Las anotaciones entre paréntesis que van en la línea de acordes (`<a>(Sorda)</a>`, `(Pito)`…) **también se envuelven en `<a>`**: cuentan como línea de acordes aunque estén solas, y el editor las reconoce (en gris) y las envuelve al guardar, **también las que ya estaban sin etiqueta aunque la línea no se toque**. Con su etiqueta se conserva la `data-postura` si la tenía.

## Letras alternativas de una misma música
Una misma música puede tener varias letras. Cada letra es una ficha propia (`.md` + URL), para que se pueda buscar por el título de esa letra; no se meten varias letras en la misma página.
- Campo opcional `letraTitulo` en el frontmatter (solo en la ficha de la letra alternativa). El título se muestra en el badge de la card, en el bloque «Letras de este pasodoble» y en los avisos; el título de la ficha sigue siendo `Pasodoble Los Colgaos`.
- La relación es **implícita**: misma `agrupacion`, `year` y tipo base (`pasodoble`), siempre que al menos una ficha del grupo tenga `letraTitulo`. La ficha original no se toca.
- En la card, el badge de la letra va debajo del de pieza; en el desplegable de sugerencias, debajo del badge de pieza; en la ficha, un bloque «Letras de este pasodoble».
- De momento solo se agrupan pasodobles (`TIPOS_CON_LETRAS` en `src/lib/letras.ts`). Para otros tipos, añadirlos ahí.
- `npm run auditar:letras` valida que el título no se repita en el grupo, que las fichas compartan música y que las variantes no lleven `destacada` (sí pueden llevar `recomendada`).

## Poner los acordes de una ficha a una letra nueva
Cuando una música tiene otra letra, los acordes caen sobre las mismas sílabas. `scripts/aplicar-acordes.mjs` reparte la letra con la métrica de la ficha base y coloca cada acorde alineando el patrón de acentos del verso. La parte que decide (qué líneas forman cada verso) la lleva el agente siguiendo la skill `letra-alternativa`; el script solo hace la aritmética de sílabas y columnas.

- `npm run acordes:plan -- --base <slug>` — esqueleto de la base (nº de verso, sílabas y el acorde sobre su sílaba: `Lam«Y» Mi7«nor»`) y de la letra pegada (`L1 5s Cinco años`). Sirve para decidir el reparto antes de generar.
- Marcas en el `.txt` de la letra: `---` sola corta entre líneas, `|` corta entre palabras (`Apaleado | y humillado`) y `-` sola salta un verso de la base sin gastar letra. Sin marcas, el reparto es automático (programación dinámica).
- `npm run acordes:aplicar -- --base <slug> --letra <txt> --titulo "..."` — escribe `src/content/acordes/<pieza>-<agrupación>-<título>.md` con el frontmatter de la base (cambia `letraTitulo`, `fraseClave` y `date`, y autores/vídeo si se pasan). `--hermanas` añade las fichas de la misma pieza, agrupación, año **y autoría de música** como candidatas; `--destino acordes2` escribe en la colección provisional. El informe marca `⚠️` (más de una sílaba de desfase) y `~` (una).
- `npm run acordes:revisar -- --slug <slug> [--base <slug>]` — editor local en el puerto 4324, **en modo texto**: tres columnas con la ficha original a la izquierda, el `<pre>` editable en el centro (acordes sin las etiquetas, encima de su sílaba) y la ficha base a la derecha. **Alt+←/→** mueve el acorde una columna, se puede escribir y pegar como en cualquier editor, y al guardar se vuelven a envolver los acordes en `<a>` conservando los `data-postura`. Antes de escribir comprueba que no haya tokens inválidos, acordes perdidos ni columnas fuera de la letra, y deja respaldo en `.cache/planes/<slug>.bak.md`. Los acordes que no están en el glosario salen en ámbar (y avisan al guardar). Marca igual que el panel lo que pasa de 55 columnas. Con `--silabas` se abre el revisor antiguo, que mueve por sílaba en vez de por columna.
- `npm run auditar:pre` — red de seguridad del editor: desenvolver y volver a envolver todas las fichas de `acordes` tiene que dar exactamente el mismo `<pre>` (incluidos `data-postura`, `(Sorda)` y los espacios). Si falla, el editor no es de fiar.

- `npm run auditar:editor` — prueba las operaciones de estructura del editor (separar y juntar por palabras) con casos fijos: `data-postura`, `(Sorda)`, corte por el inicio/fin de la palabra, ida y vuelta y ficha sin línea de acordes. Falla si el `<pre>` resultante no es el esperado.

- `npm run acordes:evaluar` — mide aplicando los acordes de una ficha a la letra de su hermana. Empareja por orden de aparición (no «el mismo acorde más cercano») y cuenta exactos / ±1 / **>1 sílaba**. Contra fichas hechas a mano el 100 % exacto no existe (se llevan ±1 entre sí), así que el número que importa es el de >1. `--pares a>b,c>d` elige pares, `--max-fuera 12` lo usa como tope y sale con 1 si empeora. Baseline de las fichas actuales: ~61 % exactos, ~28 % ±1, ~9 % >1.
- `npm run auditar:acordes` — relee y repinta todas las fichas de `acordes` y comprueba que no se pierde ningún acorde ni cambia de sitio. La primera pasada normaliza (quita espacios de más y pega cada acorde a su sílaba); a partir de ahí el dibujo tiene que ser idéntico. Falla si una ficha no se puede leer o pierde acordes.

## Buscar la letra en internet y llevar la cola
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

## Generación de PDF
`node scripts/generate-pdf.mjs src/content/acordes/<slug>.md`
Genera un PDF al lado del .md. Requiere `fonts/RobotoMono-*.ttf` (fallback a Courier).

## Limpieza de espacios en los `<pre>`
`node scripts/trim-pre-whitespace.mjs [--dir <carpeta>] [--archivo <ruta>] [--publicadas] [--check] [--dry-run] [--quiet]`
Quita espacios y tabuladores al final de línea **solo dentro de `<pre>…</pre>`** (la indentación inicial se conserva). Por defecto recorre `src/content/acordes` y `src/content/acordes2`. `--archivo` limita a fichas concretas (repetible), `--publicadas` solo mira las que están en `HEAD` (deja fuera las nuevas sin commitear) y `--check` no escribe: lista `ruta:línea` y sale con 1 si queda alguna cola. Es idempotente; útil después de importar o formatear acordes.

La cola no se ve pero cuenta: `AnchoPreInit` mide el `scrollWidth` del `<pre>` para encoger la letra de la copla y el editor del panel la suma al límite de 55 columnas. Por eso la publicación la limpia **por ficha**: `scripts/publicar-acorde.mjs` limpia las fichas de su plan antes de las auditorías, lo deja en el resumen (`limpiadas`) y falla si quedara alguna (igual que hace el paso 4-bis de la skill `subir-acorde`). Las fichas ya commiteadas pero sin push no se tocan, para no dejar cambios fuera del commit. Las publicadas antiguas se limpiaron en bloque con `--publicadas` (160 fichas, 1.936 líneas) en un commit propio, sin tocar las nuevas sin publicar.

## Importación de cancionero (local, no versionada)
Las herramientas y el contenido de esta importación viven solo en local y están en `.gitignore`: `scripts/importar-cancionero.mjs`, `src/pages/lista2.astro`, `src/pages/acordes2/`, `.agents/skills/promover-acorde/` y los `.md` de `src/content/acordes2/`. La colección `acordes2` sí se declara en `src/content/config.ts` para que esas páginas compilen.

`node scripts/importar-cancionero.mjs [opciones]`
Extrae las fichas de `guitarradegades.com/p/cancionero.html` y genera `.md` en `src/content/acordes2/` (colección provisional, acordes sin envolver).
- `--inventory` lista solo las URLs; `--dry-run` no escribe; `--only <valor>` y `--limit <n>` filtran.
- `--index-file <ruta>` / `--ficha-file <ruta>` permiten trabajar con HTML local sin red.
- Busca el vídeo en YouTube (query `Modalidad Agrupación`, primer resultado, sin API key); `--no-youtube` lo desactiva y `--fill-videos` rellena los vídeos por defecto de los `.md` ya generados.
- Omite los acordes que ya existen en `acordes` (slug `pieza-agrupacion`) y avisa de posibles duplicados.
- La promoción `acordes2` → `acordes` se hace con la skill `promover-acorde`, que envuelve los acordes en `<a>` y pone la fecha del día.
- `npm run importar:borrador -- --slug <slug>[,<slug>] [--dry]` pasa una ficha de `acordes2` a los borradores (`acordes3`) envolviendo ya los acordes con el mismo envoltorio del editor; es lo que hace el botón **A borradores** de la pestaña **Acordes2** del panel (solo en local). Después se revisa y se promueve como cualquier borrador.
