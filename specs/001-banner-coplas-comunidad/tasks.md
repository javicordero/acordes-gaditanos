# Tasks: Banner Vuestras Coplas

**Input**: Design documents from `/specs/001-banner-coplas-comunidad/`

**Prerequisites**: plan.md, spec.md, research.md

**Tests**: No tests requested. Verificación manual con `npm run dev`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear el componente BannerCoplasComunidad.astro

- [x] T001 Crear `src/components/page/BannerCoplasComunidad.astro` copiando la estructura de `src/components/page/BannerMartin.astro` con los siguientes cambios:
  - Importar `DonationIndicator` desde `../DonationIndicator.astro`
  - Título: "Vuestras coplas"
  - Párrafo 1: "¿Quieres que subamos alguna copla que no encuentras? Puedes hacer tu petición en la <a href='/pedir-copla'>página de peticiones</a> y votar las que más te gusten. Las más votadas (y las que yo quiera) se irán subiendo poco a poco."
  - Párrafo 2: "Si quieres colaborar para que siga creciendo esta web, puedes <a href='/colaborar'>hacer una donación</a>. Cada aportación ayuda a que siga subiendo coplas de Carnaval."
  - Imagen de fondo desktop: `https://static.grupojoly.com/clip/e68a84a7-37c4-4bbe-a35c-f859862ca005_source-aspect-ratio_1600w_0.jpg`
  - DonationIndicator: `variant='timeline' messageC='Ayuda a que siga subiendo más coplas' listStyle='pills'`
  - CSS idéntico a BannerMartin (responsive, Montserrat, setVh)

**Checkpoint**: Componente creado con título correcto, párrafos, enlaces e indicador de donaciones

---

## Phase 2: Integración en Index

**Purpose**: Reemplazar BannerMartin por BannerCoplasComunidad en el index

- [x] T002 Actualizar `src/pages/index.astro`:
  - Cambiar import: `import BannerCoplasComunidad from '../components/page/BannerCoplasComunidad.astro';`
  - Eliminar import de `BannerMartin`
  - Reemplazar `<BannerMartin />` por `<BannerCoplasComunidad />`

**Checkpoint**: Banner se muestra en la página de inicio

---

## Phase 3: Verificación

**Purpose**: Confirmar que todo funciona correctamente

- [x] T003 Ejecutar `npm run astro check` para verificar type-check
- [ ] T004 Ejecutar `npm run dev` y verificar en navegador:
  - Banner muestra "Vuestras coplas"
  - Enlace a `/pedir-copla` funciona
  - Enlace a `/colaborar` funciona
  - DonationIndicator se muestra
  - Responsive en < 640px

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)**: No dependencies - can start immediately
- **Phase 2 (T002)**: Depends on T001 completion
- **Phase 3 (T003-T004)**: Depends on T002 completion

### Parallel Opportunities

- T003 y T004 pueden ejecutarse en secuencia (no son paralelizables)

---

## Implementation Strategy

### MVP First (All Stories)

1. Complete Phase 1: Crear componente
2. Complete Phase 2: Integrar en index
3. Complete Phase 3: Verificar
4. **STOP and VALIDATE**: Probar en navegador

### Todo en una sola fase

Dado que es un feature de baja complejidad (1 componente + 1 modificación), todas las tareas se ejecutan secuencialmente. No hay oportunidad real de paralelismo.

---

## Notes

- El componente es una réplica casi exacta de BannerMartin.astro
- No hay tests automáticos - verificación manual
- Commit después de completar todas las tareas
