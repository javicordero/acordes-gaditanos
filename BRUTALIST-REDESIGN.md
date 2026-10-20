# Rediseño brutalist — documento de diseño

Rama: `brutalist-site` (desde `master` 72a2066) · Estado: **web pública revisada; pendiente admin local**
Última actualización: 20/10/2026

Este documento es la referencia única del rediseño. Si algo no está aquí, se decide
aquí antes de aplicarlo.

---

## 1. Principios

1. **Bordes duros, sin blur.** Todo borde es de 2px; toda sombra es sólida y desplazada.
2. **Cero radios.** `border-radius: 0` salvo logotipo y elementos circulares justificados.
3. **Tipografía con carácter.** Todo el texto en Roboto Mono; solo la marca mantiene
   Bodoni.
4. **Color plano.** Sin degradados ni transparencias decorativas. El ámbar es el acento.
5. **Jerarquía por contraste**, no por sombras difusas.
6. **Accesibilidad primero:** foco visible siempre, contraste AA, tamaños táctiles ≥ 44px.
7. **No romper negocio:** anuncios, autoscroll, buscador, formularios y tracking intactos.

---

## 2. Tokens

### Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-bg` | `#e5e5e5` | `#12141a` | Fondo de página |
| `--card-background-color` | `#ffffff` | `#1b1e26` | Superficie de tarjetas/paneles |
| `--primary-color` | `#000000` | `#f0f2f5` | Texto, bordes |
| `--primary-contrast-color` | `#fca311` | `#fca311` | Acento, sellos, sombras activas |
| `--brand-navy` | `#14213d` | `#14213d` | Bloques de sección |
| `--surface-color` | `#000000` | `#000000` | Header, footer, botones sólidos |
| `--on-bright-color` | `#111111` | `#111111` | Texto sobre ámbar (fijo) |
| `--on-surface-color` | `#ffffff` | `#ffffff` | Texto/sombra sobre negro |

> En superficies ámbar se usa siempre tinta fija `--on-bright-color`, nunca
> `--primary-color` (que se invierte en tema oscuro).

### Tipografía

| Rol | Familia | Peso | Transformación |
|---|---|---|---|
| Titular de sección | Roboto Mono | 700 | MAYÚSCULAS, tracking 0.5px |
| Título de tarjeta | Roboto Mono | 700 | MAYÚSCULAS, tracking 0.5px |
| Nombre de autor | Roboto Mono | 700 | Capitalización normal |
| Cuerpo | Roboto Mono | 400/500 | Normal |
| Metadatos, cifras y años | Roboto Mono | 400/700 | Normal |
| Marca | Bodoni | 700 | Normal |

> Roboto Mono se carga desde Google Fonts en `layouts/Layout.astro` (400 y 700) y es la
> fuente base del `body`, de los controles de formulario y del `<pre>` de los acordes.
> Solo el logo conserva Bodoni.

### Forma

| Recurso | Valor |
|---|---|
| Borde estándar | `2px solid var(--primary-color)` |
| Borde sobre ámbar | `2px solid var(--on-bright-color)` |
| Radio | `0` |
| Sombra tarjeta | `6px 6px 0 0 var(--primary-color)` |
| Sombra panel | `4px 4px 0 0 var(--primary-color)` |
| Sombra sobre navy | `6px 6px 0 0 var(--on-surface-color)` |
| Hover tarjeta | `translate(-4px, -4px)` + `10px 10px 0` acento |
| Hover botón | `translate(-2px, -2px)` + `4px 4px 0` |
| Activo | `translate(0, 0)` + `2px 2px 0` |
| Separación bajo titular | barra ámbar de 4–6px, ancho 95% |

### Espaciado

- Contenedor: `.container-layout` (90 % / 95 % en tablet-móvil, máx. 1000px).
- Gap de rejilla de tarjetas: `var(--card-padding)` (24px) / `2.5vw` en móvil.
- Padding interno de panel: 16px (12px en móvil).

---

## 3. Componentes

### 3.1 Tarjeta de acorde — `ui/Card.astro`
Blanca/oscura, borde 2px, sombra dura 6px. Imagen 220px (180px móvil). Badge de pieza
con color plano y borde; año en sello ámbar arriba. Cuerpo: agrupación en Roboto Mono 700
mayúsculas y autores en Roboto Mono. Hover: desplazamiento + sombra ámbar.

