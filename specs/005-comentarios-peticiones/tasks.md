# Tasks: Comentarios y Peticiones de Coplas

**Input**: Design documents from `/specs/005-comentarios-peticiones/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/worker-api.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5, US6)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el proyecto del Worker y la estructura base

- [X] T001 Crear estructura del worker en `workers/comments-worker/` con `src/index.js`, `wrangler.toml`, `package.json`
- [X] T002 [P] Configurar `wrangler.toml` conKV namespace `COMMENTS` y variable de entorno `ADMIN_TOKEN`
- [X] T003 [P] Crear archivo de configuración del frontend en `src/lib/comments.ts` con la URL del Worker

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Worker API base que TODOS los user stories necesitan

**⚠️ CRITICAL**: No se puede empezar ningún user story hasta completar esta fase

- [X] T004 Implementar endpoint `GET /` en `workers/comments-worker/src/index.js` para obtener comentarios por `path`
- [X] T005 Implementar endpoint `POST /` en `workers/comments-worker/src/index.js` para crear comentarios con validación de `content`
- [X] T006 Implementar rate limiting por IP (5 req/hora) en `workers/comments-worker/src/index.js` con contador en memoria
- [X] T007 Implementar manejo de errores y CORS en `workers/comments-worker/src/index.js`
- [X] T008 Desplegar Worker con `npx wrangler deploy` y verificar que `GET /?path=/test` responde correctamente

**Checkpoint**: Worker desplegado y respondiendo. Los user stories pueden empezar.

---

## Phase 3: User Story 1 - Petición de copla (Priority: P1) 🎯 MVP

**Goal**: Un usuario puede crear una petición de copla y aparecer en la lista pública

**Independent Test**: Visitar `/pedir-copla`, enviar una petición, verificar que aparece en la lista

### Implementation for User Story 1

- [X] T009 [P] [US1] Crear componente `src/components/comments/CommentForm.astro` con campo nombre (opcional) y campo comentario (requerido)
- [X] T010 [P] [US1] Crear componente `src/components/comments/CommentItem.astro` para mostrar un comentario individual
- [X] T011 [US1] Crear componente `src/components/comments/CommentsSection.astro` que carga y muestra la lista de comentarios vía fetch al Worker
- [X] T012 [US1] Crear página `src/pages/pedir-copla.astro` con Layout existente, título, formulario y sección de comentarios
- [X] T013 [US1] Implementar envío de comentario desde `CommentForm.astro` vía POST al Worker con auto-refresh de la lista
- [X] T014 [US1] Añadir validación client-side en `CommentForm.astro`: campo comentario obligatorio, botón desactivado durante envío
- [X] T015 [US1] Verificar funcionalidad: crear petición en `/pedir-copla` y comprobar que aparece en la lista

**Checkpoint**: US1 completa. Un usuario puede pedir coplas y verlas en la lista.

---

## Phase 4: User Story 2 - Respuesta a petición (Priority: P1)

**Goal**: Los usuarios pueden responder a peticiones creando hilos anidados

**Independent Test**: Responder a una petición y verificar que aparece anidada

### Implementation for User Story 2

- [X] T016 [P] [US2] Añadir botón "Responder" en `src/components/comments/CommentItem.astro`
- [X] T017 [US2] Modificar `CommentForm.astro` para aceptar prop `parentId` y enviarlo en el POST al Worker
- [X] T018 [US2] Modificar `CommentsSection.astro` para renderizar respuestas anidadas con indentación visual progresiva
- [X] T019 [US2] Añadir lógica de renderizado recursivo en `CommentsSection.astro` para soportar múltiples niveles de anidación
- [X] T020 [US2] Verificar funcionalidad: responder a una petición y comprobar que aparece anidada correctamente

**Checkpoint**: US2 completa. Los usuarios pueden comentarse entre ellos con hilos.

---

## Phase 5: User Story 3 - Respuesta del administrador (Priority: P2)

**Goal**: El administrador puede responder con badge "Propietario" visible

**Independent Test**: Autenticarse como admin, responder, verificar que aparece el badge

### Implementation for User Story 3

- [X] T021 [P] [US3] Añadir endpoints `PATCH /:id` y `DELETE /:id` con autenticación por token en `workers/comments-worker/src/index.js`
- [X] T022 [P] [US3] Crear página `src/pages/admin/comentarios.astro` con formulario de login (token) y panel de moderación
- [X] T023 [US3] Añadir lógica en `CommentItem.astro` para mostrar badge "Propietario" cuando `isAdmin: true`
- [X] T024 [US3] Implementar envío de token en header `Authorization: Bearer` desde el panel admin al responder
- [X] T025 [US3] Guardar token de admin en `localStorage` en `admin/comentarios.astro` para no re-introducirlo
- [X] T026 [US3] Verificar funcionalidad: autenticarse, responder como admin, comprobar badge "Propietario"

**Checkpoint**: US3 completa. El admin puede responder con identificación visible.

---

## Phase 6: User Story 4 - Marcar petición como completada (Priority: P2)

**Goal**: El admin puede marcar peticiones como completadas con badge y link al acorde

**Independent Test**: Marcar una petición como completada y verificar badge + link

### Implementation for User Story 4

- [X] T027 [P] [US4] Añadir manejo de campo `completed` en el endpoint `PATCH /:id` del Worker
- [X] T028 [US4] Añadir botón "Completar/Descompletar" en el panel admin `src/pages/admin/comentarios.astro`
- [X] T029 [US4] Añadir badge verde "Completada" y link "Ver acordes" en `src/components/comments/CommentItem.astro` cuando `completed: true`
- [X] T030 [US4] Verificar funcionalidad: marcar como completada, comprobar badge y link funcionales

**Checkpoint**: US4 completa. El ciclo de petición → completada está cerrado.

---

## Phase 7: User Story 5 - Eliminar comentario (Priority: P3)

**Goal**: El admin puede eliminar comentarios con cascada de respuestas

**Independent Test**: Eliminar un comentario con respuestas y verificar que todas desaparecen

### Implementation for User Story 5

- [X] T031 [P] [US5] Implementar eliminación en cascada en el endpoint `DELETE /:id` del Worker (eliminar comentario y todas sus respuestas anidadas)
- [X] T032 [US5] Añadir botón "Eliminar" en el panel admin `src/pages/admin/comentarios.astro` con confirmación
- [X] T033 [US5] Verificar funcionalidad: eliminar un comentario con respuestas y comprobar que todas desaparecen

**Checkpoint**: US5 completa. Moderación funcional.

---

## Phase 8: User Story 6 - Acceso a peticiones desde el sitio (Priority: P2)

**Goal**: Múltiples puntos de entrada a `/pedir-copla` en todo el sitio

**Independent Test**: Verificar que todos los enlaces y FAB llevan a `/pedir-copla`

### Implementation for User Story 6

- [X] T034 [P] [US6] Crear componente `src/components/comments/PedirCoplaCard.astro` para la right column de acordes
- [X] T035 [P] [US6] Crear componente `src/components/comments/PedirCoplaFAB.astro` con botón flotante dismissable (localStorage)
- [X] T036 [US6] Integrar `PedirCoplaCard.astro` en `src/pages/acordes/[id].astro` (añadir en la right column)
- [X] T037 [US6] Integrar `PedirCoplaFAB.astro` en `src/pages/index.astro`
- [X] T038 [US6] Integrar `PedirCoplaFAB.astro` en `src/pages/buscar.astro`
- [X] T039 [US6] Añadir enlace "Pedir copla" en `src/components/layout/Footer.astro`
- [X] T040 [US6] Añadir enlace a `/pedir-copla` en el mensaje de "sin resultados" de `src/pages/buscar.astro`
- [X] T041 [US6] Verificar funcionalidad: comprobar que todos los puntos de acceso llevan a `/pedir-copla` y que el FAB se puede cerrar

**Checkpoint**: US6 completa. Discoverability completa en todo el sitio.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Pulido final y verificación transversal

- [X] T042 Ejecutar `npm run astro check` y corregir errores de tipos si los hay
- [X] T043 Ejecutar `npm run dev` y verificar que todas las páginas nuevas funcionan correctamente
- [X] T044 Verificar que el FAB persiste su estado en `localStorage` (cerrado = no aparece)
- [X] T045 Verificar que el rate limiting funciona (enviar 6 peticiones y comprobar que la 6ª es rechazada)
- [X] T046 Verificar que la eliminación en cascada funciona (eliminar comentario padre y comprobar que las respuestas desaparecen)
- [X] T047 Verificar que el badge "Propietario" solo aparece en comentarios del admin
- [X] T048 Verificar que el badge "Completada" muestra el link correcto al acorde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias - empezar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup - BLOQUEA todos los user stories
- **US1 (Phase 3)**: Depende de Foundational - Sin dependencias de otros stories
- **US2 (Phase 4)**: Depende de Foundational - Puede empezar en paralelo con US1
- **US3 (Phase 5)**: Depende de Foundational - Puede empezar en paralelo con US1/US2
- **US4 (Phase 6)**: Depende de US3 (necesita endpoint PATCH y panel admin)
- **US5 (Phase 7)**: Depende de US3 (necesita endpoint DELETE y panel admin)
- **US6 (Phase 8)**: Sin dependencias de otros stories - Puede empezar en paralelo con US1
- **Polish (Phase 9)**: Depende de todos los stories deseados

### User Story Dependencies

- **US1 (P1)**: Sin dependencias - MVP
- **US2 (P1)**: Depende de US1 (necesita CommentForm y CommentsSection existentes)
- **US3 (P2)**: Depende de Foundational - Puede integrar con US1/US2
- **US4 (P2)**: Depende de US3 (necesita panel admin y endpoint PATCH)
- **US5 (P3)**: Depende de US3 (necesita panel admin y endpoint DELETE)
- **US6 (P2)**: Sin dependencias de otros stories - Puede ejecutarse en paralelo

### Parallel Opportunities

- T002 y T003 en paralelo (configuraciones independientes)
- T009 y T010 en paralelo (componentes independientes)
- T016, T021, T022, T034, T035 en paralelo (archivos diferentes)
- T034, T035, T036, T037, T038, T039, T040 (US6) parcialmente en paralelo

---

## Parallel Example: User Story 1

```bash
# Lanzar componentes en paralelo:
Task: "Crear CommentForm.astro"
Task: "Crear CommentItem.astro"

