# Tasks: Indicador de donaciones con total histórico

**Input**: Design documents from `specs/003-mejora-donaciones/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Organization**: Tasks are grouped by phase to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

---

## Phase 1: Setup — Content Collection (reemplaza JSON + fetch cliente)

**Purpose**: Crear la content collection de Astro con schema Zod y datos seed, más el componente compartido que carga los datos en build-time.

**Arquitectura**: Los datos viven en `src/content/donaciones/datos.md` (YAML frontmatter). Se cargan con `getCollection()` en build-time. No hay fetch cliente ni archivo JSON público.

- [x] T001 [P] Añadir colección `donaciones` en `src/content/config.ts` con schema Zod (`z.object({ donaciones: z.array(z.object({ fecha, importe, donante: optional })) })`)
- [x] T002 [P] Crear `src/content/donaciones/datos.md` con 6 donaciones seed en YAML frontmatter
- [x] T003 Crear componente compartido `src/components/DonationIndicator.astro` que carga datos con `getCollection()`, calcula totales en frontmatter y pasa valores al cliente via `define:vars` (depende de T001)

**Checkpoint**: Content collection operativa — los datos seed existen y se pueden consultar en build-time.

---

## Phase 2: Integración en componentes existentes

**Purpose**: Conectar DonationIndicator en las dos ubicaciones target (columna lateral y banner homepage).

- [x] T004 [P] [US1] Refactorizar `src/components/right-column/Apoyar.astro` para importar y renderizar `<DonationIndicator variant="compact" />` manteniendo el botón Buy Me a Coffee existente
- [x] T005 [US1] Modificar `src/components/page/BannerNoly.astro` para añadir `<DonationIndicator variant="timeline" />` en sección `.apoyar`, manteniendo botón existente
- [x] T006 [US1] Añadir tracking de Google Analytics en los clics del botón de donación del indicador (`data-ga-event="support_bmc_donation_indicator"`), replicando el patrón existente en `Apoyar.astro`

---

## Phase 3: Limpieza de archivos legacy

**Purpose**: Eliminar archivos de la arquitectura anterior (JSON público + módulo de fetch cliente) que ya no son necesarios.

- [x] T007 Eliminar `public/donaciones.json` (datos migrados a content collection)
- [x] T007b Eliminar `src/lib/donations.ts` (lógica de fetch sustituida por `getCollection()` en build-time)

**Checkpoint**: No queda rastro de la arquitectura anterior. Todo pasa por content collection.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validación final y verificación visual.

- [ ] T008 Ejecutar `npm run astro check` para verificar type-check (errores preexistentes no bloqueantes)
- [ ] T009 Arrancar `npm run dev` y verificar visualmente en navegador: columna derecha con datos, banner homepage con timeline, degradación graceful si la colección está vacía

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencies externas — orden interno: T001 (config.ts) → T003 (DonationIndicator.astro); T002 (datos.md) independiente
- **Integración (Phase 2)**: Depende de T003 (DonationIndicator debe existir para ser importado)
- **Limpieza (Phase 3)**: Puede ejecutarse en paralelo con Phase 2 o al final
- **Polish (Final Phase)**: Depende de Phase 2 completa

### Parallel Opportunities

- T001 y T002 pueden ejecutarse en paralelo (archivos independientes)
- T003 depende de T001 (DonationIndicator usa `getCollection('donaciones')` que requiere el schema en `config.ts`)
- T004 y T005 pueden ejecutarse en paralelo (diferentes componentes, sin solapamiento)
- T005 depende de T003 (DonationIndicator debe existir antes de importarse en BannerNoly)
- T006 depende de T003 (el botón con tracking está en DonationIndicator)
- T007 y T007b son independientes entre sí

---

## Cambios respecto a la arquitectura original

| Original | Actual |
|---|---|
| `public/donaciones.json` (datos en JSON público) | `src/content/donaciones/datos.md` (YAML frontmatter en content collection) |
| `src/lib/donations.ts` (fetch + tipos + cálculo) | Lógica inline en `DonationIndicator.astro` (frontmatter: `getCollection` + reduce; cliente: `define:vars`) |
| Fetch cliente (runtime) | Build-time (`getCollection` en frontmatter del componente) |
| Validación con JSON Schema (`contracts/donaciones.json-schema.json`) | Validación con Zod schema en `src/content/config.ts` |

---

## Notas

- El contrato `specs/003-mejora-donaciones/contracts/donaciones.json-schema.json` queda como documentación de la estructura de datos, aunque la validación real se hace con Zod.
- [P] tasks = different files, no dependencies
- Commit después de cada tarea o grupo lógico
- Parar en cualquier checkpoint para validar independientemente
