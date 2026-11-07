# Acordes Gaditanos

<img src="public/icons/logo.svg" alt="Acordes Gaditanos" width="120" align="right" />

**La mayor colección de acordes de guitarra del Carnaval de Cádiz.**

Aprende a tocar con tu guitarra todas las presentaciones, pasodobles, tangos, cuplés y popurrís de tus comparsas, chirigotas, coros y cuartetos favoritos.

[Sitio web](https://acordesgaditanos.com) · [Pedir una copla](https://acordesgaditanos.com/pedir-copla)

---

## ¿Qué es?

Acordes Gaditanos es un sitio **100 % estático** con más de **580 fichas** del Carnaval de Cádiz, organizadas por pieza, agrupación, autor y año. Cada ficha lleva la letra con los acordes encima de su sílaba, los acordes son interactivos (al pincharlos se abre su diagrama), incluye el vídeo de la actuación y un reproductor con **autoscroll** para seguir la copla sin soltar la guitarra.

## Features

- **Catálogo** de presentaciones, pasodobles, tangos, estribillos, cuartetas y popurrís, con listados por agrupación, autor de música, autor de letra y año del COAC.
- **Buscador en cliente** sobre un índice JSON que solo se descarga al abrir el buscador, tolerante a erratas y con sugerencias al teclear.
- **Glosario interactivo** de 529 acordes y ~1.342 posiciones, con diagramas SVG generados en build (sin imágenes externas) y transportador de semitonos.
- **Letras alternativas**: una misma música puede tener varias letras, cada una con su ficha y su URL, y con los acordes colocados sobre la métrica de la original.
- **PWA** instalable, con página offline y notificaciones push.
- **Panel privado `/admin`** para editar desde el móvil: guarda borradores, abre PRs en GitHub, publica, y trae estadísticas y comentarios.
- **Avisos** automáticos a Telegram al publicar, y a WhatsApp y X desde el ordenador.
- **SEO** con sitemap con `lastmod` real, `VideoObject` en las fichas, canonical única con barra final y más de 300 *redirects* de URLs antiguas.
- **Rendimiento**: prefetch de enlaces, view transitions nativas, cero frameworks de UI y una sola fuente de diagramas.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | [Astro](https://astro.build) 5 (SSG, `output: static`) |
| Contenido | Astro Content Collections (Markdown + Zod) |
| Estilos | PostCSS (`postcss-nesting`, `postcss-preset-env`, `postcss-csso`) |
| Iconos | `astro-icon` (`src/icons`) |
| Diagramas | SVG generados con `src/lib/diagrama.ts` |
| PWA | `@vite-pwa/astro` + Workbox |
| Panel | Netlify Functions (`netlify/functions`) + API de GitHub |
| Comentarios y push | Cloudflare Workers (`workers/`) |
| Analítica | GTM, GA4 y AdSense |
| Medición | [strobe](https://www.npmjs.com/package/@hona/strobe) (`perf/`) |

> [!NOTE]
> El sitio no tiene servidor de aplicación: las Netlify Functions solo sirven al panel `/admin`. El middleware únicamente manda `/formateadores` y `/coming-soon` a 404.

## Empezar

Requiere **Node.js 22.6+** (Astro 5 pide 18.17+, pero los scripts de auditoría usan `--experimental-strip-types`).

```sh
git clone https://github.com/javicordero/acordes-gaditanos.git
cd acordes-gaditanos
npm install
npm run dev
```

Abre `http://localhost:4321`.

### Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Build de producción en `./dist/` |
| `npm run preview` | Previsualiza el build |
| `npm run astro check` | Type-check del proyecto |

El resto de comandos son herramientas de contenido y de mantenimiento:

| Comando | Acción |
| --- | --- |
| `npm run acordes:plan` / `acordes:aplicar` | Reparte los acordes de una ficha base sobre una letra nueva |
| `npm run acordes:revisar` | Editor local en texto para colocar acordes columna a columna |
| `npm run acordes:evaluar` | Mide el reparto contra fichas hechas a mano |
| `npm run letras` | Cola de coplas pendientes de letra (ver, avanzar, auditar) |
| `npm run letra:web` / `letra:blog` / `letra:decarnaval` | Extrae una letra de una web, de un blog o de letrasdecarnaval.com |
| `npm run videos` | Audita los vídeos de YouTube y busca recambios |
| `npm run videos:detalles` | Completa fecha de subida y duración (VideoObject) |
| `npm run promover` | Pasa borradores de `borradores` a `acordes` |
| `npm run prs` | Lista y fusiona las PRs del panel |
| `npm run revisar` | Cola de revisión de fichas |
| `npm run trello` | Lee y mueve las tarjetas del tablero de trabajo |
| `npm run wa` / `npm run x` | Manda el aviso de una copla nueva por WhatsApp o X |

> [!TIP]
> No hace falta build para ver cambios: usa `npm run dev`. El build solo es necesario antes de desplegar.

## Variables de entorno

Se leen de un `.env` en la raíz (no versionado). Sin él la web arranca y compila igual; solo se paran las herramientas que las necesitan.

| Variable | Para qué |
| --- | --- |
| `GITHUB_TOKEN` | PRs del panel, `npm run prs`, publicar en local |
| `SESSION_SECRET`, `OWNER_LOGIN` | Sesión y propietario del panel `/admin` |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth de GitHub del panel |
| `TRELLO_KEY`, `TRELLO_TOKEN` (y `TRELLO_BOT_*`) | CLI de Trello |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Aviso automático de coplas nuevas |
| `VAPID_PRIVATE_KEY`, `PUSH_SEND_TOKEN` | Notificaciones push de la PWA |

Los detalles de cada flujo están en [`docs/operativa/`](docs/operativa/).

## Estructura del proyecto

```text
/
├── .agents/skills/       # Skills del agente (flujo de trabajo del proyecto)
├── .github/workflows/    # Aviso de Telegram y push al publicar
├── docs/                 # Operativa interna: panel, cancionero, avisos, SEO
├── netlify/functions/    # API del panel /admin (auth, guardar, publicar, lista…)
├── perf/                 # Benchmarks de strobe
├── public/               # Estáticos: iconos, redirects, ads.txt, offline
├── scripts/              # Letras, acordes, auditorías, avisos, Trello
├── specs/                # Especificaciones históricas de features
├── src/
│   ├── components/       # Astro: layout, page, comments, ads, ui, pwa
│   ├── content/          # acordes, otraweb, borradores, autores, donaciones
│   ├── data/             # Glosario, canales, estado de vídeos, cola de revisión
│   ├── integrations/     # Barra final en enlaces, API del panel en dev
│   ├── lib/              # Dominio puro: acordes, búsqueda, transporte, orden, letras
│   ├── pages/            # Rutas
│   ├── styles/           # CSS global
│   └── middleware.ts     # Redirecciones a 404
├── workers/              # Cloudflare Workers de comentarios y push
└── AGENTS.md             # Contexto y convenciones para trabajar en el repo
```

## Contenido

Cada acorde es un archivo Markdown en `src/content/acordes/`. Los acordes van **envueltos en etiquetas `<a>` dentro de un `<pre>`**, en la línea de encima de la letra, cada uno sobre su sílaba:

```html
<pre><a>LaM7</a>            <a>Mi7</a>               <a>Sim7</a>
Bendita suerte pal aficionao que más de un mes de
```

Un acorde puede fijar la postura con la que se abre su diagrama con `data-postura="x 0 2 2 2 4"`. En los popurrís, los cambios de cejilla a mitad de copla se marcan con `<strong>Cejilla: 4</strong>` en una línea propia.

### Frontmatter

Usa [`src/content/template.md`](src/content/template.md) como plantilla; el esquema está en [`src/content/config.ts`](src/content/config.ts):

```yaml
pieza: Pasodoble        # Pasodoble | Presentacion | Popurri | Cuarteta | Tango | Estribillo
agrupacion: Nombre de la agrupación
year: 2025
musica: Autor1, Autor2  # separados por coma
letra: Autor1, Autor2
letraTitulo: "Título de la letra alternativa"  # opcional, solo en la variante
modalidad: comparsa     # opcional
img: URL de imagen
cejilla: 1              # opcional (1-12)
video: URL YouTube embed
cover: URL              # opcional
autorCover: Nombre      # opcional
date: "DD/MM/YYYY"
fraseClave: "Frase destacada"  # opcional
destacada: 1            # opcional (orden en portada)
recomendada: true       # opcional
```

Los **slugs** (autor, agrupación) se generan a partir del nombre: minúsculas, sin tildes y con guiones. Las **letras alternativas** son fichas propias con `letraTitulo` y se agrupan por agrupación, año y tipo de pieza.

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/` | Portada: novedades y autores |
| `/lista` | Listado completo con filtros por pieza, autor, año y década |
| `/novedades` | Últimas fichas publicadas |
| `/acordes/[id]` | Ficha de un acorde |
| `/agrupacion/[agrupacionSlug]` | Acordes de una agrupación |
| `/autor/musica/[autorSlug]` | Acordes de un autor de música |
| `/autor/letra/[autorSlug]` | Acordes de un autor de letra |
| `/autores` | Todos los autores |
| `/carnaval/[year]` | Acordes de un año del COAC |
| `/glosario` | Glosario de acordes con diagramas |
| `/buscar` | Resultados de la búsqueda en cliente (`noindex`) |
| `/about`, `/contacto`, `/colaborar`, `/pedir-copla`, `/suscribirse` | Páginas de proyecto y canales |
| `/politicas/*` | Privacidad y cookies |
| `/indice-busqueda.json` | Índice del buscador |
| `/api/fetch-url` | Proxy CORS (`GET ?url=...`) |
| `/admin` | Panel privado de edición (`noindex`, sin enlaces públicos) |
| `/admin/api/*` | Netlify Functions del panel |
| `/borradores/[id]`, `/otraweb/[id]`, `/lista-otraweb` | Previsualizaciones locales de borradores e importados |

## Panel `/admin`

Panel privado desplegado con Netlify Functions, con login de GitHub restringido al propietario. Tiene editor de fichas (con el mismo `<pre>` en texto), cola de revisión, estadísticas y comentarios. Guardar abre una PR (`estudio/<slug>-<rand>`); publicar mueve el borrador a `acordes` en una rama nueva.

En local (`astro dev`) no hay PR: el panel escribe los `.md` en el proyecto y publica con `scripts/publicar-acorde.mjs`, que ajusta la fecha, pasa las auditorías y hace commit y push de cada ficha.

El flujo completo está en [`docs/operativa/panel-admin.md`](docs/operativa/panel-admin.md).

## Avisos

- **Telegram** sale solo: el workflow [`difundir.yml`](.github/workflows/difundir.yml) se dispara cuando un push a `master` añade `.md` en `src/content/acordes/`. Con `[sin aviso]` en el asunto del commit no avisa.
- **WhatsApp** y **X** se lanzan desde el PC (`npm run wa`, `npm run x`), porque no tienen API oficial y necesitan el Chrome con sesión.
- **Push** de la PWA: el mismo workflow ejecuta `scripts/push.mjs` contra el worker de suscripciones.

El formato de los mensajes y las flags de cada script están en [`docs/operativa/avisos.md`](docs/operativa/avisos.md).

## Calidad

No hay suite de tests ni linter: el type-check es `npm run astro check`. Lo que sí hay son auditorías que fallan cuando algo se rompe:

| Comando | Comprueba |
| --- | --- |
| `npm run auditar:pre` | Desenvolver y volver a envolver todas las fichas deja el mismo `<pre>` |
| `npm run auditar:acordes` | Releer y repintar no pierde ni mueve ningún acorde |
| `npm run auditar:editor` | Las operaciones de estructura del editor |
| `npm run auditar:filtros` | Los filtros y recuentos de `/lista` |
| `npm run auditar:orden` | El orden de las cards en los listados |
| `npm run auditar:letras` | La coherencia de las letras alternativas |
| `node --experimental-strip-types scripts/auditar-glosario.ts` | Todo acorde del cancionero tiene diagrama |
| `node --experimental-strip-types scripts/auditar-busqueda.ts` | El top-1 del buscador en consultas reales |
| `node scripts/auditar-enlaces.mjs` | Los enlaces internos llevan barra final (tras el build) |
| `node scripts/auditar-view-transitions.mjs` | No hay `view-transition-name` repetidos (tras el build) |
| `npm run auditar:seo` | `VideoObject` de las fichas y `lastmod` del sitemap (tras el build) |

## Despliegue

Netlify construye con `npm run build` y publica `./dist/` (ver [`netlify.toml`](netlify.toml)). Ese mismo archivo enruta `/admin/api/*` a las funciones, mantiene los 301 de `/estudio` y `/admin/stats|comentarios`, y aplica CSP y `noindex` a `/admin/*`.

Los workers de Cloudflare se despliegan a mano desde su panel. En `workers/push-worker` no hay `wrangler.toml` a propósito: uno generado desde el repo borraría los bindings de KV. `workers/comments-worker` sí lleva uno mínimo, **sin el binding `COMMENTS`**: antes de desplegarlo, mira su [`README.md`](workers/comments-worker/README.md). Las instrucciones del worker de push están en [`workers/push-worker/README.md`](workers/push-worker/README.md).

## Documentación

- [`AGENTS.md`](AGENTS.md) — reglas, comandos y mapa de documentación por tarea
- [`docs/operativa/cancionero-y-contenido.md`](docs/operativa/cancionero-y-contenido.md) — fichas, colecciones y herramientas del cancionero
- [`docs/operativa/panel-admin.md`](docs/operativa/panel-admin.md) — el panel `/admin`
- [`docs/operativa/listados-y-busqueda.md`](docs/operativa/listados-y-busqueda.md) — orden, hubs y buscador
- [`docs/operativa/glosario-y-experiencia.md`](docs/operativa/glosario-y-experiencia.md) — glosario, postura, transporte y URLs
- [`docs/operativa/avisos.md`](docs/operativa/avisos.md) — canales de avisos y push
- [`docs/operativa/seo-y-medios.md`](docs/operativa/seo-y-medios.md) — SEO, analítica, anuncios y vídeos
- [`docs/operativa/rendimiento.md`](docs/operativa/rendimiento.md) — medición con Strobe
- [`docs/operativa/adsense-experimentos.md`](docs/operativa/adsense-experimentos.md) — experimentos de AdSense
- [`docs/operativa/active-view-previo-movil.md`](docs/operativa/active-view-previo-movil.md) — experimento del anuncio móvil
- [`docs/operativa/opencode-remoto.md`](docs/operativa/opencode-remoto.md) — OpenCode desde el móvil

## Enlaces

- Sitio en producción: <https://acordesgaditanos.com>
- Documentación de Astro: <https://docs.astro.build>
