# Plan de Implementacion: Votar Peticiones

**Feature**: 007-votar-peticiones
**Date**: 08/09/2026

## Contexto Tecnico

- **Stack**: Astro 5.x SSG, Cloudflare Worker + KV, vanilla JS client-side
- **Worker actual**: `workers/comments-worker/src/index.js` (248 lineas)
- **KV structure**: Key `comments:/pedir-copla` → array de objetos comment
- **Comment schema actual**: `{ id, path, author, content, date, isAdmin, completed, parentId }`
- **Frontend**: `CommentForm.astro`, `CommentsSection.astro`, `comments.ts`

## Que se necesita cambiar

### Worker (`workers/comments-worker/src/index.js`)

1. **Nuevo campo `votes` y `votedBy`** al crear comentario (POST `/`):
   - `votes: 0` (default)
   - `votedBy: []` (default)
   
2. **Nuevo endpoint `POST /vote`** (PATCH con body `{ commentId, action: "vote"|"unvote", userId }`):
   - Validar que `commentId` y `userId` estan presentes
   - Buscar el comentario en todos los keys KV (como hace PATCH existente)
   - Si `action === "vote"`:
     - Verificar que `userId` no esta en `votedBy` → si esta, retornar 409
     - Incrementar `votes`, agregar `userId` a `votedBy`
   - Si `action === "unvote"`:
     - Verificar que `userId` esta en `votedBy` → si no esta, retornar 409
     - Decrementar `votes`, remover `userId` de `votedBy`
   - Retornar `{ comment: updatedComment, hasVoted: boolean }`

3. **Nuevo endpoint `GET /top`** (query param `?path=/pedir-copla&limit=3`):
   - Obtener todos los comentarios del path
   - Filtrar: solo raiz (`!parentId`), no completados (`!completed`), `votes >= 1`
   - Ordenar: `votes` desc, luego `date` desc (desempate)
   - Limitar a `limit` (default 3)
   - Retornar `{ top: [...] }`

4. **Migracion de datos**: Los comentarios existentes no tienen `votes`/`votedBy`. El Worker debe manejar esto:
   - Al leer, si `votes` es undefined → tratar como 0
   - Al leer, si `votedBy` es undefined → tratar como []

### Frontend

5. **Heart button en CommentsSection.astro** (junto a cada comentario raiz):
   - Icono de corazon (SVG inline o unicode ❤️)
   - Contador de votos al lado
   - Clase `comment-vote-btn--active` cuando ya voto
   - Click → llamar a `/vote` con `{ commentId, action, userId }`
   - Actualizar contador visualmente sin recargar toda la lista
   - Obtener/crear `userId` desde localStorage

6. **Tabla top-3 en pedir-copla.astro**:
   - Nuevo componente `TopPeticiones.astro` o funcion inline
   - Posicion: encima de `.form-section` (antes del `<h2>Escribe tu petición</h2>`)
   - Mostrar top 3 peticiones con votes > 0
   - Si no hay votos: "Aun no hay votos"
   - Cada entrada: contenido de la peticion + contador de votos + boton ir a la peticion
   - Fetch a `/top?path=/pedir-copla`

7. **User ID en localStorage**:
   - Al cargar la pagina, comprobar si `localStorage.getItem('userId')` existe
   - Si no, generar uno: `user_${Date.now()}-${Math.random().toString(36).slice(2,6)}`
   - Guardar en localStorage
   - Este ID se usa para votar

8. **Aviso de duplicados en CommentForm.astro**:
   - Nuevo div `.form-duplicate-warning` justo encima del input de nombre
   - Texto: "Echa un vistazo a las peticiones que ya hay. Si encuentras la tuya, vota para que suba en la clasificacion."
   - Estilo: fondo amarillo suave, borde izquierdo naranja, padding, font-size 0.85rem

### CSS (`:global()`)

9. **Nuevas clases en CommentsSection.astro**:
   - `.comment-vote-btn` — estilo del boton de voto
   - `.comment-vote-btn--active` — estado cuando ya voto (corazon relleno)
   - `.comment-votes-count` — contador de votos
   - `.top-peticiones` — contenedor de la tabla top 3
   - `.top-peticiones__item` — cada entrada
   - `.top-peticiones__empty` — estado vacio
   - `.form-duplicate-warning` — aviso en el formulario

## Orden de implementacion

| # | Tarea | Dependencias |
|---|-------|-------------|
| 1 | Worker: campos votes/votedBy en POST | Ninguna |
| 2 | Worker: endpoint POST /vote | 1 |
| 3 | Worker: endpoint GET /top | 1 |
| 4 | Worker: manejar migracion (valores undefined) | 1 |
| 5 | Frontend: userId en localStorage | Ninguna |
| 6 | Frontend: heart button en CommentsSection | 1, 2, 5 |
| 7 | Frontend: TopPeticiones | 3, 5 |
| 8 | Frontend: aviso duplicados en CommentForm | Ninguna |
| 9 | CSS: todos los estilos nuevos | 6, 7, 8 |
| 10 | Testing manual completo | Todos |

## Riesgos

- **KV sin votes/votedBy en datos existentes**: Mitigado con default en Worker y frontend
- **Race condition al votar**: KV es eventualmente consistente, pero para este caso de uso es aceptable (1 voto por usuario)
- **localStorage borrado**: El usuario "pierde" su identidad y puede votar de nuevo. Aceptado como limitacion conocida.

## Constitucion

- **Static-First**: Cumplido. Todo el JS de votacion es client-side. El Worker es SSG-friendly (sirve datos via fetch).
- **Spanish-First**: Todos los textos en espanol.
- **Build Discipline**: No hacer build hasta commit final.