### 3.2 Tarjeta de autor — `ui/AutorCard.astro`
Variante editorial para diferenciarla de las de acorde:
- Fondo ámbar fijo, tinta `--on-bright-color`.
- Sin sombra: el borde negro de 2px la separa del bloque navy.
- Nombre en Roboto Mono 700, sin mayúsculas, banda compacta (padding 6px 8px).
- Foto a color, sin filtros.
- Sin sello de tipo (el tipo queda en el `aria-label`).

### 3.3 Paneles de columna derecha — `layouts/RightColumnCard.astro`
Sin caja: solo título Roboto Mono 700 con barra ámbar y contenido, como antes del
rediseño pero con la tipografía nueva. La variante `flush` sigue existiendo para el
vídeo oficial, que además va sin borde en el iframe.

### 3.4 Botones
- **Primario:** fondo `--surface-color`, texto ámbar o blanco, borde 2px, sombra dura.
- **Acento:** fondo ámbar, texto `--on-bright-color`, borde 2px negro, sombra dura.
- **Secundario:** transparente, borde 2px, texto `--primary-color`.
- Mayúsculas, Roboto Mono 700, tracking 1px.
- Nunca `border-radius: 999px`.

### 3.5 Chips y sellos
Rectangulares, borde 2px, sin sombra difusa. Años: fondo ámbar, texto negro, hover
invertido (negro/ámbar) con sombra dura.

### 3.6 Formularios
Inputs y textareas rectangulares, borde 2px, fondo de tarjeta, foco con `outline` de 3px
y sin `box-shadow` difuso. Botones según 3.4. El textarea de contacto arranca con 5 filas
para que el mensaje tenga espacio desde el principio.

### 3.7 Enlaces
Color `--link-color`, subrayado grueso (2px) y `text-underline-offset: 3px`. En hover,
fondo ámbar o subrayado ámbar. Nunca quitar el foco visible. En la lista de coplas
(`/lista`) los enlaces van sin subrayado y conservan el fondo ámbar al hover.

### 3.8 Callouts
Borde 2px, radio 0, sin sombra. Badge rectangular. Fondo `--callout-bg`.

### 3.9 Navegación
Header negro fijo. Logo circular sobre base ámbar. Título Bodoni ámbar. Buscador
rectangular con foco duro. Menú móvil a pantalla completa con enlaces Roboto Mono 700
mayúsculas y una línea inferior ámbar que crece de izquierda a derecha al hover/foco.
El botón de tema va sin caja, solo el icono.

### 3.10 Footer
Negro, borde superior ámbar de 4px. Iconos sociales sin caja ni borde, en gris que pasa
a ámbar al hover. Textos pequeños en Roboto Mono y enlaces legales sin subrayado.

---

## 4. Qué NO hacer

- No usar `box-shadow` con blur (`0 4px 12px rgba(...)`) salvo en anuncios.
- No usar `border-radius` > 0 en componentes de contenido.
- No usar degradados en botones ni tarjetas.
- No tocar el tamaño, márgenes ni posición de los contenedores de anuncios.
- No cambiar la estructura de datos ni el HTML semántico (h1/h2, roles, aria).
- No poner texto oscuro sobre superficies que cambian con el tema sin comprobar ambos.

---

## 5. Mapa de archivos y progreso

### Global
- [x] `styles/variables.css` — tokens existentes
- [x] `styles/global.css` — primitivas brutalist (botones, paneles, inputs, titulares, foco)

### Layout
- [x] `components/layout/Header.astro` — header negro, logo redondo, buscador y menú
- [x] `components/layout/Footer.astro` — borde superior ámbar, iconos sin cajas, mono y enlaces legales sin subrayado
- [x] `components/layout/ThemeToggle.astro` — sin caja, solo el icono
- [x] `layouts/Layout.astro` — sin cambios necesarios

### Index
- [x] Tarjetas de acorde — `components/ui/Card.astro`
- [x] Tarjetas de autor — `components/ui/AutorCard.astro`
- [x] Callout “Novedad” — `components/page/NovedadCallout.astro`
- [x] Chips de años — `components/page/YearsList.astro`
- [x] Títulos de sección — `CardsGroup.astro`, `AutorCardsGroup.astro`, `YearsList.astro`
- [x] Banner “Vuestras coplas” — `components/page/BannerCoplasComunidad.astro`
- [x] Botón “Ver más novedades” — `pages/index.astro`
- [x] Bloque navy de autores — `pages/index.astro`
- [x] Botón flotante — `components/FloatingButton.astro`
- [x] Indicador de donaciones — `components/DonationIndicator.astro`

