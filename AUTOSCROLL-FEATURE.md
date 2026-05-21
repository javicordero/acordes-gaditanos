# Feature: Autoscroll para Acordes de Guitarra

## Resumen Ejecutivo

Se ha implementado un sistema de autoscroll para las páginas de acordes de guitarra del Carnaval de Cádiz. Esta funcionalidad permite a los usuarios practicar con la guitarra sin necesidad de hacer scroll manualmente, manteniendo las manos libres para tocar el instrumento. El sistema funciona de manera similar a otras webs de acordes como lacuerda.net.

## Motivación

Los guitarristas necesitan ambas manos para tocar la guitarra, lo que hace difícil hacer scroll manualmente por la letra de una canción. Esta feature permite que el contenido haga scroll automáticamente mientras el usuario toca su instrumento.

---

## Archivos Modificados

### Principal
- `src/components/page/AcordeCard.astro` - Componente principal que renderiza los acordes

### Documentación
- `AGENTS.md` - Actualizado con guidelines de build
- `AUTOSCROLL-FEATURE.md` - Este documento

---

## Estructura HTML

El componente de autoscroll está integrado dentro del componente `AcordeCard`:

```html
<section class="acorde-content" role="region" aria-labelledby={headingId}>
  <RecomendacionInline />
  <div class="acorde-meta">
    <Icon name="cejilla" width={22} height={22} />
    <span>{cejilla == 0 || !cejilla ? 'No' : cejilla}</span>
  </div>
  
  <div class="acorde-content">
    <div class="autoscroll-wrapper">
      <button class="autoscroll-btn play-btn" aria-label="Iniciar autoscroll">
        <svg>...</svg>
      </button>
      <button class="autoscroll-btn pause-btn" aria-label="Pausar autoscroll">
        <svg>...</svg>
      </button>
      <div class="speed-options">
        <button class="speed-btn" data-speed="1">1x</button>
        <button class="speed-btn active" data-speed="2">2x</button>
        <button class="speed-btn" data-speed="3">3x</button>
        <button class="speed-btn" data-speed="4">4x</button>
        <button class="speed-btn" data-speed="5">5x</button>
      </div>
    </div>
    <Content />
  </div>
</section>
```

### Descripción de elementos
- `.autoscroll-wrapper`: Contenedor principal que agrupa los controles
- `.play-btn`: Botón de play (visible por defecto)
- `.pause-btn`: Botón de pause (oculto por defecto)
- `.speed-options`: Contenedor de los botones de velocidad
- `.speed-btn`: Botones individuales de velocidad (1x-5x)

---

## Funcionalidad del Script

### Inicialización
```javascript
let initialized = false;

function initAutoscroll() {
  if (initialized) return;
  initialized = true;
  // ... código de inicialización
}
```

### View Transitions (Problema resuelto)
Astro usa view transitions que hacen que el DOM se actualice sin recarga completa. Esto causaba que los event listeners se acumularan. Solución:

```javascript
document.addEventListener('astro:before-swap', function() {
  initialized = false;
});

document.addEventListener('astro:page-load', initAutoscroll);
```

### Event Listeners
1. **Click en Play**: Llama a `startAutoscroll()`
2. **Click en Pause**: Llama a `stopAutoscroll()`
3. **Click en velocidad**: Cambia la velocidad y reinicia el scroll si está activo
4. **Tecla Espacio**: Alterna entre play/pause

### Funciones principales

```javascript
function startAutoscroll(speedOptions, playBtn, pauseBtn) {
  if (controlsContainer) {
    controlsContainer.classList.add('playing');
  }
  isPlaying = true;
  // Inicia el intervalo de scroll
}

function stopAutoscroll(speedOptions, playBtn, pauseBtn) {
  isPlaying = false;
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
  if (controlsContainer) {
    controlsContainer.classList.remove('playing');
  }
}
```

### Velocidades
```javascript
const speeds = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 8 };
// Velocidad en píxeles por intervalo (16ms)
```

### Scroll Automático
```javascript
scrollInterval = setInterval(function() {
  if (preElement && !isUserScrolling) {
    var speed = speeds[currentSpeed];
    var newScrollTop = preElement.scrollTop + speed;
    if (newScrollTop >= preElement.scrollHeight - preElement.clientHeight) {
      preElement.scrollTop = 0; // Loop al inicio
    } else {
      preElement.scrollTop = newScrollTop;
    }
  }
}, 16);
```

