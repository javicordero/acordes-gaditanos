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

### Dynamic Routes (`src/pages/`)
| Route | File |
|---|---|
| `/acordes/[id]` | `pages/acordes/[id].astro` |
| `/acordes2/[id]` | `pages/acordes2/[id].astro` — previsualización local de acordes importados (no versionada; `noindex`, fuera del sitemap) |
| `/lista2` | `pages/lista2.astro` — listado local de `acordes2` (no versionada; `noindex`, fuera del sitemap) |
| `/autor/musica/[autorSlug]` | `pages/autor/musica/[autorSlug].astro` |
| `/autor/letra/[autorSlug]` | `pages/autor/letra/[autorSlug].astro` |
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
- Componentes: `DiagramaAcorde.astro`, `GlosarioPopover.astro`, `AcordesDeLaPieza.astro` y `GlosarioHint.astro` (aviso «Novedad» bajo la cejilla).
- Anclas estables en `/glosario`: `#mi7`, `#do-sostenido-m7`, `#sol-sostenido-m`.
- Reconocedor de acordes: `/reconocer-acorde` usa `src/lib/reconocer.ts` (`reconocerAcorde`) para identificar la postura por clases de altura, con el nombre más probable y alternativas. Funciona por teoría, aunque la postura no esté en el JSON. De momento es **privado**: `noindex`, fuera del sitemap y sin enlaces desde el glosario ni el footer; queda accesible por URL directa para publicarlo en el futuro.
- Cobertura: `node --experimental-strip-types scripts/auditar-glosario.ts` falla si algún acorde válido del cancionero no tiene diagrama.

### Autoscroll
Implementado en `src/components/page/AcordeCard.astro`. Activado por checkbox "Activar autoscroll". Velocidad regulable. El tutorial del botón «?» ya no se abre solo: solo al pulsarlo.

### Transportador
Los botones viven en el bloque «Transportar acordes» de `AcordesDeLaPieza.astro` (debajo de la cejilla). La lógica está en `src/lib/transporte.ts` (`transportarEtiqueta`): cambia solo la raíz y el bajo, y conserva el sufijo y los espacios. `#glosario-datos` incluye las 12 transposiciones de cada acorde de la pieza, así que el popover y los diagramas del panel funcionan en cualquier tono. Tras transportar, `AcordeCard.astro` reparte los espacios de cada línea para que los acordes sigan sobre su sílaba. Sin persistencia; la cejilla no cambia.

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

### PostCSS
`postcss.config.cjs` usa `postcss-nesting` (anidamiento CSS nativo) y `postcss-preset-env` (stage 1). Sin Tailwind.

## Available Agent Skills
Skills en `.agents/skills/` para tareas comunes:
- `chord-formatting` — envolver acordes en `<a>` tags
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

