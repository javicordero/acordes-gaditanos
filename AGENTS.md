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
- **`acordes2`** — colección provisional para los acordes importados del cancionero. Mismo esquema que `acordes`, pero su contenido (`.md`) no se versiona y los acordes van sin envolver en `<a>` hasta que se promueven.

Slugs se generan automáticamente (lowercase, sin tildes, guiones). El transform también produce `musicaSlugs`, `letraSlugs`, `agrupacionSlug`.

### Formato de acordes
Cada acorde envuelto en `<a>etiqueta</a>` dentro de `<pre>`. El script `scripts/generate-pdf.mjs` parsea este formato.
```
<pre><a>LaM7</a>            <a>Mi7</a>               <a>Sim7</a>
Bendita suerte pal aficionao que más de un mes de
```

En los popurrís, los cambios de cejilla a mitad de copla se marcan con `<strong>Cejilla: 4</strong>` (o `<strong>Cejilla: No</strong>` cuando se toca al aire), **solos en su línea y sin espacios alrededor**: `AcordeCard.astro` los pinta como el chip `.acorde-meta` (icono de cejilla + texto en mayúsculas, centrado).

### Autores
`AutorCardsGroup` pinta el grid de autores (2 columnas en desktop, 1 en móvil). Cada `AutorCard` enlaza a la página principal del autor según `type` y añade chips a `/autor/musica/{slug}` y `/autor/letra/{slug}` cuando tiene créditos, calculados en build con `contarCreditosAutores` (`src/lib/autores.ts`). La home muestra los 6 primeros por `order` (5 en móvil) y `/autores` los muestra todos. Toda la card (imagen y cuerpo) usa `--primary-contrast-color`; el título y la línea de los chips van en `--on-bright-color` y los chips usan fondo `--on-bright-color` con texto `--primary-contrast-color` (sin cambio al hover). La sombra es `--on-bright-color` en reposo y en hover (solo crece y la card se desplaza).

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
| `/admin/stats` | `pages/admin/stats.astro` |
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
Implementado en `src/components/page/AcordeCard.astro`. Activado por checkbox "Activar autoscroll". Velocidad regulable. El tutorial del botón «?» ya no se abre solo: solo al pulsarlo.

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
- El mensaje se agrupa por push: 1 copla → ficha; de 2 a 10 → lista `• Pieza Agrupación — año` + enlace a `/lista/`; más de 10 (importación) → resumen con enlace a `/novedades/`. Antes de enviar espera hasta 5 minutos a que la ficha responda 200 (Netlify tarda 1-2 min), para no publicar un enlace roto.
- Formato acordado (sin paréntesis en el año):
  ```
  🎶 Nueva copla

  Pasodoble La Marea — 2024
  Música: Tatán
  Letra: Antonio Martín

  https://acordesgaditanos.com/acordes/pasodoble-la-marea/
  ```
  Si música y letra son la misma persona se juntan en `Música y letra: …`; si falta el año, se omite el `— año`. La vista previa la pone Telegram (y WhatsApp) con el `og:image` de la ficha.
- Local: `npm run difundir -- --solo <slug> --dry-run`, `--test`, `--antes <sha>`. La Action también admite `workflow_dispatch` con modo `prueba` (manda un mensaje de prueba al canal), `seco` (con `slugs` previsualiza esas coplas; sin ellos compara `HEAD~1`) o `reenviar`.
- **Secretos**: `TELEGRAM_BOT_TOKEN` (repo → Settings → Secrets → Actions) y, si se quiere cambiar, la variable `TELEGRAM_CHAT_ID` (por defecto `@acordesgaditanos`). El token no se imprime nunca. El bot debe ser administrador del canal con «Publicar mensajes», o Telegram devuelve `403`.
- **WhatsApp no tiene API oficial**: las APIs no oficiales (Whapi, Baileys…) van contra los términos de WhatsApp, cuestan 10-30 €/mes y arriesgan el número y el canal, así que no se usan. En su lugar, `scripts/whatsapp.mjs` controla WhatsApp Web con Playwright y **tu Chrome** (perfil propio `wa-profile/`, gitignored) desde este equipo: escribe el aviso en el canal «Acordes Gaditanos» y **envía solo** tras 15 s de margen (si se cierra la ventana, no se envía). Se lanza desde la skill `subir-acorde` después del push (`npm run wa -- --solo <slug>`), nunca desde CI: no hay runner ni secretos.
  - `npm run wa:login` — una sola vez (y cuando caduque): abre Chrome con el QR, se escanea y se cierra solo. Código de salida `2` = sesión caducada.
  - `npm run wa -- --solo <slug>[,<slug>]` — espera a que la ficha responda 200, abre el canal, vacía el borrador si lo hubiera, escribe (saltos con Shift+Enter) y envía solo a los 15 s. `--manual` deja el mensaje escrito y espera el Enter; `--margen <seg>` cambia el margen; `--dry-run` solo enseña el texto; `--comprobar` abre el canal y captura sin escribir; `--forzar` republica.
  - Selectores por `role`/`aria-label`/`title` (nunca clases: WhatsApp las ofusca), con variantes es/en. Ante fallo deja captura en `wa-debug/` y sale con `3` (canal), `4` (compositor) o `5` (no enviado).
  - `wa-enviados.json` (gitignored) evita publicar dos veces el mismo aviso: solo se marca cuando se detecta el envío.
  - El texto sale de `scripts/lib/aviso.mjs`, el mismo módulo que usa `difundir.mjs`, así que Telegram y WhatsApp nunca se separan.
  - Si el mensaje se pega a mano, se copia el mismo texto del canal de Telegram; el enlace genera la vista previa.
- **X (@AcordesGaditano)**: `scripts/x.mjs` hace lo mismo con tu Chrome (perfil `x-profile/`, gitignored): escribe el tuit, lo **publica solo** a los 15 s (`--manual` para dejarlo escrito y esperar «Publicar») y lo confirma en el perfil. `npm run x:login` una vez (comprueba que la cuenta es la esperada); `npm run x -- --solo <slug>`. Formato: «🆕 Nuevos acordes en la web», `🎭 Pieza – Agrupación`, `🎵` música y `✏️` letra (una sola línea si es la misma persona) y `🔗` al final. Contador tipo X (enlace = 23, emoji = 2, tope 280; si se pasa, quita autores y luego recorta el nombre, nunca la URL). Adjunta el `img` del `.md` validado por bytes mágicos y tamaño (≤5 MB). Verifica el tuit en `x.com/<cuenta>` antes de marcarlo en `x-enviados.json`.
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
- Eventos del transportador: `transpose_acorde` (parámetros `direccion` y `semitonos`) y `transpose_volver_original`.
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