### Detección de scroll manual
Si el usuario hace scroll manualmente, el autoscroll se pausa temporalmente:

```javascript
preElement.addEventListener('scroll', function() {
  if (isPlaying) {
    isUserScrolling = true;
    clearTimeout(userScrollTimeout);
    userScrollTimeout = setTimeout(function() {
      isUserScrolling = false;
    }, 300);
  }
});
```

---

## Estilos CSS

### Posicionamiento
```css
.autoscroll-wrapper {
  position: absolute;
  top: -10px;
  right: -8px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  min-width: 40px;
  background: transparent;
  padding: 2px 4px;
  border-radius: 8px;
  transition: all 0.8s ease-in-out;
}
```

### Botones (Play/Pause)
```css
.autoscroll-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #3b5a64 0%, #2d434b 100%);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s ease;
  box-shadow: 0 2px 8px rgba(59, 90, 100, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  order: -1;
}
```

### Botones de velocidad
```css
.speed-btn {
  padding: 2px 6px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #3b5a64;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Montserrat', sans-serif;
}
```

### Estado Playing
```css
.autoscroll-wrapper.playing {
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 2px 12px rgba(59, 90, 100, 0.15);
}

.autoscroll-wrapper.playing .speed-options {
  max-height: 200px;
}

.autoscroll-wrapper.playing .play-btn {
  display: none;
}

.autoscroll-wrapper.playing .pause-btn {
  display: flex;
}
```

### Animación de acordeón
```css
.autoscroll-wrapper .speed-options {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.8s ease-in-out;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
}
```

---

## Problemas Conocidos y Estado Actual

### ✅ Resueltos
1. **View Transitions**: Los event listeners se acumulaban al navegar entre páginas. Solucionado con variables de estado.
2. **Posición inicial**: Los botones deben aparecer arriba a la derecha del pre.
3. **Velocidades verticales**: Los botones de velocidad deben mostrarse en columna.
4. **Animación de apertura**: La caja se despliega hacia abajo como un acordeón.
5. **Transparencia de la caja**: El fondo es semi-transparente.

### ❌ Pendientes
1. Botones de velocidad se desplazan a la derecha al hacer pause
2. El padding de la caja cambia al hacer pause (se ve más grande)
3. Posición de los botones puede moverse entre play/pause

---

## Guía de Uso para el Usuario

1. **Antes de hacer click en Play**:
   - Solo se muestra el botón de Play
   - La caja no tiene fondo visible
   - Los botones de velocidad están ocultos

2. **Al hacer click en Play**:
   - El Play se cambia por Pause
   - Aparece el fondo de la caja
   - Los botones de velocidad se despliegan hacia abajo (animación de acordeón)
   - Comienza el scroll automático

3. **Cambiar velocidad**:
   - Click en cualquier botón (1x-5x)
   - El scroll se ajusta inmediatamente

4. **Al hacer click en Pause**:
   - El Pause se cambia por Play
   - Se cierra la caja de velocidades
   - El scroll se detiene

5. **Tecla Espacio**:
   - Alterna entre Play y Pause desde cualquier lugar de la página

---

## Build Guidelines (Actualizado en AGENTS.md)

```markdown
## Build Guidelines
- **NO hacer build** después de cada cambio pequeño
- **SÍ hacer build** solo antes de un commit
- Para verificar cambios, usar `npm run dev` y probar en el navegador
- El build completa exitosamente no garantiza que todo funcione, solo que compila
```

---

## Comandos Útiles

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Build para producción
npm run preview      # Preview del build
npm run astro check  # Type-check
```

---

## Notas Técnicas

1. **Intervalo de scroll**: 16ms (aproximadamente 60fps)
2. **Max-height para animación**: 200px (suficiente para 5 botones de velocidad)
3. **Transiciones**: 0.8s para apertura/cierre suave
4. **Z-index**: 10 para保持在 contenido之上
5. **Position**: absolute respecto a `.acorde-content`

---

## To-Do para Próxima Sesión

1. Corregir el desplazamiento de los botones de velocidad al hacer pause
2. Unificar el padding de la caja en ambos estados (playing/no playing)
3. Asegurar que la posición de los botones Play/Pause no cambie
4. Posiblemente revisar la estructura CSS duplicada que fue eliminada
5. Probar en móvil para verificar responsive

---

## Referencias

- Similar a: lacuerda.net
- Frameworks: Astro 5.15.9
- CSS: Custom properties, flexbox, CSS transitions
- JavaScript: Vanilla JS (inline script)