# Active View del anuncio móvil de la ficha

> Análisis cerrado el **7 de noviembre de 2026**. Este documento existe para
> volver dentro de unas semanas y comprobar si el cambio ha funcionado.
> Los datos son del informe `report (1).xlsx` de AdSense (8 oct – 6 nov 2026).

## Pregunta

El anuncio **«Previo acordes Movil»** (slot `8116046706`), que va justo debajo
de la imagen de cada ficha y solo se muestra en móvil (≤640 px), ha perdido
Active View viewable. ¿Por qué? ¿Es el rediseño, el bloque «Acordes usados»,
las view transitions, el scroll de los usuarios o el propio AdSense?

## Resumen

- Las **view transitions del 25 de octubre no son la causa**. El global pasa de
  40,19 % (20–24 oct) a 41,99 % (25 oct–5 nov); Right Column 1 sube de 52,71 %
  a 54,08 % y las demás también.
- El **20 de octubre** (rediseño) la unidad móvil cae de 58,84 % a 52,20 %, y
  el **23 de octubre** baja otro escalón a 47,63 %. El 1-2 de noviembre vuelve
  a 53,12 %; el 6 de noviembre (un día) marca 41,35 %.
- La **posición del anuncio no ha cambiado**: sigue en 448 px, dentro de la
  primera pantalla. La imagen mide 240 px antes y después. Lo que ha bajado es
  el `<pre>`: de 532 px a 677 px (10 px por debajo del pliegue en 390×667).
- La unidad móvil es el **45 % de los ingresos** (3,81 € de 8,42 €), así que
  importa aunque el global esté plano.
- Causa todavía **no demostrada**. Las hipótesis vivas son: creativo/tamaño que
  sirve Google (Auto Ads), mezcla de tráfico, tiempo de render del anuncio y
  salto de la imagen lazy. No hay ningún cambio de código que explique un
  escalón de 10 puntos.

## El anuncio

`src/components/page/AcordeCard.astro`, línea 137:

```astro
<div class='container-layout anuncio-movil'>
  <Anuncio adSlot='8116046706' />
</div>
```

```css
.anuncio-movil { display: none; margin-top: 24px; }
@media (max-width: 640px) { .anuncio-movil { display: block; } }
```

`Anuncio.astro` pinta un `<ins class="adsbygoogle" data-ad-format="auto"
data-full-width-responsive="true">`. Solo móvil. Orden en la ficha (HEAD
`457f362`, medido el 7 nov a 390×667):

```
imagen            184–424 px
anuncio           448 px (alto real ~250 px en producción; en local 0)
acordes usados    464–589 px (bloque «Acordes usados», 125 px)
cejilla           605–635 px
<pre>             677 px
```

El `<pre>` queda **10 px por debajo del pliegue** en 390×667. Antes del
glosario (22 oct) estaba en 532 px, dentro de la primera pantalla.

## Cronología

| Fecha | Commit | Qué cambió |
|---|---|---|
| 20 oct, 18:28 | `bfcac25` | Rediseño brutalist; cabecera de ficha (título en mayúsculas, más huecos) |
| 22 oct, 17:40 | `242bbc9` | Glosario + bloque «Acordes usados» en la ficha |
| 25 oct, 12:09 | `2aeced2` | Prefetch + view transitions cross-document |
| 1 nov | `5c80dec` | Roboto Mono autoalojada en WOFF2 + preload |
| 3 nov, 10:33 | `1eb3de1` | Se quitan Anuncio2, Anuncio3, el anuncio de `/lista` y el de la home |
| 3 nov | `aeadc65` | PWA instalable + service worker |
| 6 nov, 19:54 | `bb6c6c6` | Se quita GTM; Bodoni reducida a subset |

## Datos (xlsx)

Rango 8 oct – 6 nov 2026, 404 filas, 62.183 impresiones. `Active View
Viewable` viene en fracción (`0,4635` = 46,35 %).

### Global (ponderado por impresiones)

