# Quickstart: Votar Peticiones

## Prerequisitos
- Node.js instalado
- Acceso al Worker en Cloudflare Dashboard (para deploy)

## Desarrollo local

### 1. Worker
```bash
cd workers/comments-worker
npm run dev  # Worker en localhost
```

### 2. Frontend
```bash
npm run dev  # Astro en localhost:4321
```

### 3. Probar
1. Ir a `localhost:4321/pedir-copla`
2. Ver la tabla top-3 (inicialmente vacia)
3. Crear una peticion
4. Hacer click en el corazon para votar
5. Verificar que el contador sube
6. Recargar y verificar que el voto persiste
7. Intentar votar de nuevo (deberia impedirse)

## Deploy Worker

1. `cd workers/comments-worker`
2. `npx wrangler deploy`
3. Verificar endpoints:
   - `GET /top?path=/pedir-copla`
   - `POST /vote` con body `{ commentId, action, userId }`

## Estructura de archivos

```
workers/comments-worker/src/index.js  — Worker API (modificar)
src/components/comments/
  CommentsSection.astro               — Lista + heart button (modificar)
  CommentForm.astro                   — Formulario + aviso duplicados (modificar)
src/pages/pedir-copla.astro           — Pagina principal + top-3 (modificar)
src/lib/comments.ts                   — Config (sin cambios)
```
