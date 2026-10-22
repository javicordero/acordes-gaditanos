---
name: postura-predeterminada
description: Fija la postura que se muestra por defecto al pinchar un acorde concreto de una pieza. Usar cuando se pida "que este acorde muestre esta postura", "postura predeterminada en la línea X", "que al pinchar salga esta posición" o similar.
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Postura predeterminada de un acorde

Permite que, al pinchar un acorde de una pieza, el diagrama se abra en una postura concreta en vez de en la primera del glosario. La postura se marca en el propio `<a>` del `<pre>`:

```html
<a data-postura="x 0 2 2 2 4">LaM7</a>
```

- El texto del `<a>` sigue siendo solo el acorde (`LaM7`). El atributo no se muestra ni cambia el nombre.
- La postura se escribe con **6 valores, de la 6ª a la 1ª cuerda**, usando `x` (o `X`) para las cuerdas mudas. También se aceptan comas: `-1,0,2,2,2,4`.
- Debe coincidir **exactamente** con una de las posiciones del acorde en `src/data/glosario-acordes.json`. Si no coincide, el popover abre la primera posición.
- El acorde se marca con un asterisco (`*`) en el gráfico y, si la pieza tiene al menos uno, aparece la leyenda «* Postura concreta para esta pieza» en el bloque «Acordes usados».
- El bloque «Acordes usados» usa la misma postura: el botón del resumen y la miniatura del diagrama.

## Proceso

1. Localiza el acorde en el `.md` de la pieza (`src/content/acordes/<slug>.md`). El usuario suele indicar la línea.
2. Comprueba que la postura existe en el glosario:

   ```bash
   node -e "const g=require('./src/data/glosario-acordes.json').acordes; console.log(g['LaM7'].posiciones.map(p=>p.trastes.join(' ')))"
   ```

   Si no existe, primero añádela al glosario (ver la skill `chord-formatting`, sección «Si un acorde no está en el glosario») y después vuelve aquí.

3. Añade `data-postura="..."` al `<a>` del acorde, sin tocar el texto:

   ```html
   <a data-postura="x 0 2 2 2 4">LaM7</a>
   ```

4. No cambies los espacios ni la alineación: el atributo no ocupa sitio en el `<pre>`.
5. Comprueba el build:

   ```bash
   npm run build
   ```

6. Revisa que el popover abre en la postura correcta y que el asterisco aparece.

## Cómo lo resuelve el código

- `src/lib/acordes.ts`: `parsearPostura()` e `indicePostura()` convierten la postura escrita en el índice de la posición del glosario.
- `src/components/page/GlosarioPopover.astro`: al abrir un acorde, usa `data-postura` para empezar en esa posición.
- `src/components/page/AcordeCard.astro`: lee los `data-postura` del cuerpo de la pieza, los pasa a «Acordes usados» y pinta el asterisco de los acordes del `<pre>`.
- `src/components/page/AcordesDeLaPieza.astro`: aplica la postura a los botones y miniaturas de «Acordes usados» y muestra la leyenda si hay alguna.

## Ejemplo

En `src/content/acordes/pasodoble-los-hombres-de-paco.md`:

```html
<a data-postura="x 0 2 2 2 4">LaM7</a>
```

El acorde `LaM7` tiene cuatro posiciones en el glosario; `x 0 2 2 2 4` es la cuarta, así que al pincharlo se abre directamente en esa.

## Notas

- Si el acorde aparece varias veces y quieres la misma postura en todas, repite el atributo en cada `<a>` (o valora un mapa en el frontmatter, que hoy no existe).
- No pongas el asterisco en el texto del acorde: rompe el parser (`*` no es un carácter válido) y el acorde deja de ser interactivo. El asterisco se pinta con CSS.
- El atributo no se propaga al transportador: si se transpone la pieza, el nombre cambia y la postura guardada puede no existir en el acorde transpuesto; el popover cae entonces en la primera posición.
- El `data-postura` debe ir en el `<a>` del `<pre>`, no en el bloque «Acordes usados»: ese bloque lo lee automáticamente del cuerpo de la pieza.
