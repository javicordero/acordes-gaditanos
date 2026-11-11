# Licencias del glosario de acordes

`glosario-acordes.json` es una mezcla de tres procedencias. Este aviso viaja con el
archivo: si se reutiliza, hay que conservarlo.

## 1. Posiciones históricas de LaCuerda.net

Importadas una sola vez con `scripts/importar-glosario.mjs`. No tienen una licencia
explícita conocida: **no se amplían con más scraping**, solo se mantienen.

## 2. Posiciones propias

Acordes y posturas creados a mano para el cancionero de Acordes Gaditanos. Son del
proyecto.

## 3. Posiciones de `tombatossals/chords-db` (MIT)

Añadidas con `scripts/importar-glosario-mit.mjs` (solo posiciones, sin regenerar el
archivo). Fuente: <https://github.com/tombatossals/chords-db>.

```
MIT License

Copyright (c) 2016 David Rubert

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fuentes descartadas

- `T-vK/chord-collection`: sin licencia, prohibido.
- `szaza/guitar-chords-db-json`: MIT, permite importar con el mismo aviso de
  copyright; de momento no se ha usado.
- AcordesWeb y chordoptions: solo se consultaron como referencia de cobertura.
