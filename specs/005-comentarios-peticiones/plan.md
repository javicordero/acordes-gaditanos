# Implementation Plan: Comentarios y Peticiones de Coplas

**Branch**: `005-comentarios-peticiones` | **Date**: 31/08/2026 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-comentarios-peticiones/spec.md`

## Summary

Sistema de comentarios y peticiones de coplas para Acordes Gaditanos. Los usuarios pueden pedir coplas publicamente y comentarse entre ellos con hilos de respuesta. El administrador responde con badge "Propietario", marca peticiones como completadas y modera contenido. Backend: Cloudflare Worker + KV. Frontend: componentes Astro con JS client-side.

## Technical Context

**Language/Version**: JavaScript (Cloudflare Worker), TypeScript/Astro 5.x (frontend)

**Primary Dependencies**: Astro 5.x, Cloudflare Workers runtime, Cloudflare KV

**Storage**: Cloudflare KV (key-value, JSON por página)

**Testing**: `npm run dev` (verificación manual), `npm run astro check` (type-check)

**Target Platform**: Static site (Astro SSG) + Cloudflare Worker (edge)

**Project Type**: Web application (SSG frontend + serverless backend)

**Performance Goals**: <2s carga de comentarios, <30s creación de petición

**Constraints**: 100% SSG para páginas existentes, datos dinámicos solo vía client-side JS + Worker API

**Scale/Scope**: ~400 páginas de acordes, ~5 peticiones/día esperadas, 1 administrador

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Static-First | ✅ PASS | Las páginas de acordes siguen siendo SSG. Los comentarios se cargan vía client-side JS. El Worker es serverless, no SSR. |
| II. Content-Driven Architecture | ✅ PASS | Los comentarios no viven en content collections. Se almacenan en KV separadamente. |
| III. Chord Format Convention | ✅ PASS | No aplica (no se modifican acordes existentes). |
| IV. Feature Planning via Speckit | ✅ PASS | Feature planificada con speckit (spec → clarify → plan). |
| V. Build Discipline | ✅ PASS | Se verificará con `npm run dev` y `npm run astro check`. |
| VI. Spanish-First | ✅ PASS | Toda la UI, contenido y mensajes de error en español. |

**Gate Result**: ✅ ALL PASS — Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/005-comentarios-peticiones/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   └── worker-api.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
workers/comments-worker/
├── src/
│   └── index.js          # Cloudflare Worker (API de comentarios)
├── wrangler.toml          # Configuración del Worker
└── package.json

src/
├── components/
│   └── comments/
│       ├── CommentsSection.astro   # Contenedor principal
│       ├── CommentItem.astro       # Cada comentario individual
│       ├── CommentForm.astro       # Formulario de envío
│       ├── PedirCoplaFAB.astro     # Botón flotante (index/buscar)
│       └── PedirCoplaCard.astro    # Card de right column
├── pages/
│   ├── pedir-copla.astro           # Página dedicada de peticiones
│   └── admin/
│       └── comentarios.astro       # Panel admin
└── lib/
    └── comments.ts                 # Config (Worker URL)
```

**Structure Decision**: Backend separado en `workers/comments-worker/` (Cloudflare Worker independiente). Frontend integrado en la estructura existente de Astro. Componentes de comentarios en `src/components/comments/`. Páginas nuevas en `src/pages/`.

## Complexity Tracking

No violations to justify. Feature follows existing project patterns.
