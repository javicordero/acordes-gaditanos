# Feature Specification: Optimización integral del sitio

**Feature Directory**: `specs/002-optimizacion-integral`

**Created**: 2026-06-12

**Status**: Draft

## Clarifications

### Session 2026-06-12

- Q: ¿Cómo manejar imágenes externas con astro:assets? → A: Opción A - Solo dimensiones + lazy. Usar `<Image unoptimized>` con width/height explícitos y loading lazy. Sin conversión a WebP/AVIF. Las imágenes se mantienen como URLs externas.
- Q: ¿Incluir meta tags fb:app_id y fb:admins? → A: No. Se omiten del alcance. Solo implementar `article:published_time` y `article:author`.
- Q: ¿Alcance del lazy-load en la columna derecha? → A: Opción B - Solo componentes pesados. Aplicar Intersection Observer solo a YoutubeCard y componentes con recursos externos. Los componentes ligeros (SitiosDeInteres, Apoyar, AcordesRecomendados) cargan normalmente.

**Input**: User description: "Optimización integral del sitio basada en análisis previo"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - SEO en listados con datos estructurados (Priority: P1)

Como propietario del sitio,
quiero que las páginas de listado (`/carnaval/[year]`, `/agrupacion/[slug]`, `/autor/*`) tengan marcado ItemList,
para que Google pueda mostrar los resultados como carousels enriquecidos en el SERP y aumentar el CTR orgánico.

**Why this priority**: Impacta directamente la visibilidad en buscadores y el tráfico orgánico de las páginas de listado, que son puertas de entrada a las páginas de acordes.

**Independent Test**: Puede probarse usando la herramienta Prueba de resultados enriquecidos de Google en cualquier URL de listado y verificando que el ItemList schema se detecta correctamente.

**Acceptance Scenarios**:

1. **Given** una página de listado (`/carnaval/2024`),
   **When** se inspecciona el HTML,
   **Then** contiene un bloque JSON-LD con `@type: "ItemList"` que lista todos los acordes de esa página con sus nombres y enlaces.
2. **Given** el ItemList schema presente,
   **When** Google indexa la página,
   **Then** puede generar un carousel enriquecido en los resultados de búsqueda.
3. **Given** una página de listado con 0 resultados,
   **When** se genera el schema,
   **Then** el ItemList contiene `itemListElement` vacío (lista sin elementos).

---

### User Story 2 - SEO en páginas de acordes con meta semántica (Priority: P1)

Como propietario del sitio,
quiero que las páginas de acordes tengan schema Article + WebPage además de MusicComposition,
junto con la meta tag `article:published_time` y `article:author`,
para maximizar la señalización semántica a Google y mejorar el preview en redes sociales.

**Why this priority**: El schema adicional mejora el entendimiento semántico de Google y los meta tags de Facebook mejoran el CTR en redes sociales.

**Independent Test**: Puede probarse usando el validador de Schema.org y el Debugger de Facebook en cualquier URL de acorde.

**Acceptance Scenarios**:

1. **Given** una página de acorde (`/acordes/pasodoble-los-ejemplo-2024`),
   **When** se inspecciona el HTML,
   **Then** contiene tres bloques JSON-LD: `MusicComposition`, `Article` y `WebPage`.
2. **Given** la misma página,
   **When** se inspeccionan los meta tags,
   **Then** incluye `article:published_time` con la fecha del acorde y `article:author` con el nombre del autor musical/letrista.
3. **Given** la página compartida en Facebook/WhatsApp,
   **When** se genera el preview,
   **Then** muestra correctamente la imagen, título y descripción gracias a los meta tags Open Graph completos.

---

### User Story 3 - Carga perezosa de contenido below-fold (Priority: P2)

Como usuario del sitio,
quiero que los iframes de YouTube y el contenido de la columna derecha se carguen solo cuando sean visibles,
para que la página cargue más rápido y la experiencia de navegación sea más fluida.

**Why this priority**: Mejora Core Web Vitals (LCP, INP) y la experiencia del usuario en dispositivos móviles.

**Independent Test**: Puede probarse abriendo la página en Chrome DevTools > Network y verificando que los iframes y componentes de la columna derecha no solicitan recursos hasta que se hacen visibles al hacer scroll.

**Acceptance Scenarios**:

1. **Given** una página de acorde con iframe de YouTube,
   **When** la página carga inicialmente,
   **Then** el iframe no carga su contenido (no hay solicitud a youtube.com) hasta que el usuario hace scroll hasta la sección de video.
2. **Given** la columna derecha con componentes de anuncios y recomendaciones,
   **When** la página carga inicialmente,
   **Then** los componentes below-fold no solicitan recursos hasta que entran en el viewport.
3. **Given** un usuario con `prefers-reduced-motion`,
   **When** se activa el lazy-load,
   **Then** la carga perezosa sigue funcionando pero sin animaciones de aparición.

---

### User Story 4 - Optimización de imágenes via astro:assets (Priority: P2)

