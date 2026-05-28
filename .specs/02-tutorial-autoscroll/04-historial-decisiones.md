# Tutorial interactivo de autoscroll para primera visita — Historial de decisiones

> Fecha de inicio: 21/05/2026

---

| # | Fecha | Decisión | Alternativas consideradas | Motivo |
|---|-------|----------|---------------------------|--------|
| 1 | 21/05/2026 | Overlay tipo coach mark con 4 paneles cutout | clip-path, SVG mask, z-index stacking | Los 4 paneles son más robustos entre navegadores, no requieren coordenadas exactas en tiempo real y funcionan bien con responsive |
| 2 | 21/05/2026 | Componente autocontenido en AcordeCard.astro | Componente global en Layout.astro | El tutorial solo aplica en páginas con autoscroll; incluirlo desde AcordeCard evita lógica condicional en el layout |
| 3 | 21/05/2026 | Cierre solo explícito (botón, clic fuera, Escape) | Cierre automático al interactuar | Mejor experiencia de usuario: no interrumpe la lectura del tutorial |
| 4 | 21/05/2026 | Aparición inmediata | Retraso de 2-3s | El usuario quiere que se vea nada más cargar la página |
| 5 | 21/05/2026 | Highlight sutil (estático) | Glow pulsante | El usuario prefiere algo discreto que no distraiga |
| 6 | 21/05/2026 | EncuestaModal espera al evento ag:tutorial-completed | Solapamiento independiente, supresión de encuesta | El tutorial tiene prioridad; la encuesta debe aparecer después para no competir por la atención |
| 7 | 21/05/2026 | Flag global `window.__tutorialAutoscrollActive` para evitar duplicados | Contar cards en la página | Más simple y directo; evita que múltiples TutorialAutoscroll compitan |

---

## Formato de cada entrada

- **#**: Número secuencial
- **Fecha**: DD/MM/AAAA
- **Decisión**: Qué se eligió hacer
- **Alternativas**: Qué otras opciones se consideraron (separadas por coma)
- **Motivo**: Por qué se eligió esta opción sobre las demás
