# Feature Specification: Transportador de Acordes

**Feature Branch**: `006-transportador-acordes`

**Created**: 04/09/2026

**Status**: Draft

**Input**: User description: "Transportador de acordes en páginas de acordes. Se muestra justo debajo de la cejilla con 2 botones para subir o bajar el tono de medio en medio tono (como las cejillas de guitarra). Al subir/bajar el tono, los acordes del pre se transportan automáticamente en el navegador. No hay que guardarlo en ningún sitio."

## Clarifications

### Session 2026-09-04

- Q: ¿Cómo se indica al usuario la función de los botones +/−? → A: Tooltip al hover ("Subir tono" / "Bajar tono") + aria-label accesible.
- Q: ¿Dónde se ubican los botones del transportador? → A: En la esquina superior derecha del `<pre>`, en el mismo contenedor del autoscroll. Botones +/− en fila horizontal justo encima del botón play del autoscroll.
- Q: ¿Cómo se ayuda al usuario con los controles? → A: El botón "?" existente del autoscroll se reutiliza para mostrar ayuda combinada de ambas funciones (autoscroll + transportador).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subir el tono (Priority: P1)

Un guitarrista está en la página de un acorde y necesita subir la tonalidad para cantarla más agudo. Ve dos botones (+ y −) en la esquina superior derecha del `<pre>`, en el mismo grupo de controles que el autoscroll. Pulsa el botón + y todos los acordes mostrados se transportan medio tono arriba instantáneamente. Cada pulsación adicional sube otro medio tono. Al pasar el cursor sobre el botón, aparece un tooltip "Subir tono".

**Why this priority**: Es la funcionalidad principal del transportador. Sin la capacidad de subir tono, el feature no tiene valor.

**Independent Test**: Puede probarse accediendo a cualquier página de acorde, pulsando el botón + y verificando que los acordes cambian visualmente en el navegador.

**Acceptance Scenarios**:

1. **Given** que el usuario está en una página de acorde con cejilla 0, **When** pulsa el botón + una vez, **Then** todos los acordes del `<pre>` se transportan +1 semitono (medio tono).
2. **Given** que el usuario ha pulsado + dos veces (cejilla virtual = 2), **When** pulsa el botón + una vez más, **Then** los acordes se transportan un total de +3 semitonos respecto al original.
3. **Given** que el usuario ha subido el tono, **When** observa la cejilla, **Then** se muestra el valor acumulado de semitonos transportados.

---

### User Story 2 - Bajar el tono (Priority: P1)

Un guitarrista necesita bajar la tonalidad para adaptarla a su rango vocal. Pulsa el botón − en la esquina superior derecha del `<pre>` y los acordes se transportan medio tono abajo. Al pasar el cursor, aparece un tooltip "Bajar tono". Puede seguir pulsando para bajar más.

**Why this priority**: Completa la funcionalidad básica del transportador junto con subir tono.

**Independent Test**: Puede probarse pulsando el botón − y verificando que los acordes cambian en dirección descendente.

**Acceptance Scenarios**:

1. **Given** que el usuario está en una página de acorde, **When** pulsa el botón − una vez, **Then** todos los acordes del `<pre>` se transportan −1 semitono.
2. **Given** que el usuario ha pulsado − tres veces, **When** observa la cejilla, **Then** se muestra el valor acumulado negativo de semitonos transportados.

---

### User Story 3 - Restaurar tonalidad original (Priority: P2)

Un usuario ha transportado los acordes varias veces y quiere volver al tono original. Necesita una forma de resetear la transportación sin recargar la página.

**Why this priority**: Mejora la experiencia de usuario y evita tener que recargar para volver al original.

**Independent Test**: Puede probarse transportando acordes y luego pulsando reset, verificando que vuelven al estado original.

**Acceptance Scenarios**:

1. **Given** que el usuario ha transportado los acordes +4 semitonos, **When** pulsa el botón de reset, **Then** los acordes vuelven al tono original del archivo.
2. **Given** que el usuario está en el tono original (cejilla = 0), **When** observa el transportador, **Then** el botón de reset no está visible o está deshabilitado.

---

### User Story 4 - Transportación con cejilla existente (Priority: P2)

Algunos acordes ya tienen cejilla (ej: cejilla 3). El transportador debe tener en cuenta la cejilla original al mostrar el valor transportado.

**Why this priority**: Asegura coherencia con el sistema de cejillas existente.

**Independent Test**: Puede probarse en un acorde con cejilla != 0, transportando y verificando que la cejilla mostrada se suma correctamente.

