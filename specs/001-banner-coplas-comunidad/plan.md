# Implementation Plan: Banner Vuestras Coplas

**Branch**: `001-banner-coplas-comunidad` | **Date**: 16/09/2026 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-banner-coplas-comunidad/spec.md`

## Summary

Crear un componente `BannerCoplasComunidad.astro` réplica de `BannerMartin.astro` que promocione las coplas de la comunidad con título "Vuestras coplas", dos párrafos informativos (peticiones/votaciones y donaciones), enlaces a `/pedir-copla` y `/colaborar`, e indicador de donaciones. El componente reemplazará a `BannerMartin` en el index.

## Technical Context

**Language/Version**: TypeScript (Astro 5.x)

**Primary Dependencies**: Astro, `DonationIndicator` (componente existente), `Icon` (astro-icon)

**Storage**: N/A (componente estático)

**Testing**: Verificación manual con `npm run dev` y `npm run astro check`

**Target Platform**: Navegador web (desktop + móvil), SSG

**Project Type**: SSG site (Astro)

**Performance Goals**: Full viewport height, responsive < 640px

**Constraints**: Seguir estructura exacta de `BannerMartin.astro`, usar CSS variables del proyecto, fuente Montserrat

**Scale/Scope**: 1 componente nuevo, 1 archivo modificado (index.astro)

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Static-First | ✅ PASS | Componente SSG, sin SSR ni endpoints |
| II. Content-Driven | ✅ PASS | No usa content collections |
| III. Chord Format | N/A | No involucra acordes |
| IV. Speckit | ✅ PASS | Spec → Plan → Tasks → Implement |
| V. Build Discipline | ✅ PASS | Verificar con `npm run dev` antes de commit |
| VI. Spanish-First | ✅ PASS | Todo el contenido en español |

## Project Structure

### Documentation (this feature)

```text
specs/001-banner-coplas-comunidad/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1 (mínimo)
├── quickstart.md        # Fase 1
└── tasks.md             # Fase 2 (speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── page/
│       └── BannerCoplasComunidad.astro  # NUEVO
└── pages/
    └── index.astro                       # MODIFICADO (import y uso)
```

**Structure Decision**: Componente en `src/components/page/` siguiendo el patrón existente de banners. Solo 1 archivo nuevo + 1 modificación.

## Implementation Steps

### Step 1: Crear BannerCoplasComunidad.astro

- Copiar estructura de `BannerMartin.astro`
- Cambiar título a "Vuestras coplas"
- Escribir dos párrafos:
  - P1: Invitación a peticiones + votación (enlace a `/pedir-copla`)
  - P2: Referencia a donaciones para apoyar
- Usar imagen de fondo: `https://static.grupojoly.com/clip/e68a84a7-37c4-4bbe-a35c-f859862ca005_source-aspect-ratio_1600w_0.jpg`
- Incluir `DonationIndicator` con variante `timeline`
- Mantener CSS idéntico (responsive, setVh, Montserrat)

### Step 2: Actualizar index.astro

- Importar `BannerCoplasComunidad` en lugar de `BannerMartin`
- Reemplazar `<BannerMartin />` por `<BannerCoplasComunidad />`

### Step 3: Verificar

- `npm run astro check` (type-check)
- `npm run dev` (verificar rendering en navegador)

## Complexity Tracking

No hay violaciones de constitución. Feature de baja complejidad.
