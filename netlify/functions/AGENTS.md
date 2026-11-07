# API del panel (`/admin/api/*`)

Netlify Functions en ESM (`.mjs`). Flujo y pestañas: `docs/operativa/panel-admin.md`.

- Sesión, GitHub y cookies pasan por `_lib.mjs`. El token de GitHub **no sale nunca** al
  navegador: va en la cookie `admin` cifrada y HttpOnly (12 h).
- `SESSION_SECRET` es obligatorio fuera de local: `_lib.mjs` falla cerrado si falta (no firma
  cookies ni el `state` del OAuth).
- `ESTUDIO_LOCAL=1` cambia la fuente de verdad al disco (guardar escribe, publicar mueve);
  sin ese flag todo va por GitHub y PRs. `ESTUDIO_SIN_LOGIN=1` es un opt-in solo local y
  exige `GITHUB_TOKEN`.
- `lista.mjs` decide las pestañas: una PR es de publicación si la rama empieza por `publica/`
  o si el cuerpo declara el archivo en `acordes/` (una corrección desde el móvil usa
  `estudio/*`).
- `publicar-local.mjs` acepta **20 fichas como máximo** por trabajo; el panel reparte en
  tandas con `src/lib/panel-lote.js`.
- No añadas endpoints que reciban el token desde el navegador ni que lean `src/content` fuera
  de `CARPETAS`.
