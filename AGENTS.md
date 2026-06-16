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

## Spec-Driven Development (Speckit)

Usar GitHub Spec Kit para planificar features. Subagentes en `.opencode/agents/speckit-*.md`:

| Subagente | Invocación | Propósito |
|---|---|---|
| `speckit-constitution` | `task - speckit-constitution - "principios"` | Establecer/actualizar principios del proyecto |
| `speckit-specify` | `task - speckit-specify - "descripción feature"` | Crear especificación funcional |
| `speckit-clarify` | `task - speckit-clarify - ""` | Clarificar requisitos ambiguos |
| `speckit-plan` | `task - speckit-plan - ""` | Plan técnico de implementación |
| `speckit-tasks` | `task - speckit-tasks - ""` | Desglosar en tareas accionables |
| `speckit-analyze` | `task - speckit-analyze - ""` | Validar consistencia spec/plan/tasks (read-only) |
| `speckit-checklist` | `task - speckit-checklist - "ux"` | Generar checklist de calidad |
| `speckit-implement` | `task - speckit-implement - ""` | Ejecutar implementación |

Flujo completo: `constitution → specify → clarify → plan → tasks → analyze → implement`

Cada subagente lee las instrucciones detalladas desde `.opencode/commands/speckit.*.md` y las ejecuta adaptadas a OpenCode.

**Importante**: Ejecutar `chcp 65001` en PowerShell antes de `specify` para evitar errores de encoding en Windows.

### Subagentes NO creados
- `speckit.taskstoissues` — requiere GitHub MCP (no configurado)
- `speckit.git.*` — hooks git ya están como skills en `.agents/skills/speckit-git-*`

### Especificaciones
- Las specs activas están en `specs/NNN-feature/`

## Architecture

### SSG site
Sitio 100% estático (SSG) con Astro content collections. Middleware solo redirige `/formateadores` y `/coming-soon` → 404.

### Content Collections (`src/content/config.ts`)
- **`acordes`** — 400+ entradas. Frontmatter: `pieza`, `agrupacion`, `musica`/`letra` (strings separados por coma), `year` (number → string), `date` (formato español `DD/MM/YYYY`), `cejilla` (number → string), `video`, `img`, `cover`, `autorCover`, `fraseClave`, `destacada`, `recomendada`.
- **`autores`** — 11 autores. Frontmatter: `nombre`, `img`, `type` (`musica`|`letra`), `order`, `destacado`.

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
| `/autor/musica/[autorSlug]` | `pages/autor/musica/[autorSlug].astro` |
| `/autor/letra/[autorSlug]` | `pages/autor/letra/[autorSlug].astro` |
| `/agrupacion/[agrupacionSlug]` | `pages/agrupacion/[agrupacionSlug].astro` |
| `/carnaval/[year]` | `pages/carnaval/[year].astro` |
| `/buscar` | `pages/buscar.astro` (búsqueda cliente con datos serializados) |
| `/admin/stats` | `pages/admin/stats.astro` |
| `/api/fetch-url` | `pages/api/fetch-url.ts` — proxy CORS (GET `?url=...`) |
| `/formateadores/*` | Redirigido a 404 por middleware (páginas existen pero ocultas) |

**Importante**: `/coming-soon` y `/en-construccion` se filtran del sitemap. `/formateadores` redirige a 404.

### Autoscroll
Implementado en `src/components/page/AcordeCard.astro`. Activado por checkbox "Activar autoscroll". Velocidad regulable. Ver `AUTOSCROLL-FEATURE.md`.

### Redirects
- `public/_redirects` — redirect 301 de `/ads.txt` (Netlify-compatible)
- `public/redirects.json` — mapa de 300+ URLs legacy → nuevas rutas (usado client-side)
- `public/redirects-from.json` — lista de URLs legacy

### PDF Generation
`node scripts/generate-pdf.mjs src/content/acordes/<slug>.md`
Genera un PDF al lado del .md. Requiere `fonts/RobotoMono-*.ttf` (fallback a Courier).

### SEO & Analytics
- Site: `https://acordesgaditanos.com`
- Google Tag Manager: `GTM-MZG7K2Q4`
- Google Adsense: `ca-pub-3280015847198273`
- Claves en `src/lib/constants.ts`
- OG image por defecto: `/og-image.png`

### PostCSS
`postcss.config.cjs` usa `postcss-nesting` (anidamiento CSS nativo) y `postcss-preset-env` (stage 1). Sin Tailwind.

## Available Agent Skills
Skills en `.agents/skills/` para tareas comunes:
- `chord-formatting` — envolver acordes en `<a>` tags
- `create-acorde` — crear nuevo archivo markdown de acorde
- `transportar` — transponer acordes de tonalidad
- `tweet-acorde` — generar tweet para anunciar acorde
- `seo` — optimizaciones SEO
- `accessibility` — auditoría WCAG
- `astro` / `astro-framework` — guías de Astro
- `frontend-design` — diseño UI

Skills de speckit para git: `speckit-git-*` en `.agents/skills/`.

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

<!-- SPECKIT START -->
For additional context about the active feature, read the plan at
`specs/003-mejora-donaciones/plan.md`
<!-- SPECKIT END -->
