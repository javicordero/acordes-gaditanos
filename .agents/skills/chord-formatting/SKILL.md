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
- **Columna 0**: un acorde al principio de línea se escribe **sin espacios delante**. El build le añade la clase `acorde-col0` (plugin `src/lib/remark-acordes-col0.mjs`) y le anula el desplazamiento de 7px del CSS, para que quede alineado con la primera letra de la línea de abajo. No añadas clases ni atributos a los `<a>` ni indentes un acorde que va en la columna 0.
- Solo se detectan los `<a>` que están **dentro de `<pre>`**; fuera del bloque no se enlazan.
- `(Sorda)` y otras anotaciones pueden seguir dentro de `<a>`; no abrirán diagrama porque no son acordes.

### Notación recomendada (la del glosario)

- Fundamentales: Do, Re, Mi, Fa, Sol, La, Si, con `#` o `b` (Do#, Sib…).
- Sufijos: `m`, `7`, `m7`, `maj7` (también `7M`, `M7`, `Maj7`), `6`, `m6`, `9`, `m9`, `maj9`, `add9`, `11`, `13`, `sus`, `sus2`, `sus4`, `sus9`, `7sus4`, `dim`, `dim7`, `m7b5` (o `m7/5`), `aug`, `7b5`, `7maj5`, `mmaj7`, `add11`.
- Inversiones con barra: `Re/Fa#`, `Lam7/Sib`.
- Sin paréntesis: `La(sus9)` → `Lasus9`; `La(Sus2)` → `Lasus2`.
- Se aceptan alias del cancionero (`La7M`, `MiMaj7`, `Sim7/5`, `Mi/add9`), pero mejor usar la forma canónica.

Si un acorde no está en el glosario, se puede dejar en la letra, pero al pulsarlo no se abrirá ningún diagrama.

### Verificación

Después de formatear, comprueba la cobertura:

```bash
node --experimental-strip-types scripts/auditar-glosario.ts
```

Falla si algún acorde válido del cancionero no tiene diagrama. Si aparece uno, corrige la notación o añádelo al glosario con `node scripts/importar-glosario.mjs`.

## Patrón de Acordes a Formatear

Acordes típicos en mayúsculas/minúsculas:

- Notas naturales: La, Re, Mi, Sol, Do, Si
- Notas con sostenido #: Fa#, Sol#, Do#, Re#
- Notas con bemol b: Sib
- Acordes menores: Lam, Rem, Mim, Sim, Fa#m, Do#m
- Acordes con sexta: La6, Re6
- Acordes con séptima: Mi7, La7, Sol7, Re7, Do7, Sim7, Fa#7
- Acordes con variaciones: Mi7b5, Lam7, Fa#m, Do#m, Sol#7
- Acordes suspendidos: Lasus2, Lasus4, Lasus9, Mi7sus4
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
