# Feature Specification: Comentarios y Peticiones de Coplas

**Feature Branch**: `005-comentarios-peticiones`

**Created**: 31/08/2026

**Status**: Draft

**Input**: User description: "Implementar una pagina para que los usuarios puedan dejar comentarios y hagan peticiones de coplas. Sistema de comentarios estilo YouTube/Blogger con hilos de respuesta, visibilidad publica, sin base de datos propia. Los comentarios se almacenan en Cloudflare Worker + KV. El administrador puede responder con badge especial, marcar peticiones como completadas, y eliminar comentarios. Los usuarios pueden poner nombre opcional y contestarse entre ellos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Peticion de copla (Priority: P1)

Un usuario quiere solicitar una copla que no esta disponible en la web. Visita la pagina `/pedir-copla`, rellena un formulario con su nombre (opcional) y el texto de la peticion, y la envia. La peticion aparece inmediatamente en la lista publica de peticiones junto con las demas.

**Why this priority**: Es la funcionalidad principal del sistema. Sin peticiones, no hay comentarios ni interaccion.

**Independent Test**: Puede probarse completamente accediendo a `/pedir-copla`, enviando una peticion y verificando que aparece en la lista.

**Acceptance Scenarios**:

1. **Given** que el usuario esta en `/pedir-copla`, **When** rellena el formulario y pulsa "Enviar", **Then** la peticion aparece en la lista publica con su nombre (o "Anonimo" si no pone nombre).
2. **Given** que el usuario no rellena el campo de comentario, **When** pulsa "Enviar", **Then** se muestra un error de validacion y la peticion no se envia.
3. **Given** que la peticion se ha enviado correctamente, **When** el usuario recarga la pagina, **Then** la peticion sigue visible en la lista.

---

### User Story 2 - Respuesta a peticion (Priority: P1)

Un usuario ve una peticion que le interesa y quiere responder o sumarse. Pulsa "Responder" bajo la peticion, escribe su respuesta con nombre opcional, y la envia. La respuesta aparece anidada bajo la peticion original.

**Why this priority**: La interaccion entre usuarios es clave para que el sistema sea util y comunitario.

**Independent Test**: Puede probarse enviando una peticion y luego una respuesta a ella, verificando que aparece anidada.

**Acceptance Scenarios**:

1. **Given** que hay una peticion visible, **When** el usuario pulsa "Responder" y envia una respuesta, **Then** la respuesta aparece anidada debajo de la peticion original.
2. **Given** que un usuario responde a una respuesta existente, **When** envia la respuesta, **Then** se anida correctamente en el hilo (respuesta a respuesta).
3. **Given** que el usuario no pone nombre, **When** envia una respuesta, **Then** aparece como "Anonimo".

---

### User Story 3 - Respuesta del administrador (Priority: P2)

El administrador de la web quiere responder a peticiones de usuarios. Se autentica con un token secreto en el panel `/admin/comentarios`. Cuando responde a una peticion con el token activo, su respuesta se muestra con un badge especial "Propietario" que la identifica claramente.

**Why this priority**: La identificacion del administrador es importante para generar confianza y comunicar oficialmente las respuestas.

**Independent Test**: Puede probarse autenticandose en el panel admin, respondiendo a una peticion y verificando que aparece el badge "Propietario".

**Acceptance Scenarios**:

1. **Given** que el administrador esta autenticado en `/admin/comentarios`, **When** responde a una peticion, **Then** su respuesta se muestra con el badge "Propietario".
2. **Given** que un usuario normal responde a una peticion, **When** envia la respuesta, **Then** su respuesta NO muestra badge de administrador.
3. **Given** que el administrador responde sin autenticarse, **When** envia la respuesta, **Then** se muestra como un comentario normal (sin badge).

---

### User Story 4 - Marcar peticion como completada (Priority: P2)

El administrador ha subido los acordes de una copla que fue pedida. Quiere marcar esa peticion como completada para que los usuarios sepan que ya esta disponible. Desde el panel admin o desde la propia peticion, cambia el estado a "Completada". La peticion muestra un badge verde "Completada" con un link directo al acorde.

**Why this priority**: Cierra el ciclo de la peticion y genera satisfaccion al usuario que la pido.

**Independent Test**: Puede probarse marcando una peticion como completada y verificando que el badge y el link aparecen correctamente.

**Acceptance Scenarios**:

