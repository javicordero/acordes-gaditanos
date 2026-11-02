# AGENTS.md

## Idioma
- Commits y mensajes: siempre en español

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
- Para verificar: `npm run dev` y probar en navegador
- Build exitoso no garantiza funcionamiento, solo que compila

## Architecture

### SSG site
Sitio 100% estático (SSG) con Astro content collections. Middleware solo redirige `/formateadores` y `/coming-soon` → 404.

### Content Collections (`src/content/config.ts`)
- **`acordes`** — 400+ entradas. Frontmatter: `pieza`, `agrupacion`, `musica`/`letra` (strings separados por coma), `year` (number → string), `date` (formato español `DD/MM/YYYY`), `cejilla` (number → string), `video`, `img`, `cover`, `autorCover`, `fraseClave`, `destacada`, `recomendada`.
- **`autores`** — 11 autores. Frontmatter: `nombre`, `img`, `type` (`musica`|`letra`), `order`, `destacado`.
- **`acordes3`** — borradores del panel `/admin`: fichas nuevas o a medias que aún no se publican. Se promueven a `acordes` con `npm run promover`. Una ficha que solo existe en el ordenador (sin subir) vive aquí, no en `acordes`: el panel la lista con la marca LOCAL y `npm run letras -- auditar` la da por buena aunque no esté publicada.
- **`acordes2`** — colección provisional para los acordes importados del cancionero. Mismo esquema que `acordes`, pero su contenido (`.md`) no se versiona y los acordes van sin envolver en `<a>` hasta que se promueven.

Slugs se generan automáticamente (lowercase, sin tildes, guiones). El transform también produce `musicaSlugs`, `letraSlugs`, `agrupacionSlug`.

### Formato de acordes
Cada acorde envuelto en `<a>etiqueta</a>` dentro de `<pre>`. El script `scripts/generate-pdf.mjs` parsea este formato.
```
<pre><a>LaM7</a>            <a>Mi7</a>               <a>Sim7</a>
Bendita suerte pal aficionao que más de un mes de
```

En los popurrís, los cambios de cejilla a mitad de copla se marcan con `<strong>Cejilla: 4</strong>` (o `<strong>Cejilla: No</strong>` cuando se toca al aire), **solos en su línea y sin espacios alrededor**: `AcordeCard.astro` los pinta como el chip `.acorde-meta` (icono de cejilla + texto en mayúsculas, centrado).

### Letras alternativas de una misma música
Una misma música puede tener varias letras. Cada letra es una ficha propia (`.md` + URL), para que se pueda buscar por el título de esa letra; no se meten varias letras en la misma página.
- Campo opcional `letraTitulo` en el frontmatter (solo en la ficha de la letra alternativa). El título se muestra en el badge de la card, en el bloque «Letras de este pasodoble» y en los avisos; el título de la ficha sigue siendo `Pasodoble Los Colgaos`.
- La relación es **implícita**: misma `agrupacion`, `year` y tipo base (`pasodoble`), siempre que al menos una ficha del grupo tenga `letraTitulo`. La ficha original no se toca.
- En la card, el badge de la letra va debajo del de pieza; en el desplegable de sugerencias, debajo del badge de pieza; en la ficha, un bloque «Letras de este pasodoble».
- De momento solo se agrupan pasodobles (`TIPOS_CON_LETRAS` en `src/lib/letras.ts`). Para otros tipos, añadirlos ahí.
- `npm run auditar:letras` valida que el título no se repita en el grupo, que las fichas compartan música y que las variantes no lleven `destacada`/`recomendada`.

### Poner los acordes de una ficha a una letra nueva
Cuando una música tiene otra letra, los acordes caen sobre las mismas sílabas. `scripts/aplicar-acordes.mjs` reparte la letra con la métrica de la ficha base y coloca cada acorde alineando el patrón de acentos del verso. La parte que decide (qué líneas forman cada verso) la lleva el agente siguiendo la skill `letra-alternativa`; el script solo hace la aritmética de sílabas y columnas.

- `npm run acordes:plan -- --base <slug>` — esqueleto de la base (nº de verso, sílabas y el acorde sobre su sílaba: `Lam«Y» Mi7«nor»`) y de la letra pegada (`L1 5s Cinco años`). Sirve para decidir el reparto antes de generar.
- Marcas en el `.txt` de la letra: `---` sola corta entre líneas, `|` corta entre palabras (`Apaleado | y humillado`) y `-` sola salta un verso de la base sin gastar letra. Sin marcas, el reparto es automático (programación dinámica).
- `npm run acordes:aplicar -- --base <slug> --letra <txt> --titulo "..."` — escribe `src/content/acordes/<pieza>-<agrupación>-<título>.md` con el frontmatter de la base (cambia `letraTitulo`, `fraseClave` y `date`, y autores/vídeo si se pasan). `--hermanas` añade las fichas de la misma pieza, agrupación, año **y autoría de música** como candidatas; `--destino acordes2` escribe en la colección provisional. El informe marca `⚠️` (más de una sílaba de desfase) y `~` (una).
- `npm run acordes:revisar -- --slug <slug> [--base <slug>]` — editor local en el puerto 4324, **en modo texto**: tres columnas con la ficha original a la izquierda, el `<pre>` editable en el centro (acordes sin las etiquetas, encima de su sílaba) y la ficha base a la derecha. **Alt+←/→** mueve el acorde una columna, se puede escribir y pegar como en cualquier editor, y al guardar se vuelven a envolver los acordes en `<a>` conservando los `data-postura`. Antes de escribir comprueba que no haya tokens inválidos, acordes perdidos ni columnas fuera de la letra, y deja respaldo en `.cache/planes/<slug>.bak.md`. Los acordes que no están en el glosario salen en ámbar (y avisan al guardar). Marca igual que el panel lo que pasa de 55 columnas. Con `--silabas` se abre el revisor antiguo, que mueve por sílaba en vez de por columna.
- `npm run auditar:pre` — red de seguridad del editor: desenvolver y volver a envolver las 603 fichas tiene que dar exactamente el mismo `<pre>` (incluidos `data-postura`, `(Sorda)` y los espacios). Si falla, el editor no es de fiar.

