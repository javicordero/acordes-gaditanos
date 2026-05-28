# Tasks: Tutorial interactivo de autoscroll

**Input**: Design documents from `specs/001-tutorial-autoscroll/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No se requieren tests automatizados. Verificación mediante pruebas manuales en navegador.

**Estado actual**: El componente `TutorialAutoscroll.astro`, la integración en `AcordeCard.astro` y la coordinación con `EncuestaModal.astro` ya existen de una implementación legacy parcial. Las tareas se centran en **sobrescribir/mejorar** el componente existente y añadir lo que falta: accesibilidad WCAG, analytics, debounce y refinamientos.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- Astro SSG project with islands architecture

## Phase 1: Setup & Preparación

**Purpose**: Auditar el estado actual de los archivos legacy

- [ ] T001 Auditar `src/components/page/TutorialAutoscroll.astro` — identificar qué funcionalidad ya existe y qué falta (HTML, JS, CSS)
- [ ] T002 Auditar `src/components/page/AcordeCard.astro` — verificar import y botón "?" existentes
- [ ] T003 Auditar `src/components/ads/EncuestaModal.astro` — verificar coordinación con ag:tutorial-completed existente

---

## Phase 2: User Story 1 — Primera visita con tutorial automático (Priority: P1) 🎯 MVP

**Goal**: El usuario nuevo ve un overlay coach mark al entrar a `/acordes/[id]` por primera vez, con tooltip explicativo del autoscroll.

**Independent Test**: Navegar a cualquier `/acordes/[id]` sin haber visitado nunca antes. Verificar que aparece el overlay que oscurece el fondo, destaca los controles de autoscroll, y muestra el tooltip. Cerrar con "¡Entendido!" y verificar que no reaparece al recargar.

**Nota**: El componente `TutorialAutoscroll.astro` ya existe con template, JS y CSS funcionales. Se **sobrescribe completamente** para cumplir la spec actualizada.

### Implementation for User Story 1

- [ ] T004 [P] [US1] Reescribir `src/components/page/TutorialAutoscroll.astro` template HTML: backdrop, 4 paneles cutout (data-panel top/right/bottom/left), highlight ring, tooltip con botón "×" y "¡Entendido!"
- [ ] T005 [US1] Reescribir JS de posicionamiento dinámico: `getBoundingClientRect()` del `.autoscroll-wrapper`, 4 paneles, highlight y tooltip (responsive desktop/mobile)
- [ ] T006 [US1] Reescribir JS de localStorage: clave `ag_tutorial_autoscroll_visto`, auto-mostrar en primera visita, marcar al cerrar, try/catch
- [ ] T007 [US1] Reescribir JS de cierre: botón "¡Entendido!", clic fuera del tooltip (no en paneles), tecla Escape
- [ ] T008 [US1] Reescribir JS de flag global `window.__tutorialAutoscrollActive` para evitar duplicados
- [ ] T009 [US1] Reescribir JS de evento `ag:tutorial-completed` y re-posicionamiento en resize (`requestAnimationFrame` o debounce 150ms)
- [ ] T010 [US1] Reescribir JS de integración con View Transitions: `astro:page-load` y `astro:before-swap`
- [ ] T011 [US1] Reescribir estilos CSS: backdrop (`rgba(0,0,0,0.55)`, z-index 10001), paneles cutout, highlight, tooltip con animación slide-up, responsive < 640px, `prefers-reduced-motion`

**Checkpoint**: Tutorial aparece y se cierra correctamente en primera visita. No reaparece en visitas siguientes.

---

## Phase 3: User Story 2 — Reapertura con botón de ayuda (Priority: P2)

**Goal**: El usuario puede reabrir el tutorial en cualquier momento mediante un botón "?" permanente junto a los controles de autoscroll.

**Independent Test**: Cerrar el tutorial, luego hacer clic en el botón "?". Verificar que el tutorial se reabre con toda la información. Cerrarlo de nuevo y verificar que el estado de localStorage sigue intacto.

**Nota**: El botón "?" ya existe en `AcordeCard.astro`. Solo se verifica que funcione correctamente con el nuevo componente.

- [ ] T012 [P] [US2] Verificar en `AcordeCard.astro` que el botón `data-tutorial-help` y el manejador `handleHelpClick` en TutorialAutoscroll funcionan correctamente

**Checkpoint**: Botón "?" visible junto a los controles. Al hacer clic, el tutorial se reabre siempre.

---

## Phase 4: User Story 3 — Coordinación con EncuestaModal (Priority: P3)

**Goal**: EncuestaModal espera a que el tutorial se cierre antes de mostrarse, evitando solapamiento de overlays.

**Independent Test**: Configurar EncuestaModal para que aparezca a los 5s. Entrar a `/acordes/[id]` por primera vez. Verificar que la encuesta NO aparece hasta después de cerrar el tutorial.

**Nota**: La coordinación ya existe en `EncuestaModal.astro`. Solo se verifica que funcione.

- [ ] T013 [US3] Verificar en `src/components/ads/EncuestaModal.astro` que la escucha de `ag:tutorial-completed` y el flag `__tutorialAutoscrollActive` funcionan correctamente

**Checkpoint**: EncuestaModal espera al tutorial. Sin solapamiento visual.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Accesibilidad WCAG, analytics GTM, robustez

- [ ] T014 [P] Implementar focus trap en `TutorialAutoscroll.astro`: el foco no puede salir del tooltip mientras está abierto (ciclo entre elementos focusables)
- [ ] T015 [P] Añadir roles ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` en el tooltip; mover foco al abrir/cerrar; anuncio automático al screen reader
- [ ] T016 [P] Implementar analytics: disparar `dataLayer.push({ event: 'tutorial_autoscroll_mostrado' })`, `..._cerrado`, `..._reabierto` en GTM
- [ ] T017 [P] Implementar debounce de acciones: proteger contra ráfagas de clics en "¡Entendido!" y botón "?"
- [ ] T018 [P] Implementar catch seguro en todo el init: si algo falla, el tutorial no se muestra pero el resto de la página funciona sin errores visibles
- [ ] T019 Verificar build: `npm run astro check` y `npm run build` sin errores
- [ ] T020 Probar en local: flujo completo (primera visita, re-apertura, responsive, SPA navigation, coordinación, accesibilidad teclado)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — puede empezar inmediatamente
- **User Story 1 (Phase 2)**: Depende de Setup — **MVP** — sobrescribe el componente existente
- **User Story 2 (Phase 3)**: Depende de US1 (el botón "?" necesita el componente actualizado)
- **User Story 3 (Phase 4)**: Depende de US1 (necesita el evento actualizado)
- **Polish (Phase 5)**: Depende de US1 completada — tareas [P] paralelizables

### User Story Dependencies

- **User Story 1 (P1)**: Sin dependencias
- **User Story 2 (P2)**: Depende de US1
- **User Story 3 (P3)**: Depende de US1
- US2 y US3 son independientes entre sí

### Parallel Opportunities

- T001, T002, T003 (auditorías) en paralelo
- T004 (template) y T011 (estilos) pueden solaparse
- T014-T018 (polish) todas paralelizables

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (auditar estado actual)
2. Completar Phase 2: sobrescribir `TutorialAutoscroll.astro` con la spec actualizada
3. **VALIDAR**: Probar tutorial en navegador

### Incremental Delivery

1. Setup + US1 → Tutorial funcional en primera visita (MVP)
2. Añadir US2 + US3 → Refinamientos de UX (coordinación, botón "?")
3. Añadir Polish → Accesibilidad, analytics, robustez
