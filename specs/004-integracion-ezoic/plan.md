# Implementation Plan: Integración Ezoic para gestión de anuncios

**Branch**: `004-integracion-ezoic` | **Date**: 19/06/2026 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-integracion-ezoic/spec.md`

## Summary

Integrar Ezoic como plataforma de anuncios en acordesgaditanos.com. Fase 1 (P1): verificar que la redirección `/ads.txt` → Ezoic Ads.txt Manager funciona correctamente. Fase 2 (P2): completar integración DNS apuntando nameservers a Ezoic. Fase 3 (P3): verificar que los anuncios se muestran sin degradar la experiencia.

## Technical Context

**Language/Version**: N/A — sin cambios de código para la redirección ads.txt. DNS requiere acceso al panel del proveedor de dominio.

**Primary Dependencies**: Netlify (hosting actual), Ezoic (ad platform), registrador de dominio donde están los DNS actuales.

**Storage**: N/A

**Testing**: Verificación manual con `curl -I https://acordesgaditanos.com/ads.txt` para el redirect. `nslookup` para verificar DNS post-cambio. Prueba visual navegando el sitio.

**Target Platform**: Producción — acordesgaditanos.com (Netlify)

**Project Type**: Web SSG (Astro)

**Performance Goals**: Los anuncios Ezoic no deben aumentar el tiempo de carga >20% respecto a la línea base sin anuncios. Lighthouse Performance Score ≥ 85.

**Constraints**: Mantener arquitectura 100% SSG. No modificar contenido de acordes existente. El cambio DNS NO debe interrumpir la disponibilidad del sitio. La redirección ads.txt ya existe en `public/_redirects`.

**Scale/Scope**: Single domain, tráfico actual de acordesgaditanos.com.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| **I. Static-First** | ✅ PASS | La integración Ezoic vía DNS mantiene el sitio como SSG. Ezoic actúa como proxy CDN. No requiere SSR. |
| **II. Content-Driven** | ✅ PASS | No se modifican content collections. |
| **III. Chord Format** | ✅ PASS | No se tocan acordes ni `<pre>` blocks. |
| **IV. Speckit Planning** | ✅ PASS | Feature planificado via speckit. |
| **V. Build Discipline** | ✅ PASS | Solo build antes de commit. |
| **VI. Spanish-First** | ✅ PASS | Contenido y commits en español. |
| **SEO & Analytics** | ✅ PASS | GTM, AdSense IDs ya configurados. `_redirects` ya tiene la regla ads.txt. |

No violations. Complexity tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-integracion-ezoic/
├── spec.md              # Especificación funcional
├── plan.md              # Este archivo
├── research.md          # Investigación de integración Ezoic
├── data-model.md        # Entidades y configuración
├── quickstart.md        # Guía rápida de integración
├── contracts/           # Contratos de interfaz (redirección, DNS)
└── tasks.md             # Tareas accionables (fase posterior)
```

### Source Code (repository root)

```text
# No se requiere nueva estructura de código.
# Los únicos cambios son:
public/
└── _redirects           # Ya contiene la regla ads.txt (verificar)

# La integración Ezoic via DNS no requiere cambios en el repositorio.
```

**Structure Decision**: Sin cambios en el código fuente. Solo verificación de `_redirects` existente y configuración externa (DNS, panel Ezoic).
