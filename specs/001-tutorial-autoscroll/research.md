# Research: Tutorial interactivo de autoscroll

## Decisiones técnicas

### Patrón de overlay coach mark

- **Decisión**: 4 paneles cutout con posicionamiento dinámico vía JS
- **Rationale**: Más robusto cross-browser que clip-path o SVG mask. No
  requiere coordenadas exactas en tiempo real. Funciona bien con responsive.
- **Alternativas consideradas**: clip-path CSS, SVG mask, z-index stacking

### Localización del componente

- **Decisión**: Componente autocontenido en AcordeCard.astro
- **Rationale**: El tutorial solo aplica en páginas con autoscroll. Evita
  lógica condicional en Layout.astro.
- **Alternativas consideradas**: Componente global en Layout.astro

### Mecanismo de cierre

- **Decisión**: Cierre solo explícito (botón, clic fuera, Escape)
- **Rationale**: No interrumpe la lectura del tutorial. Mejor experiencia.
- **Alternativas consideradas**: Cierre automático al interactuar

### Timing de aparición

- **Decisión**: Inmediata al cargar la página
- **Rationale**: El usuario quiere verlo nada más llegar.
- **Alternativas consideradas**: Retraso de 2-3s

### Highlight del autoscroll-wrapper

- **Decisión**: Highlight sutil (estático, borde/sombra)
- **Rationale**: Discreto, no distrae.
- **Alternativas consideradas**: Glow pulsante animado

### Coordinación con EncuestaModal

- **Decisión**: Tutorial tiene prioridad. EncuestaModal escucha
  `ag:tutorial-completed`.
- **Rationale**: No competir por la atención del usuario.
- **Alternativas consideradas**: Solapamiento independiente, supresión total

### Prevención de duplicados

- **Decisión**: Flag global `window.__tutorialAutoscrollActive`
- **Rationale**: Simple y directo.
- **Alternativas consideradas**: Contar cards en la página

### Accesibilidad

- **Decisión**: WCAG completa: focus trap, roles ARIA, foco gestionado,
  anuncios screen reader, prefers-reduced-motion.
- **Rationale**: Inclusivo, requerido por clarificación explícita del usuario.
- **Alternativas consideradas**: Solo Escape y aria-label

### Degradación graceful

- **Decisión**: Try/catch en localStorage y en init completo. Sin errores
  visibles. Tutorial se muestra siempre si localStorage falla.
- **Rationale**: Robustez ante modos incógnito y JS exceptions.
- **Alternativas consideradas**: Sin manejo especial

### Analytics

- **Decisión**: Eventos dataLayer en tutorial mostrado, cerrado y reabierto.
- **Rationale**: Permite medir adopción sin necesidad de sistema externo.
- **Alternativas consideradas**: Sin analytics
