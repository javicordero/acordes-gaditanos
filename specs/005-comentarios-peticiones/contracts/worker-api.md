# API Contract: Comments Worker

**Date**: 31/08/2026
**Base URL**: `https://comments-worker.{subdomain}.workers.dev`

## Endpoints

### GET / — Obtener comentarios

Obtiene todos los comentarios de una página.

**Request**:

```
GET /?path=/pedir-copla
```

| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `path` | string | Sí | Ruta de la página |

**Response 200**:

```json
{
  "comments": [
    {
      "id": "1725110400000-a3f2",
      "path": "/pedir-copla",
      "author": "Juan",
      "content": "Pedir la bombonera",
      "date": "2026-08-31T12:00:00.000Z",
      "isAdmin": false,
      "completed": false,
      "parentId": null
    }
  ]
}
```

**Response 400** (falta `path`):

```json
{
  "error": "Missing required parameter: path"
}
```

---

### POST / — Crear comentario

Crea un nuevo comentario o petición.

**Request**:

```
POST /
Content-Type: application/json
Authorization: Bearer {token}  (opcional, solo admin)

{
  "path": "/pedir-copla",
  "author": "Juan",
  "content": "Pedir la bombonera del 2024",
  "parentId": null
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `path` | string | Sí | Ruta de la página |
| `author` | string | No | Nombre del autor (vacío = "Anónimo") |
| `content` | string | Sí | Texto del comentario |
| `parentId` | string \| null | No | ID del comentario padre (null = petición raíz) |

**Response 201**:

```json
{
  "comment": {
    "id": "1725110400000-a3f2",
    "path": "/pedir-copla",
    "author": "Juan",
    "content": "Pedir la bombonera del 2024",
    "date": "2026-08-31T12:00:00.000Z",
    "isAdmin": false,
    "completed": false,
    "parentId": null
  }
}
```

**Response 400** (validación):

```json
{
  "error": "Content is required"
}
```

**Response 429** (rate limit):

```json
{
  "error": "Rate limit exceeded. Try again later.",
  "retryAfter": 3600
}
```

**Response 503** (KV no disponible):

```json
{
  "error": "Service temporarily unavailable. Please try again."
}
```

---

### PATCH /:id — Actualizar comentario

Actualiza un comentario existente (solo admin).

**Request**:

```
PATCH /:id
Content-Type: application/json
Authorization: Bearer {token}

{
  "completed": true
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `completed` | boolean | No | Marcar/desmarcar como completada |
| `content` | string | No | Editar contenido (futuro) |

**Response 200**:

```json
{
  "comment": {
    "id": "1725110400000-a3f2",
    "completed": true
  }
}
```

**Response 401** (no autenticado):

```json
{
  "error": "Unauthorized"
}
```

---

### DELETE /:id — Eliminar comentario

Elimina un comentario y todas sus respuestas anidadas (solo admin).

**Request**:

```
DELETE /:id
Authorization: Bearer {token}
```

**Response 200**:

```json
{
  "deleted": 3
}
```

**Response 401** (no autenticado):

```json
{
  "error": "Unauthorized"
}
```

---

## Rate Limiting

- **Límite**: 5 requests POST por IP por hora
- **Implementación**: In-memory counter con TTL en el Worker
- **Response**: 429 con `retryAfter` en segundos

## Headers

| Header | Descripción |
|--------|-------------|
| `Authorization` | `Bearer {ADMIN_TOKEN}` — requerido para PATCH y DELETE |
| `Content-Type` | `application/json` — requerido para POST y PATCH |
| `X-Forwarded-For` | IP del cliente (proporcionado por Cloudflare) |