- `npm run auditar:editor` — prueba las operaciones de estructura del editor (separar y juntar por palabras) con casos fijos: `data-postura`, `(Sorda)`, corte por el inicio/fin de la palabra, ida y vuelta y ficha sin línea de acordes. Falla si el `<pre>` resultante no es el esperado.

- `npm run acordes:evaluar` — mide aplicando los acordes de una ficha a la letra de su hermana. Empareja por orden de aparición (no «el mismo acorde más cercano») y cuenta exactos / ±1 / **>1 sílaba**. Contra fichas hechas a mano el 100 % exacto no existe (se llevan ±1 entre sí), así que el número que importa es el de >1. `--pares a>b,c>d` elige pares, `--max-fuera 12` lo usa como tope y sale con 1 si empeora. Baseline de las fichas actuales: ~61 % exactos, ~28 % ±1, ~9 % >1.
- `npm run auditar:acordes` — relee y repinta las 562 fichas y comprueba que no se pierde ningún acorde ni cambia de sitio. La primera pasada normaliza (quita espacios de más y pega cada acorde a su sílaba); a partir de ahí el dibujo tiene que ser idéntico. Falla si una ficha no se puede leer o pierde acordes.

### Buscar la letra en internet y llevar la cola
`letras-pendientes.md` es la lista de coplas de las que solo tenemos una frase y el nombre de la agrupación (a veces aproximado). La tabla es la fuente de verdad y lleva el estado de cada una.

