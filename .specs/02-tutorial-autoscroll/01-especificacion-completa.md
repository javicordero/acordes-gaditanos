# Tutorial interactivo de autoscroll para primera visita — Especificación completa

> Fecha: 21/05/2026
> Estado: Spec

---

## Resumen

Coach mark overlay que se muestra automáticamente en la primera visita a `acordes/[id].astro`, oscureciendo el resto de la página y destacando los controles de autoscroll con un highlight sutil y un tooltip explicativo. Incluye un botón de ayuda permanente ("?") para reabrir el tutorial cuando el usuario lo desee.

---

## Motivación

La funcionalidad de autoscroll existe en `AcordeCard.astro` pero no es evidente para los usuarios nuevos. Un tutorial visual tipo coach mark (siguiendo el patrón de `EncuestaModal`) mejora la adopción y la experiencia de usuario.

---

## Alcance

### Incluye
- Overlay de pantalla completa con fondo semi-transparente (`rgba(0,0,0,0.55)`, z-index: 10001)
- Efecto cutout con 4 paneles (top/right/bottom/left) para destacar los controles
- Highlight sutil (borde/sombra estática) alrededor del `.autoscroll-wrapper`
- Tooltip explicativo posicionado dinámicamente (lado en desktop, abajo en mobile)
- Contenido del tooltip: Play/Pausa, velocidad 1x-5x, atajo Espacio, auto-stop al final, pausa por scroll manual
- Almacenamiento en `localStorage` con clave `ag_tutorial_autoscroll_visto`
- Botón "?" permanente junto a los controles para reabrir el tutorial
- Cierre solo explícito: botón "¡Entendido!", clic fuera del tooltip, o tecla Escape
- Aparición inmediata al cargar la página
- Compatibilidad con View Transitions (ClientRouter)
- Coordinación con `EncuestaModal`: el tutorial tiene prioridad. `EncuestaModal` retrasa su aparición hasta que el tutorial se cierre (evento `ag:tutorial-completed`).

### No incluye (fuera de scope)
- Modificación del comportamiento existente del autoscroll
- Tutoriales para otras funcionalidades
- Modificaciones a `Layout.astro` o `global.css`

---

## Diseño de la solución

### Arquitectura

Se crea un nuevo componente `TutorialAutoscroll.astro` con estilos y JS autocontenidos. Se importa en `AcordeCard.astro` y se renderiza una vez por card. Para evitar duplicados (si hubiera varias cards en una página), se usa un flag global `window.__tutorialAutoscrollActive`.

El overlay se posiciona con `position: fixed; inset: 0; z-index: 10001` (por encima de `EncuestaModal` que usa 10000). Los 4 paneles se calculan con JS obteniendo el `getBoundingClientRect()` del `.autoscroll-wrapper`.

### Flujo de usuario

1. Usuario navega a `/acordes/[id]`
2. `astro:page-load` dispara `initTutorial()`
3. Si `localStorage` no tiene `ag_tutorial_autoscroll_visto=true`, se muestra el overlay inmediatamente
4. El overlay oscurece todo excepto el área del `.autoscroll-wrapper`
5. El tooltip aparece animado (slide-up suave, respeta `prefers-reduced-motion`)
6. Usuario lee, hace clic en "¡Entendido!" (o fuera, o Escape)
7. Tutorial se cierra, se marca localStorage, se dispara `ag:tutorial-completed`
8. En visitas siguientes, el botón "?" permanente permite reabrir el tutorial (ignorando localStorage)

### Efecto cutout

Se implementa con 4 divs (`<div class="panel panel--top">`, etc.) posicionados dinámicamente vía JS:

```
┌──────────────────────────────┐
│         panel--top           │
│      ┌──────────────┐        │
│ left │   (hueco)    │ right  │
│ panel│  autoscroll  │ panel  │
│      └──────────────┘        │
│        panel--bottom         │
└──────────────────────────────┘
```

### Tooltip

```html
<div class="tutorial-tooltip">
  <button class="tutorial-tooltip__close" data-tutorial-close aria-label="Cerrar tutorial">&times;</button>
  <h3>Desplazamiento automático</h3>
  <p class="tutorial-tooltip__subtitle">Desplázate por la letra sin usar las manos</p>
  <ul>
    <li><strong>▶ Play / ⏸ Pausa</strong> — inicia y detiene el scroll automático</li>
    <li><strong>1x a 5x</strong> — ajusta la velocidad de desplazamiento</li>
    <li><strong>Tecla Espacio</strong> — atajo para reproducir o pausar</li>
    <li>Se detiene automáticamente al llegar al final de la letra</li>
    <li>Si haces scroll manual, el autoscroll se pausa momentáneamente</li>
  </ul>
  <button class="tutorial-tooltip__action" data-tutorial-action>¡Entendido!</button>
</div>
```

---

## Cambios detallados

| # | Archivo | Tipo de cambio | Descripción |
|---|---------|---------------|-------------|
| 1 | `src/components/page/TutorialAutoscroll.astro` | CREAR | Componente overlay completo con JS, estilos, tooltip |
| 2 | `src/components/page/AcordeCard.astro` | MODIFICAR | Importar y renderizar TutorialAutoscroll; añadir botón "?" |
| 3 | `src/components/ads/EncuestaModal.astro` | MODIFICAR | Escuchar evento `ag:tutorial-completed` para retrasar su aparición |

