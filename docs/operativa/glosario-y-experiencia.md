# Glosario y experiencia de las fichas

Referencia técnica de acordes interactivos y navegación. Consulta solo el apartado que corresponda.

## Postura predeterminada por acorde
En el `<pre>` se puede fijar la postura con la que se abre un acorde con `data-postura`:
```html
<a data-postura="x 0 2 2 2 4">LaM7</a>
```
La postura se escribe de la 6ª a la 1ª cuerda (`x` = muda) y debe coincidir exactamente con una posición del glosario. El popover abre en esa posición, el acorde se marca con un asterisco y, si la pieza tiene alguna, aparece la leyenda «* Postura concreta para esta pieza» en «Acordes usados». La lógica está en `parsearPostura`/`indicePostura` (`src/lib/acordes.ts`). Ver skill `postura-predeterminada`.

## Glosario de acordes
Los acordes del `<pre>` son interactivos: al pulsarlos se abre un popover con su diagrama.
- Datos: `src/data/glosario-acordes.json` (605 acordes, 2.688 posiciones). Las posiciones históricas se importaron una sola vez con `node scripts/importar-glosario.mjs --regenerar` desde el glosario público de LaCuerda.net; el resto son posturas hechas a mano y las añadidas desde `tombatossals/chords-db` (MIT) con `scripts/importar-glosario-mit.mjs`. El archivo es la fuente de verdad: no se regenera. Licencias en `src/data/glosario-acordes.LICENSE.md`.
- Renderizador único: `src/lib/diagrama.ts` (`svgDiagrama`) genera el SVG en build y en el navegador. No hay imágenes externas.
- Parser de notación española: `src/lib/acordes.ts` (`parsearAcorde`, `buscarEnIndice`, `slugAcorde`). Admite enarmonías, `7M`/`M7`, `m7/5`, `/add9`, bajos con barra y raíces en mayúsculas (`MIm`, `SI7`).
- Componentes: `DiagramaAcorde.astro`, `GlosarioPopover.astro` y `AcordesDeLaPieza.astro` (incluye la nota «Pincha en cualquier acorde…», encima del transportador). El popover vive en las fichas (cifrado y «Acordes usados»), no en `/glosario`.
- Anclas estables en `/glosario`: `#mi7`, `#do-sostenido-m7`, `#sol-sostenido-m`.
- **Páginas individuales**: cada acorde con posiciones tiene la suya en `/glosario/<slug>/` (`src/pages/glosario/[acorde].astro`, 605 en build). Lleva H1 con las dos notaciones («Acorde Do7 (C7) en guitarra»), un apartado «Cómo tocar Do7 en guitarra», todas las posiciones con diagrama grande y tabla de cuerdas, las **notas del acorde** (con la letra que les toca por grado), las coplas del cancionero que lo usan (índice invertido en `src/lib/coplas-por-acorde.ts`, memoizado) y un muro de acordes relacionados. Los textos y la notación inglesa están en `src/lib/glosario-acordes.ts` (puro). No llevan el JSON del índice ni el popover: los diagramas van en SVG desde el build. `node scripts/auditar-glosario-paginas.mjs` (después del build; también `npm run auditar:glosario-paginas`) comprueba que están las 605, con su H1 y diagrama.
- **Índice**: `/glosario` arranca plegado y no pinta diagramas. Las 17 fundamentales son `<details>` y dentro van los 605 enlaces a las páginas (nombre, notación inglesa y tipo). Los enlaces siguen en el HTML (se rastrean) y al pinchar uno se va directo a su página, sin popover. Pesa ~230 KB (~26 KB gzip) frente a los 1,38 MB de antes. El buscador filtra por nombre, notación inglesa y tipo, abre las fundamentales con resultados y las vuelve a plegar al borrar; el hash `#raiz-do` abre el grupo.
- El enlace manda `click_glosario_ver_acorde` (`ubicacion: indice`); en las fichas está en el panel «Acordes usados» (`ubicacion: ficha`) y en los relacionados (`ubicacion: relacionado`). El popover de las fichas/cifrado lleva «Ver acorde» encima de las flechas de posiciones (evento `click_glosario_popover_ver_acorde`).
- El buscador del glosario encuentra también por **notación inglesa**: `C7` → Do7, `Bb` → Sib.
- Reconocedor de acordes: `/reconocer-acorde` usa `src/lib/reconocer.ts` (`reconocerAcorde`) para identificar la postura por clases de altura, con el nombre más probable y alternativas. Funciona por teoría, esté o no la postura en el glosario: calcula las notas de las 6 cuerdas y busca el acorde que las contiene. `src/lib/reconocer-glosario.ts` (`mapaPosturas`) añade el nombre que usa la web y el enlace a `/glosario/<slug>/` cuando la postura exacta ya está en el glosario; si no, se usa el resultado teórico. La página es pública (texto, ejemplos, FAQ, `WebApplication` y `FAQPage`) y se enlaza desde `/glosario`, desde las 605 páginas de acorde, desde el panel «Acordes usados» de las coplas y desde el footer. Eventos: `click_reconocer_acorde_glosario` / `_pagina` / `_ficha` / `_footer`, `reconocer_acorde`, `click_glosario_desde_reconocer`, `limpiar_mastil` y `click_ejemplo_reconocer`. `npm run auditar:reconocer` comprueba 17 acordes comunes, 3 posturas inventadas fuera del glosario y que el recorrido del glosario no empeore (hoy 23 posiciones sin resultado y el 84 % con el nombre de la web).
- Cobertura: `npm run auditar:glosario` falla si algún acorde válido del cancionero no tiene diagrama.
- Posturas predeterminadas: `npm run auditar:posturas` falla si un `data-postura` de una ficha apunta a una posición que no existe en el glosario.

