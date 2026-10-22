# Research: Transportador de Acordes

**Date**: 04/09/2026 | **Spec**: [spec.md](./spec.md)

## R1: Algoritmo de transportación de acordes

**Decision**: Usar la escala cromática de 12 notas con notación española (Do, Do#, Re, Re#, Mi, Fa, Fa#, Sol, Sol#, La, La#, Si). Para cada acorde, extraer la nota fundamental (antes de sufijos como 7, m, M7, add9, etc.), buscar su índice en la escala, sumar el intervalo de semitonos, y reconstruir el acorde con la nueva nota + sufijos originales.

**Rationale**: Es el mismo algoritmo que usa la skill `transportar` existente. La escala cromática con notación española es la usada en el proyecto (400+ entradas).

**Alternatives considered**:
- Usar notación anglosajona (C, C#, D, etc.) → Rechazado: rompe compatibilidad con el contenido existente
- Usar bemoles por defecto → Rechazado: la mayoría de acordes usan sostenidos (#)

## R2: Parsing de acordes en el DOM

**Decision**: Los acordes están en `<a>` tags dentro de `<pre>`. El script JavaScript leerá el `textContent` de cada `<a>`, extraerá la nota fundamental usando regex, la transportará, y escribirá el nuevo texto con `textContent`. No se modifica la estructura HTML, solo el contenido de texto de los nodos `<a>`.

**Rationale**: Usar `textContent` es seguro y preserva el espaciado original del `<pre>`. No hay riesgo de inyección XSS ya que solo se modifica contenido de texto.

**Alternatives considered**:
- Modificar el HTML interno del `<a>` → Rechazado: más complejo y riesgo de romper formato
- Clonar el `<pre>` y reemplazarlo → Rechazado: innecesariamente pesado y pierde eventos

## R3: Gestión del estado del transportador

**Decision**: Usar una variable closure `currentTranspose` dentro del IIFE del script inline de AcordeCard. Cada página de acorde tiene su propio estado independiente. El valor se actualiza al pulsar +/− y se resetea a 0 con el botón reset.

**Rationale**: El autoscroll ya usa este patrón (closure con IIFE). No hay necesidad de localStorage ya que es temporal.

**Alternatives considered**:
- Usar localStorage para persistir → Rechazado: spec dice "no hay que guardarlo en ningún sitio"
- Usar sessionStorage → Rechazado: innecesario para una funcionalidad temporal
- Usar state management (Alpine.js, etc.) → Rechazado: overkill para 2 botones

## R4: Integración con el tutorial existente

**Decision**: Modificar `TutorialAutoscroll.astro` para incluir una sección adicional sobre el transportador en el tooltip. El título cambiará a "Controles" y se añadirán items sobre +/− al final de la lista existente.

**Rationale**: El botón "?" ya existe y tiene la infraestructura de tooltip. Reutilizar es más eficiente que crear un segundo sistema de ayuda.

**Alternatives considered**:
- Crear un segundo tooltip independiente → Rechazado: confuso para el usuario, dos botones "?" juntos
- Solo usar tooltips en los botones +/− → Rechazado: el usuario pidió ayuda combinada

## R5: Posicionamiento CSS del transportador

**Decision**: Los botones +/− se colocan dentro del `.autoscroll-wrapper` existente, justo encima del botón play. Se usa `flex-direction: column` con los botones en fila horizontal (`flex-direction: row` en un sub-contenedor). Se mantiene la posición `absolute` del wrapper sobre el `<pre>`.

**Rationale**: El wrapper ya tiene posición absoluta y está anclado a la esquina superior derecha del `<pre>`. Añadir controles dentro mantiene la consistencia visual.

**Alternatives considered**:
- Crear un segundo contenedor posicionado → Rechazado: más CSS, más complejidad de positioning
- Mover los controles debajo de la cejilla (ubicación original del spec) → Rechazado: usuario decidió moverlos aquí
