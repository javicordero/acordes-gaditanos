---

description: "Task list for Ezoic ad integration on acordesgaditanos.com"

---

# Tasks: Integración Ezoic para gestión de anuncios

**Input**: Design documents from `specs/004-integracion-ezoic/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No se requieren tests automatizados. Verificación manual con curl, nslookup y navegador.

**Organization**: Tasks grouped by user story, cada una independiente y testeable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo
- **[Story]**: User story (US1, US2, US3)
- Incluir paths exactos

---

## Phase 1: Setup (Verificación Inicial)

**Purpose**: Confirmar estado actual y preparar entorno

- [X] T001 Verificar que la regla ads.txt existe en `public/_redirects`
- [X] T002 Confirmar que el proyecto compila con `npm run build` antes de cambios
- [X] T003 [P] Hacer deploy a Netlify (o confirmar que el último deploy incluye `_redirects`)

**Checkpoint**: Estado base verificado. El redirect ads.txt debería estar en producción.

**Hallazgo**: Existía `public/ads.txt` estático (AdSense legacy) que sobrescribía la redirección. Eliminado.

---

## Phase 2: User Story 1 — Verificar redirección ads.txt (Priority: P1) 🎯 MVP

**Goal**: Confirmar que `/ads.txt` redirige correctamente a Ezoic Ads.txt Manager

**Independent Test**: `curl -I https://acordesgaditanos.com/ads.txt` responde con HTTP 301 a `srv.adstxtmanager.com/19390/...`

### Implementation

- [ ] T004 [P] [US1] Ejecutar `curl -I https://acordesgaditanos.com/ads.txt` y verificar HTTP 301
- [ ] T005 [P] [US1] Verificar que la URL destino contiene el ID de cuenta 19390
- [ ] T006 [US1] Desde el panel de Ezoic, confirmar que el dominio aparece como verificado tras el redirect

**Checkpoint**: US1 completo — Ezoic puede gestionar el ads.txt. El sitio sigue funcionando normalmente.

---

## Phase 3: User Story 2 — Integración DNS con Ezoic (Priority: P2)

**Goal**: Apuntar nameservers del dominio a Ezoic desde Netlify para integración completa

**Independent Test**: `nslookup acordesgaditanos.com` muestra nameservers `ns1.ezoic.com` / `ns2.ezoic.com`. Sitio accesible en navegador.

### Implementation

- [ ] T007 [US2] Acceder al panel DNS de Netlify para el dominio acordesgaditanos.com
- [ ] T008 [US2] Cambiar nameservers a `ns1.ezoic.com` y `ns2.ezoic.com`
- [ ] T009 [US2] Esperar propagación DNS (verificar cada 12h con `nslookup`)
- [ ] T010 [US2] Confirmar que `https://acordesgaditanos.com` sigue accesible tras propagación
- [ ] T011 [P] [US2] En panel Ezoic, verificar que el dominio aparece como "Active"
- [ ] T012 [P] [US2] Verificar que el redirect ads.txt sigue funcionando tras cambio DNS

**Checkpoint**: US2 completo — Ezoic gestiona el DNS y los anuncios están activos.

---

## Phase 4: User Story 3 — Verificación de anuncios (Priority: P3)

**Goal**: Confirmar que los anuncios se muestran correctamente sin degradar la experiencia

**Independent Test**: Navegar 3+ páginas del sitio y verificar anuncios visibles, layout intacto, rendimiento aceptable.

### Implementation

- [ ] T013 [P] [US3] Navegar a una página de acorde y verificar que los anuncios aparecen sin ocultar la letra
- [ ] T014 [P] [US3] Verificar que el autoscroll de acordes sigue funcionando con anuncios visibles
- [ ] T015 [P] [US3] Verificar que la búsqueda cliente sigue funcionando
- [ ] T016 [P] [US3] Ejecutar Lighthouse Performance y verificar score ≥ 85 (o documentar desviación)
- [ ] T017 [US3] Probar en móvil y desktop que el layout no se rompe con anuncios

**Checkpoint**: US3 completo — anuncios integrados sin afectar la experiencia de usuario.

---

## Phase 5: Polish & Documentación

**Purpose**: Dejar documentado el estado final y procedimiento de rollback

- [ ] T018 [P] Documentar los nameservers originales de Netlify en caso de rollback
- [ ] T019 Actualizar `specs/004-integracion-ezoic/quickstart.md` si surgen cambios durante la implementación
- [ ] T020 [P] Ejecutar `npm run build` y verificar que compila sin errores
- [ ] T021 Commit final con mensaje descriptivo en español

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar inmediatamente
- **US1 (Phase 2)**: Depende de Setup — es el MVP
- **US2 (Phase 3)**: Depende de US1 (Ezoic debe verificar el dominio vía ads.txt primero)
- **US3 (Phase 4)**: Depende de US2 (los anuncios requieren DNS activo)
- **Polish (Phase 5)**: Depende de US3 completo

### User Story Dependencies

- **US1 (P1)**: Sin dependencias — primer paso
- **US2 (P2)**: Depende de US1 — Ezoic verifica el dominio via ads.txt antes del DNS
- **US3 (P3)**: Depende de US2 — necesita DNS activo para servir anuncios

### Parallel Opportunities

- T003, T004, T005 pueden ejecutarse en paralelo (verificaciones independientes)
- T011, T012 pueden ejecutarse en paralelo tras propagación DNS
- T013-T017 pueden ejecutarse en paralelo (verificaciones independientes)
- T018, T020 pueden ejecutarse en paralelo

---

## Implementation Strategy

### MVP (Phase 2 only)

1. Setup (Phase 1): Verificar estado actual
2. US1 (Phase 2): Confirmar redirect ads.txt funciona
3. **STOP**: Ezoic ya puede gestionar ads.txt. Deployar/demo si es suficiente

### Incremental Delivery

1. Phase 1 + US1 → MVP: redirección ads.txt verificada
2. Agregar US2 → DNS con Ezoic, anuncios activos
3. Agregar US3 → Verificación de experiencia completa
4. Polish → Documentación final

---

## Notes

- Este feature NO requiere cambios de código en Astro. Solo configuración externa (DNS, panel Ezoic) y verificación manual.
- Si el redirect ads.txt falla: verificar que `public/_redirects` está en el deploy de Netlify.
- Rollback DNS: cambiar nameservers de vuelta a los originales de Netlify. Propagación 24-72h.