1. **Given** que una peticion esta pendiente, **When** el administrador la marca como completada, **Then** la peticion muestra un badge verde "Completada" con un link al acorde correspondiente.
2. **Given** que una peticion esta completada, **When** un usuario la ve, **Then** puede hacer click en el link y ser redirigido a la pagina del acorde.
3. **Given** que el administrador quiere desmarcar una peticion, **When** la desmarca desde el panel admin, **Then** vuelve a estado "Pendiente".

---

### User Story 5 - Eliminar comentario (Priority: P3)

El administrador quiere eliminar un comentario que es spam, ofensivo o incorrecto. Desde el panel admin, pulsa "Eliminar" junto al comentario y este desaparece de la lista.

**Why this priority**: Moderacion es importante pero critico solo con spam o contenido inapropiado.

**Independent Test**: Puede probarse eliminando un comentario y verificando que ya no aparece.

**Acceptance Scenarios**:

1. **Given** que hay un comentario visible, **When** el administrador lo elimina desde el panel admin, **Then** el comentario desaparece de la lista y de la pagina publica.
2. **Given** que un usuario intenta eliminar un comentario sin autenticacion, **When** intenta la accion, **Then** la operacion es rechazada.

---

### User Story 6 - Acceso a peticiones desde el sitio (Priority: P2)

El usuario descubre la funcionalidad de peticiones a traves de distintos puntos de entrada en la web: una card en la columna derecha de las paginas de acordes, un boton flotante en el index y la busqueda, un enlace en el footer, y un enlace en el mensaje de "sin resultados" de busqueda.

**Why this priority**: La discoverability es clave para que los usuarios utilicen la funcionalidad.

**Independent Test**: Puede probarse verificando que todos los enlaces llevan a `/pedir-copla` y que el FAB se puede cerrar y no vuelve a aparecer.

**Acceptance Scenarios**:

1. **Given** que el usuario esta en una pagina de acorde, **When** ve la columna derecha, **Then** hay una card "Pedir esta copla" con un enlace a `/pedir-copla`.
2. **Given** que el usuario esta en el index o en buscar, **When** ve la pagina, **Then** hay un boton flotante (FAB) con enlace a `/pedir-copla`.
3. **Given** que el usuario cierra el FAB, **When** recarga la pagina, **Then** el FAB no vuelve a aparecer (guardado en localStorage).
4. **Given** que el usuario hace una busqueda sin resultados, **When** se muestra el mensaje de "sin resultados", **Then** hay un enlace a `/pedir-copla`.
5. **Given** que el usuario esta en cualquier pagina, **When** mira el footer, **Then** hay un enlace "Pedir copla" a `/pedir-copla`.

---

### Edge Cases

- Que ocurre cuando un usuario envia multiples peticiones identicas? Se permiten (no hay deduplicacion automatica).
- Que ocurre cuando el servicio de Cloudflare KV no esta disponible? Se muestra un mensaje de error amigable y se anima a intentar de nuevo.
- Que ocurre cuando un usuario intenta responder a un comentario que ha sido eliminado? Se muestra un mensaje indicando que el comentario ya no existe.
- Que ocurre cuando se elimina un comentario que tiene respuestas anidadas? Se eliminan el comentario y todas sus respuestas.
- Que ocurre cuando el token de administrador es incorrecto? Se rechaza la operacion con un mensaje de error.
- Que ocurre cuando un comentario tiene muchas respuestas anidadas? Se muestra con indentacion progresiva, con un limite visual razonable.
- Que ocurre cuando el formulario se envia multiples veces rapidamente? Se desactiva el boton de envio mientras se procesa.
- Que ocurre cuando un usuario supera el limite de 5 peticiones por hora? Se muestra un mensaje indicando que debe esperar antes de enviar otra peticion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar una pagina publica `/pedir-copla` con la lista de todas las peticiones ordenadas por fecha de creacion (mas recientes primero).
- **FR-002**: El sistema MUST permitir a los usuarios crear peticiones con un campo de texto obligatorio y un campo de nombre opcional.
- **FR-003**: El sistema MUST permitir a los usuarios responder a peticiones y a otras respuestas, creando hilos de conversacion.
- **FR-003b**: El sistema MUST recargar automaticamente la lista de comentarios tras cada envio exitoso, sin requerir recarga manual de la pagina.
- **FR-004**: El sistema MUST almacenar cada comentario con: identificador unico, ruta de la pagina, autor (opcional), contenido, fecha, indicador de administrador, estado de completado, e identificador del comentario padre (para respuestas).
- **FR-005**: El sistema MUST mostrar un badge "Propietario" en los comentarios enviados por el administrador autenticado.
- **FR-006**: El sistema MUST permitir al administrador marcar peticiones como "Completadas" con un badge visual y un link al acorde correspondiente.
- **FR-007**: El sistema MUST permitir al administrador eliminar comentarios. Al eliminar un comentario, se eliminan tambien todas sus respuestas anidadas.
- **FR-008**: El sistema MUST autenticar al administrador mediante un token secreto configurado como variable de entorno.
- **FR-009**: El sistema MUST guardar el token de administrador en localStorage del navegador para no tener que re-introducirlo en cada sesion.
- **FR-010**: El sistema MUST validar que el campo de comentario no este vacio antes de permitir el envio.
- **FR-011**: El sistema MUST mostrar un mensaje de error amigable cuando el servicio de almacenamiento no este disponible.
- **FR-012**: El sistema MUST desactivar el boton de envio mientras se procesa una peticion para evitar envios duplicados.
- **FR-021**: El sistema MUST limitar el envio de peticiones a 5 por IP por hora. Si se excede el limite, se muestra un mensaje indicando que debe esperar.
- **FR-013**: El sistema MUST incluir una card "Pedir esta copla" en la columna derecha de cada pagina de acorde.
- **FR-014**: El sistema MUST incluir un boton flotante (FAB) en las paginas de index y busqueda con enlace a `/pedir-copla`.
- **FR-015**: El sistema MUST permitir al usuario cerrar el FAB, recordando esta preferencia en localStorage.
- **FR-016**: El sistema MUST incluir un enlace a `/pedir-copla` en el footer de todas las paginas.
- **FR-017**: El sistema MUST incluir un enlace a `/pedir-copla` en el mensaje de "sin resultados" de la pagina de busqueda.
- **FR-018**: El sistema MUST renderizar respuestas anidadas con indentacion visual progresiva.
- **FR-019**: El sistema MUST panel administrativo en `/admin/comentarios` que liste todas las peticiones con opciones de moderacion.
- **FR-020**: El sistema MUST comunicar el estado de la peticion (pendiente/completada) de forma visual clara.