- `npm run letras` — resumen por estado y la cola completa (`-- listar --estado pendiente` filtra; el primer argumento es la orden, así que `-- --estado pendiente` da «orden desconocida»).
- `npm run letras -- siguiente` — el primer pendiente con su ficha base.
- `npm run letras -- estado <n> encontrada|"con acordes"|"no encontrada"|duplicada --ficha <slug> --fuente <url> --notas "..."` — actualiza la fila.
- `npm run letras -- auditar` — comprueba que cada `con acordes` tiene ficha real con `letraTitulo` y que la base existe.
- `npm run letras -- anadir "frase" --agrupacion "Los X" --base <slug>` — añade una fila nueva.

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
- **Listado**: buscador + pestañas `Todas`, `Acordes3` (borradores y fichas con PR), `Acordes` (publicadas) y `Por revisar` (coplas que faltan por revisar a mano), agrupadas por año y con `Pendientes` arriba. Cada fila lleva **Editar**, **Publicar** (solo borradores) y **＋** (crear otra ficha a partir de esa misma música). Los estilos de la página van con `<style is:global>`: el HTML que pinta el JS no lleva el `data-astro-cid` y con estilos *scoped* la lista salía sin ellos.
- **Por publicar** (solo en local): pestaña con las fichas de `acordes` que están en el ordenador pero todavía no en git: nuevas (`??`), modificadas, borradas o en commits locales sin push. `lista.mjs` la calcula con `git status`/`git diff`; en producción la pestaña se oculta. Las nuevas salen como `NUEVA` (con la fecha que se les asignará); el resto, `MODIFICADA`, `BORRADA` o `SIN PUSH`.
- **Publicar en local**: botón por fila (no hay «publicar todo»). Ejecuta `scripts/publicar-acorde.mjs`: ajusta la fecha de las nuevas (día siguiente al último de `HEAD`), pasa `auditar:pre` y `auditar:acordes`, hace un commit por ficha (solo sus rutas, con la baja de `acordes3` si toca) y push. Telegram avisa solo; WhatsApp y X **no** se lanzan desde el panel: al terminar, **Copiar aviso** abre el texto ya compuesto (el mismo de Telegram) para pegarlo desde el móvil. El script acepta `--avisar` para lanzar `wa`/`x` desde el PC. Solo funciona con `astro dev` (en Netlify la función responde 501).
- **Por revisar**: la cola vive en `src/data/revision-acordes.json` (`pendientes: [slug]`), la lee `lista.mjs` y la comparte `npm run revisar` (`--marcar`, `--anadir`, `--auditar`, `--sincronizar` desde `pendientes-revision.md`). En el editor, el botón **Revisado ✓** guarda, quita la copla de la cola y (en producción) fusiona la PR; en local solo escribe el archivo y el commit se hace luego con `subir-acorde`.
- **＋ Letra**: añade una entrada a `letras-pendientes.md` (frase y agrupación obligatorias; fuente y notas opcionales) con estado `pendiente`, para buscarla y ponerle los acordes después. La **base se calcula sola**: el pasodoble de esa agrupación (la ficha original, sin `letraTitulo`); si no hay ninguna, se apunta `?`. En local escribe el archivo; en producción abre una PR en `letras/<n>-…` (la lista `npm run prs` las marca como `letra` y las fusiona con `--merge`).
- **Editor**: el mismo `<pre>` en texto que el revisor local, con acordes coloreados, sugerencias y **Alt+←/→** para mover una columna. En móvil, pestañas para cambiar de columna (sin botones de mover: el editor se queda con toda la altura). En la cabecera hay tres botones: **↶ deshacer** (`Ctrl+Z`), **✂ separar por palabras** (`Alt+Enter`, la palabra del cursor baja a una línea nueva con sus acordes) y **⤴ juntar por palabras** (`Alt+Retroceso`, la palabra del cursor sube al verso anterior). Las operaciones están en `src/lib/editar-lineas.js` (puras) y conservan `data-postura` y `(Sorda)`; `npm run auditar:editor` las prueba. La cabecera de vistas (Editor/Estadísticas/Comentarios) se oculta al editar y el panel **Datos** se pliega al tocar el textarea, para dejar más alto el editor; las pestañas Base/Editor/Original son más pequeñas. Arriba, un panel **Datos** plegable con el frontmatter editable (pieza, agrupación, año, cejilla, autores, título de la letra, frase clave, imagen, vídeo, destacada, recomendada, cover). **Editar los datos no cambia el slug**: el archivo conserva su nombre y la URL (el título de la letra es solo frontmatter, lo que pinta la card). Las columnas van **Base · Editor · Original**; la de **Base** (la primera) solo aparece si hay otra ficha de la misma agrupación, y su cabecera lleva un **selector** para cambiar con cuál comparar (mismo año y misma pieza primero). El editor tiene **un solo scroll** (`.lienzo`): el `<textarea>` y el `<pre>` van dentro de una hoja del tamaño del texto, así el arrastre lateral funciona en toda el área. Una regla marca la **columna 55** y lo que la pasa se pinta en rojo subrayado (también en Original y Base); la cabecera lleva el contador `máx/55` y, cuando no caben las 55 columnas, un botón **Ajustar/Ampliar** que reduce la letra sin partir líneas.
- **Guardar**: crea la rama `estudio/<slug>-<rand>`, hace el commit y abre (o actualiza) la **PR**. Netlify deja el deploy preview en la PR.
- **En local (`astro dev`) no hay PR**: el panel ejecuta las funciones con `ESTUDIO_LOCAL=1`, así que **Guardar escribe el `.md` en el proyecto** y **Publicar mueve el archivo** de `acordes3` a `acordes` con la fecha del día. `lista.mjs` y `ficha.mjs` leen también del disco, y en la lista salen los borradores locales con la marca LOCAL. Un borrador que solo está en GitHub sale con la marca **EN GITHUB** y sin **Promover** (hay que abrirlo, guardarlo para traerlo al ordenador y entonces promoverlo); uno que ya está en `acordes` en el disco no se repite como borrador. Al abrir una ficha local, el estado (LOCAL y, si toca, «en GitHub hay otra versión») sale en una **banda sobre las pestañas**, no en un aviso flotante: así no tapa el editor ni estorba al scroll en móvil. Para subirlo a la web, después, `subir-acorde`.
- **En local no se pide login**: con `ESTUDIO_SIN_LOGIN=1` en `.env`, `sesion()` (`_lib.mjs`) devuelve una sesión de desarrollo con el `GITHUB_TOKEN` del mismo `.env` y `/me` añade `local: true`, que el panel usa para `MODO_LOCAL`. Así el panel se puede abrir desde el móvil por el túnel o por la IP del Wi-Fi, donde el OAuth no puede volver (el callback registrado es `localhost`) y además solo escucha en `::1` sin `--host`. Los tres cerrojos son `ESTUDIO_LOCAL` (solo lo pone la ruta de dev), el opt-in y el token; en Netlify no se cumplen, así que producción sigue con OAuth. Ojo: mientras `astro dev` esté abierto, quien llegue al puerto puede editar y hacer push con tu token; con `--host` eso incluye a toda la red local. La sección de **Comentarios** usa el token de GitHub de la sesión; el worker tiene que estar desplegado con la comprobación de GitHub. `COMMENTS_ADMIN_TOKEN` solo queda como respaldo para un worker antiguo.
- **Borradores**: todo lo que se crea o se está trabajando vive en `acordes3`; la lista del panel los saca primero, con la marca BORRADOR. Al guardar se actualiza la rama y la PR.
- **Publicar / Promover**: en producción, botón que mueve el borrador de `acordes3` a `acordes` en una rama nueva y abre la PR; al fusionar, Netlify reconstruye y el aviso de Telegram sale solo (un `.md` añadido). En local el botón se llama **Promover** y solo mueve el archivo en el proyecto (sin PR y sin tocar la web, que no cambia hasta el commit y push).
- **Fichas publicadas**: se pueden abrir y corregir; al guardar, la PR va a `acordes`.
- **Fusionar**: botón que hace squash merge de la PR abierta de esa ficha. Si la ficha se ha renombrado, la PR se localiza por la rama (`rama`), no por el slug.
- **Avisos**: el panel compone el aviso con la ficha abierta (manda su frontmatter por `POST /admin/api/aviso`, así sale aunque no esté subida, en una PR o solo en el ordenador). El texto va en formato **WhatsApp** (negrita con `*…*`) para copiar; para X se manda sin marcas (`textoX`). Botones de copiar y de abrir X. WhatsApp y X siguen saliendo desde el PC (`npm run wa`, `npm run x`): necesitan tu Chrome con sesión.

