# Plan de Implementación: Optimización integral del sitio

**Feature Directory**: `specs/002-optimizacion-integral`
**Spec**: `spec.md`
**Data Model**: `data-model.md`
**Research**: `research.md`

---

## Technical Context

**Stack**: Astro 5, SSG, Content Collections, astro:assets, astro-icon
**Hosting**: Netlify (inferido por `_redirects`)
**Analytics**: GTM, GA4, Cloudflare, stats worker custom
**Imágenes**: 100% hotlinks externos → `<Image unoptimized>` con width/height

**Clarifications resolved**:
1. Imágenes: modo `unoptimized` (sin conversión WebP/AVIF)
2. Facebook tags: omitidos del alcance
3. Lazy-load columna derecha: solo YoutubeCard (pesados)

**Design decisions** (from research.md):
1. JSON-LD schemas inline en cada página (patrón existente)
2. IntersectionObserver para YouTube (placeholder→iframe)
3. article:published_time desde frontmatter date (DD/MM/YYYY → ISO 8601)
4. Eliminación física de archivos de anuncios + limpieza de referencias

---

## Gates

- [x] Spec completa y clarificada (3 preguntas respondidas)
- [x] Sin marcadores NEEDS CLARIFICATION
- [x] Success criteria medibles y verificables
- [x] Dependencias y assumptions documentadas
- [x] Stack conocido (Astro 5, SSG)
- [x] No hay violaciones constitucionales (no existe constitution.md)

---

## Tasks

### T-001: Añadir ItemList schema a páginas de listado

**Archivos**: `src/pages/carnaval/[year].astro`, `src/pages/agrupacion/[agrupacionSlug].astro`, `src/pages/autor/musica/[autorSlug].astro`, `src/pages/autor/letra/[autorSlug].astro`

**Descripción**: Añadir bloque JSON-LD `ItemList` a todas las páginas de listado dinámicas, enumerando cada acorde con su nombre y URL.

**Implementación**:
1. En cada página, tras recibir `acordes` prop, generar schema:
   ```typescript
   const itemListSchema = {
     '@context': 'https://schema.org',
     '@type': 'ItemList',
     itemListElement: acordes.map((a, i) => ({
       '@type': 'ListItem',
       position: i + 1,
       name: `${a.data.pieza} - ${a.data.agrupacion}`,
       item: `${Astro.site}acordes/${a.slug}`,
     })),
   };
   ```
2. Insertar en template: `<script type='application/ld+json' set:html={JSON.stringify(itemListSchema)} />`
3. Verificar con validador de Google

**Criterio de éxito**: SC-001

---

### T-002: Añadir Article + WebPage schema a páginas de acorde

**Archivos**: `src/pages/acordes/[id].astro`, `src/components/utils/MusicCompositionSchema.astro`

**Descripción**: Añadir dos bloques JSON-LD adicionales (`Article` y `WebPage`) a cada página de acorde, complementando el `MusicComposition` existente.

**Implementación**:
1. Crear función `buildArticleSchema(data, slug)` en `[id].astro` que genere:
   - `headline`: `${pieza} - ${agrupacion}`
   - `description`: descripción SEO existente
   - `datePublished`: `data.date` convertido a ISO 8601 (DD/MM/YYYY → YYYY-MM-DDT00:00:00Z)
   - `author`: array de `Person` desde `musicaList` + `letraList`
   - `image`: `data.img`
   - `inLanguage`: `es-ES`
2. Crear función `buildWebPageSchema(data, canonicalURL)`:
   - `name`, `description`, `url`, `inLanguage`, `isPartOf`: apuntando a WebSite principal
3. Insertar ambos schemas en el template junto al MusicComposition existente
4. Opcional: extraer a un componente reutilizable estilo `MusicCompositionSchema.astro`

**Criterio de éxito**: SC-002

---

### T-003: Añadir meta tags article:published_time y article:author

**Archivos**: `src/pages/acordes/[id].astro`

**Descripción**: Añadir meta tags `article:published_time` y `article:author` en el `<head>` de cada página de acorde.

