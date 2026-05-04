# AGENTS.md

## Idioma
- **Commits**: Siempre en español
- **Mensajes de salida**: En español

## Commands
- `npm run dev` - Start dev server at localhost:4321
- `npm run build` - Build to ./dist/
- `npm run preview` - Preview production build
- `npm run astro check` - Type-check

## Architecture

### Content Collections
- **`src/content/config.ts`** defines two collections:
  - `acordes` - Song chords with metadata (pieza, agrupacion, musica, letra, year, cejilla, video, cover, etc.)
  - `autores` - Authors (nombre, img, type: musica|letra, order)

Slug generation is automatic via transform (normalized, lowercase, dashes).

### Dynamic Routes
| Route | File | Description |
| `/acordes/[id]` | `src/pages/acordes/[id].astro` | Individual chord entry |
| `/autor/musica/[autorSlug]` | `src/pages/autor/musica/[autorSlug].astro` | Author music |
| `/autor/letra/[autorSlug]` | `src/pages/autor/letra/[autorSlug].astro` | Author lyrics |
| `/agrupacion/[agrupacionSlug]` | `src/pages/agrupacion/[agrupacionSlug].astro` | Grouping |
| `/carnaval/[year]` | `src/pages/carnaval/[year].astro` | Year archive |
| `/buscar` | `src/pages/buscar.astro` | Search page |
| `/admin/stats` | `src/pages/admin/stats.astro` | Statistics |

### Special Features
- **PDF generation**: `scripts/generate-pdf.mjs` uses pdf-lib and @pdf-lib/fontkit
- **Redirects**: `public/_redirects` and `public/redirects.json` handle URL redirects (deployed to `dist/`)
- **Cookie consent**: `src/lib/cookiesConsent.ts`
- **Middleware**: `src/middleware.ts` for SSR

## Dependencies
- astro: ^5.15.9
- astro-icon: ^1.1.5
- @astrojs/sitemap: ^3.6.0
- @astrojs/partytown: ^2.1.4
- pdf-lib: ^1.17.1
- @pdf-lib/fontkit: ^1.1.1

## Dev Dependencies
- postcss, postcss-nesting, postcss-csso, postcss-preset-env, autoprefixer (CSS processing)

## CSS
- Global styles in `src/styles/global.css`
- PostCSS config in `postcss.config.cjs`

## Integrations
Configured in `astro.config.mjs`:
- `icon` (iconDir: 'src/icons')
- `sitemap` (filters /coming-soon and /en-construccion)
- No explicit Partytown configured in config, but included in dependencies