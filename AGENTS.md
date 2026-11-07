# AGENTS.md

## Reglas del proyecto
- Commits y mensajes siempre en español.
- **UI:** nunca subrayar al pasar el cursor. Si el enlace ya está subrayado en reposo, conserva ese subrayado.
- No añadir skills genéricas al repositorio salvo que se vayan a usar de verdad. OpenCode descubre las skills de `.agents/skills`; no hace falta mantener aquí una lista duplicada.

## Comandos y verificación
| Comando | Uso |
|---|---|
| `npm run dev` | Astro en `localhost:4321` |
| `npm run build` | Build en `./dist/` |
| `npm run preview` | Preview del build |
| `npm run astro check` | Único check/lint configurado |

- **El puerto 4321 está reservado al usuario.** Nunca arrancar `dev` ni `preview` ahí. Si el servidor del usuario ya está activo, no arrancar otro Astro: comparten `.astro/data-store.json` y se pisan. Para probar, usar el servidor del usuario; si no está activo, `npm run dev -- --port 4322`. Preview, si se necesita, en 4323.
- No ejecutar `npm run build` tras cada cambio: solo si lo pide el usuario o justo antes de un commit. No ejecutar `preview` salvo que lo pida el usuario.
- No hay scripts de test ni lint. El build comprueba que compila, no que el comportamiento funcione.

## Mapa de documentación por tarea
Lee el documento indicado **solo cuando trabajes en esa parte**. Comprueba el código actual: las referencias técnicas pueden quedarse desactualizadas.

- **Crear o editar fichas, formato de acordes, colecciones, letras alternativas, importación y herramientas del cancionero:** [`docs/operativa/cancionero-y-contenido.md`](docs/operativa/cancionero-y-contenido.md), `src/content/template.md` y la skill específica (`create-acorde`, `chord-formatting`, `letra-alternativa`, etc.).
- **Panel `/admin`:** [`docs/operativa/panel-admin.md`](docs/operativa/panel-admin.md); los invariantes del front y de la API están en `src/scripts/AGENTS.md` y `netlify/functions/AGENTS.md` (se cargan solos al abrir esos archivos).
- **Avisos y notificaciones push:** [`docs/operativa/avisos.md`](docs/operativa/avisos.md); leer antes de tocar avisos.
- **Listados, orden, hubs y búsqueda:** [`docs/operativa/listados-y-busqueda.md`](docs/operativa/listados-y-busqueda.md).
- **Glosario, postura, autoscroll, URLs, prefetch y transiciones:** [`docs/operativa/glosario-y-experiencia.md`](docs/operativa/glosario-y-experiencia.md).
- **SEO, analítica, anuncios, vídeos y estáticos:** [`docs/operativa/seo-y-medios.md`](docs/operativa/seo-y-medios.md); experimentos en [`docs/operativa/adsense-experimentos.md`](docs/operativa/adsense-experimentos.md) y [`docs/operativa/active-view-previo-movil.md`](docs/operativa/active-view-previo-movil.md).
- **Rendimiento (Strobe):** [`docs/operativa/rendimiento.md`](docs/operativa/rendimiento.md).
- **OpenCode remoto (servidor en el PC y móvil):** [`docs/operativa/opencode-remoto.md`](docs/operativa/opencode-remoto.md).
- **Trello:** seguir el flujo de la skill `trello`; no duplicar sus pasos aquí.

Los `AGENTS.md` anidados de `src/content`, `src/scripts`, `netlify/functions` y `scripts` recogen los invariantes de cada carpeta y se cargan solos al abrir un archivo de ahí: no hace falta leerlos a mano.

## Arquitectura en una línea
Sitio Astro 100 % estático (SSG) con colecciones de contenido. Los detalles de arquitectura y sus invariantes están en las referencias operativas anteriores; no cargar el manual completo para tareas que no lo necesiten.