**Implementación**:
1. Convertir `data.date` de DD/MM/YYYY a ISO 8601
2. Si `musicaList` y `letraList` son iguales, un solo `article:author`. Si diferentes, múltiples tags (primero letra, luego música).
3. Insertar en el `<head>` del Layout, pasándolos como props:
   ```html
   <meta property='article:published_time' content='2024-02-15T00:00:00Z' />
   <meta property='article:author' content='Nombre Autor' />
   ```

**Criterio de éxito**: SC-003

---

### T-004: Mantener lazy-load nativo en YoutubeCard

**Archivos**: `src/components/right-column/YoutubeCard.astro`

**Descripción**: Se mantiene el `loading="lazy"` nativo del iframe de YouTube. Se descarta IntersectionObserver porque Astro no interpola variables de frontmatter dentro de `<script>` sin `is:inline`, lo que hace la implementación frágil.

**Implementación**:
1. El iframe ya tiene `loading='lazy'` - no requiere cambios.
2. Verificar que el atributo loading=lazy está presente.

**Criterio de éxito**: SC-004

---

### T-005: Migrar imágenes a <Image unoptimized> con width/height explícitos

**Archivos**: `src/components/page/AcordeCard.astro`

**Descripción**: Verificar y estandarizar el uso de `<Image>` de astro:assets con modo `unoptimized` para imágenes externas. Añadir width/height donde falten.

**Implementación**:
1. El componente `AcordeCard.astro` ya usa `<Image>` con width={480} height={320}. Añadir prop `unoptimized` (para compatibilidad explícita con imágenes externas).
2. Verificar que en `acordes/[id].astro` la imagen del header también use el mismo patrón.
3. Verificar que todas las imágenes de la columna derecha tengan dimensiones explícitas.

**Criterio de éxito**: SC-005, SC-006

---

### T-006: Eliminar componentes de anuncios inactivos

**Archivos**: 11 componentes .astro + imports en páginas

**Descripción**: Eliminar físicamente los archivos de componentes de anuncios inactivos y limpiar todas las referencias (imports, usos comentados) en las páginas.

**Implementación**:
1. Gestionar archivos:
   - `src/components/right-column/anuncios/AnunciosGuitarra.astro` → convertir a stub desactivado
   - `src/components/right-column/anuncios/AnunciosLibros.astro` → convertir a stub desactivado
   - `src/components/right-column/anuncios/AnunciosTech.astro` → eliminar
   - `src/components/right-column/anuncios/AnunciosHogar.astro` → eliminar
   - `src/components/right-column/Native1x1.astro`
   - `src/components/right-column/Banner315x300.astro`
   - `src/components/ads/BannerDesktopYMovilHilitop.astro`
   - `src/components/ads/InPagePushHilitop.astro`
   - `src/components/ads/PopunderHilitop.astro`
   - `src/components/ads/VideoSliderHilitop.astro`
   - `src/components/ads/InlineShein.astro`
2. Limpiar imports y referencias comentadas en:
   - `src/pages/acordes/[id].astro` (líneas 9-10, 16-17 imports; líneas 135, 156, 159, 161, 176)
   - `src/components/page/AcordeCard.astro` (líneas 103-105)
3. Verificar que no queden referencias con búsqueda global

**Criterio de éxito**: SC-008

---

### T-007: Verificar build y type-check

**Descripción**: Ejecutar `npm run build` y `npm run astro check` para verificar que no hay errores tras todos los cambios.

**Criterio de éxito**: Build exitoso, type-check sin errores.

---

## Orden de ejecución recomendado

```
T-006 (limpieza) → T-001 (ItemList) → T-002 (Article+WebPage) → T-003 (meta tags) → T-004 (lazy YouTube) → T-005 (imágenes) → T-007 (verificación)
```

Razón: T-006 primero porque elimina archivos y simplifica el código base. Luego SEO (T-001→T-002→T-003) que son independientes entre sí. Luego rendimiento (T-004→T-005). Finalmente verificación.