Variables en Netlify: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (secreta), `SESSION_SECRET` (secreta) y `OWNER_LOGIN`. El callback de la OAuth App tiene que ser `https://acordesgaditanos.com/admin/api/auth-callback`.

`npm run prs` lista las PRs abiertas del panel (borradores `estudio/*` y publicaciones `publica/*`).
`npm run prs -- --merge [--si]` fusiona con squash los borradores; `--todas` incluye las de publicar (eso publica y avisa).
Necesita `GITHUB_TOKEN` en `.env` (permiso `public_repo` o `repo`) o `gh` autenticado. Después, `git pull`.

`npm run promover -- --slug <slug>[,<slug>] | --todos [--dry]` pasa los borradores de `acordes3` a `acordes`, les pone la fecha del día y borra el borrador. Después, `auditar:pre`, `auditar:acordes` y el commit con `subir-acorde`.

### Autores
`AutorCardsGroup` pinta el grid de autores (2 columnas en desktop, 1 en móvil). Cada `AutorCard` enlaza a la página principal del autor según `type` y añade chips a `/autor/musica/{slug}` y `/autor/letra/{slug}` cuando tiene créditos, calculados en build con `contarCreditosAutores` (`src/lib/autores.ts`). La home muestra los 6 primeros por `order` (5 en móvil) y `/autores` los muestra todos. Toda la card (imagen y cuerpo) usa `--primary-contrast-color`; el título y la línea de los chips van en `--on-bright-color` y los chips usan fondo `--on-bright-color` con texto `--primary-contrast-color` (sin cambio al hover). La sombra es `--on-bright-color` en reposo y en hover (solo crece y la card se desplaza).

### Orden de las cards en los listados
Todo en `src/lib/orden.ts`, con dos comparadores que comparten las piezas (`compararTipo`, `compararPrioridad`, `compararAgrupacion`, `compararResto`).

**Prioridad por autor destacado** (la usan los dos): la agrupación (por `agrupacionSlug`) de un autor del listado de `/autores` va delante, en el orden de su campo `order`, usando la mejor posición entre sus autores de música y letra. Las agrupaciones sin autor del listado quedan detrás.

- `/autor/musica` y `/autor/letra` (`ordenarAcordesAutor`, `compararFichas`): **año ↓** → agrupación A-Z → tipo de pieza → `date` ↓ → pieza A-Z → slug A-Z. No reciben prioridad: todas las cards son del mismo autor.
- `/carnaval/[year]` (`ordenarAcordesYear`, `compararFichasYear`): **tipo de pieza primero** → prioridad por autor destacado → agrupación A-Z → `date` ↓ → pieza A-Z → slug A-Z.

**Tipo de pieza** (`ORDEN_PIEZAS`): popurrí, final de popurrí, cuarteta, estribillo, pasodoble, tango, presentación. Se compara por prefijo, así encajan «Final de popurrí/popurri/popurí», «Presentación Original» o «Pasodoble Inédito»; lo que no case va al final por orden alfabético. Las equivalencias puntuales van en `EQUIVALENCIAS_PIEZAS`: el `Credo` y el `Testamento` cuentan como cuarteta.

**`date` ↓** es la fecha de alta en la web, no la de la copla; para cerrar empates se usa pieza A-Z y slug A-Z (antes, las fichas empatadas quedaban en el orden en que `getCollection` devuelve los ficheros). **`/lista` es la excepción**: conserva su orden local por tipo de pieza, que es lo que anuncia su meta description.

