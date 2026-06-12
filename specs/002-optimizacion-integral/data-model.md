# Data Model: Optimización integral del sitio

## Entidades de schema.org (nuevas)

### ItemList (JSON-LD)
| Campo | Tipo | Origen | Descripción |
|---|---|---|---|
| `@context` | string | Fijo: `https://schema.org` | Contexto del schema |
| `@type` | string | Fijo: `ItemList` | Tipo de schema |
| `itemListElement` | `ListItem[]` | Generado desde colección | Lista de elementos ordenados |

### ItemList → ListItem
| Campo | Tipo | Origen | Descripción |
|---|---|---|---|
| `@type` | string | Fijo: `ListItem` | Tipo de elemento de lista |
| `position` | number | Índice en array (1-based) | Posición en la lista |
| `name` | string | `acorde.data.pieza + " - " + acorde.data.agrupacion` | Nombre del acorde |
| `item` | string (URL) | `Astro.site + "/acordes/" + acorde.slug` | URL del acorde |

### Article (JSON-LD)
| Campo | Tipo | Origen | Descripción |
|---|---|---|---|
| `@context` | string | Fijo | Contexto |
| `@type` | string | Fijo: `Article` | Tipo |
| `headline` | string | `data.pieza + " - " + data.agrupacion` | Título del artículo |
| `description` | string | `data.modalidad` o descripción generada | Descripción |
| `datePublished` | string (ISO 8601) | Convertir `data.date` (DD/MM/YYYY) | Fecha de publicación |
| `author` | `Person[]` | `data.musicaList` / `data.letraList` | Autores |
| `image` | string (URL) | `data.img` | Imagen destacada |
| `inLanguage` | string | Fijo: `es-ES` | Idioma |

### WebPage (JSON-LD)
| Campo | Tipo | Origen | Descripción |
|---|---|---|---|
| `@context` | string | Fijo | Contexto |
| `@type` | string | Fijo: `WebPage` | Tipo |
| `name` | string | Generado de `data` | Nombre de la página |
| `description` | string | Generado de `data` | Descripción |
| `url` | string (URL) | `Astro.url` | URL canónica |
| `inLanguage` | string | Fijo: `es-ES` | Idioma |
| `isPartOf` | `WebSite` | `{ "@id": "https://acordesgaditanos.com/#website" }` | Sitio al que pertenece |

## Meta tags HTML (nuevas)

### article:published_time
- **Formato:** `<meta property="article:published_time" content="YYYY-MM-DDTHH:mm:ssZ">`
- **Origen:** Campo `date` del frontmatter (DD/MM/YYYY)
- **Conversión:** `DD/MM/YYYY` → `YYYY-MM-DDT00:00:00Z`

### article:author
- **Formato:** `<meta property="article:author" content="Nombre del autor">`
- **Origen:** `data.musicaList` (primario) y/o `data.letraList`
- **Multiplicidad:** Múltiples autores → múltiples meta tags. Si música = letra, un solo tag.

## Entidades modificadas

### AcordeCard (componente)
| Campo actual | Cambio | Descripción |
|---|---|---|
| `<Image>` sin `unoptimized` | Añadir `unoptimized` | Indicar a astro:assets que la imagen es externa |
| width/height hardcoded | Mantener | Ya existen (480x320) |
| `loading="lazy"` | Mantener | Ya existe |

### YoutubeCard (componente)
| Estado actual | Cambio | Descripción |
|---|---|---|
| `loading="lazy"` nativo en iframe | Reemplazar por Intersection Observer | Más control sobre el threshold de carga |
| iframe directo | Placeholder + carga bajo demanda | Mejor rendimiento inicial |

## Archivos a eliminar

| Ruta | Red | Estado actual |
|---|---|---|
| `src/components/right-column/anuncios/AnunciosGuitarra.astro` | Amazon | Comentado |
| `src/components/right-column/anuncios/AnunciosLibros.astro` | Amazon | Comentado |
| `src/components/right-column/anuncios/AnunciosTech.astro` | Amazon | Comentado |
| `src/components/right-column/anuncios/AnunciosHogar.astro` | Amazon | Comentado |
| `src/components/right-column/Native1x1.astro` | Mondiad | Comentado |
| `src/components/right-column/Banner315x300.astro` | Mondiad | Sin usar |
| `src/components/ads/BannerDesktopYMovilHilitop.astro` | Hilitop | Comentado |
| `src/components/ads/InPagePushHilitop.astro` | Hilitop | Comentado |
| `src/components/ads/PopunderHilitop.astro` | Hilitop | Comentado |
| `src/components/ads/VideoSliderHilitop.astro` | Hilitop | Comentado |
| `src/components/ads/InlineShein.astro` | Shein | Sin usar |

## Páginas afectadas

| Ruta | Modificaciones |
|---|---|
| `src/pages/acordes/[id].astro` | + Article schema, + WebPage schema, + article:published_time/author meta tags, + Image unoptimized |
| `src/pages/carnaval/[year].astro` | + ItemList schema |
| `src/pages/agrupacion/[agrupacionSlug].astro` | + ItemList schema |
| `src/pages/autor/musica/[autorSlug].astro` | + ItemList schema |
| `src/pages/autor/letra/[autorSlug].astro` | + ItemList schema |
| `src/layouts/Layout.astro` | Sin cambios |
| `src/components/right-column/YoutubeCard.astro` | + IntersectionObserver lazy-load |
