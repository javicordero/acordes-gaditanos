# Implementation Plan: Transportador de Acordes

**Branch**: `006-transportador-acordes` | **Date**: 04/09/2026 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-transportador-acordes/spec.md`

## Summary

Añadir un transportador de acordes en la esquina superior derecha del `<pre>` de cada página de acorde. Dos botones +/− en fila horizontal permiten subir/bajar el tono de semitono en semitono. Los acordes se transportan instantáneamente en el navegador. El botón "?" existente del autoscroll se reutiliza para ayuda combinada (autoscroll + transportador).

## Technical Context

**Language/Version**: JavaScript (ES2015+ inline), Astro components, CSS custom properties
**Primary Dependencies**: Astro (framework), postcss-nesting, postcss-preset-env
**Storage**: N/A — todo es temporal en el navegador (sin persistencia)
**Testing**: Manual — `npm run dev` y probar en navegador (no hay scripts de test)
**Target Platform**: Web (SSG), responsive (mobile + desktop)
**Project Type**: SSG site estático con Astro
**Performance Goals**: Transportación instantánea al pulsar botón (< 50ms percepción)
**Constraints**: No romper el autoscroll existente, mantener compatibilidad con 400+ entradas de acordes
**Scale/Scope**: 1 componente modificado (AcordeCard.astro), 1 componente de tutorial modificado

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Static-First | ✅ PASS | Feature es 100% client-side JavaScript inline. No SSR, no endpoints. |
| II. Content-Driven | ✅ PASS | No modifica content collections. Opera sobre el DOM existente. |
| III. Chord Format | ✅ PASS | Transporta acordes dentro de `<a>` tags, preservando el formato. |
| IV. Feature Planning | ✅ PASS | Siguiendo flujo speckit completo. |
| V. Build Discipline | ✅ PASS | Cambios en componente existente. Verificar con `npm run dev`. |
| VI. Spanish-First | ✅ PASS | Tooltips, aria-labels y ayuda en español. |

**Post-Phase 1**: Re-check after design — PASS (no new violations).

## Project Structure

### Documentation (this feature)

```text
specs/006-transportador-acordes/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md        # Phase 1 — escala cromática y entidades
├── checklists/
│   └── requirements.md  # Checklist de calidad
└── tasks.md             # Phase 2 — NO creado por /speckit.plan
```

### Source Code (repository root)

```text
src/
├── components/
│   └── page/
│       ├── AcordeCard.astro              # MODIFICADO — añadir controles transportador
│       └── TutorialAutoscroll.astro      # MODIFICADO — añadir ayuda de transportador
```

**Structure Decision**: Modificar componentes Astro existentes. No se crean nuevos archivos de componente — el transportador se integra directamente en AcordeCard.astro junto a los controles del autoscroll.

## Complexity Tracking

> No hay violaciones de constitución. No se requiere justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |
