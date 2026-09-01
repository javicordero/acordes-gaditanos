# Research: Comentarios y Peticiones de Coplas

**Date**: 31/08/2026
**Feature**: 005-comentarios-peticiones

## R1: Cloudflare Worker para API de comentarios

**Decision**: Crear un Worker independiente (`comments-worker`) en lugar de extender el Worker existente de stats.

**Rationale**: Separación de responsabilidades. El Worker de stats ya tiene su propio ciclo de vida. Un Worker dedicado permite despliegue, escalabilidad y mantenimiento independientes.

**Alternatives considered**:
- Extender el Worker de stats: Rechazado porque mezclaría lógica de analytics con comentarios.
- Usar Cloudflare Pages Functions: Menos flexible para KV y routing personalizado.

## R2: Cloudflare KV como almacenamiento

**Decision**: Usar Cloudflare KV con una key por página (JSON array de comentarios).

**Rationale**: KV es ideal para este caso de uso:
- Lecturas frecuentes (usuarios ven comentarios), escrituras ocasionales (nuevos comentarios)
- Datos por página (1 key = 1 página = todos sus comentarios)
- Tier gratuito suficiente (100k lecturas/día)
- Consistencia eventual aceptable para comentarios (no es crítico tiempo real)

**Alternatives considered**:
- Cloudflare D1 (SQLite): Más potente pero innecesario para este caso. KV es más simple.
- Cloudflare Durable Objects: Overkill para comentarios estáticos.
- Firestore/Firebase: Requiere cuenta Google y SDK externo.

## R3: Estructura de datos en KV

**Decision**: Key = `comments:{path}`, Value = JSON array de objetos comentario.

```json
{
  "comments:/pedir-copla": [
    {
      "id": "abc123",
      "path": "/pedir-copla",
      "author": "Juan",
      "content": "Pedir la bombonera",
      "date": "2026-08-31T12:00:00Z",
      "isAdmin": false,
      "completed": false,
      "parentId": null
    }
  ]
}
```

**Rationale**: Simple, una lectura por página, sin joins. Para el volumen esperado (<1000 comentarios/día), el tamaño del JSON por página no será problemático.

**Alternatives considered**:
- Key por comentario: Más complejo para listar, requiere múltiples lecturas.
- D1 con SQL: Más overhead innecesario.

## R4: Autenticación del administrador

**Decision**: Token secreto en variable de entorno del Worker (`ADMIN_TOKEN`). El frontend guarda el token en `localStorage` y lo envía en header `Authorization: Bearer {token}`.

**Rationale**: Simple, sin dependencias externas. Para un solo administrador, un token compartido es suficiente.

**Alternatives considered**:
- OAuth2/GitHub Login: Overkill para un solo admin.
- Password simple: Menos seguro que un token de 32+ caracteres.

## R5: Rate limiting

**Decision**: Rate limiting por IP usando Cloudflare Worker en memoria (in-memory counter con TTL).

**Rationale**: Cloudflare Workers tienen acceso a `request.headers['cf-connecting-ip']`. Un counter en memoria con TTL de 1 hora es suficiente para el tráfico esperado. No requiere almacenamiento persistente.

**Limitación**: El rate limiting en Workers es por instancia, no global. Con múltiples instancias, un usuario podría superar el límite si sus requests van a diferentes instancias. Para el volumen esperado (~5 peticiones/día), esto no es un problema real.

**Alternatives considered**:
- Cloudflare Rate Limiting (producto): Requiere plan pago.
- KV para rate limiting: Más persistente pero innecesario para 5 req/hora.

## R6: Eliminación de comentarios con respuestas

**Decision**: Eliminar en cascada: cuando se elimina un comentario, se eliminan todas sus respuestas anidadas.

**Rationale**: Evita comentarios huérfanos. Simplifica la lógica de renderizado. Comportamiento estándar (YouTube funciona así).

**Implementación**: Al eliminar, el Worker filtra el array eliminando el comentario y todos los que tengan `parentId` que apunte al eliminado (recursivamente).

## R7: Auto-refresh de comentarios

**Decision**: Fetch automático de comentarios tras cada envío exitoso.

**Rationale**: Experiencia tipo YouTube/Blogger como pidió el usuario. No requiere WebSocket ni polling.

**Implementación**: Tras un POST exitoso, el frontend ejecuta un GET para recargar la lista completa. Loading state mientras se recarga.

## R8: FAB dismissable

**Decision**: Botón flotante (FAB) en index y buscar, con cierre persistido en `localStorage`.

**Rationale**: El usuario pidió que se pueda borrar. localStorage es suficiente para persistir esta preferencia.

**Key**: `fab-pedir-copla-closed` = `true` cuando se cierra.
