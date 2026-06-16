# Implementation Plan: Indicador de donaciones con total histórico

**Branch**: `003-mejora-donaciones` | **Date**: 15/06/2026 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-mejora-donaciones/spec.md`

## Summary

Mostrar en la columna lateral derecha (refactorizando `Apoyar.astro`) y en el banner de homepage (`BannerNoly.astro`) un indicador con el total histórico de donaciones y timeline de últimas donaciones. Los datos se cargan desde una content collection de Astro (`src/content/donaciones/datos.md`) mediante `getCollection()` en build-time, sin fetch cliente ni backend. Los valores computados (total, nº donantes, últimas donaciones) se pasan al script del cliente vía `define:vars`.

## Technical Context

**Language/Version**: TypeScript (Astro 4.x, Node.js build)

**Primary Dependencies**: `astro:content` (módulo nativo de Astro, sin dependencias externas adicionales)

**Storage**: Content collection `donaciones` en `src/content/donaciones/datos.md` (YAML frontmatter con array de donaciones)

**Testing**: No hay test suite en el proyecto. La verificación será manual (navegador + modificar `datos.md` + rebuild). El proyecto usa `npm run astro check` para type-check.

**Target Platform**: Navegadores web modernos (Chrome, Firefox, Safari, Edge)

**Project Type**: SSG sitio web estático (Astro content collections)

**Performance Goals**: Datos inlineados en HTML en build-time (<1KB). Sin fetch cliente. Sin metas de rendimiento específicas.

**Constraints**: 
- SSG puro, sin endpoints SSR ni backend
- Los datos se actualizan modificando `src/content/donaciones/datos.md` y redeployando (NO en caliente)
- Debe degradarse gracefulmente si la content collection está vacía o no existe
- Build fallará si el YAML frontmatter es inválido (validación Zod en content config)

**Scale/Scope**: 1 archivo Markdown con YAML frontmatter, actualizado manualmente. Máximo ~200 donaciones previsibles.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| **Static-First (I)** | ✅ PASS | Content collection en build-time. Datos computados en servidor (build) mediante `getCollection()`, renderizado estático completo. Sin fetch cliente ni SSR. |
| **Content-Driven (II)** | ✅ PASS | Nueva content collection `donaciones` en `src/content/donaciones/datos.md`. Registrada en `src/content/config.ts`. Sigue el mismo patrón que `acordes` y `autores`. |
| **Chord Format (III)** | ✅ PASS | No modifica el formato de acordes. |
| **Speckit Planning (IV)** | ✅ PASS | Siguiendo el flujo speckit: clarify → plan. |
| **Build Discipline (V)** | ✅ PASS | Requiere añadir colección `donaciones` en content config. Build-time load con `getCollection()`. Build falla si YAML inválido (Zod). |
| **Spanish-First (VI)** | ✅ PASS | Todo el contenido del indicador en español. |
| **CSS Conventions** | ✅ PASS | Usa CSS con nesting (postcss-nesting) y variables existentes. Sin Tailwind. |
| **Backward Compatibility** | ✅ PASS | No modifica contenido existente. Refactoriza `Apoyar.astro` manteniendo funcionalidad actual del botón de donación. |

No violations found. Complexity tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-mejora-donaciones/
├── plan.md              # This file (/speckit.plan)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # (/speckit.tasks - NOT created here)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── right-column/
│   │   └── Apoyar.astro          # REFACTOR: integrar DonationIndicator
│   ├── page/
│   │   └── BannerNoly.astro      # MODIFY: añadir DonationIndicator
│   └── DonationIndicator.astro   # NEW: componente compartido (carga build-time via getCollection)
├── content/
│   ├── config.ts                 # MODIFY: añadir colección donaciones con esquema Zod
│   └── donaciones/
│       └── datos.md              # NEW: datos de donaciones en YAML frontmatter

specs/003-mejora-donaciones/
└── ...                           # Documentación del feature
```

**Structure Decision**: Single Astro project existente. Se añade un componente compartido (`DonationIndicator.astro`) que carga datos build-time desde content collection, un archivo de datos (`datos.md`) en la nueva colección `donaciones`, y se modifica `src/content/config.ts` para registrar la colección. No se crean nuevos proyectos ni directorios adicionales. A diferencia del diseño inicial, se elimina `src/lib/donations.ts` (la lógica de fetch cliente ya no es necesaria) y `public/donaciones.json` (los datos viven en la content collection).
