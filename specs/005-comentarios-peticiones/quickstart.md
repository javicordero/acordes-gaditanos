# Quickstart: Comentarios y Peticiones de Coplas

**Date**: 31/08/2026
**Feature**: 005-comentarios-peticiones

## Prerrequisitos

- Node.js 18+
- Cuenta de Cloudflare (gratuita)
- Wrangler CLI instalado (`npm install -g wrangler`)

## Pasos de implementación

### 1. Crear el Cloudflare Worker

```bash
cd workers/comments-worker
npm init -y
npm install wrangler --save-dev
npx wrangler kv:namespace create COMMENTS
```

Copiar el `namespace_id` del output y añadirlo a `wrangler.toml`.

### 2. Configurar variables de entorno

```bash
npx wrangler secret put ADMIN_TOKEN
# Introducir un token seguro (ej: generar con crypto.randomUUID())
```

### 3. Desplegar el Worker

```bash
npx wrangler deploy
```

El Worker estará disponible en `https://comments-worker.{tu-subdomain}.workers.dev`.

### 4. Configurar el frontend

Añadir la URL del Worker en `src/lib/comments.ts`:

```typescript
export const COMMENTS_CONFIG = {
  workerUrl: 'https://comments-worker.{tu-subdomain}.workers.dev',
  namespace: 'comments:/pedir-copla',
};
```

### 5. Crear componentes frontend

Los componentes están en `src/components/comments/`:

- `CommentsSection.astro` — Contenedor principal
- `CommentItem.astro` — Cada comentario
- `CommentForm.astro` — Formulario de envío
- `PedirCoplaFAB.astro` — Botón flotante
- `PedirCoplaCard.astro` — Card de right column

### 6. Crear páginas

- `src/pages/pedir-copla.astro` — Página dedicada
- `src/pages/admin/comentarios.astro` — Panel admin

### 7. Integrar en el sitio existente

- Añadir `PedirCoplaCard` en la right column de `[id].astro`
- Añadir `PedirCoplaFAB` en `index.astro` y `buscar.astro`
- Añadir enlace "Pedir copla" en `Footer.astro`
- Añadir enlace en el mensaje de "sin resultados" de `buscar.astro`

### 8. Verificar

```bash
npm run dev
# Visitar http://localhost:4321/pedir-copla
# Enviar una petición
# Verificar que aparece en la lista
# Visitar http://localhost:4321/admin/comentarios
# Autenticarse con el token
# Responder a la petición
# Verificar que aparece el badge "Propietario"
```

## Estructura de archivos final

```
workers/comments-worker/
├── src/index.js
├── wrangler.toml
└── package.json

src/
├── components/comments/
│   ├── CommentsSection.astro
│   ├── CommentItem.astro
│   ├── CommentForm.astro
│   ├── PedirCoplaFAB.astro
│   └── PedirCoplaCard.astro
├── pages/
│   ├── pedir-copla.astro
│   └── admin/comentarios.astro
└── lib/comments.ts

specs/005-comentarios-peticiones/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/worker-api.md
```
