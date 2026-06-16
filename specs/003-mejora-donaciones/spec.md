# Feature Specification: Mejora del Sistema de Donaciones

**Feature Branch**: `003-mejora-donaciones`

**Created**: 15/06/2026

**Status**: Draft

**Input**: User description: "en base a monetizacion.md quiero mejorar la implementacion de las donaciones"

## Clarifications

### Session 2026-06-15

- Q1: ¿Formato de la sección de donaciones? → A: Total histórico acumulado (sin meta mensual)
- Q2: ¿Cómo se cargan los datos? → A: Content collection de Astro (`src/content/donaciones/datos.md`) con datos cargados en build-time mediante `getCollection()`
- Q3: ¿A qué plataforma de donación enlazar? → A: Buy Me a Coffee (la actual)
- Q4: ¿Dónde se muestra el indicador? → A: Columna lateral derecha, refactorizando `Apoyar.astro`
- Q5: ¿Estructura de los datos de donaciones? → A: Array en YAML frontmatter de `src/content/donaciones/datos.md` con fecha, importe y donante opcional
- Q6: ¿Dónde se muestra el timeline detallado? → A: En `Apoyar.astro` (variante compacta) y `BannerNoly.astro` (variante timeline), con componente compartido `DonationIndicator`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Indicador de donaciones con total histórico (Priority: P1)

Un visitante navega por la web y en la colateral derecha ve que el proyecto ha recibido más de 1.200 € gracias a 89 personas. Al ver que la comunidad ya ha apoyado el proyecto, se siente motivado a contribuir haciendo clic en el botón "Apoyar Acordes Gaditanos" justo debajo del indicador.

**Why this priority**: La transparencia y prueba social aumentan la tasa de conversión de donaciones. Mostrar el total acumulado histórico genera confianza y comunidad.

**Independent Test**: Puede probarse cargando cualquier página con columna lateral derecha y verificando que se muestra el total recaudado histórico y el número de donantes junto al botón de donación. Si se modifica `src/content/donaciones/datos.md` con nuevos valores, el indicador reflejará el cambio tras redeploy.

**Acceptance Scenarios**:

1. **Given** un visitante en cualquier página con columna lateral derecha, **When** la página se carga completamente, **Then** se muestra el total acumulado de donaciones, el número total de donantes y un resumen de las últimas donaciones junto al botón "Apoyar Acordes Gaditanos".
2. **Given** un visitante, **When** el indicador se muestra, **Then** se listan las últimas donaciones (fecha, importe, nombre o "Anónimo") extraídas de la content collection.
3. **Given** un administrador, **When** modifica `src/content/donaciones/datos.md` añadiendo una nueva donación y redeploya, **Then** el indicador en todas las páginas refleja los nuevos totales y la nueva donación en la lista.

---

### Edge Cases

- ¿Qué ocurre si no hay entrada en la content collection o el array de donaciones está vacío? El indicador debe mostrar el mensaje por defecto ("Sé el primero en apoyar el proyecto") sin romper el resto de la página. Si el YAML frontmatter es inválido, el build fallará (validación en build-time).
- ¿Qué pasa si no ha habido donaciones nunca (array vacío)? Se muestra "Sé el primero en apoyar el proyecto" con el botón de donación.
- ¿Qué ocurre si hay muchas donaciones (ej. 200+)? Se muestran solo las últimas 5-10 donaciones, y el total calculado del array completo.
- ¿Cómo se protege la privacidad? El campo `donante` es opcional; si no se especifica, se muestra como "Anónimo".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar un indicador de donaciones con el total acumulado histórico (importe total recaudado y número total de donantes), calculado a partir de un listado de donaciones individuales.
- **FR-002**: El indicador MUST integrarse en dos ubicaciones:
  - **Columna lateral derecha**: refactorizando el componente `Apoyar.astro` para mostrar el total + últimas donaciones + botón (variante compacta).
  - **Homepage**: en `BannerNoly.astro`, mostrando total + últimas donaciones + botón (variante timeline).
- **FR-002b**: La lógica de carga desde content collection y cálculo de totales MUST implementarse en un componente compartido (`DonationIndicator`) que acepte una prop `variant` para adaptar el layout (compact vs timeline).

- **FR-003**: Los datos del indicador MUST cargarse desde una content collection de Astro (`src/content/donaciones/`) mediante `getCollection()` en el frontmatter del componente, en build-time. Los datos se definen como YAML frontmatter en `src/content/donaciones/datos.md` con un array de donaciones individuales (fecha, importe, donante opcional). El total acumulado y número de donantes se calcula en el frontmatter del componente y se pasa al script del cliente mediante `define:vars`.
- **FR-004**: El indicador MUST incluir un enlace directo a Buy Me a Coffee para que el usuario pueda donar desde el indicador.
- **FR-005**: El enlace de donación en el indicador MUST abrirse en una nueva pestaña/ventana para no perder al usuario del sitio.
- **FR-006**: Si la content collection está vacía o no hay donaciones registradas, el indicador MUST mostrar "Sé el primero en apoyar el proyecto" con el botón de donación, sin romper el resto de la página.

### Key Entities *(include if feature involves data)*

- **Donación**: Representa una donación individual. Atributos: fecha (string, formato DD/MM/YYYY), importe (number), donante (string opcional, por defecto "Anónimo"). Gestionado mediante content collection de Astro (`src/content/donaciones/datos.md`) con array de donaciones en YAML frontmatter, actualizado manualmente. El total acumulado y número de donantes se deriva del array en build-time mediante `getCollection()`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El indicador de donaciones se muestra correctamente en todas las páginas que incluyen la columna lateral derecha (homepage, páginas de acorde, páginas de autor, etc.), verificable mediante inspección visual.
- **SC-002**: Los datos mostrados en el indicador se actualizan al modificar `src/content/donaciones/datos.md`, requiriendo rebuild y redeploy del sitio para que los cambios se reflejen (verificable editando el archivo, haciendo `npm run build` y desplegando).
- **SC-003**: Si la content collection está vacía o no existe entrada de donaciones, el indicador muestra el mensaje por defecto ("Sé el primero en apoyar el proyecto") sin impedir el funcionamiento del resto de la página. El build fallará si el YAML frontmatter es inválido (validación de esquema Zod en content collection).

## Assumptions

- El sistema de donaciones usará Buy Me a Coffee para procesar los pagos; la web solo muestra el indicador de recaudación y el enlace a dicha plataforma.
- Los datos de recaudación se actualizarán manualmente en `src/content/donaciones/datos.md` (no hay automatización con webhooks).
- No hay meta mensual ni barra de progreso; se muestra solo el total histórico acumulado.
- El indicador se implementa con content collection de Astro: los datos se cargan en build-time mediante `getCollection()` y los valores computados se pasan al cliente con `define:vars` en el componente `DonationIndicator.astro`.
- Para actualizar los datos hay que modificar `src/content/donaciones/datos.md` y redeployar el sitio.
- No se requiere backend ni base de datos para esta funcionalidad.
