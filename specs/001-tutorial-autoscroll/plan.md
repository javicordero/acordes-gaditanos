# Implementation Plan: Tutorial interactivo de autoscroll

**Branch**: `001-tutorial-autoscroll` | **Date**: 2026-05-25 | **Spec**: `specs/001-tutorial-autoscroll/spec.md`

**Input**: Feature specification from `specs/001-tutorial-autoscroll/spec.md`

## Summary

Crear un overlay tipo coach mark que se muestra automáticamente en la primera
visita a páginas de acordes, destacando los controles de autoscroll con un
tooltip explicativo. Incluye botón "?" de ayuda permanente, coordinación con
EncuestaModal, accesibilidad WCAG y analytics vía GTM.

## Technical Context

**Language/Version**: JavaScript / Astro 5.x

**Primary Dependencies**: Astro View Transitions, Google Tag Manager (dataLayer)

**Storage**: localStorage (clave `ag_tutorial_autoscroll_visto`)

**Testing**: Pruebas manuales en navegador (no hay test framework configurado)

**Target Platform**: Navegadores modernos (Chrome, Firefox, Safari, Edge)

**Project Type**: Web SSG (Astro content collections)

**Performance Goals**: Tutorial visible en <500ms desde page-load

**Constraints**: SSG - sin servidor, todo client-side. Sin Tailwind, sin
frameworks CSS. PostCSS con nesting y preset-env stage 1.

**Scale/Scope**: Una única página por visita (acordes/[id]), máximo 1 card
con tutorial visible a la vez.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| **Static-First**: No SSR/server endpoints added | ✅ PASS | Tutorial es 100% client-side JS y CSS |
| **Content-Driven**: No modifica colecciones | ✅ PASS | Solo añade componente visual, no toca content collections |
| **Chord Format**: No modifica formato de acordes | ✅ PASS | El tutorial no interactúa con el contenido de acordes |
| **Build Discipline**: Astro build, no Tailwind | ✅ PASS | Sin nuevas dependencias, estilos autocontenidos en el componente |
| **Spanish-First**: Todo en español | ✅ PASS | Tooltip y mensajes en español |
| **Backward Compatibility**: 400+ entries intactas | ✅ PASS | Solo añade overlay y tooltip, no modifica comportamiento existente |

## Project Structure

### Documentation (this feature)

```text
specs/001-tutorial-autoscroll/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/components/page/
├── TutorialAutoscroll.astro   # CREAR — componente overlay completo
└── AcordeCard.astro           # MODIFICAR — importar TutorialAutoscroll + botón "?"

src/components/ads/
└── EncuestaModal.astro        # MODIFICAR — escuchar evento ag:tutorial-completed
```

**Structure Decision**: Astro islands architecture estándar del proyecto.
Cada componente es autocontenido con template, script y estilo. El tutorial
se importa desde AcordeCard (solo visible en páginas con autoscroll), no
desde Layout.astro.

## Complexity Tracking

Sin violaciones de la constitución.
