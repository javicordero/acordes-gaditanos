# Acordes Gaditanos

<img src="public/icons/logo.svg" alt="Acordes Gaditanos" width="120" align="right" />

**La mayor colección de acordes de guitarra del Carnaval de Cádiz.**

Aprende a tocar con tu guitarra todas las presentaciones, pasodobles, tangos, cuplés y popurrís de tus comparsas, chirigotas, coros y cuartetos favoritos.

[Sitio web](https://acordesgaditanos.com)

---

## ¿Qué es?

Acordes Gaditanos es un sitio web estático con más de **470 acordes** del Carnaval de Cádiz, organizados por pieza, agrupación, autor y año. Cada ficha incluye la letra con los acordes intercalados, el vídeo de YouTube de la actuación original y un reproductor con **autoscroll** para seguir la canción sin soltar la guitarra.

## Features

- **Catálogo completo** de acordes por agrupación, autor de música, autor de letra y año (COAC).
- **Buscador** en cliente sobre todo el contenido.
- **Autoscroll** con velocidad regulable para tocar mientras se desplaza la letra.
- **Comentarios y peticiones** de coplas (Cloudflare Worker + base de datos).
- **Donaciones** y apoyo al proyecto.
- **SEO** con sitemap, metadatos, JSON-LD (`MusicComposition`) y más de 300 redirects de URLs antiguas.
- Diseño responsive, accesible y sin frameworks de UI.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | [Astro](https://astro.build) 5 (SSG, `output: static`) |
| Contenido | Astro Content Collections (Markdown + Zod) |
| Estilos | PostCSS (`postcss-nesting`, `postcss-preset-env`, `postcss-csso`) |
| Iconos | `astro-icon` (`src/icons`) |
| Sitemap | `@astrojs/sitemap` |
| Backend | Cloudflare Worker (`workers/comments-worker`) |
| Analytics / Ads | GTM, Google Analytics, AdSense |

> [!NOTE]
> El sitio es 100% estático: no hay servidor de aplicación. El middleware solo redirige `/formateadores` y `/coming-soon` a 404.

## Empezar

Requiere **Node.js 18.17+** o **20+**.

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

> [!TIP]
> No hace falta build para ver cambios: usa `npm run dev`. El build solo es necesario antes de desplegar.

## Estructura del proyecto

```text
/
├── public/               # Estáticos: favicon, fuentes, redirects, og-image, ads.txt
├── src/
│   ├── components/       # Componentes Astro (layout, page, comments, ads, ui)
│   ├── content/          # Acordes y autores en Markdown + config.ts + template.md
│   ├── icons/            # Iconos para astro-icon
│   ├── layouts/          # Layouts base
│   ├── lib/              # Constantes (CONFIG, ANALYTICS, SEO)
│   ├── pages/            # Rutas (incluye rutas dinámicas)
│   ├── styles/           # CSS global
│   └── middleware.ts     # Redirecciones a 404
├── workers/              # Cloudflare Worker de comentarios
└── specs/                # Especificaciones de features (Spec Kit)
```

## Contenido

Cada acorde es un archivo Markdown en `src/content/acordes/`. Los acordes se escriben **envueltos en etiquetas `<a>` dentro de un `<pre>`**, con la línea de acordes encima de la letra:

```html
<pre><a>LaM7</a>            <a>Mi7</a>               <a>Sim7</a>
Bendita suerte pal aficionao que más de un mes de
```

### Frontmatter

Usa [`src/content/template.md`](src/content/template.md) como plantilla. El esquema está definido en [`src/content/config.ts`](src/content/config.ts):

```yaml
pieza: Pasodoble        # Pasodoble | Presentacion | Popurri | Cuarteta | Tango | Estribillo
agrupacion: Nombre de la agrupación
year: 2025
musica: Autor1, Autor2  # separados por coma
letra: Autor1, Autor2
modalidad: comparsa
img: URL de imagen
cejilla: 1              # opcional (1-12)
video: URL YouTube embed
cover: URL              # opcional
autorCover: Nombre      # opcional
date: "DD/MM/YYYY"
fraseClave: "Frase destacada"  # opcional
```

Los **slugs** (autor, agrupación) se generan automáticamente a partir del nombre: minúsculas, sin tildes y con guiones.

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/acordes/[id]` | Ficha de un acorde |
| `/autor/musica/[autorSlug]` | Acordes de un autor de música |
| `/autor/letra/[autorSlug]` | Acordes de un autor de letra |
| `/agrupacion/[agrupacionSlug]` | Acordes de una agrupación |
| `/carnaval/[year]` | Acordes de un año del COAC |
| `/buscar` | Búsqueda en cliente |
| `/admin/stats` | Estadísticas internas |
| `/api/fetch-url` | Proxy CORS (`GET ?url=...`) |

## Despliegue

El sitio es estático: ejecuta `npm run build` y publica el contenido de `./dist/`. El Worker de comentarios y estadísticas se despliega por separado:

```sh
cd workers/comments-worker
npm install
npm run deploy
```

## Enlaces

- Sitio en producción: <https://acordesgaditanos.com>
- Documentación de Astro: <https://docs.astro.build>