**Recuento de `/lista`**: la página separa **coplas** y **letras extras** («534 coplas y 4 letras extras») con `contarCoplas` (`src/lib/letras.ts`), que agrupa igual que las letras alternativas (tipo base + agrupación + año): cada grupo es una copla y el resto de fichas son letras. No sirve mirar qué fichas llevan `letraTitulo`: las originales de DSAS3, La Azotea y Los Colgaos también lo llevan. Si un año no tiene letras, solo se ponen las coplas («38 coplas»). `/lista2` usa el mismo recuento.

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
| `/acordes2/[id]` | `pages/acordes2/[id].astro` — previsualización local de acordes importados (no versionada; `noindex`, fuera del sitemap) |
| `/lista2` | `pages/lista2.astro` — listado local de `acordes2` (no versionada; `noindex`, fuera del sitemap) |
| `/autor/musica/[autorSlug]` | `pages/autor/musica/[autorSlug].astro` |
| `/autor/letra/[autorSlug]` | `pages/autor/letra/[autorSlug].astro` |
| `/autores` | `pages/autores.astro` — listado de todos los autores (grid 2/1) |
| `/agrupacion/[agrupacionSlug]` | `pages/agrupacion/[agrupacionSlug].astro` |
| `/carnaval/[year]` | `pages/carnaval/[year].astro` |
| `/buscar` | `pages/buscar.astro` (búsqueda cliente con datos serializados) |
| `/glosario` | `pages/glosario.astro` — glosario de acordes con diagramas y buscador |
| `/reconocer-acorde` | `pages/reconocer-acorde.astro` — mástil interactivo que identifica el acorde (privada: `noindex`, fuera del sitemap y sin enlaces públicos) |
| `/admin/stats` | Redirige a `/admin/?vista=stats` (301, `netlify.toml`) |
| `/admin/comentarios` | Redirige a `/admin/?vista=comentarios` (301, `netlify.toml`) |
| `/api/fetch-url` | `pages/api/fetch-url.ts` — proxy CORS (GET `?url=...`) |
| `/formateadores/*` | Redirigido a 404 por middleware (páginas existen pero ocultas) |

**Importante**: `/coming-soon`, `/en-construccion`, `/acordes2`, `/lista2` y `/reconocer-acorde` se filtran del sitemap. `/acordes2`, `/lista2` y `/reconocer-acorde` además emiten `noindex`. `/formateadores` redirige a 404.

### Glosario de acordes
Los acordes del `<pre>` son interactivos: al pulsarlos se abre un popover con su diagrama.
- Datos: `src/data/glosario-acordes.json` (481 acordes, ~1.278 posiciones), generados una sola vez con `node scripts/importar-glosario.mjs` a partir del glosario público de LaCuerda.net. El script cachea en `.cache/glosario` (ignorado por git) y no se ejecuta en build.
- Renderizador único: `src/lib/diagrama.ts` (`svgDiagrama`) genera el SVG en build y en el navegador. No hay imágenes externas.
- Parser de notación española: `src/lib/acordes.ts` (`parsearAcorde`, `buscarEnIndice`, `slugAcorde`). Admite enarmonías, `7M`/`M7`, `m7/5`, `/add9`, bajos con barra y raíces en mayúsculas (`MIm`, `SI7`).
- Componentes: `DiagramaAcorde.astro`, `GlosarioPopover.astro` y `AcordesDeLaPieza.astro` (incluye la nota «Pincha en cualquier acorde…», encima del transportador).
- Anclas estables en `/glosario`: `#mi7`, `#do-sostenido-m7`, `#sol-sostenido-m`.
- Reconocedor de acordes: `/reconocer-acorde` usa `src/lib/reconocer.ts` (`reconocerAcorde`) para identificar la postura por clases de altura, con el nombre más probable y alternativas. Funciona por teoría, aunque la postura no esté en el JSON. De momento es **privado**: `noindex`, fuera del sitemap y sin enlaces desde el glosario ni el footer; queda accesible por URL directa para publicarlo en el futuro.
- Cobertura: `node --experimental-strip-types scripts/auditar-glosario.ts` falla si algún acorde válido del cancionero no tiene diagrama.

### Autoscroll
Implementado en `src/components/page/AcordeCard.astro`. Activado por el botón de play y regulado con 1x–5x, que se despliegan en vertical bajo el botón. El control flota en la esquina superior derecha del cifrado (`top: -22px`) y el contenedor del `<pre>` lleva `padding-top: 26px` para que no tape la primera línea; en móvil el botón mide 28 px. El antiguo tutorial del botón «?» se eliminó.

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
- `node --experimental-strip-types scripts/auditar-busqueda.ts` comprueba el top-1 de 12 consultas reales (erratas, prefijos, orden libre, año, autor, tipo) y falla si el ranking se degrada.
- Eventos: `buscar_sugerencia_click` (con `origen`: `raton`|`teclado`), `buscar_ver_resultados` (con `origen`: `panel`|`formulario` y `total` en el panel) y `buscar_sin_resultados` (consulta truncada a 40 caracteres). Los que navegan fuera de la página se mandan con `transport_type: 'beacon'` para que no se pierdan al descargar la siguiente.

