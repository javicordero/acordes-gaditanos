# Tasks: Transportador de Acordes

**Input**: Design documents from `/specs/006-transportador-acordes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: No tests — el proyecto no tiene framework de tests configurado. Verificación manual con `npm run dev`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No se necesita setup — el feature se integra en componentes existentes del proyecto ya configurado.

*Skip — pasar directamente a Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar la lógica de transportación que todas las user stories necesitan.

**⚠️ CRITICAL**: Las user stories no pueden funcionar sin esta lógica base.

- [x] T001 [US1+US2] Añadir escala cromática de 12 notas (notación española) como array constante en el script inline de `src/components/page/AcordeCard.astro`
- [x] T002 [US1+US2] Implementar función `transportarNota(nota, semitonos)` que dada una nota y un intervalo retorne la nueva nota según la escala cromática con módulo 12 en `src/components/page/AcordeCard.astro`
- [x] T003 [US1+US2] Implementar función `transportarAcorde(textoAcorde, semitonos)` que parsea un acorde (regex `^([DoReMiFaSolLaSi#b]+)(.*)$`), transporta la nota fundamental y retorna el acorde reconstruido con sufijo intacto en `src/components/page/AcordeCard.astro`
- [x] T004 [US1+US2] Implementar función `transportarTodosLosAcordes(preElement, semitonos)` que itera todos los `<a>` dentro de un `<pre>`, aplica `transportarAcorde` a cada uno y actualiza su `textContent` preservando el espaciado original en `src/components/page/AcordeCard.astro`
- [x] T005 [US1+US2] Implementar manejo de acordes con barra (ej: Do/Fa) — la función `transportarAcorde` debe splittear por `/`, transportar cada parte y reconstruir con `/` en `src/components/page/AcordeCard.astro`

**Checkpoint**: Lógica de transportación completa — lista para integrar con UI.

---

## Phase 3: User Story 1 + 2 — Subir y bajar el tono (Priority: P1) 🎯 MVP

**Goal**: El usuario puede subir (+) o bajar (−) el tono de semitono en semitono usando dos botones en la esquina superior derecha del `<pre>`.

**Independent Test**: Acceder a cualquier página de acorde, pulsar + y verificar que los acordes cambian +1 semitono. Pulsar − y verificar que vuelven. Tooltips visibles al hover.

### Implementation

- [x] T006 [P] [US1+US2] Añadir HTML de los botones + y − dentro del `.autoscroll-wrapper` en `src/components/page/AcordeCard.astro` — fila horizontal encima del play, con `aria-label="Subir tono"` y `aria-label="Bajar tono"`, `title="Subir tono"` y `title="Bajar tono"` para tooltips
- [x] T007 [US1+US2] Añadir variable closure `let currentTranspose = 0` y cache `originalChords = new Map()` en el IIFE del script inline de `src/components/page/AcordeCard.astro`
- [x] T008 [US1+US2] Implementar event listeners para botones + y − en `src/components/page/AcordeCard.astro`: al pulsar + incrementar `currentTranspose += 1`, al pulsar − decrementar `currentTranspose -= 1`, llamar a `transportarTodosLosAcordes` con el nuevo valor, y actualizar display de semitonos
- [x] T009 [US1+US2] Añadir `<span>` para mostrar el valor acumulado de semitonos junto a los botones +/− en `src/components/page/AcordeCard.astro` — oculto cuando es 0, muestra "+1", "−2", etc.
- [x] T010 [US1+US2] Añadir CSS para los botones +/− en `src/components/page/AcordeCard.astro`: tamaño consistente con botones de autoscroll, estilo gradiente similar, posición en fila horizontal dentro del wrapper
- [x] T011 [US1+US2] Cache de acordes originales: al inicializar, recorrer todos los `<a>` del `<pre>` y guardar su `textContent` en `originalChords` antes de cualquier transportación en `src/components/page/AcordeCard.astro`

**Checkpoint**: MVP funcional — usuario puede subir y bajar tono con tooltips.

---

## Phase 4: User Story 3 — Restaurar tonalidad original (Priority: P2)

**Goal**: El usuario puede volver al tono original con un botón de reset.

**Independent Test**: Transportar acordes +4 semitonos, pulsar reset, verificar que vuelven al original. Verificar que reset no es visible cuando `currentTranspose === 0`.

### Implementation

- [x] T012 ~~[US3] Añadir botón de reset~~ — ELIMINADO por decisión del usuario
- [x] T013 ~~[US3] Implementar lógica de reset~~ — ELIMINADO por decisión del usuario
- [x] T014 ~~[US3] Mostrar/ocultar botón reset~~ — ELIMINADO por decisión del usuario
- [x] T015 ~~[US3] Añadir CSS para botón reset~~ — ELIMINADO por decisión del usuario

**Checkpoint**: Reset funcional — usuario puede volver al original sin recargar.

---

## Phase 5: User Story 4 — Transportación con cejilla existente (Priority: P2)

**Goal**: La cejilla mostrada se actualiza al transportar (cejilla original + semitonos transportados).

**Independent Test**: Probar en un acorde con cejilla != 0, transportar +1, verificar que la cejilla mostrada se incrementa.

### Implementation

- [x] T016 ~~[US4] Modificar el display de cejilla~~ — ELIMINADO: la cejilla siempre muestra el valor original
- [x] T017 ~~[US4] Manejar cejillas negativas~~ — ELIMINADO: la cejilla no cambia

**Checkpoint**: Cejilla coherente con la transportación.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que afectan múltiples user stories.

- [x] T018 [P] Actualizar contenido del tooltip de ayuda en `src/components/page/TutorialAutoscroll.astro`: cambiar título a "Controles", añadir sección sobre transportador (+/−, reset) al final de la lista existente
- [x] T019 [P] Verificar accesibilidad: todos los botones tienen `aria-label`, tooltips funcionan, focus management correcto en `src/components/page/AcordeCard.astro`
- [x] T020 Verificar responsive: botones +/− visibles y usables en móvil (< 640px) en `src/components/page/AcordeCard.astro`
- [x] T021 Ejecutar `npm run dev` y probar en navegador: subir/bajar tono, reset, cejilla con valor, tooltips, ayuda del "?"
- [x] T022 Ejecutar `npm run build` para verificar que no hay errores de compilación

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — empezar aquí
- **Phase 3 (US1+US2 MVP)**: Depende de Phase 2
- **Phase 4 (US3 Reset)**: Depende de Phase 3
- **Phase 5 (US4 Cejilla)**: Depende de Phase 3
- **Phase 6 (Polish)**: Depende de Phase 3+

### User Story Dependencies

- **US1+US2 (P1)**: Depende de Phase 2 — sin dependencias de otras stories
- **US3 (P2)**: Depende de US1+US2 — necesita `currentTranspose` y `originalChords`
- **US4 (P2)**: Depende de US1+US2 — necesita `currentTranspose` para calcular cejilla

### Within Each Phase

- HTML primero → JS después → CSS al final
- Cache de originales antes de cualquier transportación

### Parallel Opportunities

- T001-T005 (Phase 2): Se pueden implementar secuencialmente (dependen entre sí)
- T006 [P]: HTML de botones (diferente archivo conceptual)
- T018 [P] y T019 [P]: Tutorial y accesibilidad en archivos separados

---

## Parallel Example: User Story 1+2

```
# Sequential (misma lógica):
T001 → T002 → T003 → T004 → T005 (escala + funciones)

# Después (UI):
T006 (HTML) → T007 (variables) → T008 (listeners) → T009 (display) → T010 (CSS) → T011 (cache)
```

---

## Implementation Strategy

### MVP First (US1+US2 Only)

1. Completar Phase 2: Lógica de transportación
2. Completar Phase 3: Botones +/− funcionales con tooltips
3. **PARAR y VALIDAR**: Probar en navegador con `npm run dev`
4. Deploy si está listo

### Incremental Delivery

1. Phase 2+3 → Botones +/− funcionales (MVP)
2. Phase 4 → Reset añadido
3. Phase 5 → Cejilla coherente
4. Phase 6 → Polish y ayuda

---

## Notes

- [P] tareas = archivos diferentes, sin dependencias
- [Story] label mapea tarea a user story para trazabilidad
- Cada phase es un incremento independiente y testeable
- Verificar después de cada phase con `npm run dev`
- No hay tests automatizados — toda verificación es manual
