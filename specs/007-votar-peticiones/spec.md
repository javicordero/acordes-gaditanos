# Feature Specification: Votar Peticiones

**Feature Branch**: `007-votar-peticiones`

**Created**: 08/09/2026

**Status**: Draft

**Input**: User description: "Los usuarios puedan votar peticiones de otros usuarios. Aparece una tabla justo encima de 'Escribe tu peticion' con las peticiones mas votadas. El usuario no puede votar mas de una vez una peticion. Indicar al usuario esta funcionalidad para que sepa que puede votar."

## Clarifications

### Session 2026-09-08

- Q: Visual del boton de voto → A: Icono de corazon que se rellena al votar, con contador al lado (Opcion B)
- Q: Indicar al usuario que revise peticiones existentes → A: Mostrar un aviso/tooltip indicando que revise las peticiones actuales antes de crear una nueva, ya que si repite una peticion existente los votos se dividen y no se acumulan en la clasificacion
- Q: Empates en la tabla → A: Desempatar por fecha de creacion (la mas reciente primero)
- Q: Clasificacion inicial sin votos → A: Las peticiones con 0 votos no aparecen en la tabla. Solo se muestran peticiones con >= 1 voto. Si no hay ninguna con votos, se muestra un mensaje indicando que aun no hay votos.
- Q: Actualizacion en tiempo real de la tabla top 3 → A: Solo se actualiza al recargar la pagina o al votar uno mismo. Sin WebSocket ni polling.
- Q: Texto del aviso de duplicados → A: "Echa un vistazo a las peticiones que ya hay. Si encuentras la tuya, vota para que suba en la clasificacion." Se muestra como alerta/recomendacion visual dentro del formulario, justo encima del input de nombre. No es un alert del navegador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Votar una peticion (Priority: P1)

Un usuario visita `/pedir-copla` y ve la lista de peticiones. Junto a cada peticion hay un icono de corazon con un contador de votos. El usuario pulsa el corazon para votar una peticion que le interesa. El corazon se rellena visualmente y el contador aumenta. Si el usuario ya voto esa peticion, no puede volver a votar.

**Why this priority**: Es la funcionalidad central del sistema de votacion. Sin ella, no hay interaccion ni ranking.

**Independent Test**: Puede probarse accediendo a `/pedir-copla`, votando una peticion y verificando que el contador aumenta. Recargar la pagina y verificar que el voto persiste y no se puede votar de nuevo.

**Acceptance Scenarios**:

1. **Given** que el usuario esta en `/pedir-copla`, **When** pulsa el boton de votar en una peticion, **Then** el contador de votos de esa peticion aumenta en 1 y se muestra visualmente que ya ha votado.
2. **Given** que el usuario ya voto una peticion, **When** intenta votarla de nuevo, **Then** se indica que ya ha votado y no se incrementa el contador.
3. **Given** que el usuario vota una peticion, **When** recarga la pagina, **Then** su voto persiste y sigue indicado como votada.
4. **Given** que el usuario no ha votado ninguna peticion, **When** visita la pagina, **Then** puede votar cualquier peticion que desee.

---

### User Story 2 - Tabla de peticiones mas votadas (Priority: P1)

En la pagina `/pedir-copla`, justo encima del bloque "Escribe tu peticion", se muestra una tabla o bloque con las peticiones mas votadas. Las peticiones se ordenan por numero de votos de mayor a menor. Se muestran las top 3 peticiones con mas votos. Las peticiones marcadas como completadas no aparecen en esta tabla.

**Why this priority**: Da visibilidad a las peticiones populares y anima a los usuarios a votar y a crear peticiones de calidad.

**Independent Test**: Puede probarse votando varias peticiones y verificando que la tabla se actualiza con el orden correcto.

**Acceptance Scenarios**:

1. **Given** que hay peticiones con votos, **When** el usuario visita `/pedir-copla`, **Then** ve una tabla con las 3 peticiones mas votadas ordenadas de mayor a menor numero de votos.
2. **Given** que hay menos de 3 peticiones con votos, **When** se muestra la tabla, **Then** se muestran todas las que tengan al menos 1 voto.
3. **Given** que no hay peticiones con votos, **When** se muestra la tabla, **Then** se muestra un mensaje indicando que aun no hay votos o la tabla no se muestra.
4. **Given** que un usuario vota una peticion, **When** la tabla se actualiza, **Then** la peticion votada sube de posicion si corresponde.
5. **Given** que una peticion en la tabla es marcada como completada, **When** se actualiza la tabla, **Then** la peticion completada desaparece de la tabla de mas votadas.

---

### User Story 3 - Indicar la funcionalidad de votar (Priority: P2)

El usuario que visita `/pedir-copla` por primera vez necesita saber que puede votar peticiones. Se muestra un texto o indicador que comunique esta funcionalidad de forma clara pero no intrusiva. Ademas, se incluye un aviso indicando que revise las peticiones existentes antes de crear una nueva, ya que si crea una peticion duplicada los votos se dividen entre ambas en lugar de acumularse en una sola.