### Canales de avisos (WhatsApp y Telegram)
- Enlaces únicos en `src/data/canales.json` (`whatsapp` y `telegram`); se usan en el footer, en la banda de suscripción y en `Layout.astro` (`sameAs` de `Organization`).
- **Telegram se publica solo**: `.github/workflows/difundir.yml` se dispara en cada push a `master` que toque `src/content/acordes/**` y llama a `scripts/difundir.mjs`. El script vuelve a comprobar con `git diff --diff-filter=A` que sean **`.md` añadidos** en `src/content/acordes/`: editar, corregir o cambiar la fecha de una copla ya publicada **no avisa**. Los PDFs de `scripts/generate-pdf.mjs` y la carpeta local `acordes2` tampoco cuentan.
- **Modo silencioso**: si el asunto del último commit lleva `[sin aviso]`, `difundir.mjs` no envía nada (también con `SALTAR_AVISO=1`). Es lo que usa la skill cuando se pide «súbelo sin avisos»: la copla se publica igual, pero no salta ningún canal.
- El mensaje se agrupa por push: 1 copla → ficha; de 2 a 10 → lista `• Pieza Agrupación` + enlace a `/lista/`; más de 10 (importación) → resumen con enlace a `/novedades/`. Antes de enviar espera hasta 5 minutos a que la ficha responda 200 (Netlify tarda 1-2 min), para no publicar un enlace roto.
- Formato acordado (sin paréntesis en el año; pieza y agrupación en negrita y sin año, y línea en blanco antes de los autores):
  ```
  🎶 Nuevos acordes

  *Pasodoble La Marea*

  Música: Tatán
  Letra: Antonio Martín

  https://acordesgaditanos.com/acordes/pasodoble-la-marea/
  ```
  WhatsApp marca la negrita con `*…*`; Telegram con `<b>…</b>` y `parse_mode: HTML` (lo pone `difundir.mjs`). El año no se pone en el aviso. Si música y letra son la misma persona se juntan en `Música y letra: …`. La vista previa la pone Telegram (y WhatsApp) con el `og:image` de la ficha.
- Local: `npm run difundir -- --solo <slug> --dry-run`, `--test`, `--antes <sha>`. La Action también admite `workflow_dispatch` con modo `prueba` (manda un mensaje de prueba al canal), `seco` (con `slugs` previsualiza esas coplas; sin ellos compara `HEAD~1`) o `reenviar`.
- **Secretos**: `TELEGRAM_BOT_TOKEN` (repo → Settings → Secrets → Actions) y, si se quiere cambiar, la variable `TELEGRAM_CHAT_ID` (por defecto `@acordesgaditanos`). El token no se imprime nunca. El bot debe ser administrador del canal con «Publicar mensajes», o Telegram devuelve `403`.
- **WhatsApp no tiene API oficial**: las APIs no oficiales (Whapi, Baileys…) van contra los términos de WhatsApp, cuestan 10-30 €/mes y arriesgan el número y el canal, así que no se usan. En su lugar, `scripts/whatsapp.mjs` controla WhatsApp Web con Playwright y **tu Chrome** (perfil propio `wa-profile/`, gitignored) desde este equipo: escribe el aviso en el canal «Acordes Gaditanos» y **envía solo** tras 15 s de margen (si se cierra la ventana, no se envía). Se lanza desde la skill `subir-acorde` después del push (`npm run wa -- --solo <slug>`), nunca desde CI: no hay runner ni secretos.
  - `npm run wa:login` — una sola vez (y cuando caduque): abre Chrome con el QR, se escanea y se cierra solo. Código de salida `2` = sesión caducada.
  - `npm run wa -- --solo <slug>[,<slug>]` — espera a que la ficha responda 200, abre el canal, vacía el borrador si lo hubiera, escribe (saltos con Shift+Enter) y envía solo a los 15 s. `--manual` deja el mensaje escrito y espera el Enter; `--margen <seg>` cambia el margen; `--dry-run` solo enseña el texto; `--comprobar` abre el canal y captura sin escribir; `--forzar` republica.
  - Selectores por `role`/`aria-label`/`title` (nunca clases: WhatsApp las ofusca), con variantes es/en. Ante fallo deja captura en `wa-debug/` y sale con `3` (canal), `4` (compositor) o `5` (no enviado).
  - `wa-enviados.json` (gitignored) evita publicar dos veces el mismo aviso: solo se marca cuando se detecta el envío.
  - El texto sale de `scripts/lib/aviso.mjs`, el mismo módulo que usa `difundir.mjs`, así que Telegram y WhatsApp nunca se separan.
  - Si el mensaje se pega a mano, se copia el mismo texto del canal de Telegram; el enlace genera la vista previa.
- **X (@AcordesGaditano)**: `scripts/x.mjs` hace lo mismo con tu Chrome (perfil `x-profile/`, gitignored): escribe el tuit, lo **publica solo** a los 15 s (`--manual` para dejarlo escrito y esperar «Publicar») y lo confirma en el perfil. `npm run x:login` una vez (comprueba que la cuenta es la esperada); `npm run x -- --solo <slug>`. Formato: «🆕 Nuevos acordes en la web», `🎭 Pieza – Agrupación`, línea en blanco, `🎵` música y `✏️` letra (una sola línea si es la misma persona) y `🔗` al final. Contador tipo X (enlace = 23, emoji = 2, tope 280; si se pasa, quita autores y luego recorta el nombre, nunca la URL). Adjunta el `img` del `.md` validado por bytes mágicos y tamaño (≤5 MB). Verifica el tuit en `x.com/<cuenta>` antes de marcarlo en `x-enviados.json`.
  - **Etiquetas en la imagen**: se etiquetan las cuentas de `ETIQUETAS` (`scripts/lib/tuit.mjs`): @Carnavaladictos y @Orteguilla25, en cada tuit con imagen. Va por la UI de X («Etiquetar personas»), es best-effort (si una cuenta no aparece se avisa y se publica igual) y se puede cambiar con `--etiquetar @a,@b` o quitar con `--sin-etiquetas`.
  - Los enlaces externos **no tienen penalización escrita** en el algoritmo publicado (`open_link` pesa +0,2), pero sí un efecto medido de menos alcance. Por eso: un tuit por copla, con imagen, texto que se entiende sin el enlace y sin repetir avisos.