### Ficha de acorde
- [x] `components/page/AcordeCard.astro` — título `$pieza $agrupación`, cejilla, controles y `pre`
- [x] `components/page/Breadcrumb.astro`
- [x] `components/page/TutorialAutoscroll.astro`
- [x] `layouts/RightColumnCard.astro` — sin cajas: título con barra y contenido
- [x] `YoutubeCard`, `Apoyar`, `PedirCoplaCard`, `SigueTocando`, `AcordesRecomendados`
- [x] Comentarios: `comments/CommentForm`, `CommentItem`, `CommentsSection`, `PeticionesStats`
- [x] `components/page/RecomendacionInline.astro`
- [x] Anuncios: sin tocar tamaños ni márgenes (solo contenedores existentes)

### Listados y búsqueda
- [x] `pages/lista.astro`
- [x] `pages/buscar.astro`
- [x] `pages/novedades.astro`
- [x] `pages/autor/musica/[autorSlug].astro`
- [x] `pages/autor/letra/[autorSlug].astro`
- [x] `pages/carnaval/[year].astro`
- [x] `pages/agrupacion/[agrupacionSlug].astro`

### Páginas de contenido
- [x] `pages/contacto.astro`
- [x] `pages/pedir-copla.astro`
- [x] `pages/colaborar.astro`
- [x] `pages/about.astro`
- [x] `pages/404.astro`
- [x] `pages/coming-soon.astro`
- [x] `pages/politicas/*.astro`

### Local / interno (noindex)
- [x] `pages/lista2.astro`
- [x] `pages/acordes2/[id].astro` — reutiliza `AcordeCard` y la columna derecha
- [ ] `pages/admin/*` — local y gitignored; no forma parte de la web publicada. Pendiente
  solo si se quiere uniformar el panel interno.
- `pages/formateadores/*` — ocultos por el middleware (404); no se rediseñan.

### Componentes sin uso (si se reactivan, hay que pasarlos)
- `BannerCoac2026.astro`, `BannerCoac2026ConAnuncios.astro`, `BannerNoly.astro`,
  `BannerMartin.astro`, `BannerPacoAlba.astro`
- `AcordeAvisoMigracion.astro`
- `InlineShein.astro`, `SheinRightColumn.astro`
- `CardLegacy.astro`, `CardBrutalist.astro` (duplicados de la tarjeta)
- `comments/CommentItem.astro` — sustituido por el render de `CommentsSection`

---

## 6. Verificación

Antes de dar una tanda por cerrada:

1. `npm run astro check` sin errores nuevos.
2. Revisar en navegador a 1280px y a 390px.
3. Revisar tema claro y oscuro.
4. Comprobar foco con teclado en enlaces y botones.
5. Confirmar que los anuncios conservan su alto.
6. Comprobar que el autoscroll, el buscador y los formularios siguen funcionando.
7. Anotar aquí cualquier decisión nueva.

**Nota:** el proyecto arrastra errores de tipos previos en `admin/*`, `formateadores/*`
y scripts con parámetros implícitos. No vienen de este rediseño.

**Estado 20/10/2026:** `npm run build` correcto (1497 páginas). Revisados index, ficha
de acorde, lista, búsqueda, contacto, pedir copla, about y 404 en 1280px y 390px.
Pendiente: admin y componentes sin uso.

**Revisión 20/10/2026:** auditoría automática de las páginas públicas (index, ficha,
lista, buscar, contacto, pedir copla, colaborar, about, novedades, carnaval, agrupación,
autor, políticas, 404 y coming-soon): sin radios, sombras con blur, degradados ni fuentes
ajenas en los elementos visibles. La web publicada no tiene pendientes de estilo. Quedan
fuera el admin local (gitignored), los formateadores ocultos y los componentes sin uso.

---

## 7. Registro de decisiones

> Las entradas se conservan en orden cronológico; las más recientes prevalecen sobre las
> anteriores.

- **20/10/2026** — Las tarjetas de autor se separan del lenguaje de las de acorde:
  fondo ámbar, Bodoni y sombra blanca. Se elimina el sello de tipo por petición.
- **20/10/2026** — El callout “Novedad” pierde la sombra dura; queda solo borde.
- **20/10/2026** — El rediseño se consolida en el repo local (se abandona el worktree).
- **20/10/2026** — El hero “Vuestras coplas” mantiene el texto directamente sobre la
  foto, con borde inferior ámbar de 4px (igual que los bordes de sección). El widget de
  donaciones usa fondo `#0003` con sombra dura y brillos interiores.
