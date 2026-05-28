# Acordes Gaditanos Constitution

## Core Principles

### I. Static-First

The site is 100% Static Site Generation (SSG) with Astro. No SSR, no server endpoints beyond the minimal CORS proxy at `/api/fetch-url`. All pages must be pre-renderable at build time. Dynamic data must be client-side via serialized JSON or JS.

### II. Content-Driven Architecture

Content lives in Astro content collections (`src/content/`). The two collections are `acordes` (400+ chord entries) and `autores` (11 authors). Slugs are auto-generated from titles (lowercase, no accents, hyphens). Transform functions enrich each entry with `musicaSlugs`, `letraSlugs`, `agrupacionSlug` at collection load time.

### III. Chord Format Convention

All chord names must be wrapped in `<a>chord</a>` tags inside `<pre>` blocks. This format is parsed by `scripts/generate-pdf.mjs` and displayed with distinct styling on the site. Never use plain text for chords.

### IV. Feature Planning via Speckit

Every feature must start with a spec (`.specify/` tracking) before any code is written. Use the `/speckit.*` commands in order: `constitution → specify → clarify → checklist → plan → tasks → analyze → implement`. The old custom agents (`spec-planner`, `spec-implementer`) and the `spec-creator` skill have been removed in favor of Speckit. Existing `.specs/` directory is legacy.

### V. Build Discipline

Build (`astro build`) only before commits. Verify changes with `npm run dev`. `npm run astro check` is the only type-check available. There are no test scripts or linters. PostCSS processes CSS with `postcss-nesting` and `postcss-preset-env` (stage 1). No Tailwind.

### VI. Spanish-First

All content, commit messages, and agent interactions must be in Spanish. The site targets the Carnaval de Cádiz community.

## SEO & Analytics Requirements

- Site URL: `https://acordesgaditanos.com`
- Google Tag Manager: `GTM-MZG7K2Q4`
- Google AdSense: `ca-pub-3280015847198273`
- Redis/Cloudflare analytics via worker at `stats-worker.javiercorderotoscano.workers.dev`
- Sitemap excludes `/coming-soon` and `/en-construccion`
- Middleware redirects `/formateadores/*` and `/coming-soon` to 404
- OG image default: `/og-image.png`
- `public/redirects.json` handles 300+ legacy URL redirects client-side
- `public/_redirects` handles `/ads.txt` redirect (Netlify-compatible)

## PostCSS & CSS Conventions

- CSS nesting via `postcss-nesting` (CSS specification compliant)
- Modern CSS features via `postcss-preset-env` (stage 1)
- Global styles in `src/styles/global.css`
- CSS variables in `src/styles/variables.css`
- No CSS frameworks or utility libraries (no Tailwind, no Bootstrap)

## Governance

The constitution supersedes ad-hoc instructions. Amendments require documentation and approval. Features must maintain backward compatibility with the 400+ existing content entries. The `/speckit.constitution` command updates this file.

**Version**: 1.0.0 | **Ratified**: 2026-05-25 | **Last Amended**: 2026-05-25
