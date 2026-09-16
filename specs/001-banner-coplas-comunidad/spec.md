# Feature Specification: Banner Vuestras Coplas

**Feature Branch**: `001-banner-coplas-comunidad`

**Created**: 16/09/2026

**Status**: Draft

**Input**: User description: "Quiero crear un banner como el BannerMartin.astro pero para las coplas de la comunidad. Sería el que voy a poner ahora en el index. El título sería 'Vuestras coplas'. Inventate un par de párrafos para escribir ahí tomando de referencia el que hay. Esto va a ser de ahora hasta el COAC 2027. Pon que se pueden hacer las peticiones y el enlace a esa página en el primer párrafo. Que se pueden votar y se irán subiendo las que más votos tengan (también las que más me apetezca). Y en el segundo párrafo referencia a que me pueden donar para apoyar."

## User Scenarios & Testing

### User Story 1 - Ver banner en el index (Priority: P1)

Un usuario accede a la página de inicio y ve un banner a pantalla completa con el título "Vuestras coplas" y un texto que invita a participar haciendo peticiones y votando.

**Why this priority**: Es el elemento visual principal que comunica la nueva funcionalidad de coplas de la comunidad. Sin el banner, los usuarios no saben que pueden participar.

**Independent Test**: Puedo visitar la página de inicio y ver el banner con el título correcto, los párrafos informativos y los enlaces funcionales.

**Acceptance Scenarios**:

1. **Given** que un usuario visita `/`, **When** carga la página, **Then** ve un banner a pantalla completa con el título "Vuestras coplas"
2. **Given** que el banner está visible, **When** el usuario lee el primer párrafo, **Then** ve información sobre peticiones con un enlace a `/pedir-copla`
3. **Given** que el banner está visible, **When** el usuario lee el segundo párrafo, **Then** ve una referencia a las donaciones con un enlace de apoyo

---

### User Story 2 - Navegar a peticiones desde el banner (Priority: P1)

Un usuario ve el banner y hace clic en el enlace de peticiones para ir a la página de petición de coplas.

**Why this priority**: El enlace a peticiones es la acción principal que el banner promueve. Debe funcionar correctamente.

**Independent Test**: Puedo hacer clic en el enlace de "peticiones" dentro del banner y llegar a la página `/pedir-copla`.

**Acceptance Scenarios**:

1. **Given** que el banner muestra el enlace a peticiones, **When** el usuario hace clic, **Then** se navega a `/pedir-copla`
2. **Given** que el usuario está en móvil, **When** hace clic en el enlace, **Then** la navegación funciona correctamente

---

### User Story 3 - Navegar a donaciones desde el banner (Priority: P2)

Un usuario ve el banner y hace clic en el enlace de donación/apoyo para colaborar con el proyecto.

**Why this priority**: Las donaciones son importantes para la sostenibilidad del proyecto, pero son secundarias respecto a la participación en peticiones.

**Independent Test**: Puedo hacer clic en el enlace de "apoyar" dentro del banner y llegar a la página de donación.

**Acceptance Scenarios**:

1. **Given** que el banner muestra el enlace de donación, **When** el usuario hace clic, **Then** se navega a la página de apoyo (`/colaborar`)
2. **Given** que el banner tiene el componente de donaciones, **When** el usuario lo ve, **Then** muestra el indicador de donantes

---

### User Story 4 - Responsive en móvil (Priority: P2)

El banner se adapta correctamente a pantallas móviles, mostrando una imagen de fondo diferente y ajustando tipografía y espaciado.

**Why this priority**: Gran parte del tráfico viene de móviles. El banner debe verse bien en todos los dispositivos.

**Independent Test** puedo ver el banner en un dispositivo móvil (o simulador) y se adapta correctamente con imagen de fondo móvil y tipografía ajustada.

**Acceptance Scenarios**:

1. **Given** que un usuario visita el index en un móvil, **When** carga la página, **Then** el banner usa la imagen de fondo móvil y ajusta el tamaño de texto
2. **Given** que el banner se muestra en móvil, **When** el usuario interacts, **Then** los enlaces son fácilmente pulsables (mínimo 44px de área de toque)

---

### Edge Cases

- ¿Qué pasa si no hay donaciones registradas? El componente `DonationIndicator` ya maneja este caso mostrando "Sé el primero en apoyar el proyecto"
- ¿Qué pasa si el usuario navega desde un enlace directo al index? El banner se muestra correctamente sin importar la ruta de entrada

## Requirements

### Functional Requirements

- **FR-001**: Se DEBE crear un componente `BannerCoplasComunidad.astro` en `src/components/page/`
- **FR-002**: El componente DEBE seguir la misma estructura y estilo que `BannerMartin.astro`
- **FR-003**: El título del banner DEBE ser "Vuestras coplas"
- **FR-004**: El banner DEBE contener dos párrafos informativos
- **FR-005**: El primer párrafo DEBE mencionar que se pueden hacer peticiones con enlace a `/pedir-copla`
- **FR-006**: El primer párrafo DEBE mencionar que se pueden votar las peticiones y que las más votadas (y las que más apetezca al autor) se irán subiendo
- **FR-007**: El segundo párrafo DEBE hacer referencia a las donaciones para apoyar el proyecto
- **FR-008**: El banner DEBE incluir el componente `DonationIndicator` con variante `timeline`
- **FR-009**: El banner DEBE ser responsive con imagen de fondo desktop: `https://static.grupojoly.com/clip/e68a84a7-37c4-4bbe-a35c-f859862ca005_source-aspect-ratio_1600w_0.jpg`
- **FR-010**: El banner DEBE ocupar toda la pantalla (full viewport height) igual que los banners existentes
- **FR-011**: Se DEBE reemplazar `BannerMartin` por `BannerCoplasComunidad` en `src/pages/index.astro`
- **FR-012**: El banner DEBE tener la funcionalidad JavaScript de `setVh` para manejar el viewport en móviles
- **FR-013**: El banner DEBE usar la fuente Montserrat y los estilos CSS variables del proyecto

### Key Entities

- **Banner**: Componente visual a pantalla completa que promociona la funcionalidad de coplas de la comunidad
- **DonationIndicator**: Componente existente que muestra las donaciones recibidas y anima a donar
- **Peticiones**: Página existente donde los usuarios pueden pedir y votar coplas

## Success Criteria

### Measurable Outcomes

- **SC-001**: El banner se carga en la página de inicio sin errores de rendering
- **SC-005**: El enlace a `/pedir-copla` funciona correctamente desde el banner
- **SC-002**: El banner se adapta a pantallas móviles (< 640px) mostrando imagen de fondo alternativa
- **SC-003**: El banner ocupa el 100% del viewport en desktop y móvil
- **SC-004**: El componente `DonationIndicator` se muestra correctamente dentro del banner

## Clarifications

### Session 2026-09-16

- Q: ¿Qué imagen de fondo para el banner? → A: `https://static.grupojoly.com/clip/e68a84a7-37c4-4bbe-a35c-f859862ca005_source-aspect-ratio_1600w_0.jpg`

## Assumptions

- La imagen de fondo del banner desktop es: `https://static.grupojoly.com/clip/e68a84a7-37c4-4bbe-a35c-f859862ca005_source-aspect-ratio_1600w_0.jpg`
- Se asume que la imagen de fondo móvil también deberá proporcionarse (o se usará la misma con recorte)
- Se reutiliza el componente `DonationIndicator` existente sin modificaciones
- El enlace de donaciones apuntará a `/colaborar` (página existente)
- El banner reemplazará al `BannerMartin` en el index, no se mostrarán ambos simultáneamente
- Los estilos CSS serán idénticos a los de `BannerMartin.astro` con los ajustes de contenido necesarios