- Web: `src/components/page/CanalCallout.astro` con dos variantes: `linea` (home, tras «Ver más novedades»: «¿Te aviso…? Únete a nuestros canales de WhatsApp y Telegram» con dos enlaces) y `destacado` (`/pedir-copla`, encima de `PeticionesStats`: párrafo con el formato del texto de la página y dos botones con icono). Texto propio por `ubicacion`.
- `/suscribirse` explica qué llega y cómo darse de baja, con QR en escritorio. Los QR se generan una sola vez con `npm run qr` y van versionados en `public/qr-*.svg` (no se generan en el build). No hay formulario ni base de datos: suscribirse es unirse al canal.

### Prefetch y transiciones de página
- **Prefetch**: `prefetch: { prefetchAll: true, defaultStrategy: 'hover' }` en `astro.config.mjs`. Precarga el HTML de los enlaces al pasar el ratón o al enfocar con teclado, descarta conexiones lentas (`saveData`, 2g) y enlaces externos. En táctil no hay hover, así que `src/components/utils/PrefetchTap.astro` precarga en `pointerdown` con `prefetch()` de `astro:prefetch` (comparte la lista de URLs ya precargadas; no duplica peticiones).
- **Transiciones**: view transitions cross-document nativas con `@view-transition { navigation: auto }` en `global.css`. **No** se usa `ClientRouter` (se quitó para que funcione AdSense Auto Ads): la navegación sigue siendo una carga completa, así que AdSense, GTM, GA4, el contador propio y el CMP funcionan igual. Chrome/Edge 126+ y Safari 18.2+; con `prefers-reduced-motion: reduce` se desactivan.
- El morph card → ficha se hace con el título y con la imagen: `transition:name` con `titulo-${slug}` en el `h3.card-title` (`Card.astro`) y en el `h2` de `AcordeCard.astro`, e `img-${slug}` en las dos imágenes. Astro emite las animaciones `astroFadeIn`/`astroFadeOut` pero no sus keyframes: están definidos en `global.css`.
- **La imagen conserva su recorte original**: la card usa `height: 220px` (180 px en móvil) y la ficha `360px` de ancho con `min/max-height` 225/240. Como las proporciones no coinciden (la card es casi cuadrada y la ficha 3:2), el morph de la imagen es un zoom con cambio de encuadre, no un morph perfecto. Si algún día se igualan las proporciones, el morph queda limpio; si se desactiva, basta con quitar `img-${slug}` de las dos imágenes.
- `node scripts/auditar-view-transitions.mjs` (después de `npm run build`) falla si algún HTML repite un `view-transition-name` en la misma página o si `@view-transition` no sobrevive al build.

### Redirects
- `public/ads.txt` — archivo estático de AdSense (`google.com, pub-3280015847198273, DIRECT, f08c47fec0942fa0`)
- `public/redirects.json` — mapa de 300+ URLs legacy → nuevas rutas (usado client-side)
- `public/redirects-from.json` — lista de URLs legacy

### Vídeos de YouTube
- Cada ficha tiene un `video:` (embed) y, si hay, un `cover:` (guitarra). El estado del vídeo principal se guarda en `src/data/videos-estado.json`: `ok`, `muerto` (404/401) o `bloqueado` (403, el autor no permite incrustarlo).
- `npm run videos` audita con el oEmbed de YouTube y reescribe ese JSON. No se ejecuta en build (son ~440 peticiones): se pasa antes de publicar o cuando se toque el cancionero. Si una consulta falla por red o 429 se conserva el estado anterior; con `--solo` se conserva el resto del cancionero.
- `src/lib/videos.ts` lo lee en la ficha (`estadoDeVideo`, `enlaceYoutube`, `busquedaYoutube`). `YoutubeCard` pinta el iframe solo si está `ok`: si está `muerto` muestra un bloque con enlace a la búsqueda en YouTube, y si está `bloqueado` un enlace directo a `watch?v=`. Sin datos se asume `ok`, para no ocultar un vídeo nuevo.
- **Recambio**: `npm run videos -- --buscar` busca la **actuación completa** de la agrupación en `@ONDACADIZCARNAVAL`, `@carnavalsur` y `@cadizbooktv8695`, en ese orden. Escribe `videos-candidatos.md` y `src/data/videos-candidatos.json`. Filtros: el título debe llevar todas las palabras de la agrupación, no puede ser de otro año (título, `COACnn` o fecha de subida si es ≥2015), ni una pieza suelta, ni antología/homenaje/entrevista/resumen/carnaval chiquito, y tiene que durar ≥10 min. El canal se verifica con el `author_name` de oEmbed, porque el buscador de CADIZBOOKTV cae a resultados generales.
- `npm run videos -- --aplicar` escribe el vídeo elegido **solo en las fichas caídas** de esa agrupación y año (nunca cambia uno que funciona). Para descartar un grupo, `"aplicar": false` en el JSON. `--solo <texto>` limita a una agrupación y fusiona con lo ya revisado.
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
`node scripts/trim-pre-whitespace.mjs [--dir <carpeta>] [--dry-run] [--quiet]`
Quita espacios y tabuladores al final de línea **solo dentro de `<pre>…</pre>`** (la indentación inicial se conserva). Por defecto recorre `src/content/acordes` y `src/content/acordes2`. Es idempotente; útil después de importar o formatear acordes.

