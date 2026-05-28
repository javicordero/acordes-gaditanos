# Tutorial interactivo de autoscroll para primera visita — Tareas

> Estimación total: 🟡 ~60 min

---

## Preparación

- [ ] `T-001` — Leer `AcordeCard.astro` completo para identificar puntos de inserción y el botón "?" 🟢
- [ ] `T-002` — Leer `EncuestaModal.astro` para entender el patrón de setTimeout y evento de cierre 🟢

---

## Core

- [ ] `T-003` — Crear `src/components/page/TutorialAutoscroll.astro` con template (backdrop, 4 paneles, highlight, tooltip) 🟡
- [ ] `T-004` — Implementar JS: posicionamiento dinámico de paneles y highlight vía `getBoundingClientRect()` 🟡
- [ ] `T-005` — Implementar JS: lógica de localStorage, auto-mostrar en primera visita, cierre (botón, fuera, Escape) 🟡
- [ ] `T-006` — Implementar JS: flag global `__tutorialAutoscrollActive` para evitar duplicados 🟢
- [ ] `T-007` — Implementar JS: evento `ag:tutorial-completed` y re-posicionamiento en resize 🟢
- [ ] `T-008` — Implementar JS: integración con `astro:page-load` y `astro:before-swap` 🟢
- [ ] `T-009` — Añadir estilos CSS del overlay, paneles, highlight, tooltip, animación slide-up, responsive 🟡

---

## Páginas

- [ ] `T-010` — Modificar `AcordeCard.astro`: importar y renderizar `TutorialAutoscroll` 🟢
- [ ] `T-011` — Modificar `AcordeCard.astro`: añadir botón "?" en `.autoscroll-wrapper` con estilos 🟢

---

## Componentes

- [ ] `T-012` — Modificar `EncuestaModal.astro`: añadir escucha de `ag:tutorial-completed` para retrasar la aparición 🟢

---

## Verificación

- [ ] `T-013` — Probar en local: navegar a `/acordes/[id]` y verificar que el tutorial aparece, se cierra correctamente y no reaparece 🟢
- [ ] `T-014` — Probar re-apertura: hacer clic en botón "?" y verificar que el tutorial se muestra de nuevo 🟢
- [ ] `T-015` — Probar responsive: redimensionar a móvil (< 640px) y verificar posicionamiento correcto 🟢
- [ ] `T-016` — Probar SPA: navegar entre páginas de acordes y verificar que el tutorial solo aparece en la primera visita 🟢
- [ ] `T-017` — Probar conflicto EncuestaModal: verificar que la encuesta espera a que el tutorial se cierre 🟢

---

## Commit

- [ ] `T-018` — `git add -A && git commit -m "feat: tutorial autoscroll con overlay primera visita"` 🟢

---

> Leyenda estimaciones: 🟢 <10min | 🟡 10-25min | 🔴 >25min