Como propietario del sitio,
quiero migrar las imágenes de los acordes (campo `img` en frontmatter) a usar `astro:assets` con transformaciones optimizadas,
para reducir el peso de las imágenes y mejorar el LCP y la velocidad de carga general.

**Why this priority**: Las imágenes sin optimizar son una de las causas principales de LCP alto y mala experiencia en móviles.

**Independent Test**: Puede probarse comparando el peso en bytes de una imagen antes y después de la migración, y verificando que la etiqueta `<img>` generada incluye `srcset` y tamaños responsivos.

**Acceptance Scenarios**:

1. **Given** una página de acorde con una imagen en su frontmatter,
   **When** se genera la página,
   **Then** la imagen se sirve a través del pipeline de `astro:assets` con formato WebP o AVIF, dimensiones optimizadas y `srcset` para diferentes tamaños de pantalla.
2. **Given** la imagen optimizada,
   **When** se carga en un dispositivo móvil (320px-768px),
   **Then** se sirve la variante de menor tamaño que cubre el ancho del contenedor.
3. **Given** una imagen externa (hotelink, Amazon, etc.),
   **When** no se puede pasar por el pipeline de assets,
   **Then** se mantiene la URL original pero se añaden atributos `loading="lazy"`, `decoding="async"` y dimensiones explícitas.

---

### User Story 5 - Limpieza de componentes de anuncios inactivos (Priority: P3)

Como mantenedor del código,
quiero eliminar los componentes de anuncios que están inactivos (comentados o sin usar),
para reducir el peso del código fuente, mejorar la mantenibilidad y evitar confusiones futuras.

**Why this priority**: No aporta valor directo al usuario pero reduce deuda técnica y facilita el desarrollo futuro.

**Independent Test**: Puede probarse verificando que no existen imports ni referencias a los componentes eliminados en ninguna página .astro.

**Acceptance Scenarios**:

1. **Given** el repositorio actual,
   **When** se buscan referencias a los componentes de Amazon (AnunciosTech, AnunciosHogar),
   **Then** no existe ningún import o uso activo en páginas.
2. **Given** los componentes AnunciosGuitarra y AnunciosLibros,
   **When** se verifica su contenido,
   **Then** existen como stubs desactivados (sin renderizar) con imports comentados en páginas.
2. **Given** el mismo criterio para Mondiad (Native1x1, Banner315x300), Hilitop (BannerDesktopYMovilHilitop, InPagePushHilitop, PopunderHilitop, VideoSliderHilitop) y Shein (InlineShein),
   **When** se buscan referencias en páginas .astro y componentes,
   **Then** no existe ningún import o uso activo ni comentado.
3. **Given** los archivos de componentes eliminados,
   **When** se verifica el sistema de archivos,
   **Then** los archivos `.astro` correspondientes ya no existen en `src/components/`.

---

### Edge Cases

- ¿Qué ocurre si una imagen del frontmatter tiene una URL rota o inaccesible?
  El pipeline de astro:assets debe fallar gracefulmente y mostrar un placeholder o la imagen original sin procesar.
- ¿Qué ocurre en páginas de listado con un solo elemento?
  ItemList con un solo ítem sigue siendo válido y Google lo trata como lista de un elemento.
- ¿Qué ocurre con los componentes de anuncios que tienen lógica asociada (cookies, scripts)?
  Al eliminar los componentes, cualquier script o lógica de inicialización asociada debe eliminarse también para evitar errores en consola.

## Out of Scope

- Cambios en la estructura de navegación del sitio
- Añadir nuevas redes de anuncios o cambiar la estrategia de monetización
- Modificar el diseño visual de las páginas
- Crear nuevo contenido (blog, glosario, tutoriales)
- Implementar service worker o PWA
- Campañas de backlinks o SEO off-page
- Newsletter o email marketing

## Requirements *(mandatory)*

### Functional Requirements

**SEO - Datos estructurados:**

- **FR-001**: El sistema MUST generar un bloque JSON-LD `ItemList` en todas las páginas de listado dinámicas (`/carnaval/[year]`, `/agrupacion/[agrupacionSlug]`, `/autor/musica/[autorSlug]`, `/autor/letra/[autorSlug]`) que enumere cada acorde listado con su nombre y URL.
- **FR-002**: El sistema MUST añadir un bloque JSON-LD `Article` a cada página de acorde (`/acordes/[id]`) con: `headline`, `description`, `datePublished`, `author`, `image`.
- **FR-003**: El sistema MUST añadir un bloque JSON-LD `WebPage` a cada página de acorde con: `name`, `description`, `url`, `inLanguage`, `isPartOf` apuntando al `WebSite` principal.
- **FR-004**: El sistema MUST incluir la meta tag `article:published_time` en páginas de acorde con el valor del campo `date` del frontmatter en formato ISO 8601.
- **FR-005**: El sistema MUST incluir la meta tag `article:author` en páginas de acorde con los nombres de los autores (música y/o letra).

