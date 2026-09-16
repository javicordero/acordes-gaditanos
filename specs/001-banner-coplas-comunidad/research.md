# Research: Banner Vuestras Coplas

**Date**: 16/09/2026

## Decision Log

### 1. Componente base a copiar

**Decision**: Usar `BannerMartin.astro` como plantilla exacta

**Rationale**: El usuario pidió explícitamente "como el BannerMartin.astro". Mantiene consistencia visual con los banners existentes (BannerNoly, BannerPacoAlba).

**Alternatives considered**:
- Usar `BannerCoac2026.astro` como base: Rechazado porque tiene estructura diferente (botón de BMC en vez de DonationIndicator)

### 2. Posición del enlace de peticiones

**Decision**: Enlace `<a>` inline en el primer párrafo, igual que los enlaces existentes en BannerMartin

**Rationale**: Consistencia con el patrón existente. BannerMartin usa `<a href='...'>texto</a>` dentro de `<p>`.

### 3. Texto de los párrafos

**Decision**: Redactar párrafos en tono cercano y直接, inspirado en el estilo de los banners existentes

**Rationale**: Los banners existentes usan un tono informal y directo ("llega el turno de...", "tras recordar..."). Mantener coherencia.

**Propuesta de texto**:

P1:
> ¿Quieres que subamos alguna copla que no encuentras? Puedes hacer tu petición en la <a href='/pedir-copla'>página de peticiones</a> y votar las que más te gusten. Las más votadas (y las que yo quiera) se irán subiendo poco a poco.

P2:
> Si quieres colaborar para que siga creciendo esta web, puedes <a href='/colaborar'>hacer una donación</a>. Cada aportación ayuda a que siga subiendo coplas de Carnaval.

### 4. Imagen de fondo móvil

**Decision**: Usar la misma imagen que desktop con CSS `center/cover`

**Rationale**: No se ha proporcionado imagen móvil. El BannerMartin usa una imagen separada (`antonio-martin-movil.jpg`) pero el usuario no ha dado una móvil. Usar la misma imagen es la solución más práctica.

**Alternatives considered**:
- Pedir imagen móvil al usuario: Rechazado porque retrasa la implementación
- No poner imagen móvil: Rechazado porque rompería el responsive

### 5. Donaciones enlace destino

**Decision**: Enlace a `/colaborar`

**Rationale**: Página existente de donaciones. Consistente con BannerCoac2026 que también usa `/colaborar`.

## Research Notes

- No hay dependencias externas nuevas
- No hay APIs a integrar
- No hay datos nuevos que modelar
- El componente `DonationIndicator` ya maneja el caso vacío de donaciones
