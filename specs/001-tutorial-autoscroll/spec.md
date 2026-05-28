# Feature Specification: Tutorial interactivo de autoscroll

**Feature Branch**: `001-tutorial-autoscroll`

**Created**: 2026-05-25

**Status**: Draft

## Clarifications

### Session 2026-05-25

- Q: ¿Qué nivel de accesibilidad debe tener el tutorial? → A: Accesibilidad completa WCAG: focus trap dentro del overlay, roles ARIA, descripciones screen reader, orden de tabulación controlado
- Q: ¿Cómo manejar errores de localStorage o JS? → A: Degradación completa: si localStorage falla, tutorial siempre visible sin persistencia. Si error JS en init, el tutorial no se muestra pero el resto funciona. Sin errores visibles al usuario.
- Q: ¿Documentar exclusiones explícitas de alcance? → A: Sí, incluir sección de "Fuera de alcance" en la spec.
- Q: ¿Incluir analytics de uso del tutorial? → A: Sí, registrar eventos: tutorial mostrado, cerrado y reabierto, conectado al sistema existente (Google Tag Manager).

**Input**: User description: "Tutorial interactivo de autoscroll para primera visita"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Primera visita con tutorial automático (Priority: P1)

Como usuario nuevo que visita por primera vez una página de acordes,
quiero ver un tutorial visual que me explique los controles de autoscroll,
para aprender a usar la funcionalidad sin tener que buscarla.

**Why this priority**: Es la funcionalidad principal del tutorial — sin esto
el usuario nunca sabrá que el autoscroll existe.

**Independent Test**: Puede probarse navegando a cualquier `/acordes/[id]`
sin haber visitado nunca antes, y verificando que el overlay aparece
inmediatamente con el tooltip explicativo.

**Acceptance Scenarios**:

1. **Given** un usuario sin visitas previas a páginas de acordes,
   **When** navega a `/acordes/[id]`,
   **Then** se muestra un overlay a pantalla completa que oscurece el fondo
   y destaca los controles de autoscroll con un tooltip explicativo.
2. **Given** el tutorial visible,
   **When** el usuario hace clic en "¡Entendido!" (o pulsa Escape, o clic fuera),
   **Then** el overlay se cierra, se marca en localStorage como visto,
   y no se vuelve a mostrar automáticamente.

---

### User Story 2 - Reapertura del tutorial con botón de ayuda (Priority: P2)

Como usuario que ya vio el tutorial pero quiere repasar las instrucciones,
quiero un botón "?" permanente junto a los controles de autoscroll,
para reabrir el tutorial cuando lo necesite.

**Why this priority**: Mejora la experiencia sin ser crítica — el usuario
ya aprendió el flujo básico en la primera visita.

**Independent Test**: Puede probarse haciendo clic en el botón "?" después
de haber cerrado el tutorial, y verificando que se reabre correctamente.

**Acceptance Scenarios**:

1. **Given** el tutorial ya fue visto y cerrado,
   **When** el usuario hace clic en el botón "?" junto a los controles,
   **Then** el tutorial se reabre mostrando toda la información,
   ignorando el estado de localStorage.
2. **Given** el tutorial reabierto vía botón "?",
   **When** el usuario lo cierra,
   **Then** el comportamiento de primera visita no se ve afectado
   (sigue marcado como visto).

---

### User Story 3 - Coordinación con EncuestaModal (Priority: P3)

Como usuario que ve tanto el tutorial como la encuesta modal,
quiero que el tutorial tenga prioridad y la encuesta espere a que termine,
para no verme abrumado por dos overlays simultáneos.

**Why this priority**: Es un refinamiento de UX importante pero no bloqueante
— la funcionalidad principal funciona sin esta coordinación.

**Independent Test**: Puede probarse configurando la encuesta para que
aparezca a los 5 segundos, cargando una página de acordes por primera vez,
y verificando que la encuesta solo aparece después de cerrar el tutorial.

**Acceptance Scenarios**:

1. **Given** el tutorial de autoscroll visible en primera visita,
   **When** pasan 5 segundos (tiempo de aparición de EncuestaModal),
   **Then** la encuesta NO aparece hasta que el tutorial se cierra.
2. **Given** el tutorial cerrado,
   **When** se dispara el evento de cierre del tutorial,
   **Then** EncuestaModal puede aparecer según su lógica normal.

---

### Edge Cases

- ¿Qué ocurre si hay múltiples `AcordeCard` en una misma página?
  Solo el primer card activa el tutorial (flag global evita duplicados).
- ¿Qué ocurre si el usuario redimensiona la ventana con el tutorial abierto?
  Los paneles y el tooltip se re-posicionan dinámicamente.
- ¿Qué ocurre si `localStorage` está deshabilitado?
  El tutorial se muestra siempre (sin persistencia), con degradación graceful.