**Why this priority**: Sin comunicar la funcionalidad, los usuarios no sabran que pueden votar y la feature no se usara.

**Independent Test**: Puede probarse visitando `/pedir-copla` por primera vez (sin cookies/localStorage) y verificando que se muestra el indicador.

**Acceptance Scenarios**:

1. **Given** que el usuario visita `/pedir-copla`, **When** carga la pagina, **Then** ve un indicador o texto que le informa de que puede votar peticiones.
2. **Given** que el usuario ya ha votado alguna peticion, **When** visita la pagina, **Then** el indicador puede cambiar o desaparecer (ya sabe que puede votar).
3. **Given** que el indicador es visible, **When** el usuario interactua con el, **Then** no bloquea la interaccion con el resto de la pagina.
4. **Given** que el usuario va a crear una peticion, **When** esta en el formulario, **Then** se muestra una alerta visual (no un alert del navegador) justo encima del input de nombre con el texto "Echa un vistazo a las peticiones que ya hay. Si encuentras la tuya, vota para que suba en la clasificacion."

---

### User Story 4 - Anti-abuso: un voto por usuario por peticion (Priority: P1)

El sistema debe impedir que un usuario vote mas de una vez la misma peticion. La identificacion se basa en el navegador del usuario (localStorage o similar). No se requiere autenticacion.

**Why this priority**: Sin esta restriccion, el sistema de votos no tiene credibilidad y puede ser manipulado.

**Independent Test**: Puede probarse votando una peticion, borrando localStorage, votando de nuevo (deberia permitirse), y votando la misma sin borrar (deberia impedirse).

**Acceptance Scenarios**:

1. **Given** que un usuario voto una peticion, **When** intenta votarla de nuevo en la misma sesion, **Then** se impide el voto y se muestra un indicador de que ya voto.
2. **Given** que un usuario voto una peticion, **When** borra los datos del navegador (localStorage) y vota de nuevo, **Then** se permite el voto (nueva identidad).
3. **Given** que un usuario voto la peticion A, **When** vota la peticion B, **Then** se permite (el limite es por peticion, no global).

---

## Scope

### In Scope

- Boton de voto con icono de corazon (se rellena al votar) y contador en cada peticion
- Contador de votos por peticion
- Tabla de peticiones mas votadas (top 3) encima del formulario
- Persistencia de votos en el Worker (KV)
- Restriccion de un voto por usuario por peticion (localStorage)
- Indicador/texto comunicando la funcionalidad de votar
- Aviso indicando revisar peticiones existentes para evitar duplicados que dividen votos (alerta visual dentro del formulario, encima del input de nombre)
- Actualizacion de la tabla al votar o recargar (sin tiempo real para otros usuarios)

### Out of Scope

- Sistema de autenticacion de usuarios
- Votaciones negativas (downvotes)
- Comentarios en las votaciones
- Tabla de clasificacion global de usuarios por votos
- Notificaciones a los autores de peticiones cuando reciben votos
- Votar respuestas (solo peticiones raiz)

## Assumptions

- La identificacion del usuario se basa en un ID generado y almacenado en localStorage. No se requiere login.
- Los votos se almacenan en Cloudflare KV junto con los comentarios, usando la misma key `comments:/pedir-copla`.
- Cada comentario (peticion) tiene un campo `votes` (number) y la lista de IDs que ya votaron se almacena en un campo `votedBy` (string[]) o en una key separada en KV.
- La tabla de "mas votadas" muestra las top 3 peticiones raiz con mas votos (>= 1 voto). Las peticiones completadas se excluyen. Desempate por fecha de creacion (mas reciente primero).
- El indicador de funcionalidad es un texto breve en la zona de intro, no un popup o tooltip.
- La tabla se actualiza solo al votar o recargar la pagina. Sin actualizacion en tiempo real para otros usuarios.

## Success Criteria

- Los usuarios pueden votar peticiones con un solo clic
- Un usuario no puede votar la misma peticion mas de una vez (en la misma sesion)
- La tabla de mas votadas se actualiza al votar o recargar la pagina
- El 100% de los usuarios que visitan la pagina saben que pueden votar (testable por presencia del indicador)
- El sistema soporta al menos 100 votos por peticion sin degradacion perceptible
- Los votos persisten entre sesiones (recarga de pagina)

## Key Entities

- **Peticion**: Comentario raiz con contenido, autor, fecha, votes (number, default 0), votedBy (string[] de IDs de usuario, default [])
- **Usuario**: Identificado por un ID auto-generado almacenado en localStorage
- **Voto**: Asociacion entre un usuario (ID) y una peticion (comment ID). Un usuario puede tener maximo 1 voto por peticion.
- **Tabla de votos**: Lista de las top 3 peticiones raiz con >= 1 voto, ordenadas por numero de votos (desc) y fecha de creacion (desc como desempate). Peticiones completadas excluidas.