## Páginas de agrupación
Cuatro selecciones curadas de acordes, una por intención de búsqueda:
`/acordes-faciles-guitarra/`, `/acordes-con-cejilla/`, `/acordes-guitarra-espanola/` y
`/acordes-de-carnaval/`.

- El contenido (copy, selección, postura concreta de cada acorde, progresión y FAQ) vive en
  `src/lib/agrupaciones-acordes.ts`; la plantilla es `src/components/page/AgrupacionAcordes.astro` y
  las cuatro páginas de `src/pages/` solo le pasan su grupo.
- La selección se escribe a mano, no se filtra automáticamente: lo que aporta la página es el
  criterio y el porqué de cada acorde.
- Cada acorde lleva su postura exacta (se resuelve con `indicePostura`) y enlaza a su ficha. En
  Carnaval, además, se cuenta en el build cuántas coplas lo usan con `coplasPorAcorde`.
- Enlazan desde el bloque «Selecciones» de `/glosario` y desde `/reconocer-acorde`, y se enlazan
  entre ellas. No van en el footer ni en las fichas.
- `npm run auditar:agrupaciones` comprueba que cada acorde existe, que la postura está entre sus
  posiciones, que se cumple el criterio de la página (sin cejilla, con cejilla, primera posición o
  mínimo de coplas), que no hay repetidos, que la progresión usa acordes de la selección y que los
  metadatos son distintos. Con `dist/` construido revisa además H1, diagramas, los enlaces desde el
  glosario y el reconocedor y que el número de coplas que muestra cada tarjeta sea el real.

## Glosario de acordes (datos)
`node scripts/importar-glosario.mjs --regenerar [--dry-run] [--force] [--only <texto>]`
Genera `src/data/glosario-acordes.json` desde el glosario público de LaCuerda.net. Cachea las respuestas en `.cache/glosario` y espera 400 ms entre peticiones. No se ejecuta en build. **Reescribe el archivo entero**, así que sin `--regenerar` se niega a escribir: borraría las posturas hechas a mano.

`node scripts/importar-glosario-mit.mjs [--plan | --aplicar] [--fase A|B|C] [--detalle] [--revisar]`
Amplía el glosario con posiciones de `tombatossals/chords-db` (MIT) sin regenerarlo: solo añade posiciones al final de cada acorde y acordes nuevos al final del archivo. `--plan` no escribe y enseña el resumen; `--detalle` lista las posiciones descartadas y `--revisar` las nuevas de los acordes indicados (`--revisar=Do,La`). Las fases son acumulativas: A completa solo acordes existentes, B añade `sus2`, `sus4` y `madd9`, y C añade `7#9`, `9b5`, `m11`, `maj11` y `maj13`. Antes de escribir comprueba que ninguna posición existente desaparece ni cambia de orden, valida que la posición tenga las notas del acorde (no solo la fundamental) y guarda copia en `.cache/glosario-mit/`.

`node --experimental-strip-types scripts/auditar-glosario.ts`
Audita la cobertura: recorre `src/content/acordes` y falla si algún acorde válido no tiene diagrama. Requiere Node ≥ 22.6.

`node --experimental-strip-types scripts/sugerir-acorde.ts "Mi9"`
Comprueba si un acorde existe en el glosario y, si no, sugiere acordes parecidos disponibles (misma fundamental, enarmonía y sufijos similares).