### Key Entities

- **Comentario/Peticion**: Representa una peticion de copla o una respuesta. Atributos: identificador unico, ruta de la pagina, autor (texto opcional), contenido (texto), fecha de creacion, indicador de es administrador (booleano), estado completado (booleano), identificador del comentario padre (referencia a otro comentario o nulo para peticiones raiz).
- **Sesion de administrador**: Representa la autenticacion del administrador. Atributos: token de autenticacion, estado de autenticacion (activo/inactivo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los usuarios pueden crear una peticion en menos de 30 segundos desde que visitan `/pedir-copla`.
- **SC-002**: Las respuestas aparecen anidadas correctamente y la lista se recarga automaticamente en menos de 2 segundos despues del envio.
- **SC-003**: El administrador puede autenticarse y responder a una peticion en menos de 1 minuto.
- **SC-004**: El 100% de las peticiones enviadas aparecen en la lista publica sin perdida de datos.
- **SC-005**: Los badges de "Propietario" y "Completada" son claramente visibles y distinguibles para el usuario promedio.
- **SC-006**: El FAB es dismissable y su estado se persiste correctamente entre sesiones.
- **SC-007**: Todos los puntos de acceso al sistema de peticiones (card, FAB, footer, busqueda) funcionan correctamente y llevan a `/pedir-copla`.
- **SC-008**: El sistema maneja errores de conexion mostrando mensajes amigables sin perdida de datos del formulario.

## Clarifications

### Session 2026-08-31

- Q: Rate limiting y spam → A: 5 peticiones por IP por hora
- Q: Eliminación de comentarios con respuestas → A: Eliminar el comentario y todas sus respuestas anidadas
- Q: Mecanismo de actualización de comentarios → A: La lista se recarga automáticamente tras cada envío (fetch automático)

## Assumptions

- Los usuarios tienen conexion a internet estable para interactuar con el sistema de comentarios.
- El servicio de Cloudflare Worker y KV esta disponible y funciona correctamente.
- El administrador conoce el token secreto para autenticarse.
- El sistema de acordes existente sigue funcionando igual (los comentarios son una capa adicional).
- No se requiere moderacion automatica de spam en la v1 (el administrador modera manualmente).
- Las peticiones no tienen limite de caracteres razonable (se asume contenido de texto normal, no abuso).
- El boton flotante (FAB) solo aparece en paginas index y busqueda, no en paginas de acordes individuales.
- La pagina `/pedir-copla` es la unica ubicacion donde se muestran todas las peticiones; en acordes solo hay la card de acceso.
- No se requiere notificacion por email al administrador de nuevas peticiones en la v1.
