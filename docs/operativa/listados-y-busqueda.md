# Listados, navegación y búsqueda

Referencia de la organización de las fichas y las páginas de descubrimiento. Antes de cambiar su comportamiento, confirma en el código que los detalles siguen vigentes.

## Autores
`AutorCardsGroup` pinta el grid de autores (2 columnas en desktop, 1 en móvil). Cada `AutorCard` enlaza a la página principal del autor según `type` y añade chips a `/autor/musica/{slug}` y `/autor/letra/{slug}` cuando tiene créditos, calculados en build con `contarCreditosAutores` (`src/lib/autores.ts`). La home muestra los 6 primeros por `order` (5 en móvil) y `/autores` los muestra todos. Toda la card (imagen y cuerpo) usa `--primary-contrast-color`; el título y la línea de los chips van en `--on-bright-color` y los chips usan fondo `--on-bright-color` con texto `--primary-contrast-color` (sin cambio al hover). La sombra es `--on-bright-color` en reposo y en hover (solo crece y la card se desplaza).

## Orden de las cards en los listados
Todo en `src/lib/orden.ts`, con dos comparadores que comparten las piezas (`compararTipo`, `compararPrioridad`, `compararCoplas`, `compararAgrupacion`, `compararResto`).

**Prioridad por autor destacado**: la agrupación (por `agrupacionSlug`) de un autor del listado de `/autores` va delante, en el orden de su campo `order`, usando la mejor posición entre sus autores de música y letra. Las agrupaciones sin autor del listado quedan detrás.

**Prioridad por coplas** (`prioridadPorCoplas` + `contarCoplasAutores`): dentro de lo que queda, primero las agrupaciones de los autores más prolíficos, según las coplas distintas que tienen en **todo el cancionero** (una ficha cuenta una vez aunque el autor firme música y letra). De cada agrupación se usa su autor con más coplas. Es el escalón que va justo después de los destacados, antes de la agrupación A-Z.

- `/autor/musica` y `/autor/letra` (`ordenarAcordesAutor`, `compararFichas`): **año ↓** → agrupación A-Z → tipo de pieza → `date` ↓ → pieza A-Z → slug A-Z. No reciben prioridad: todas las cards son del mismo autor.
- `/carnaval/[year]` y `/lista` (`ordenarAcordesYear`, `compararFichasYear`): **autor destacado** → **coplas del autor más prolífico ↓** → agrupación A-Z → tipo de pieza → `date` ↓ → pieza A-Z → slug A-Z. `/lista` lo aplica dentro de cada año (los años siguen de más reciente a más antiguo).

**Tipo de pieza** (`ORDEN_PIEZAS`): popurrí, final de popurrí, cuarteta, estribillo, pasodoble, tango, presentación. Se compara por prefijo, así encajan «Final de popurrí/popurri/popurí», «Presentación Original» o «Pasodoble Inédito»; lo que no case va al final por orden alfabético. Las equivalencias puntuales van en `EQUIVALENCIAS_PIEZAS`: el `Credo` y el `Testamento` cuentan como cuarteta.

**`date` ↓** es la fecha de alta en la web, no la de la copla; para cerrar empates se usa pieza A-Z y slug A-Z. `npm run auditar:orden` comprueba la secuencia de escalones con fichas de mentira y con el cancionero real.

**Recuento de `/lista`**: la página separa **coplas** y **letras extras** («554 coplas y 22 letras extras») con `contarCoplas` (`src/lib/letras.ts`), que agrupa igual que las letras alternativas (tipo base + agrupación + año): cada grupo es una copla y el resto de fichas son letras. No sirve mirar qué fichas llevan `letraTitulo`: las originales de DSAS3, La Azotea y Los Colgaos también lo llevan. Si un año no tiene letras, solo se ponen las coplas («38 coplas»). `/lista2` usa el mismo recuento.

**Filtros de `/lista`**: el panel filtra por pieza, música, letra, año y década **en el navegador**, sobre las coplas ya pintadas: no genera páginas ni URLs nuevas, la canonical sigue siendo `/lista` y el estado se guarda en la query (`?pieza=pasodoble,tango&musica=juan-carlos-aragon`) con `history.replaceState`. La lógica pura está en `src/lib/filtros-lista.ts` (décadas, opciones de cada faceta, `filtrarFicha`, `parsearFiltros`/`serializarFiltros`) y el panel lo pinta `FiltrosLista.astro` con un `FiltroMultiple.astro` por faceta, en ese orden: **se admiten varios valores por faceta** (OR dentro de una faceta, AND entre facetas). Cada filtro parece un `<select>` pero despliega un panel con **checkboxes** nativos (y caja de búsqueda en música y letra, que son las listas largas); no se cierra al marcar, se cierra con Escape, con el botón o pulsando fuera, y devuelve el foco al botón. El panel cuelga con `position: fixed` y `z-index` por encima de la cabecera fija (`9999`), se recoloca al hacer scroll o al abrirse el teclado del móvil, no se mete debajo de la cabecera y se limita al hueco disponible. Las opciones de pieza van en el orden presentación · pasodoble · tango · estribillo · cuarteta · final de popurrí · popurrí (distinto del orden de pieza de las cards, que empieza por el popurrí). El panel de filtros se pliega con una animación de altura (`grid-template-rows` de `0fr` a `1fr`, sin transición con `prefers-reduced-motion`; al plegarse el contenido queda `inert`) y el botón dice «Abrir filtros» / «Ocultar filtros». Los `<li>` de la página llevan los `data-*` que lee el script: `data-t` (tipo de pieza) para filtrar y `data-p` (pieza original) para recalcular coplas/letras con la misma regla que `contarCoplas`. Al filtrar, los años sin coplas se ocultan y los recuentos se actualizan. Las opciones de autor se agrupan por slug, muestran la variante de nombre más usada y van **ordenadas por número de coplas** (de más a menos, A-Z para desempatar). **Las facetas se recalculan entre sí**: al cambiar un filtro, las opciones de los demás se limitan a lo que sigue teniendo coplas (y sus recuentos se actualizan); el filtro que se recalcula se mira sin su propio valor, para poder marcar varios dentro de la misma faceta. Un valor ya marcado que se queda sin coplas sigue visible con 0, para poder quitarlo. `npm run auditar:filtros` comprueba el tipo de pieza, las décadas, las combinaciones, la URL y que los recuentos reparten todas las fichas.

