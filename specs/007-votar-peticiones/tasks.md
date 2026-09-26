# Tareas: Votar Peticiones (007)

**Feature**: 007-votar-peticiones
**Date**: 08/09/2026

## Phase 1: Setup Worker

- [x] T001 Agregar campos `votes: 0` y `votedBy: []` al crear comentario en POST `/` — `workers/comments-worker/src/index.js:153`
- [x] T002 Agregar migracion: normalizar `votes` y `votedBy` al leer comentarios (si undefined → default) en `getComments()` — `workers/comments-worker/src/index.js:67`
- [x] T003 Crear endpoint `POST /vote` con validacion de `commentId`, `action`, `userId` — `workers/comments-worker/src/index.js` (nuevo bloque antes del GET `/top`)
- [x] T004 Crear endpoint `GET /top` con filtro raiz + no completado + votes>=1, orden votes desc / date desc, limite configurable — `workers/comments-worker/src/index.js` (nuevo bloque antes del POST `/`)

## Phase 2: Foundational Frontend

- [x] T005 Crear funcion `getUserId()` en `src/lib/comments.ts`: obtiene o genera `userId` en localStorage
- [x] T006 [P] Agregar estilos CSS `:global()` para `.comment-vote-btn`, `.comment-vote-btn--active`, `.comment-votes-count`, `.top-peticiones`, `.top-peticiones__item`, `.top-peticiones__empty`, `.form-duplicate-warning` — `src/components/comments/CommentsSection.astro` (bloque `<style>`)

## Phase 3: US1 — Votar una peticion

**Story**: El usuario puede votar peticiones con un icono de corazon
**Test**: Ir a `/pedir-copla`, votar una peticion, verificar que el contador sube. Recargar y verificar que el voto persiste.

- [x] T007 [US1] Modificar `renderComments()` para agregar boton de voto (corazon + contador) junto a cada comentario raiz — `src/components/comments/CommentsSection.astro:172`
- [x] T008 [US1] Implementar logica de click en `.comment-vote-btn`: llamar a `POST /vote` con `{ commentId, action, userId }`, actualizar contador y clase visual — `src/components/comments/CommentsSection.astro` (bloque `<script>`)
- [x] T009 [US1] Al cargar comentarios, marcar botones de peticiones ya votadas (verificar `votedBy` contiene `userId`) — `src/components/comments/CommentsSection.astro:150`

## Phase 4: US2 — Tabla de peticiones mas votadas

**Story**: Se muestra top 3 peticiones con mas votos encima del formulario
**Test**: Votar varias peticiones y verificar que la tabla muestra las 3 mas votadas en orden correcto.

- [x] T010 [US2] Crear funcion `loadTopPeticiones()` que haga fetch a `GET /top?path=/pedir-copla&limit=3` y renderice la tabla — `src/pages/pedir-copla.astro` (nuevo `<script>`)
- [x] T011 [US2] Insertar bloque `.top-peticiones` en el DOM antes de `.form-section` — `src/pages/pedir-copla.astro` (entre lineas 28-29)
- [x] T012 [US2] Manejar estado vacio: si no hay votos, mostrar "Aun no hay votos" — `src/pages/pedir-copla.astro` (en `loadTopPeticiones()`)

## Phase 5: US3 — Indicar funcionalidad de votar

**Story**: El usuario sabe que puede votar y se le avisa de duplicados
**Test**: Visitar `/pedir-copla` por primera vez y verificar que se muestra el indicador y el aviso en el formulario.

- [x] T013 [US3] Agregar texto indicativo de votar en la seccion intro (junto a `PeticionesStats`) — `src/pages/pedir-copla.astro:23`
- [x] T014 [US3] Agregar div `.form-duplicate-warning` encima del input de nombre en el formulario — `src/components/comments/CommentForm.astro:10`
- [x] T015 [US3] Estilizar `.form-duplicate-warning`: fondo amarillo suave, borde izquierdo naranja, padding — `src/components/comments/CommentForm.astro` (bloque `<style>` o `:global()`)

## Phase 6: US4 — Anti-abuso

**Story**: Un usuario no puede votar la misma peticion mas de una vez
**Test**: Votar una peticion, intentar votar de nuevo (deberia impedirse). Borrar localStorage y votar (deberia permitirse).

- [x] T016 [US4] Verificar que el Worker retorna 409 si `userId` ya esta en `votedBy` al votar — `workers/comments-worker/src/index.js` (en endpoint POST /vote)
- [x] T017 [US4] Verificar que el frontend maneja 409 mostrando "Ya has votado esta peticion" y no incrementa el contador — `src/components/comments/CommentsSection.astro` (en handler de click)

## Phase 7: Polish

- [x] T018 Verificar que la tabla top-3 se actualiza al votar (llamar `loadTopPeticiones()` despues de voto exitoso) — `src/pages/pedir-copla.astro`
- [x] T019 Testing manual: flujo completo votar → recargar → verificar persistencia → intentar duplicar → verificar bloqueo — `/pedir-copla`

## Dependencies

```
T001 → T002 → T003, T004
T005 → T007, T008, T009
T006 → T007, T008
T003 → T008, T016
T004 → T010
T001 → T011 ( Worker retorna votes en GET / )
```

## Paralelizaciones

- **T003, T004** (endpoints Worker) pueden ejecutarse en paralelo
- **T005, T006** (userId + CSS) pueden ejecutarse en paralelo
- **T013, T014, T015** (US3) pueden ejecutarse en paralelo
- **T010, T011, T012** (US2) pueden ejecutarse en paralelo
- **T016, T017** (US4) pueden ejecutarse en paralelo

## MVP

El minimo viable es **US1 + US4** (votar + anti-abuso):
- Worker: T001, T002, T003
- Frontend: T005, T006, T007, T008, T009, T016, T017
