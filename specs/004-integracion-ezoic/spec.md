# Feature Specification: Integración Ezoic para gestión de anuncios

**Feature Branch**: `004-integracion-ezoic`

**Created**: 19/06/2026

**Status**: Draft

**Input**: User description: "Vamos a crear una especificacion para integrar ezoic en nuestro proyecto ya que adsense no nos aprueba el dominio para mostrar anuncios. Empezamos por el ads.txt y despues seguimos con mas. Para que Ezoic gestione su archivo ads.txt, tendra que crear y configurar una redireccion al Ads.txt Manager: /ads.txt > https://srv.adstxtmanager.com/19390/acordesgaditanos.com"

## Clarifications

### Session 2026-06-19

- Q: ¿Dónde está registrado/administrado el dominio acordesgaditanos.com? → A: En Netlify (DNS gestionado desde Netlify)
- Q: ¿Ya tienes cuenta en Ezoic? → A: Sí, la cuenta ya está creada

## User Scenarios & Testing

### User Story 1 - Configurar redirección ads.txt para Ezoic (Priority: P1)

El administrador del sitio necesita delegar la gestión del archivo ads.txt a Ezoic para que puedan verificar el dominio y comenzar a servir anuncios.

**Why this priority**: Sin la redirección ads.txt, Ezoic no puede verificar la propiedad del dominio ni gestionar los anuncios. Es el requisito mínimo de entrada.

**Independent Test**: Acceder a `https://acordesgaditanos.com/ads.txt` debe redirigir (301) a `https://srv.adstxtmanager.com/19390/acordesgaditanos.com`. Verificable con curl o navegador.

**Acceptance Scenarios**:

1. **Given** un visitante accede a `/ads.txt`, **When** la petición llega al servidor, **Then** se redirige con código 301 a la URL de Ezoic Ads.txt Manager
2. **Given** el administrador despliega el sitio en Netlify, **When** se verifica el archivo `_redirects`, **Then** la regla `/ads.txt` está presente y apunta a la URL correcta

---

### User Story 2 - Integración completa con Ezoic via DNS (Priority: P2)

El administrador completa la integración con Ezoic apuntando los DNS del dominio a Ezoic para que gestionen los anuncios, velocidad y experiencia de usuario.

**Why this priority**: La redirección ads.txt permite la verificación inicial, pero Ezoic necesita control DNS para servir anuncios completos y optimizar el sitio.

**Independent Test**: Verificar que los registros DNS del dominio apuntan a los nameservers de Ezoic y que el sitio sigue accesible con los anuncios visibles.

**Acceptance Scenarios**:

1. **Given** el administrador cambia los nameservers en el proveedor de dominio, **When** se propagan los DNS, **Then** el sitio sigue siendo accesible en `https://acordesgaditanos.com`
2. **Given** Ezoic tiene control DNS, **When** se accede al sitio, **Then** los anuncios de Ezoic se renderizan sin romper el layout existente

---

### User Story 3 - Verificación de anuncios visibles sin afectar experiencia (Priority: P3)

El visitante del sitio debe ver anuncios relevantes sin que estos degraden la experiencia de navegación (rendimiento, usabilidad, contenido tapado).

**Why this priority**: Los anuncios generan ingresos pero no deben ahuyentar a los usuarios. El equilibrio es clave para la retención.

**Independent Test**: Navegar por varias páginas del sitio (acordes, agrupaciones, búsqueda) y verificar que los anuncios se muestran sin superponerse al contenido principal ni ralentizar la carga.

**Acceptance Scenarios**:

1. **Given** un usuario visita una página de acorde, **When** la página carga completamente, **Then** los anuncios aparecen en posiciones designadas sin ocultar la letra ni los acordes
2. **Given** un usuario navega entre páginas, **When** cambia de ruta, **Then** el tiempo de carga no aumenta más de un 20% respecto a la línea base sin anuncios

---

### Edge Cases

- ¿Qué ocurre si la URL de Ezoic Ads.txt Manager cambia en el futuro?
- ¿Cómo afecta el bloqueador de anuncios del usuario a la visualización del contenido?
- ¿Qué pasa si los nameservers de Ezoic caen? ¿Hay un plan de fallback?
- ¿Cómo se maneja la propagación DNS durante el cambio (periodo de corte)?

## Requirements

### Functional Requirements

- **FR-001**: El sitio DEBE redirigir `/ads.txt` a `https://srv.adstxtmanager.com/19390/acordesgaditanos.com` con código 301
- **FR-002**: El sitio DEBE seguir funcionando correctamente (SSG, rutas, contenido) después de la integración DNS con Ezoic
- **FR-003**: Los anuncios DEBEN insertarse sin modificar el contenido existente de los acordes (letra, acordes en `<pre>`)
- **FR-004**: El administrador DEBE poder verificar que Ezoic está sirviendo anuncios correctamente mediante su panel de control
- **FR-005**: El sitio DEBE mantener su funcionalidad de autoscroll y búsqueda cliente sin interferencias de los anuncios
- **FR-006**: El sistema DEBE desactivar cualquier bloqueo de anuncios propio (ad-blocker) que impida la verificación de Ezoic

### Key Entities

- **Redirección ads.txt**: Regla en `public/_redirects` que delega el archivo ads.txt a Ezoic. Entidad crítica para la verificación del dominio.
- **Nameservers Ezoic**: Servidores DNS de Ezoic que gestionan el tráfico del dominio. Se configuran desde el panel DNS de Netlify.
- **Scripts de anuncios**: Código JavaScript insertado por Ezoic para renderizar anuncios. Debe integrarse sin romper el HTML generado por Astro.
- **Panel Ezoic**: Interfaz web donde el administrador configura ubicaciones de anuncios, tipos, y métricas.

## Success Criteria

### Measurable Outcomes

- **SC-001**: La redirección `/ads.txt` → Ezoic responde con 301 en menos de 5 segundos desde cualquier ubicación
- **SC-002**: El sitio mantiene un Lighthouse Performance Score ≥ 85 después de integrar Ezoic (vs línea base)
- **SC-003**: Los anuncios se renderizan en menos de 3 segundos desde que el usuario llega a la página
- **SC-004**: Ezoic verifica exitosamente el dominio y comienza a servir anuncios en un plazo de 48 horas desde el cambio DNS
- **SC-005**: 100% de las páginas principales (acordes, agrupaciones, autor, búsqueda) muestran anuncios sin romper el layout

## Assumptions

- El sitio está desplegado en Netlify con soporte para `_redirects`
- El dominio está registrado y gestionado desde Netlify, los nameservers se cambian desde el panel DNS de Netlify
- Ya existe una cuenta en Ezoic con ID 19390, solo falta la configuración DNS
- Los anuncios no interferirán con el contenido principal gracias a las opciones de layout de Ezoic
- No se necesita backend adicional ni cambios en el código de Astro para la integración básica
- Ezoic ofrece un plan gratuito o de prueba que cubre las necesidades iniciales del sitio
- La redirección ads.txt ya está implementada en `public/_redirects`