## Hubs por modalidad, tipo de pieza y década
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

## Rutas dinámicas (`src/pages/`)
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

## Buscador y sugerencias
- Motor en `src/lib/busqueda.ts` (`preparar`, `buscar`): normaliza sin tildes ni puntuación, exige que **cada palabra de la consulta case en algún campo y en cualquier orden**, y puntúa con pesos (agrupación 10 · autores 6 · pieza 5 · año 4). Tolera erratas (distancia ≤1, ≤2 en palabras largas, subsecuencia solo en palabras de longitud parecida) y busca años exactos. Si no hay resultados devuelve una `sugerencia` («quizá quisiste decir»). Es puro, sin DOM.
- Índice: `src/pages/indice-busqueda.json.ts` genera `/indice-busqueda.json` (~84 KB crudos, ~10 KB comprimido). El header **no lo descarga al cargar la página**: solo al abrir el buscador. `public/_headers` le da 1 día de caché.
- UI: `src/components/layout/SugerenciasBusqueda.astro`, montado dentro de `.search-container` en `Header.astro`. Muestra 6 sugerencias desde 2 caracteres (debounce 120 ms), con teclado (↑ ↓ Home End Enter Esc), `role=combobox/listbox/option`, `aria-activedescendant` y recuento en `aria-live`. Precarga la sugerencia resaltada con `prefetch()`. Se posiciona con JS para no salirse de la pantalla en móvil (`.search-wrapper` tiene `overflow: hidden`, así que el panel cuelga de `.search-container`).
- Sin JS el `<form action="/buscar/" method="get">` sigue funcionando igual. Las filas van directas a la ficha; no llevan `view-transition-name` a propósito (chocaría con la card del mismo slug que ya está en la página).
- `/buscar` es `noindex` y está fuera del sitemap: es una página de resultados. Las variantes `?q=` no se indexan y la canonical las neutraliza. **El `noindex` no afecta a las visitas ni a AdSense**: solo a la indexación.
- **`/buscar` no trae las cards en el HTML** (eran 3,8 MB): pide `src/pages/indice-tarjetas.json.ts` (`/indice-tarjetas.json`, ~290 KB crudos y ~33 KB comprimido, caché de 1 h en `_headers`) y las pinta en el navegador desde la URL (`?q=`), con la misma regla de siempre (texto normalizado sin tildes + `includes`) y el mismo orden (año ↓, fecha ↓). No es un listado: la página solo renderiza **una** card dentro de un `<template>` (el prototipo), y el script la clona y rellena sus `data-campo` (`ancla`, `imagen`, `pieza`, `letra`, `year`, `titulo`, `autores`). El bloque de resultados lleva un título pequeño («N resultados para» + el término buscado entre comillas y en negrita), sin la raya naranja que marca el H1 de la página. Al clonar se quita el `data-astro-transition-scope` de la instancia y se pone el `view-transition-name` de cada ficha en línea, para que el morph card → ficha siga funcionando. Como los estilos de la card son *scoped*, los nodos que haya que crear en JS copian las marcas `data-astro-cid-…` del prototipo. Los nodos nuevos se miden solos (`ResizeObserver` de `CardsGroup`) y los badges se ajustan con un `resize` (lo escucha `FitTextInit`). La lógica de presentación de la card (pieza visible, color del badge, autores y nombre completo) vive en `src/lib/tarjeta.ts` (`prepararTarjeta`) y la comparten `Card.astro` y el catálogo, para que no se desincronicen.
- `npm run auditar:buscar` (después del build) falla si `/buscar` vuelve a traer más de una card o pasa de 250 KB, si falta el `<template>` o algún `data-campo`, o si el catálogo no tiene una entrada por ficha con sus campos, sus `href` de autor con barra final y su página en el build.
- `node --experimental-strip-types scripts/auditar-busqueda.ts` comprueba el top-1 de 12 consultas reales (erratas, prefijos, orden libre, año, autor, tipo) y falla si el ranking se degrada.
- Eventos: `buscar_sugerencia_click` (con `origen`: `raton`|`teclado`), `buscar_ver_resultados` (con `origen`: `panel`|`formulario` y `total` en el panel) y `buscar_sin_resultados` (consulta truncada a 40 caracteres). Los que navegan fuera de la página se mandan con `transport_type: 'beacon'` para que no se pierdan al descargar la siguiente.