## Autoscroll
Implementado en `src/components/page/AcordeCard.astro`. Activado por el botón de play y regulado con 1x-5x. Desde el 11/11/2026 el control vive en la barra de herramientas de la ficha (`BarraHerramientas.astro`), en la fila «Autoplay»: play/pausa y las cinco velocidades en horizontal, siempre visibles. Ya no flota sobre el cifrado, así que el `<pre>` no necesita hueco extra. La clase `.playing` del contenedor sigue cambiando play por pausa.

## Transportador
- **En la ficha**: el control vive en `src/components/page/BarraHerramientas.astro`, debajo del anuncio y encima de «Cejilla:» (dos filas: transporte y afinador). Antes estaba dentro de la caja de acordes (`AcordesDeLaPieza.astro`). La lógica no cambió: `AcordeCard.astro` busca los botones dentro de `.acorde-card`, no dentro de la caja, y la sincronización con los mini-diagramas va por el evento `ag:transpose`.
- **Motor**: `src/lib/transporte.ts` (`transportarEtiqueta`): cambia solo la raíz y el bajo, y conserva el sufijo y los espacios. `#glosario-datos` incluye las 12 transposiciones de cada acorde de la pieza, así que el popover y los diagramas del panel funcionan en cualquier tono. Tras transportar, `AcordeCard.astro` reparte los espacios de cada línea para que los acordes sigan sobre su sílaba. Sin persistencia; la cejilla no cambia.
- **Página**: `/transportar-acordes/` (`src/pages/transportar-acordes.astro`) trabaja con un cifrado pegado. Usa `transportarCifrado()`, que solo transporta las líneas que son de acordes (todos sus tokens son acordes o anotaciones entre paréntesis) y deja intactas las de letra. Mantiene la columna de cada acorde y conserva la alineación sobre la letra; los acordes pegados (`SolLam`) y los que llevan barra o bemoles también se transportan. Todo ocurre en el navegador y no se guarda nada. Se enlaza desde el footer (`click_transportador_footer`) y desde `/herramientas/`.

## Afinador
- **Página**: `/afinador-guitarra/` (`src/pages/afinador-guitarra.astro`). El widget es `src/components/afinador/Afinador.astro` y no arranca solo: el micrófono se pide al pulsar «Activar micrófono», que es lo que exigen iOS y los permisos.
- **Motor**: `src/lib/afinador/` — `cuerdas.ts` (las seis cuerdas y sus frecuencias), `notas.ts` (Hz → nota + cents, y cuerda más cercana) y `detector.ts` (Pitchy detrás de una interfaz propia). Usa `getUserMedia` sin cancelación de eco ni reducción de ruido, `AnalyserNode` de 4096, mediana de 7 lecturas, histéresis de 3 cents, claridad mínima 0,8 y puerta de volumen a −60 dB. La última nota se mantiene **2,5 s** sin lecturas válidas, para poder leerla y corregir sin volver a pulsar; un salto de más de 200 cents se interpreta como cambio de cuerda y no se promedia con la anterior. El grafo se cierra con una ganancia a cero hacia el destino: sin eso, algunos navegadores no procesan el analizador y devuelven silencio. El contexto se crea dentro del clic, antes de `getUserMedia`, para no perder el gesto en iOS. Al parar, en `pagehide` y en `astro:before-swap` se paran los tracks.
- **Diagnóstico en pantalla**: el widget lleva un medidor de señal (nivel RMS en dB, de −60 a 0) bajo la aguja. Si el nivel no llega en 2,5 s, aparece un aviso con qué revisar. Así se distingue «no hay permiso», «no llega señal» y «hay señal pero no se reconoce la nota».
- **Permisos**: `netlify.toml` necesita `microphone=(self)` en la `Permissions-Policy`; sin eso `getUserMedia` falla en producción y parece un fallo del detector. El sitio pide permiso y, si se deniega, muestra el mensaje y el botón para reintentar.
- **Ficha**: enlace «Afina tu guitarra antes de tocar» en la barra de herramientas, con `click_afinador_ficha`. Al activar/parar se envían `afinador_activar` y `afinador_parar`.

## Barra de herramientas de la ficha
`src/components/page/BarraHerramientas.astro` se pinta en `AcordeCard.astro` después del anuncio y **antes de `.acorde-meta`** (la cejilla, que sigue centrada y fuera del panel), y antes del cifrado. Es un panel con tres filas de etiqueta y controles: **Afinar** (enlace con aspecto de botón), **Transportar** (`−` / `0` / `+`) y **Autoplay** (play/pausa y 1x–5x en horizontal, siempre visibles; hover y selección solo cambian color, sin sombras ni desplazamientos). «Ver diagramas» se queda dentro de la caja de acordes. Si la ficha no tiene acordes enlazados, `AcordeCard` oculta solo el bloque `.transporte`; las otras dos filas se quedan.

