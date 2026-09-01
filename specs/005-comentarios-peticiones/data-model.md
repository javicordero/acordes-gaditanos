# Data Model: Comentarios y Peticiones de Coplas

**Date**: 31/08/2026
**Feature**: 005-comentarios-peticiones

## Entities

### Comentario

Representa una petición de copla o una respuesta a ella.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | string | Sí | Identificador único (generado en el Worker, formato: timestamp + random) |
| `path` | string | Sí | Ruta de la página donde se creó (siempre `/pedir-copla`) |
| `author` | string | No | Nombre del autor. Si está vacío, se muestra "Anónimo" |
| `content` | string | Sí | Texto de la petición o respuesta |
| `date` | string (ISO 8601) | Sí | Fecha y hora de creación |
| `isAdmin` | boolean | Sí | `true` si fue enviado por el administrador autenticado |
| `completed` | boolean | Sí | `true` si la petición fue marcada como completada (solo aplica a peticiones raíz) |
| `parentId` | string \| null | Sí | ID del comentario padre. `null` para peticiones raíz |

### Reglas de negocio

- `content` no puede estar vacío (validación en Worker y frontend)
- `author` es opcional; si vacío → "Anónimo"
- `isAdmin` solo puede ser `true` si el request incluye header `Authorization` con token válido
- `completed` solo tiene efecto en peticiones raíz (`parentId === null`)
- `parentId` apunta a un `id` existente o es `null`

### Transiciones de estado

```
Petición raíz:
  [Pendiente] → [Completada] (admin marca)
  [Completada] → [Pendiente] (admin desmarca)

Comentario/respuesta:
  [Visible] → [Eliminado] (admin elimina, incluye cascada de respuestas)
```

## Storage Layout (Cloudflare KV)

```
Key: "comments:/pedir-copla"
Value: JSON array de objetos Comentario
```

**Ejemplo**:

```json
[
  {
    "id": "1725110400000-a3f2",
    "path": "/pedir-copla",
    "author": "Juan",
    "content": "Pedir la bombonera del 2024",
    "date": "2026-08-31T12:00:00.000Z",
    "isAdmin": false,
    "completed": false,
    "parentId": null
  },
  {
    "id": "1725110460000-b7c1",
    "path": "/pedir-copla",
    "author": "",
    "content": "¡Yo también la quiero!",
    "date": "2026-08-31T12:01:00.000Z",
    "isAdmin": false,
    "completed": false,
    "parentId": "1725110400000-a3f2"
  },
  {
    "id": "1725110520000-d9e4",
    "path": "/pedir-copla",
    "author": "",
    "content": "¡Ya la tenemos subida! Mira el enlace arriba.",
    "date": "2026-08-31T12:02:00.000Z",
    "isAdmin": true,
    "completed": false,
    "parentId": "1725110400000-a3f2"
  }
]
```

## Relationships

```
Comentario (raíz) ←── Comentario (respuesta)
     ↑                        ↑
     │                        │
     └── parentId = null       └── parentId = id del padre
```

- Una petición raíz puede tener N respuestas
- Una respuesta puede tener N respuestas (anidamiento recursivo)
- Al eliminar un comentario, se eliminan todas sus respuestas (cascada)
