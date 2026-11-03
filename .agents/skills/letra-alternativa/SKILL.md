---
name: letra-alternativa
description: Pone los acordes de una ficha existente a una letra nueva de la misma música (pasodobles con varias letras). Usar cuando el usuario pase la letra de una copla que ya está en la web, pida "poner acordes a esta letra", "es la misma música que X", "otra letra del mismo pasodoble" o "sacar los acordes de esta letra".
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Letra alternativa sobre una música que ya está en la web

Skill para crear una ficha nueva a partir de una letra pegada, reutilizando los
acordes de otra ficha de la misma música. El script hace la aritmética de sílabas
y columnas; **el reparto (qué líneas de la letra van en cada verso de la base) lo
decides tú**, que es donde un script falla: repeticiones, «Ay» sueltos, frases
que el usuario parte en dos líneas y estribillos.

## Cuándo usarla

- El usuario pega una letra y dice que es del mismo pasodoble (u otra pieza) que
  una ficha que ya existe.
- El usuario pide "poner los acordes", "aplicar los acordes de X a esta letra",
  "es la misma música que pasodoble-la-azotea"…
- La petición llega como **tarjeta de Trello**: «nueva letra comparsa el cementerio»,
  «pasodoble el cementerio», o con la letra/URL en la descripción.

## Entrada desde Trello

Reconoce la copla con `npm run letras -- reconocer "<título + descripción>"` para sacar
agrupación, año y **base**, y sigue esta skill. La ficha se escribe en
`src/content/acordes/` (local, sin commit), como siempre. Al terminar, apúntala en
`letras-pendientes.md` (`estado "con acordes"`) y métela en «Por revisar» con
`npm run revisar -- --anadir <slug>`. Si falta la base o hay varias candidatas, pregunta
en la tarjeta antes de escribir.

## Datos de entrada

- La letra, tal cual (da igual cómo la corte en líneas).
- La ficha base: slug. Si no lo dice, búscala por agrupación + año + pieza y
  comprueba que comparte `musica` en el frontmatter.
- El título de la letra (`letraTitulo`). Si no lo da, propón el primer verso y
  confírmalo antes de escribir el `.md`.

## Proceso

### 1. Guarda la letra

`.cache/letra-<slug>.txt` (`.cache/` está ignorado por git). Línea por línea, tal
como la pegó el usuario. No la reescribas todavía.

### 2. Mira la estructura

```bash
npm run acordes:plan -- --base <base> --letra .cache/letra-<slug>.txt
```

Devuelve, por cada verso de la base, sus **sílabas métricas** (hasta la última
tónica) y el acorde sobre su sílaba (`Lam«Y» Mi7«nor»`), y después cada línea de la
letra con sus sílabas. Con eso se decide el reparto.

### 3. Decide el reparto (esto es tuyo)

Reglas que funcionan:

- Un bloque de la letra = un verso de la base, **en orden**. La letra tiene que
  caber en los versos de la base; el número de bloques no puede pasarse.
- Casa por **significado** y por **sílabas**: un verso de 15 sílabas no puede
  recibir una frase de 6. Diferencias de ±1 son normales (sinalefas, «pa», «to»).
- Los **saltos de línea del usuario son pistas**, no verdad: une varias líneas en
  un verso si la frase musical es una sola.
- Si una frase cruza dos versos de la base, córtala con `|`:
  `Apaleado | y humillado`.
- Los «Ay», «Ayy», «Olé» sueltos **abren** el verso siguiente, no cierran el anterior.
- Las repeticiones («Soy ese hombre» ×3) van contra los versos repetidos de la
  base, en el mismo orden. Si la letra no repite donde la base sí, salta el verso
  con una línea `-` sola.
- Si la letra acaba antes que la base, no pasa nada: los últimos versos quedan sin usar.

Escribe los `---` (y los `|`) en el `.txt`.

### 4. Genera

```bash
npm run acordes:aplicar -- --base <base> --letra .cache/letra-<slug>.txt --titulo "<título>"
```

Opciones útiles: `--hermanas` (prueba todas las fichas de la misma pieza,
agrupación, año y música y se queda con la que mejor encaja), `--frase "..."`,
`--fecha DD/MM/YYYY`, `--forzar` para sobrescribir, `--destino acordes2` para
dejarlo en la colección provisional, `--dry` para verlo sin escribir.

