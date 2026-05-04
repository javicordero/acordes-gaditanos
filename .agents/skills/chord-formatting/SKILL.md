---
name: chord-formatting
description: Formatea acordes envolviéndolos en etiquetas <a>. Usar cuando se pide "envolver acordes", "formatear acordes", "añadir etiquetas a acordes" o "dar formato a файлы de acordes".
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Formateo de Acordes

Skill para formatear archivos de acordes de Carnaval de Cádiz envolviendo los acordes en etiquetas `<a>`.

## Formato de Acordes

Los archivos de acordes están en `src/content/acordes/*.md`. Cada acorde en el contenido debe estar envuelto en `<a>`:

```markdown
<pre>
<a>La</a>                                           <a>Mi7</a>
Como salidas de un cuento se presentan ante ustedes
                   <a>Re</a> 
las famosas brujas Piti
               <a>Mi7</a>               <a>La</a>
</pre>
```

## Patrón de Acordes a Formatear

Acordes típicos en mayúsculas/minúsculas:
- Notas naturales: La, Re, Mi, Sol, Do, Si
- Notas con sostenido #: Fa#, Sol#, Do#, Re#, La#
- Acordes menores: Lam, Rem, Mim, Sim
- Acordes con séxtas: La6, Re6
- Acordes con séptima: Mi7, La7, Sol7, Re7, Do7, Sim7, Fa#7
- Acordes con variaciones: Mi7b5, Lam7, Fa#m, Do#m
- Acordes de dominante: Sol#7, Do#m

## (Sorda) - Caso Especial

`(Sorda)` es una indicación musical que aparece al inicio de líneas (como un acorde) y debe formatearse como `<a>(Sorda)</a>`.

**Ejemplos:**
- `<a>(Sorda)</a>` al inicio de línea
- `(Sorda)` al inicio de línea

**NO formatear cuando:**
- Aparece entre texto en medio de una frase (ej: "la sorda del pueblo")
- Como parte de la letra de la canción

## Proceso

1. Leer el archivo de acordes
2. Identificar todos los acordes (patrones: palabras que son notas musicales o derivados)
3. Envolver cada acorde con `<a>...</a>`
4. Preservar el resto del contenido (letra, espacios, puntuación)
5. Verificar que no queden acordes sin formatear

## Ejemplo de Transformación

**Antes:**
```
La                                           Mi7
Como salidas de un cuento se presentan ante ustedes
                   Re 
las famosas brujas Piti
```

**Después:**
```
<a>La</a>                                           <a>Mi7</a>
Como salidas de un cuento se presentan ante ustedes
                   <a>Re</a> 
las famosas brujas Piti
```

## Notas

- Solo formatear dentro de bloques `<pre>` si existen
- Mantener la posición original del acorde
- No formatear palabras que contengan notas como parte de otras palabras (ej: "luna" no es "La" + "na")
- Verificar contra otros archivos del proyecto para consistencia