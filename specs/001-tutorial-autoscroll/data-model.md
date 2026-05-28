# Data Model: Tutorial interactivo de autoscroll

## Entities

### TutorialState

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `isOpen` | `boolean` | Indica si el overlay del tutorial está visible actualmente |
| `helpButton` | `HTMLElement` | Referencia al botón "?" permanente |

**Estado inicial**: `isOpen = false`

**Transiciones**:

1. `closed → open`: Se activa en primera visita (localStorage check) o por clic en botón "?"
2. `open → closed`: Se activa por clic en "¡Entendido!", clic fuera del tooltip, o Escape
3. Al cerrar: se persiste `ag_tutorial_autoscroll_visto = "true"` en localStorage y se dispara `ag:tutorial-completed`

### LocalStorageFlag

| Clave | Valor | Descripción |
|-------|-------|-------------|
| `ag_tutorial_autoscroll_visto` | `"true"` o ausente | Indica si el usuario ya completó el tutorial |

**Reglas de validación**:
- Si la clave no existe → es primera visita → auto-mostrar tutorial
- Si la clave existe → visitas siguientes → NO auto-mostrar
- Botón "?" ignora esta clave (siempre muestra el tutorial)
- Si localStorage no está disponible → tratar como primera visita siempre

### Analytics Events (dataLayer)

| Evento | Disparo | Data |
|--------|---------|------|
| `tutorial_autoscroll_mostrado` | Al abrirse el overlay (auto o vía "?") | — |
| `tutorial_autoscroll_cerrado` | Al cerrarse el overlay | — |
| `tutorial_autoscroll_reabierto` | Solo cuando se abre vía botón "?" | — |

### CoordinationEvent

| Evento | Tipo | Descripción |
|--------|------|-------------|
| `ag:tutorial-completed` | `CustomEvent` | Lo dispara el tutorial al cerrarse. EncuestaModal lo escucha para retrasar su aparición. |

**Regla**: Si `window.__tutorialAutoscrollActive === true` cuando EncuestaModal
intenta mostrarse, debe esperar a este evento.