### 5. Lee el informe y corrige

El informe marca cada verso:

- `⚠️` más de una sílaba de desfase → el reparto está mal ahí. Vuelve al paso 3
  con la línea concreta y regenera con `--forzar`.
- `~` una sílaba → normal; puede ser una sinalefa o una decisión de quien hizo la
  ficha base. No lo toques salvo que el acorde quede claramente fuera de sitio.

Repite hasta que solo queden `~` y los `⚠️` que sean de verdad (un verso corto que
se canta estirando, por ejemplo). **No edites las columnas del `.md` a mano.**

### 6. Revisión fina

Levanta el revisor y dáselo al usuario:

```bash
npm run acordes:revisar -- --slug <slug> --base <base>
```

- El editor es el `<pre>` en texto: los acordes van sin etiquetas, encima de su sílaba. **Alt+←/→** mueve un acorde **una columna**; también puedes escribir, borrar y pegar como en cualquier editor.
- `Ctrl+Z` deshace, `Ctrl+Y` rehace, `Ctrl+S` guarda (vuelve a envolver en `<a>` y respeta los `data-postura`).
- «Comprobar» avisa antes de guardar: acordes perdidos, tokens que no son acordes y acordes sin diagrama.
- A la izquierda tienes la ficha original y a la derecha la base, para comparar.

El revisor abre el 4324, nunca el 4321. Si el usuario no puede abrirlo, dile qué
acordes revisar (los `⚠️`) y en qué sílaba deberían caer. El modo antiguo, que
mueve por sílaba, sigue disponible con `--silabas`.

### 7. Cierra

```bash
npm run auditar:letras
npm run letras -- estado <n> "con acordes" --ficha <slug> --fuente <url>
npm run revisar -- --anadir <slug>
```

Comprueba que el título no se repite en el grupo y que las fichas comparten
música. La ficha ya lleva `letraTitulo`, así que entra sola en el bloque «Letras
de este pasodoble». La última orden la deja en la pestaña **Por revisar** del
panel; tú la publicas cuando quieras con la skill `subir-acorde` (o desde el
panel).

**No commitees**: de eso se encarga la skill `subir-acorde` (que además ajusta la
fecha). Si el usuario pide subirlo, pásale el relevo.

## Errores típicos

- **«La letra pide N versos y la base solo tiene M»**: sobran `---`. Quita los de
  las frases que van juntas.
- **Sale todo desplazado a partir de un punto**: un bloque está mal cerrado y
  todo lo siguiente se arrastra. Compara con el `--plan` original.
- **El resultado es plausible pero falso**: puede que `--hermanas` haya elegido
  otra música del mismo grupo y año (el script avisa si la autoría de `musica` no
  coincide). Fija `--base` a mano.
- **Verso con 4 sílabas frente a 9 de la base**: suele ser un verso corto que se
  canta estirando («Pa donde siempre»). Es correcto si el acorde cae en la última
  sílaba.
- **«La letra parece llevar metadatos de la web»**: el `.txt` arrastra el título
  («Pasodoble …»), el contador de visitas, el año con la agrupación o el pie de
  autoría. Bórralos: no son versos. La primera línea útil suele ser la que empieza
  por la frase que buscabas.
- **El primer acorde no es el que suena**: algunas fichas base empiezan con un
  verso de entrada que la letra nueva no tiene. En ese caso pon una línea `-` sola
  al principio del `.txt` (salta ese verso de la base) y separa **cada** verso con
  `---`; a partir de ahí los acordes caen donde deben. Comprueba la primera línea
  del `<pre>` contra la grabación antes de dar la ficha por buena.

## Referencia

```bash
npm run acordes:plan -- --base <slug> [--letra <txt>]
npm run acordes:aplicar -- --base <slug> --letra <txt> --titulo "..." [--hermanas] [--destino acordes2] [--forzar] [--dry]
npm run acordes:revisar -- --slug <slug> [--base <slug>] [--puerto 4324] [--abrir]
npm run acordes:evaluar [--pares a>b,c>d] [--max-fuera 12] [-v]
```

El `.md` se escribe en `src/content/acordes/` salvo `--destino acordes2`.