- **20/10/2026** — Los paneles de la columna derecha de la ficha pasan a ser tarjetas
  con borde y sombra, para que los videos y textos no floten sobre el fondo.
- **20/10/2026** — En la ficha, la pieza pasa a sello (ámbar) y la agrupación a titular
  Roboto Mono 700. La cejilla se muestra como chip mono con etiqueta “Cejilla”.
- **20/10/2026** — Se añaden utilidades globales (`brutal-btn`, `brutal-panel`,
  `brutal-input`, `brutal-title`) como base para páginas nuevas; las existentes
  mantienen sus estilos propios ya adaptados.
- **20/10/2026** — Se mantienen los azules de enlace existentes por contraste y
  familiaridad; el acento ámbar se reserva para hover, sellos y sombras.
- **20/10/2026** — Excepciones pedidas por el usuario: el logo vuelve a ser redondo,
  el toggle de tema pierde la caja, el hero deja el texto directamente sobre la foto
  (sin panel), el widget de donaciones del hero recupera el fondo translúcido tipo
  glass, los iconos sociales del footer van sin borde y los enlaces legales sin
  subrayado.
- **20/10/2026** — Los titulares de sección y los números de año pasan a Roboto Mono
  (la fuente del footer). Se carga Roboto Mono desde Google Fonts para que no dependa
  de la monoespaciada del sistema.
- **20/10/2026** — El widget de donaciones del hero usa fondo `#0003` plano (sin blur),
  esquinas rectas, sin borde, sombra dura de 6px y dos brillos interiores. Las pills
  recuperan los colores originales (ámbar en el hero, azul en la variante compacta).
  El botón de apoyo mantiene el azul original. El header pierde el borde inferior ámbar.
- **20/10/2026** — La ficha de acorde se simplifica: sin sello de pieza, año como enlace
  azul normal, autores sin subrayado y `pre` sin borde izquierdo. El vídeo oficial se
  muestra sin panel (`flush`).
- **20/10/2026** — Los nombres de las tarjetas de autor pasan a Roboto Mono 700 en caja
  normal, la misma fuente que el footer y los títulos de sección.
- **20/10/2026** — Se descarta el ancho mínimo de LETRA/MÚSICA: la separación vuelve a
  ser natural aunque los autores no queden alineados entre sí.
- **20/10/2026** — Las barras de los títulos de la columna derecha pasan de 2px a 4px.
- **20/10/2026** — El título de la ficha pasa a mostrar “$pieza $agrupación” y adopta el
  estilo de los títulos de sección: Roboto Mono 700, 1.6rem en escritorio (1.25rem en
  móvil) y barra ámbar de 6px (4px en móvil) al 95%.
- **20/10/2026** — Ajustes de detalle: se elimina la pista de voto de `/pedir-copla`, se
  separan sus párrafos, el hover de “Responder” pasa a sombra dura sin relleno, el
  textarea de contacto arranca con 5 filas y los enlaces de `/lista` pierden el subrayado.
- **20/10/2026** — La barra del título de ficha sube a 6px en escritorio (4px en móvil)
  para igualar el grosor de las barras de los títulos de sección.
- **20/10/2026** — La barra ámbar del título de ficha se acerca al texto: su separación
  pasa de 4px a 1px.
- **20/10/2026** — Las barras ámbar que subrayan los títulos de sección suben de 3px
  a 4px en móvil para que no se vean tan finas.
- **20/10/2026** — Roboto Mono pasa a ser la fuente por defecto de **todo el texto**
  (hero, formularios, legales, botones, títulos). Solo el logo conserva Bodoni. Se
  eliminan Montserrat y Raleway de la carga de Google Fonts.
- **20/10/2026** — Las tarjetas de autor pierden la sombra; el borde negro de 2px hace
  de separación sobre el bloque navy.
- **20/10/2026** — La columna derecha de la ficha vuelve a ir sin cajas (solo título y
  contenido), manteniendo la tipografía nueva. El vídeo oficial sigue sin panel ni borde.
- **20/10/2026** — Todas las barras ámbar que subrayan títulos pasan del 100% al 95%
  de ancho, incluida la línea de hover del menú. Las barras de texto se mantienen en
  6px; lo que baja a 4px es el borde de separación del hero.
