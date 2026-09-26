# Modelo de Datos: Votar Peticiones

## Entidad: Comment (extendida)

```typescript
interface Comment {
  id: string;            // "1725812345678-a1b2"
  path: string;          // "/pedir-copla"
  author: string;        // "Juan" | "" (anonimo)
  content: string;       // texto de la peticion
  date: string;          // ISO 8601
  isAdmin: boolean;      // badge "Propietario"
  completed: boolean;    // completada por admin
  parentId: string|null; // null = raiz (peticion), string = respuesta
  votes: number;         // NUEVO - default 0
  votedBy: string[];     // NUEVO - IDs de usuario, default []
}
```

### Campos nuevos

| Campo | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `votes` | `number` | `0` | Numero total de votos recibidos |
| `votedBy` | `string[]` | `[]` | Lista de IDs de usuario que ya votaron |

### Migracion

Los comentarios existentes no tienen estos campos. El Worker debe:
- Al leer: si `votes === undefined` → tratar como `0`
- Al leer: si `votedBy === undefined` → tratar como `[]`
- Al guardar: los campos siempre presentes

## Entidad: User

```typescript
interface UserId {
  id: string;  // "user_1725812345678-a1b2"
}
```

- Almacenado en `localStorage` bajo key `userId`
- Generado una vez por navegador
- No requiere autenticacion

## Endpoints

### POST `/vote`

```typescript
// Request
{ commentId: string, action: "vote"|"unvote", userId: string }

// Response 200
{ comment: Comment, hasVoted: boolean }

// Response 409
{ error: "Already voted" | "Vote not found" }

// Response 404
{ error: "Comment not found" }
```

### GET `/top`

```typescript
// Query params
?path=/pedir-copla&limit=3

// Response 200
{ top: Comment[] }
```

### GET `/` (existente, sin cambios)

```typescript
// Response 200
{ comments: Comment[] }
// Cada comment incluye votes y votedBy
```

### POST `/` (existente, con cambios)

```typescript
// Body incluye automaticamente
{ votes: 0, votedBy: [] }
```

## Reglas de negocio

1. Un usuario solo puede votar una vez por peticion
2. Solo se puede votar en peticiones raiz (`parentId === null`)
3. La tabla top muestra solo peticiones con `votes >= 1` y `completed === false`
4. Desempate por fecha de creacion (mas reciente primero)
5. El voto es por usuario (localStorage), no por sesion
