# Worker API Contract: Votar Peticiones

**Worker URL**: `https://comments-worker.javiercorderotoscano.workers.dev`

## Endpoints

### POST `/vote`

Vota o des-vota una peticion.

**Headers**: `Content-Type: application/json`

**Body**:
```json
{
  "commentId": "1725812345678-a1b2",
  "action": "vote",
  "userId": "user_1725812345678-c3d4"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `commentId` | string | Si | ID de la peticion a votar |
| `action` | "vote"\|"unvote" | Si | Accion a realizar |
| `userId` | string | Si | ID del usuario (desde localStorage) |

**Response 200** (voto exitoso):
```json
{
  "comment": {
    "id": "1725812345678-a1b2",
    "votes": 5,
    "votedBy": ["user_123", "user_456", "..."],
    "...": "demas campos del comentario"
  },
  "hasVoted": true
}
```

**Response 409** (ya voto o voto no encontrado):
```json
{
  "error": "Already voted"
}
```
o
```json
{
  "error": "Vote not found"
}
```

**Response 404**:
```json
{
  "error": "Comment not found"
}
```

---

### GET `/top`

Obtiene las peticiones mas votadas.

**Query params**:

| Param | Tipo | Requerido | Default | Descripcion |
|-------|------|-----------|---------|-------------|
| `path` | string | Si | - | Path de la pagina (ej: `/pedir-copla`) |
| `limit` | number | No | 3 | Numero maximo de resultados |

**Response 200**:
```json
{
  "top": [
    {
      "id": "1725812345678-a1b2",
      "author": "Juan",
      "content": "Busco la copla...",
      "votes": 12,
      "date": "2026-09-08T10:00:00.000Z",
      "...": "demas campos"
    }
  ]
}
```

**Response 400** (falta path):
```json
{
  "error": "Missing required parameter: path"
}
```

---

### GET `/` (existente, sin cambios estructurales)

Retorna comments incluyendo campos `votes` y `votedBy`.

---

### POST `/` (existente, con cambio)

El comentario creado incluye `votes: 0` y `votedBy: []`.
