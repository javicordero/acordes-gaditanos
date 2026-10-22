---
name: chord-formatting
description: Formatea acordes envolviéndolos en etiquetas <a>. Usar cuando se pide "envolver acordes", "formatear acordes", "añadir etiquetas a acordes" o "dar formato a archivos de acordes".
license: MIT
metadata:
  author: local
  version: "1.1"
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

## Compatibilidad con el glosario

El glosario (`/glosario`) y el diagrama emergente funcionan **automáticamente** con cualquier acorde envuelto así dentro de un `<pre>`:

```html
<pre>
<a>La</a>    <a>Mi7</a>    <a>Sim7/5</a>
</pre>
```

- **No hay que añadir nada más**: ni `href`, ni `class`, ni `data-acorde`, ni atributos ARIA. El popover añade `data-acorde`, `role`, `tabindex` y `aria-*` en el navegador.
- El texto del `<a>` debe ser **solo el símbolo del acorde**. El popover usa ese texto para buscarlo en el glosario y muestra su diagrama si existe.
- **No pongas `href`**: el enlace navegaría en vez de abrir el diagrama.
- Solo se detectan los `<a>` que están **dentro de `<pre>`**; fuera del bloque no se enlazan.
- `(Sorda)` y otras anotaciones pueden seguir dentro de `<a>`; no abrirán diagrama porque no son acordes.

### Notación recomendada (la del glosario)

- Fundamentales: Do, Re, Mi, Fa, Sol, La, Si, con `#` o `b` (Do#, Sib…).
- Sufijos: `m`, `7`, `m7`, `maj7` (también `7M`, `M7`, `Maj7`), `6`, `m6`, `9`, `m9`, `maj9`, `add9`, `11`, `13`, `sus`, `sus2`, `sus4`, `sus9`, `7sus4`, `dim`, `dim7`, `m7b5` (o `m7/5`), `aug`, `7b5`, `7maj5`, `mmaj7`, `add11`.
- Inversiones con barra: `Re/Fa#`, `Lam7/Sib`.
- Sin paréntesis: `La(sus9)` → `Lasus9`; `La(Sus2)` → `Lasus2`; `La(susb6/9)` → `Lasusb6/9`.
- Se aceptan alias del cancionero (`La7M`, `MiMaj7`, `Sim7/5`, `Mi/add9`), pero mejor usar la forma canónica.

Si un acorde no está en el glosario, se puede dejar en la letra, pero al pulsarlo no se abrirá ningún diagrama. En ese caso sigue el flujo de la sección siguiente.

### Verificación

Después de formatear, comprueba la cobertura:

```bash
node --experimental-strip-types scripts/auditar-glosario.ts
```

Falla si algún acorde válido del cancionero no tiene diagrama.

## Alineación y desplazamiento

Cada acorde lleva un pequeño desplazamiento a la derecha (`left`) para quedar sobre su sílaba. El desplazamiento depende de la **columna visible** en la que empieza el acorde (los `<a>` no ocupan sitio; solo cuenta el texto):

| Columna | Desplazamiento | Clase |
|---|---|---|
| 0 | 0px | `acorde-col-0` |
| 1–10 | 1px | `acorde-col-1` |
| 11–20 | 3px | `acorde-col-2` |
| 21–30 | 5px | `acorde-col-3` |
| 31–45 | 7px | `acorde-col-4` |
| 46+ | 8px | `acorde-col-5` |

La clase la pone el build (plugin `src/lib/remark-acordes-columna.mjs`): **no añadas `style`, clases ni atributos a los `<a>`**. Lo que sí importa es que la columna sea exacta: cuenta caracteres de texto visible, sin los `<a>`. Un espacio de más o de menos desplaza el acorde y puede cambiarle el tramo.

Ejemplo: en `<a>Sol</a>    <a>Do</a>`, `Sol` está en la columna 0 y `Do` en la 7 (no en la 14): `<a>Sol</a>` no ocupa esas 7 columnas.

## Si un acorde no está en el glosario

Cuando la auditoría detecte acordes sin diagrama (o al revisar un cifrado), comprueba cada uno:

```bash
node --experimental-strip-types scripts/sugerir-acorde.ts "Mi9" "Re/Fa#"
```

- Si existe: `OK (slug, N posiciones)`.
- Si no existe: indica el motivo y muestra **acordes parecidos** disponibles (misma fundamental, enarmonía y sufijos similares).

**Avisa siempre al usuario antes de tocar el contenido**, por ejemplo:

> El acorde `X` no está en el glosario. ¿Quieres añadirlo con ese nombre o cambiarlo por uno de estos similares: `Mimaj7`, `Mimaj9`, `Mi6`…?

Dos opciones:

1. **Añadirlo al glosario**: crea sus posiciones en `scripts/importar-glosario.mjs` (nuevo modo o `posicionesManuales`) o añade la entrada al JSON; ejecuta el importador y la auditoría, y comprueba que el diagrama se pinta.
2. **Cambiarlo por uno similar**: sustituye `X` por el nombre elegido en el `.md` y vuelve a pasar la auditoría.

No cambies el acorde por iniciativa propia: decide el usuario.

## Patrón de Acordes a Formatear

Acordes típicos en mayúsculas/minúsculas:

- Notas naturales: La, Re, Mi, Sol, Do, Si
- Notas con sostenido #: Fa#, Sol#, Do#, Re#
- Notas con bemol b: Sib
- Acordes menores: Lam, Rem, Mim, Sim, Fa#m, Do#m
- Acordes con sexta: La6, Re6
- Acordes con séptima: Mi7, La7, Sol7, Re7, Do7, Sim7, Fa#7
- Acordes con variaciones: Mi7b5, Lam7, Fa#m, Do#m, Sol#7
- Acordes suspendidos: Lasus2, Lasus4, Lasus9, Lasusb6/9, Mi7sus4
- Acordes con novena: Mi/add9, Lad9, Dom9
- Acordes semidisminuidos: Sim7/5, Do#m7/5
- Inversiones: Re/Fa#, Lam7/Sib

## (Sorda) - Caso Especial

`(Sorda)` es una indicación musical que aparece al inicio de líneas (como un acorde) y puede formatearse como `<a>(Sorda)</a>`. No es un acorde: el glosario no le asociará ningún diagrama.

**Ejemplos:**
- `<a>(Sorda)</a>` al inicio de línea
- `(Sorda)` al inicio de línea

**NO formatear cuando:**
- Aparece entre texto en medio de una frase (ej: "la sorda del pueblo")
- Como parte de la letra de la canción

## Proceso

1. Leer el archivo de acordes.
2. Identificar todos los acordes (patrones: palabras que son notas musicales o derivados).
3. Envolver cada acorde con `<a>...</a>`.
4. Preservar el resto del contenido (letra, espacios, puntuación).
5. **No dejar espacios ni tabuladores al final de línea** dentro del `<pre>`: la línea termina justo después del último carácter (letra o `</a>`). La indentación inicial sí se conserva porque es la que alinea el acorde con la letra.
6. Verificar que no queden acordes sin formatear y que todos los que existan en el glosario estén en notación reconocible.
7. Ejecutar la auditoría del glosario (ver arriba).

Para comprobar o corregir los espacios finales:

```bash
node scripts/trim-pre-whitespace.mjs --dir src/content/acordes --dry-run
```

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

- Solo formatear dentro de bloques `<pre>` si existen; el glosario solo lee esos bloques.
- Mantener la posición original del acorde.
- No formatear palabras que contengan notas como parte de otras palabras (ej: "luna" no es "La" + "na").
- Verificar contra otros archivos del proyecto para consistencia.