- ¿Qué ocurre en pantallas móviles (< 640px)?
  El tooltip se posiciona debajo del highlight, centrado horizontalmente.
- ¿Qué ocurre con `prefers-reduced-motion`?
  Las animaciones del tooltip (slide-up) se desactivan.
- ¿Qué ocurre si `localStorage.setItem` lanza una excepción (modo incógnito Safari)?
  El tutorial se muestra siempre (sin persistencia), con degradación graceful y sin errores visibles.
- ¿Qué ocurre si el script de inicialización del tutorial lanza un error?
  El tutorial no se muestra, catch silencioso, el resto de la página funciona con normalidad.
- ¿Qué ocurre si el usuario hace clic repetidamente en "¡Entendido!" o en el botón "?" antes de que termine una animación?
  Las acciones se debouncean: solo la primera cuenta, el estado del tutorial se protege contra ráfagas de clics.

## Out of Scope

- Modificación del comportamiento existente del autoscroll (play, pausa, velocidad, auto-stop)
- Tutoriales para otras funcionalidades del sitio (navegación, búsqueda, etc.)
- Modificaciones a `Layout.astro` o `global.css`
- Soporte multi-idioma

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar un overlay a pantalla completa con
  fondo semi-transparente en la primera visita a `/acordes/[id]`.
- **FR-002**: El sistema MUST destacar los controles de autoscroll con un
  efecto cutout (4 paneles alrededor) y un highlight sutil.
- **FR-003**: El sistema MUST mostrar un tooltip explicativo con:
  funcionamiento de Play/Pausa, velocidades 1x-5x, atajo Espacio,
  auto-stop al final y pausa por scroll manual.
- **FR-004**: El sistema MUST cerrar el tutorial solo mediante acción explícita:
  botón "¡Entendido!", clic fuera del tooltip, o tecla Escape.
- **FR-005**: El sistema MUST almacenar en localStorage
  (`ag_tutorial_autoscroll_visto`) que el tutorial fue visto.
- **FR-006**: El sistema MUST mostrar un botón "?" permanente junto a los
  controles para reabrir el tutorial en cualquier momento.
- **FR-007**: El sistema MUST coordinar con EncuestaModal para que esta
  espere al cierre del tutorial antes de mostrarse.
- **FR-008**: El sistema MUST re-posicionar paneles y tooltip al redimensionar
  la ventana mientras el tutorial está abierto.
- **FR-009**: El sistema MUST funcionar correctamente con View Transitions
  (navegación SPA).
- **FR-010**: El sistema MUST respetar `prefers-reduced-motion`.
- **FR-011**: El sistema MUST implementar un focus trap dentro del overlay mientras el tutorial está abierto (el foco no puede salir del tooltip).
- **FR-012**: El sistema MUST usar roles ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) en el tooltip.
- **FR-013**: El sistema MUST mover el foco al primer elemento interactivo del tooltip al abrir y devolverlo al botón "?" al cerrar.
- **FR-014**: El sistema MUST anunciar el contenido del tutorial al lector de pantalla automáticamente al abrirse.
- **FR-015**: El sistema MUST degradar gracefulmente si `localStorage` no está disponible: el tutorial se muestra siempre pero no persiste el estado.
- **FR-016**: El sistema MUST disparar eventos de analytics (dataLayer de GTM) en tres momentos: tutorial mostrado, tutorial cerrado, tutorial reabierto vía botón "?".

### Key Entities

- **TutorialOverlay**: Estado visual del tutorial (visible/oculto), panel cutout, highlight, tooltip
- **LocalStorageFlag**: Marca persistente `ag_tutorial_autoscroll_visto` que controla auto-apertura
- **TutorialHelpButton**: Botón "?" permanente para reapertura manual
- **CoordinationEvent**: Evento `ag:tutorial-completed` que EncuestaModal escucha

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuarios nuevos ven el tutorial inmediatamente al cargar la
  página, sin retardo apreciable (< 500ms desde page-load).
- **SC-002**: Usuarios pueden cerrar el tutorial y no se vuelve a mostrar
  automáticamente en visitas siguientes.
- **SC-003**: Usuarios pueden reabrir el tutorial en cualquier momento
  mediante el botón "?".
- **SC-004**: EncuestaModal no aparece mientras el tutorial está visible
  (0% de solapamiento entre ambos overlays).
- **SC-005**: Los tres eventos de analytics (mostrado, cerrado, reabierto) se registran correctamente en el dataLayer verificable mediante consola.

## Assumptions

- El navegador soporta `localStorage` (salvo degradación graceful).
- View Transitions (ClientRouter) está activo en el proyecto.
- Los controles de autoscroll existen dentro de un contenedor con clase
  `.autoscroll-wrapper`.
- EncuestaModal se dispara con un `setTimeout` y puede retrasarse mediante
  una Promesa.
- El proyecto usa Astro con islands architecture (componentes
  autocontenidos con script y estilo propio).
