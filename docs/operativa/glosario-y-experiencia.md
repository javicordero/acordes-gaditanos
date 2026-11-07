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

## Glosario de acordes (datos)
`node scripts/importar-glosario.mjs [--dry-run] [--force] [--only <texto>]`
Genera `src/data/glosario-acordes.json` desde el glosario público de LaCuerda.net. Cachea las respuestas en `.cache/glosario` y espera 400 ms entre peticiones. No se ejecuta en build.

`node --experimental-strip-types scripts/auditar-glosario.ts`
Audita la cobertura: recorre `src/content/acordes` y falla si algún acorde válido no tiene diagrama. Requiere Node ≥ 22.6.

`node --experimental-strip-types scripts/sugerir-acorde.ts "Mi9"`
Comprueba si un acorde existe en el glosario y, si no, sugiere acordes parecidos disponibles (misma fundamental, enarmonía y sufijos similares).

## Autoscroll
Implementado en `src/components/page/AcordeCard.astro`. Activado por el botón de play y regulado con 1x–5x, que se despliegan en vertical bajo el botón. El control flota en la esquina superior derecha del cifrado (`top: -22px`) y el contenedor del `<pre>` lleva `padding-top: 26px` para que no tape la primera línea; en móvil el botón mide 28 px.

## Transportador
Los botones viven en el bloque «Transportar acordes» de `AcordesDeLaPieza.astro` (debajo de la cejilla). La lógica está en `src/lib/transporte.ts` (`transportarEtiqueta`): cambia solo la raíz y el bajo, y conserva el sufijo y los espacios. `#glosario-datos` incluye las 12 transposiciones de cada acorde de la pieza, así que el popover y los diagramas del panel funcionan en cualquier tono. Tras transportar, `AcordeCard.astro` reparte los espacios de cada línea para que los acordes sigan sobre su sílaba. Sin persistencia; la cejilla no cambia.

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