**Acceptance Scenarios**:

1. **Given** que un acorde tiene cejilla = 3, **When** el usuario pulsa + una vez, **Then** la cejilla mostrada pasa a 4 (3 + 1).
2. **Given** que un acorde tiene cejilla = 0, **When** el usuario pulsa − una vez, **Then** la cejilla mostrada pasa a −1.

---

### Edge Cases

- ¿Qué pasa cuando se transportan acordes que contienen sostenidos/bemoles ya existentes (ej: Fa#, Solb)? → Se deben transportar correctamente manteniendo la notación.
- ¿Qué pasa con acordes compuestos con barra (ej: Do/Fa)? → Se transportan ambas partes de la barra.
- ¿Qué pasa con acordes con sufijos complejos (ej: Mi/add9, Lam7)? → Se mantiene el sufijo y se transporta solo la nota fundamental.
- ¿Qué pasa si el usuario recarga la página? → Se pierde la transportación (es temporal, no se persiste).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema MUST mostrar un transportador con 2 botones (+ y −) en la esquina superior derecha del `<pre>`, en el mismo contenedor que los controles del autoscroll. Los botones se disponen en fila horizontal encima del play.
- **FR-001a**: Sistema MUST mostrar tooltip "Subir tono" al hover sobre el botón + y "Bajar tono" sobre el botón −.
- **FR-001b**: Sistema MUST incluir aria-label "Subir tono" en el botón + y "Bajar tono" en el botón − para accesibilidad.
- **FR-002**: Sistema MUST transportar los acordes del `<pre>` de medio en medio tono (1 semitono) por cada pulsación.
- **FR-003**: Sistema MUST mantener todos los sufijos de los acordes (7, m, M7, maj7, aug, dim, sus2, sus4, add9, etc.) al transportar.
- **FR-004**: Sistema MUST transportar ambas partes de acordes con barra (ej: Do/Fa → Re/Sol).
- **FR-005**: Sistema MUST mostrar el valor acumulado de semitonos transportados junto a los botones +/− en la zona de controles.
- **FR-006**: Sistema MUST proporcionar una forma de restaurar el tono original (botón reset).
- **FR-007**: Sistema MUST usar la escala cromática de 12 notas: Do, Do#, Re, Re#, Mi, Fa, Fa#, Sol, Sol#, La, La#, Si.
- **FR-008**: Sistema MUST operar completamente en el navegador sin llamadas al servidor.
- **FR-009**: Sistema MUST ser compatible con la notación española de acordes (Sib en lugar de Bb, Mib en lugar de Eb, etc.).
- **FR-010**: Sistema MUST preservar el espaciado y formato original del `<pre>` al modificar los acordes.
- **FR-011**: Sistema MUST reutilizar el botón "?" existente del autoscroll para mostrar ayuda combinada de autoscroll + transportador.

### Key Entities

- **Transportador**: Componente UI con botones + y − (en fila horizontal) integrado en la zona de controles del autoscroll (esquina superior derecha del `<pre>`). Incluye tooltips descriptivos y aria-labels.
- **Semitono**: Unidad de transportación (medio tono = 1 posición en la escala cromática).
- **Escala Cromática**: Las 12 notas musicales en orden: Do(0), Do#(1), Re(2), Re#(3), Mi(4), Fa(5), Fa#(6), Sol(7), Sol#(8), La(9), La#(10), Si(11).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los usuarios pueden subir o bajar el tono de cualquier acorde en menos de 2 segundos.
- **SC-002**: La transportación se aplica instantáneamente (sin percibir delay) al pulsar los botones.
- **SC-003**: 100% de los acordes del `<pre>` se transportan correctamente al pulsar + o −.
- **SC-004**: Los sufijos de acordes (7, m, M7, etc.) se mantienen intactos después de la transportación.
- **SC-005**: El botón de reset restaura el tono original en una sola pulsación.

## Assumptions

- Los acordes están formateados con etiquetas `<a>` dentro de `<pre>` (formato existente del proyecto).
- La notación usada es la española (Do, Re, Mi, Fa, Sol, La, Si con sostenidos/bemoles).
- No se necesita persistir la transportación (es temporal para la sesión del usuario).
- El transportador se integra en el componente AcordeCard existente.
- La escala cromática sigue el orden del skill transportar existente: Do, Do#, Re, Re#, Mi, Fa, Fa#, Sol, Sol#, La, La#, Si.
- Los acordes con notación enarmónica se manejan según la dirección de transportación.