| Periodo | Impresiones | Active View |
|---|---:|---:|
| 8–19 oct (antes) | 21.943 | **43,47 %** |
| 20–24 oct (rediseño) | 10.047 | **40,19 %** |
| 25 oct–5 nov (con view transitions) | 28.173 | **41,99 %** |
| 6 nov (un día) | 2.020 | 36,76 % |

Semanas: 42,82 → 43,53 → **40,71** → **41,52** → **42,40** (2–6 nov).

### Por unidad

| Unidad | 8–19 oct | 20–24 oct | 25 oct–5 nov | Impresiones | Ingresos |
|---|---:|---:|---:|---:|---:|
| **Previo acordes Movil** | **58,84 %** | **48,73 %** | **49,17 %** | 14.150 | **3,81 €** |
| Right Column 1 | 51,65 % | 52,71 % | 54,08 % | 20.745 | 2,44 € |
| Right Column 2 | 52,27 % | 53,90 % | 55,96 % | 5.668 | 0,40 € |
| Right Column Final 2 | 17,78 % | 18,91 % | 20,46 % | 4.451 | 0,22 € |
| Sobre pagina | 38,03 % | 36,75 % | 40,36 % | 4.938 | 0,78 € |
| Sobre footer 2 | 18,04 % | 16,42 % | 16,90 % | 8.232 | 0,59 € |
| Bajo autores | 12,70 % | 14,65 % | 16,59 % | 2.141 | 0,16 € |
| Pagina Lista | 15,10 % | 10,97 % | 8,64 % | 1.450 | 0,02 € |

Total: **8,42 €**. La unidad móvil es el 45 %.

### Serie diaria de «Previo acordes Movil»

```
08-oct 60,18   13-oct 58,31   18-oct 57,78   23-oct 42,67   28-oct 49,38   02-nov 55,11
09-oct 62,75   14-oct 52,90   19-oct 62,22   24-oct 46,56   29-oct 46,15   03-nov 47,83
10-oct 63,12   15-oct 56,18   20-oct 52,75   25-oct 51,90   30-oct 47,38   04-nov 47,63
11-oct 62,53   16-oct 58,28   21-oct 54,64   26-oct 50,95   31-oct 46,35   05-nov 46,27
12-oct 55,61   17-oct 56,05   22-oct 50,21   27-oct 48,24   01-nov 51,23   06-nov 41,35
```

Tramos: 58,84 → 52,20 → 47,63 → 53,12 → 47,20 → 41,35.

No es una recta: un ajuste lineal da −0,56 pts/día (R² 0,654), pero un escalón
el 20 de octubre ajusta mejor (R² 0,674). El 6 de noviembre es un solo día y
arrastra el promedio del último tramo.

## Lo descartado

- **View transitions (25 oct)**: el global sube 1,8 puntos en el periodo con VT
  respecto a los cinco días del rediseño. No cambian el layout (la medición lo
  confirma: el anuncio está en 448 antes y después).
- **Rediseño como causa de posición**: el anuncio pasó de 454 a 448 px (subió
  6 px porque el título quedó 8 px más bajo). No lo empujó hacia abajo.
- **Imagen más grande**: 240 px antes y después. El borde de 2 px del rediseño
  va por dentro (`box-sizing: border-box`).
- **Bloque «Acordes usados» empujando el anuncio**: va después del anuncio; no
  puede moverlo. Lo que baja es el `<pre>`.
- **3 de noviembre**: `1eb3de1` quitó Anuncio2/Anuncio3 y los anuncios de
  `/lista` y la home. Las 13/3/1/0 impresiones residuales son HTML en caché (y
  desde ese día hay service worker). «Página Lista» se hunde por lo mismo.

## Hipótesis abiertas

1. **Creativo / Auto Ads.** El tamaño lo elige Google (`auto` + responsive). Un
   creativo más alto cambia el 50 % de área visible: con el anuncio en 448 y
   una pantalla de 640-667, solo caben 192-219 px en la primera pantalla.
   Hace falta la dimensión **Tamaño del anuncio** en el informe.
2. **Mezcla de tráfico.** Las impresiones suben (~1.850/día → ~2.400/día) y la
   unidad móvil correlaciona negativamente con ellas (−0,23). Hace falta
   **plataforma**, país, fuente y duración de sesión.