### Detalle por archivo

#### 1. `src/components/page/TutorialAutoscroll.astro` (CREAR)

Componente completo con:
- Template: backdrop + 4 paneles + highlight ring + tooltip
- `<script is:inline>` con toda la lógica
- `<style>` encapsulado

Estructura del script:

```javascript
(function() {
  const STORAGE_KEY = 'ag_tutorial_autoscroll_visto';
  let isOpen = false;

  function initTutorial() {
    // Evitar duplicados si hay múltiples cards
    if (window.__tutorialAutoscrollActive) return;
    const article = document.querySelector('.acorde-card');
    if (!article) return;
    const wrapper = article.querySelector('.autoscroll-wrapper');
    if (!wrapper) return;

    // Auto-mostrar solo si es primera visita
    if (!localStorage.getItem(STORAGE_KEY)) {
      showTutorial(wrapper);
    }
  }

  function showTutorial(wrapper) {
    window.__tutorialAutoscrollActive = true;
    // ... posicionar paneles, highlight, tooltip
  }

  function closeTutorial() {
    // ... ocultar todo, marcar localStorage, disparar evento
    window.dispatchEvent(new CustomEvent('ag:tutorial-completed'));
  }

  // Eventos: astro:page-load, astro:before-swap, resize, Escape, clicks
  // ...
})();
```

#### 2. `src/components/page/AcordeCard.astro` (MODIFICAR)

**Import:** Añadir al frontmatter:
```astro
import TutorialAutoscroll from './TutorialAutoscroll.astro';
```

**Render:** Justo antes del `.autoscroll-wrapper`:
```astro
<TutorialAutoscroll />
<div class='autoscroll-wrapper'>
```

**Botón "?"** dentro del `.autoscroll-wrapper`, al inicio:
```astro
<button class='autoscroll-help-btn' data-tutorial-help aria-label='Ayuda sobre el autoscroll'>?</button>
<button class='autoscroll-btn play-btn' ...>
```

Estilo para el botón "?" (en la sección `<style>` del componente):
```css
.autoscroll-help-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--secondary-color);
  background: transparent;
  color: var(--secondary-color);
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s ease;
  flex-shrink: 0;
  order: -2; /* antes del play-btn */
}

.autoscroll-help-btn:hover {
  background: var(--secondary-color);
  color: #fff;
}
```

#### 3. `src/components/ads/EncuestaModal.astro` (MODIFICAR)

En la función `initEncuestaModal()`, antes del `setTimeout` que muestra el modal, añadir:

```javascript
// Escuchar si hay un tutorial de autoscroll activo
const tutorialCompleted = new Promise((resolve) => {
  if (window.__tutorialAutoscrollActive) {
    window.addEventListener('ag:tutorial-completed', () => resolve(), { once: true });
  } else {
    resolve();
  }
});

// Esperar tanto el timeout de 5s como que el tutorial termine
tutorialCompleted.then(() => {
  // ... lógica existente de mostrar el modal
});
```

---

## Backward compatibility

Completa. El tutorial solo añade elementos nuevos (overlay, tooltip, botón "?"). No modifica el comportamiento del autoscroll ni de ningún otro componente excepto `EncuestaModal` que gana una escucha de evento opcional.

---

## Edge cases

| Caso | Comportamiento esperado |
|------|------------------------|
| Primera visita a `/acordes/[id]` | Tutorial se muestra inmediatamente con overlay |
| Visitas siguientes | Tutorial no se auto-muestra (localStorage) |
| Clic en botón "?" | Tutorial se abre siempre, ignorando localStorage |
| Navegación SPA (View Transitions) | Tutorial se re-evalúa en cada `astro:page-load`; flag global evita duplicados |
| Redimensionar ventana con tutorial abierto | `requestAnimationFrame` re-posiciona paneles y tooltip |
| Múltiples AcordeCard en misma página | Solo el primer card activa el tutorial (flag global) |
| Pantalla móvil (< 640px) | Tooltip se posiciona debajo del highlight, centrado |
| `prefers-reduced-motion` | Animaciones del tooltip (slide-up) desactivadas |
| Escape o clic fuera del tooltip | Tutorial se cierra y marca como visto |
| Clic en "¡Entendido!" | Tutorial se cierra y marca como visto |
| `localStorage` deshabilitado | Tutorial se muestra siempre (sin persistencia); graceful degradation |
| EncuestaModal a los 5s mientras tutorial abierto | EncuestaModal espera al evento `ag:tutorial-completed` |

---

## Datos de prueba

```yaml
rutas:
  - /acordes/[id]  # cualquier acorde existente
simular segunda visita:
  - localStorage.setItem('ag_tutorial_autoscroll_visto', 'true')
  - recargar página
reabrir tutorial:
  - localStorage.removeItem('ag_tutorial_autoscroll_visto')
  - hacer clic en botón "?" junto a los controles
```

---

## Archivos NO modificados

| Archivo | Motivo |
|---------|--------|
| `src/layouts/Layout.astro` | El tutorial se incluye desde AcordeCard |
| `src/styles/global.css` | Estilos autocontenidos en el componente |
| `src/styles/variables.css` | No necesita nuevas variables |
| `src/lib/*` | Clave de localStorage definida directamente en el componente |
