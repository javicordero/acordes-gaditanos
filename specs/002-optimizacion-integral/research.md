# Research: Optimización integral del sitio

## Decisiones técnicas

### 1. Imágenes externas con astro:assets

- **Decisión:** Usar `<Image unoptimized>` con width/height explícitos.
- **Justificación:** Las 425+ imágenes son hotlinks externos (lavozdigital, abcstatics, grupajoly, etc.). `astro:assets` no puede transformar imágenes remotas. El modo `unoptimized` mantiene la URL original pero añade width/height y lazy loading.
- **Alternativas consideradas:**
  - Descargar imágenes localmente (inviable por volumen y licencias)
  - Servicio CDN como Cloudinary (coste adicional innecesario)

### 2. Lazy-load de iframes YouTube

- **Decisión:** Intersection Observer con rootMargin `200px` combinado con `loading="lazy"` nativo como fallback.
- **Justificación:** El Intersection Observer da control preciso sobre el threshold de carga (200px antes del viewport). `loading="lazy"` nativo sirve como fallback para navegadores sin soporte de IntersectionObserver.
- **Patrón:** Placeholder `<div>` que se reemplaza por el iframe real al hacer scroll. El placeholder puede mostrar una imagen de previsualización o un botón de play simulado.

### 3. Schemas JSON-LD (ItemList, Article, WebPage)

- **Decisión:** Inyectar los schemas directamente en el frontmatter de cada página, usando `<script type="application/ld+json">` con `set:html`.
- **Justificación:** Es SSG, los datos están disponibles en build-time via Astro.content collections. Sigue el mismo patrón que `Breadcrumb.astro` y `MusicCompositionSchema.astro`.
- **Patrón existente:** El proyecto ya usa este patrón correctamente en Breadcrumb y MusicComposition.

### 4. Meta tags article:published_time y article:author

- **Decisión:** Añadir en el `<head>` de cada página de acorde, dentro del `Layout.astro` o directamente en `[id].astro`.
- **Justificación:** Son meta tags estándar de Open Graph/Article. Se generan a partir del frontmatter (`date` y `musicaList`/`letraList`).

### 5. Limpieza de componentes

- **Decisión:** Eliminar archivos físicos + limpiar imports y referencias comentadas.
- **Justificación:** Todos los componentes están comentados o sin importar. No hay lógica compartida. Eliminar físicamente reduce deuda técnica y evita confusiones.

## Patrones de implementación

### Intersection Observer para YouTube

```astro
---
// Placeholder component that loads YouTube iframe on scroll
---
<div class="youtube-placeholder" data-youtube-id={videoId}>
  <!-- Optional: thumbnail preview -->
  <button class="play-button" aria-label="Reproducir video">
    <svg>...play icon...</svg>
  </button>
</div>

<script>
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const placeholder = entry.target;
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube.com/embed/${placeholder.dataset.youtubeId}`;
          iframe.loading = 'lazy';
          // ... copy attributes
          placeholder.replaceWith(iframe);
          observer.unobserve(placeholder);
        }
      }
    },
    { rootMargin: '200px' }
  );
  observer.observe(document.querySelector('.youtube-placeholder'));
</script>
```

### ItemList schema for listing pages

Generate in the Astro frontmatter, iterating over the acordes prop:

```typescript
const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: acordes.map((acorde, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: `${acorde.data.pieza} - ${acorde.data.agrupacion}`,
    url: new URL(`/acordes/${acorde.slug}`, Astro.site).toString(),
  })),
};
```

### Article + WebPage schema for chord pages

Combinar con MusicComposition existente:

```typescript
const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: `${pieza} - ${agrupacion}`,
  description: `Acordes de guitarra de ${pieza} de ${agrupacion}`,
  datePublished: convertToISO(date),
  author: [...],
  image: img,
};

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Acordes ${pieza} ${agrupacion}`,
  description: `...`,
  url: canonicalURL,
  inLanguage: 'es-ES',
  isPartOf: { '@id': 'https://acordesgaditanos.com/#website' },
};
```

## Dependencias externas

- Ninguna. Todo es implementación interna con Astro e JavaScript.
- Los valores de `article:published_time` se obtienen del campo `date` en frontmatter (formato DD/MM/YYYY → ISO 8601).
- Los valores de `article:author` se obtienen de `musicaList`/`letraList` en frontmatter.