## Herramientas
`/herramientas/` (`src/pages/herramientas.astro`) es la entrada del menú y del footer. Explica las cuatro herramientas (afinador, transportador, reconocedor y glosario) con texto propio, enlaza a las cuatro selecciones de acordes y lleva `WebPage`/`ItemList` y `FAQPage`. Cada herramienta enlaza de vuelta desde su cierre. Eventos `click_herramienta_*` y `click_herramientas_footer`.

## Anuncios de las páginas nuevas
Cada página creada en este bloque (las cuatro selecciones, el transportador, el afinador y herramientas) lleva **un solo anuncio manual**: `Anuncio2` (slot `9740119561`), colocado tras el bloque de introducción o de herramienta. Llevan `sinAnuncioSobreFooter` para no sumar el anuncio global del footer: una página, un anuncio. `npm run auditar:anuncios` (después del build) lo comprueba, junto con los enlaces del hub y la barra de herramientas de la ficha.

## URLs y barra final
- **Las páginas se sirven siempre con barra final**: `/acordes/pasodoble-guenagente/`. Netlify responde **301** en `/acordes/pasodoble-guenagente` y **200** en la versión con barra. La canonical (`Layout.astro`, desde `Astro.url.pathname`) y el sitemap ya usan la barra, así que solo hay una URL indexable y no hay contenido duplicado.
- Los enlaces internos se escriben sin barra en el código, y la integración `src/integrations/enlaces-con-barra.mjs` (registrada en `astro.config.mjs`) reescribe el HTML generado para añadirla. Solo toca rutas que existan en el build (`dist/<ruta>/index.html`), así que nunca toca assets, `/api/` ni enlaces rotos. Sin esto, cada clic pagaba un 301 de más (una ida y vuelta completa) e inutilizaba parte del prefetch.
- Si se añade un enlace interno nuevo, **no hace falta poner la barra a mano**: la integración lo hace en el build. En `astro dev` los enlaces salen sin barra (Astro sirve las dos variantes), es normal.
- `node scripts/auditar-enlaces.mjs` (después de `npm run build`) falla si algún enlace interno apunta a una URL sin barra que Netlify redirigiría; también avisa de enlaces a páginas inexistentes (los de `otraweb`, que no se publica).
- **Si un script lee un `href` del DOM, quita la barra final antes de usarlo**: `href.replace('/acordes/', '').replace(/\/+$/, '')`. El buscador de `/buscar` se rompió justo por esto al añadir la barra.

## Prefetch y transiciones de página
- **Prefetch**: `prefetch: { prefetchAll: true, defaultStrategy: 'hover' }` en `astro.config.mjs`. Precarga el HTML de los enlaces al pasar el ratón o al enfocar con teclado, descarta conexiones lentas (`saveData`, 2g) y enlaces externos. En táctil no hay hover, así que `src/components/utils/PrefetchTap.astro` precarga en `pointerdown` con `prefetch()` de `astro:prefetch` (comparte la lista de URLs ya precargadas; no duplica peticiones).
- **Transiciones**: view transitions cross-document nativas con `@view-transition { navigation: auto }` en `global.css`. **No** se usa `ClientRouter` (se quitó para que funcione AdSense Auto Ads): la navegación sigue siendo una carga completa, así que AdSense, GTM, GA4, el contador propio y el CMP funcionan igual. Chrome/Edge 126+ y Safari 18.2+; con `prefers-reduced-motion: reduce` se desactivan.
- El morph card → ficha se hace con el título y con la imagen: `transition:name` con `titulo-${slug}` en el `h3.card-title` (`Card.astro`) y en el `h2` de `AcordeCard.astro`, e `img-${slug}` en las dos imágenes. Astro emite las animaciones `astroFadeIn`/`astroFadeOut` pero no sus keyframes: están definidos en `global.css`.
- **La imagen conserva su recorte original**: la card usa `height: 220px` (180 px en móvil) y la ficha `360px` de ancho con `min/max-height` 225/240. Como las proporciones no coinciden (la card es casi cuadrada y la ficha 3:2), el morph de la imagen es un zoom con cambio de encuadre, no un morph perfecto. Si algún día se igualan las proporciones, el morph queda limpio; si se desactiva, basta con quitar `img-${slug}` de las dos imágenes.
- `node scripts/auditar-view-transitions.mjs` (después de `npm run build`) falla si algún HTML repite un `view-transition-name` en la misma página o si `@view-transition` no sobrevive al build.