### Importación de cancionero (local, no versionada)
Las herramientas y el contenido de esta importación viven solo en local y están en `.gitignore`: `scripts/importar-cancionero.mjs`, `src/pages/lista2.astro`, `src/pages/acordes2/`, `.agents/skills/promover-acorde/` y los `.md` de `src/content/acordes2/`. La colección `acordes2` sí se declara en `src/content/config.ts` para que esas páginas compilen.

`node scripts/importar-cancionero.mjs [opciones]`
Extrae las fichas de `guitarradegades.com/p/cancionero.html` y genera `.md` en `src/content/acordes2/` (colección provisional, acordes sin envolver).
- `--inventory` lista solo las URLs; `--dry-run` no escribe; `--only <valor>` y `--limit <n>` filtran.
- `--index-file <ruta>` / `--ficha-file <ruta>` permiten trabajar con HTML local sin red.
- Busca el vídeo en YouTube (query `Modalidad Agrupación`, primer resultado, sin API key); `--no-youtube` lo desactiva y `--fill-videos` rellena los vídeos por defecto de los `.md` ya generados.
- Omite los acordes que ya existen en `acordes` (slug `pieza-agrupacion`) y avisa de posibles duplicados.
- La promoción `acordes2` → `acordes` se hace con la skill `promover-acorde`, que envuelve los acordes en `<a>` y pone la fecha del día.

### SEO & Analytics
- Site: `https://acordesgaditanos.com`
- Google Tag Manager: `GTM-MZG7K2Q4`
- Google Adsense: `ca-pub-3280015847198273`
- Claves en `src/lib/constants.ts`
- OG image por defecto: `/og-image.png`
- Eventos del glosario: `click_novedad_glosario`, `click_acordes_usados_ver_mas` / `click_acordes_usados_ver_menos`, `click_acorde_pre`, `click_acorde_usado`, `click_acorde_glosario` y `click_glosario_acordes_usados`.
- Eventos del transportador: `transpose_acorde` (parámetros `direccion` y `semitonos`).
- Eventos de "ver más" de la home: `ver_mas_novedades_click` y `ver_mas_autores_click` (parámetros `link_type` y `location`).
- Eventos de las cards de autor: `click_autor_card`, `click_autor_card_musicas` y `click_autor_card_letras` (parámetros `autor` y `ubicacion`).
- Eventos de los canales de avisos: `click_canal_home`, `click_canal_pedir_copla` y `click_canal_suscribirse` (parámetros `canal` y `ubicacion`), más `click_canal_info_pedir_copla` para el enlace a `/suscribirse`. Un evento por página para verlo directo en GA4.

### PostCSS
`postcss.config.cjs` usa `postcss-nesting` (anidamiento CSS nativo) y `postcss-preset-env` (stage 1). Sin Tailwind.

## Available Agent Skills
Skills en `.agents/skills/` para tareas comunes:
- `chord-formatting` — envolver acordes en `<a>` tags
- `postura-predeterminada` — fijar la postura con la que se abre un acorde concreto con `data-postura`
- `cifrado-a-formato` — convertir cifrado pegado de otra web al formato propio (línea de acordes + letra con palabras completas)
- `create-acorde` — crear nuevo archivo markdown de acorde
- `promover-acorde` — mover acordes revisados de `acordes2` a `acordes` (local, no versionada)
- `letra-alternativa` — aplicar los acordes de una ficha a una letra nueva de la misma música
- `prs-acordes3` — listar y fusionar las PRs de los borradores que se guardaron desde el móvil
- `subir-acorde` — ajustar la fecha al día siguiente del último publicado y hacer commit + push
- `transportar` — transponer acordes de tonalidad
- `tweet-acorde` — generar tweet para anunciar acorde
- `seo` — optimizaciones SEO
- `accessibility` — auditoría WCAG
- `astro` / `astro-framework` — guías de Astro
- `frontend-design` — diseño UI

## Content Template
Usar `src/content/template.md` como referencia:
```yaml
pieza: Pasodoble|Presentacion|Popurri|Cuarteta|Tango|Estribillo
agrupacion: Nombre de la agrupación
year: 2025
musica: Autor1, Autor2 (separados por coma)
letra: Autor1, Autor2
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

