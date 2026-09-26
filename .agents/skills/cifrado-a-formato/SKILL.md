---
name: cifrado-a-formato
description: Convierte el texto/cifrado de acordes pegado desde otra web (formato con acordes intercalados en medio de las palabras) al formato propio de Acordes Gaditanos (línea de acordes encima de línea de letra). Usar cuando el usuario pegue texto con acordes intercalados tipo "(Ah)[La]ora quiero (que)[Mi7] te pongas" o pida "pasar este cifrado", "convertir este formato", "pasar acordes de la otra web", "intercalar acordes".
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Convertir Cifrado (otra web) al Formato Acordes Gaditanos

Skill para convertir el texto con acordes que el usuario pega desde **otra web** al formato propio del proyecto `acordes-gaditanos`.

## Diferencias de formato

### Otra web (origen) — acordes INTERCALADOS en las palabras
En la web origen los acordes van **en medio de las palabras**, partiéndolas:

```
(Ah)La ora quiero que te pongas bien cerquita
```

O en el HTML fuente (`.cifrado__linea`, `.segmento` con `data-chord`, `segmento__texto`):

```html
<p class="cifrado__linea">
  <span class="segmento"><span class="segmento__texto">Ah</span></span>
  <span class="segmento" data-chord="La"><span class="segmento__texto">ora quiero qu</span></span>
  <span class="segmento" data-chord="Mi7"><span class="segmento__texto">e te pongas b</span></span>
  <span class="segmento" data-chord="La"><span class="segmento__texto">ien cerquita</span></span>
</p>
```

Esto significa: la palabra "**Ahora**" está partida como "Ah" + (La) "ora", "**que**" como "qu" + (Mi7) "e", "**bien**" como "b" + (La) "ien".

### Formato propio (destino) — LÍNEA de acordes + LÍNEA de letra
En `src/content/acordes/*.md` cada pareja es:
1. **Línea de acordes**: los acordes envueltos en `<a>...</a>`, separados con espacios.
2. **Línea de letra**: el texto debajo, con las palabras **COMPLETAS** (sin partir).

```markdown
<pre>
  <a>La</a>             <a>Mi7</a>             <a>La</a>
Ahora quiero que te pongas bien cerquita
</pre>
```

**Dos reglas clave:**
1. **Juntar las palabras partidas**: "Ah" + "ora" → "Ahora" (completa). El acorde no deja hueco en la línea de letra.
2. **Alinear el acorde por columna**: el acorde va en la línea de acordes en la **misma columna** donde empieza el texto del segmento que lo lleva, es decir, encima de la sílaba donde se intercala el cambio.

## Proceso

### 1. Recoger el texto pegada del usuario
El usuario puede pegar el texto en dos formatos:
- Texto plano con notación entre paréntesis antes del segmento: `(Ah)La ora quiero (que)Mi7 te pongas...`
- El HTML `.cifrado__linea` (con `<span class="segmento" data-chord="...">` y `segmento__texto`).

Extraer los **segmentos**: cada segmento tiene un acorde opcional y un texto.

### 2. Reconstruir la línea de letra y calcular columnas
Recorrer los segmentos de cada línea en orden:

```
texto = ""                    # letra completa
acordes = []                  # cada uno: {pos, chord}
offset = 0
para cada segmento:
    chord = su acorde (o vacío)
    segtext = su texto
    si chord no vacío:
        acordes.push({pos: offset, chord})
    texto += segtext           # concatenación directa (los cortes pegan sin espacio)
    offset += segtext.length
```

- La concatenación directa reconstruye las palabras completas automáticamente (los segmentos ya contienen los espacios que separan palabras reales; los cortes a mitad de palabra se pegan sin espacio).
- **IMPORTANTE**: no hacer `trim()` del texto de cada segmento, o se pierden los espacios finales que separan palabras (ej. "desde la " + "orilla" → "desde la orilla", no "desde laorilla").

### 3. Construir la línea de acordes
- Partir de una línea de espacios con la misma longitud que `texto`.
- Insertar cada acorde como `<a>chord</a>` en su columna `pos`.
- **Insertar de derecha a izquierda** (orden inverso) para no corromper las posiciones.

```
chordLine = " ".repeat(texto.length)
para i desde acordes.length-1 hasta 0:
    ch = acordes[i]
    chordLine = chordLine[0..ch.pos] + "<a>" + ch.chord + "</a>" + chordLine[ch.pos..]
```

- Recortar espacios sobrantes al final de cada línea.
- Si la línea solo tiene letra (sin acordes), no emitir línea de acordes vacía: emitir solo la línea de letra.
- Quedan como pares (acordes + letra) consecutivos, sin líneas en blanco entre parejas.

### 4. `(Sorda)` / `(SORDA)`
La indicación `(Sorda)`/`(SORDA)` en una línea propia se envuelve como `<a>(SORDA)</a>` y se emite como su propia línea (sin línea de letra debajo si no hay texto).

## Ejemplo completo

**Entrada (HTML origen):**
```html
<p class="cifrado__linea">
  <span class="segmento"><span class="segmento__texto">Ah</span></span>
  <span class="segmento" data-chord="La"><span class="segmento__texto">ora quiero qu</span></span>
  <span class="segmento" data-chord="Mi7"><span class="segmento__texto">e te pongas b</span></span>
  <span class="segmento" data-chord="La"><span class="segmento__texto">ien cerquita</span></span>
</p>
```

**Salida (formato propio):**
```
  <a>La</a>             <a>Mi7</a>             <a>La</a>
Ahora quiero que te pongas bien cerquita
```

## Notas
- Escribir el resultado dentro del bloque `<pre>...</pre>` del archivo `.md`.
- La línea de acordes puede quedar más larga que la de letra (los acordes ocupan más columnas que las sílabas); no pasa nada, el contenedor lo tolera.
- Si un acorde coincide con otro muy cerca, mantener la alineación exacta de columnas.
- Al terminar, escribir el resultado al archivo correspondiente y verificar visualmente en el navegador (`npm run dev`).