# Luego en secuencia:
Task: "Crear CommentsSection.astro" (depende de CommentItem)
Task: "Crear pedir-copla.astro" (depende de CommentsSection)
Task: "Implementar envío y validación"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRITICAL)
3. Completar Phase 3: User Story 1
4. **PARAR Y VALIDAR**: Probar US1 independientemente
5. Desplegar si está listo

### Incremental Delivery

1. Setup + Foundational → Base lista
2. Añadir US1 → Probar independientemente → Desplegar/Demo (MVP!)
3. Añadir US2 → Probar independientemente → Desplegar/Demo
4. Añadir US6 → Probar independientemente → Desplegar/Demo (discoverability)
5. Añadir US3 → Probar independientemente → Desplegar/Demo (admin)
6. Añadir US4 → Probar independientemente → Desplegar/Demo (completar)
7. Añadir US5 → Probar independientemente → Desplegar/Demo (moderación)
8. Cada story añade valor sin romper los anteriores

---

## Notes

- [P] tasks = archivos diferentes, sin dependencias
- [Story] label mapea cada task al user story para trazabilidad
- Cada user story debe ser completable y testeable independientemente
- Verificar que el Worker responde correctamente después de cada cambio
- Commit después de cada task o grupo lógico
- Parar en cualquier checkpoint para validar el story independientemente