**Rendimiento - Lazy-load:**

- **FR-007**: El sistema MUST aplicar `loading="lazy"` nativo a los iframes de YouTube en páginas de acorde. Se descarta IntersectionObserver por incompatibilidad con el bundler de Astro.
- **FR-008**: El sistema MUST aplicar `loading="lazy"` nativo a todas las imágenes below-fold de la columna derecha que usen etiquetas `<img>` estándar.
- **FR-009**: El sistema MUST mantener `loading="lazy"` nativo en YoutubeCard. Los componentes ligeros de la columna derecha (SitiosDeInteres, AcordesRecomendados, Apoyar) cargan sin lazy-load adicional.

**Rendimiento - Imágenes:**

- **FR-010**: El sistema MUST migrar el uso del campo `img` del frontmatter de acordes a `<Image unoptimized />` de `astro:assets`, manteniendo las URLs externas originales pero con atributos `width` y `height` explícitos.
- **FR-011**: El sistema MUST añadir `width` y `height` explícitos a todas las imágenes para prevenir CLS, obteniendo las dimensiones reales de cada imagen.
- **FR-012**: El sistema MUST aplicar `loading="lazy"` y `decoding="async"` en imágenes below-fold, y `fetchpriority="high"` en la imagen principal above-fold de cada página de acorde.

**Limpieza de código:**

- **FR-014**: El sistema MUST mantener `AnunciosGuitarra.astro` y `AnunciosLibros.astro` como stubs desactivados (sin renderizar), y eliminar `AnunciosTech.astro` y `AnunciosHogar.astro` (Amazon). Los imports y referencias a Guitarra/Libros se mantienen comentados.
- **FR-015**: El sistema MUST eliminar los componentes: `Native1x1.astro`, `Banner315x300.astro` (Mondiad).
- **FR-016**: El sistema MUST eliminar los componentes: `BannerDesktopYMovilHilitop.astro`, `InPagePushHilitop.astro`, `PopunderHilitop.astro`, `VideoSliderHilitop.astro` (Hilitop).
- **FR-017**: El sistema MUST eliminar el componente `InlineShein.astro` (Shein).
- **FR-018**: El sistema MUST limpiar todos los imports y referencias comentadas a estos componentes en páginas .astro y Layout.astro.
### Key Entities *(mandatory)*

- **ItemList**: Schema JSON-LD para páginas de listado con `itemListElement` (array de `ListItem` con `position`, `name`, `url`)
- **Article**: Schema JSON-LD para páginas de acorde con `headline`, `description`, `datePublished`, `author` (Person), `image`
- **WebPage**: Schema JSON-LD para páginas de acorde con `name`, `description`, `url`, `inLanguage` (`es-ES`), `isPartOf` (WebSite)
- **ArticleMeta**: `article:published_time`, `article:author` en páginas de acorde
- **LazyLoader**: Intersection Observer para iframes YouTube y componentes de columna derecha
- **ImagePipeline**: Uso de `astro:assets` (`<Image />`/`<Picture />`) para imágenes del frontmatter
- **AdRemoval**: Lista de 11 componentes .astro a eliminar + limpieza de referencias en imports

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todas las páginas de listado (carnaval/[year], agrupacion/[slug], autor/*) contienen ItemList schema válido verificable con la Prueba de resultados enriquecidos de Google.
- **SC-002**: Todas las páginas de acorde contienen Article + WebPage + MusicComposition schema, verificable con validador de Schema.org.
- **SC-003**: Las páginas de acorde tienen `article:published_time` y `article:author` en el `<head>`, verificable con inspector de HTML.
- **SC-004**: Los iframes de YouTube usan `loading="lazy"` nativo para carga perezosa.
- **SC-005**: Todas las imágenes de acordes tienen `width` y `height` explícitos en el HTML, verificable con inspector.
- **SC-006**: El CLS (Cumulative Layout Shift) de las páginas de acorde se reduce al menos un 50% respecto al estado actual (medido con PageSpeed Insights).
- **SC-007**: El LCP de las páginas de acorde mejora al menos un 10% respecto al estado actual (medido con PageSpeed Insights en móvil).
- **SC-008**: No existe ningún import, referencia o archivo de los componentes de anuncios eliminados en el repositorio.

## Assumptions

- Las imágenes del frontmatter (`img`) son URLs externas (hotlinks) y se mantienen como tales, no se convierten a locales.
- Los componentes de anuncios a eliminar están todos comentados o sin uso activo en páginas, no hay lógica compartida con otros componentes.
- `astro:assets` está disponible y configurado en el proyecto (forma parte del núcleo de Astro 5.x), usado en modo `unoptimized` para imágenes externas.
- Los iframes de YouTube están envueltos en un contenedor con clase o selector identificable.
- Las páginas de listado se renderizan en el servidor (SSG) con acceso a la colección completa de acordes para generar el ItemList.