3. **Tiempo de render.** Si el anuncio llena después de que el usuario haya
   scrolleado, no se mide como visible. Hace falta medir tiempo hasta
   `data-ad-status="filled"` y tiempo con ≥50 % visible.
4. **Salto de la imagen lazy.** `loading="lazy"` + `content-visibility: auto` +
   `contain-intrinsic-size: 482px 320px` reservan 320 px, pero el alto real es
   240: **80 px de salto** posibles. Es código de mayo, no del rediseño.
5. **Medición.** Active View no mide en todos los navegadores; si sube
   iOS/Safari o cambia el consentimiento, cambia el denominador. Hace falta
   **impresiones medibles** + plataforma.

## Decisión: mover el anuncio debajo del bloque (7 nov 2026)

Se ha movido el anuncio de `AcordeCard.astro` a **justo después de
`.acordes-pieza`** y antes de la cejilla. El `<pre>` no cambia de sitio; el
anuncio baja ~165-226 px según el estado del bloque.

**Estado:** aplicado en el working tree el 7 nov 2026, **sin commit**.

Medido en HEAD (`457f362`) a 390×667 antes del cambio: anuncio 448, bloque
464–589, `<pre>` 677. Después del cambio el anuncio queda en ~613 px.

**Efecto esperado.** El anuncio pasa a ~613 px. En 390×667 solo se ven 54 px
de los ~250 del anuncio (**22 %**), por debajo del 50 % necesario; en 360×640,
27 px (11 %). En 390×844 seguiría bien (231 px, 92 %). Restaura la distancia al
`<pre>`, pero **empeora la posición absoluta** y podría bajar aún más el Active
View. Es el experimento que se ha decidido probar.

**Alternativa si esta no funciona — mover el bloque «Acordes usados» debajo del
`<pre>`.** El anuncio se queda en 448 y el `<pre>` vuelve a ~536 px, por encima
del pliegue en 390×667 (antes del glosario estaba en 532). Restaura el
comportamiento de scroll anterior sin tocar la posición del anuncio.

> Revisar a las 2-4 semanas: exportar AdSense y comparar con la tabla de
> arriba. Si el Active View del móvil no mejora (o baja), deshacer este cambio
> y probar la alternativa.

## Cómo volver a medir

1. Exportar de AdSense **CSV** (no PDF), 8 oct – hoy, con:
   fecha, unidad, **plataforma**, **tamaño del anuncio**, impresiones,
   **impresiones medibles**, **impresiones visibles** (o el %).
2. Comparar la unidad «Previo acordes Movil» con los mismos tramos:
   8–19 oct, 20–24 oct, 25 oct–5 nov, y el periodo nuevo.
3. Mirar si el cambio está en el **%** o en las **impresiones medibles**.
4. Repetir la medición de layout:

```powershell
git worktree add --detach <tmp>\ag-antes <commit-antes-del-cambio>
# junction de node_modules al repo principal
npm run dev -- --port 4325
```

```js
(() => {
  const q = s => document.querySelector(s);
  const r = el => el ? { top: Math.round(el.getBoundingClientRect().top + scrollY),
                         h: Math.round(el.getBoundingClientRect().height) } : null;
  return { ad: r(q('.anuncio-movil')), pre: r(q('.acorde-content pre')),
           bloque: r(q('.acordes-pieza')), figura: r(q('.acorde-card figure')) };
})()
```

Ficha de referencia: `/acordes/pasodoble-al-borde-del-precipicio-los-rancios/`.

**Ojo:** en localhost AdSense no carga y el `<ins>` mide 0 px. Las posiciones
son válidas; en producción el `<pre>` baja ~250 px más por el alto del anuncio.

## Baseline para comparar

| Métrica | Valor el 7 nov 2026 |
|---|---|
| Global 8–19 oct | 43,47 % |
| Global 25 oct–5 nov | 41,99 % |
| Móvil 8–19 oct | 58,84 % |
| Móvil 25 oct–5 nov | 49,17 % |
| Top del anuncio (390×667) | 448 px |
| Top del `<pre>` (390×667) | 677 px |
