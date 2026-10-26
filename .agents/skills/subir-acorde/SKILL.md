---
name: subir-acorde
description: Ajusta la fecha de los acordes nuevos al día siguiente del último publicado (commiteado en HEAD) y hace el commit y el push a git. Usar cuando el usuario diga "sube el pasodoble la marea", "sube el acorde de X", "haz commit de este acorde", "commitea este acorde", "sube este acorde a git", "publica el acorde", "haz commit y push del acorde" o similar.
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Subir Acorde a Git

Skill para publicar acordes en git. Antes de commitear, reajusta el campo `date` del
frontmatter para que sea **un día después del último acorde ya publicado**, de forma que
el acorde que se sube quede siempre como el más nuevo. Después hace commit (uno por acorde)
y push.

## Cuándo usarla

Se activa con frases naturales como:

- "sube el pasodoble la marea", "sube el pasodoble de la marea a git"
- "sube el acorde de X", "sube este acorde"
- "haz commit de este acorde", "commitea este acorde"
- "haz commit y push del acorde", "súbelo a git"
- "sube los acordes nuevos", "publica los acordes"
- "súbelo sin avisos", "sube sin posts", "sin avisar" → publicar en la web sin notificar
  en ningún canal (ver paso 6: marcador `[sin aviso]`).

Si el usuario no nombra acordes y dice "este acorde", usar el que esté claro por el
contexto reciente de la conversación o, si no, los `.md` nuevos (sin rastrear) de
`src/content/acordes/`.

## Datos de entrada

- Uno o varios acordes, identificados por:
  - nombre hablado: pieza + agrupación (p. ej. "el pasodoble la marea" → `Pasodoble` + `La Marea`), o
  - slug / nombre de archivo (p. ej. `pasodoble-la-marea`).
- Si hay ambigüedad o varios candidatos, listarlos y pedir confirmación antes de tocar nada.

## Proceso

### 1. Resolver los acordes a subir

Resolver cada acorde pedido a su ruta exacta en la colección oficial:

```powershell
Get-ChildItem -LiteralPath "src\content\acordes" -Filter *.md | Select-Object -ExpandProperty Name
```

Para resolver un nombre hablado, buscar por `pieza` y `agrupacion` del frontmatter
(sin distinguir mayúsculas/tildes):

```powershell
Select-String -Path "src\content\acordes\*.md" -Pattern '^pieza:|^agrupacion:' |
  Group-Object Filename | Where-Object { $_.Group.Line -match 'Pasodoble' -and $_.Group.Line -match 'Marea' }
```

Comprobar si cada archivo ya está rastreado por git:

```powershell
git ls-files --error-unmatch "src/content/acordes/<slug>.md" 2>$null
```

- **Sin rastrear (nuevo)** → candidato normal.
- **Ya rastreado (modificado)** → ya estaba publicado; **avisar antes de cambiarle la
  fecha** y esperar confirmación explícita del usuario.
- Si un acorde pedido no existe en `acordes/`, avisar y continuar con el resto.
- **`src/content/acordes2/` no entra**: es provisional y no cuenta como publicado.

### 2. Calcular el último publicado

La referencia es el **último acorde commiteado (HEAD)**, nunca el working tree (los
acordes nuevos sin commitear no deben contarse a sí mismos):

```powershell
$keys = git grep -h "^date:" HEAD -- "src/content/acordes/*.md" |
  ForEach-Object { ($_ -replace '.*date:\s*', '').Trim('"', "'") } |
  ForEach-Object { $p = $_ -split '/'; [int]$p[2] * 10000 + [int]$p[1] * 100 + [int]$p[0] }
$maxKey = ($keys | Measure-Object -Maximum).Maximum
```

Se compara por componentes (`A*10000 + M*100 + D`) para que las fechas inválidas
existentes (p. ej. `31/09/2026`) no rompan el cálculo.

### 3. Calcular las fechas nuevas

Convertir la clave máxima a fecha y sumar un día por acorde:

```powershell
$y = [int]($maxKey / 10000); $m = [int](($maxKey % 10000) / 100); $d = [int]($maxKey % 100)
$base = (Get-Date -Year $y -Month $m -Day 1).AddDays($d - 1)   # tolera días inválidos
```

- Un solo acorde → `$base.AddDays(1)`.
- Varios acordes → fechas **consecutivas** (`+1`, `+2`, …) en **orden alfabético de archivo**.

Formatear siempre como `dd/MM/yyyy`.

### 4. Aplicar la fecha

En cada archivo, reemplazar **solo** la línea del frontmatter:

```yaml
date: "FECHA_ANTIGUA"
```

por:

```yaml
date: "DD/MM/AAAA"
```

No modificar ningún otro campo ni el contenido (letra y acordes). **No** envolver nada
en `<a>`.

### 5. Verificar

Comprobar, antes de commitear:

- Cada fecha nueva es mayor que todas las fechas de HEAD.
- Los archivos siguen teniendo el mismo contenido salvo la línea `date`.

Si la verificación falla, **abortar sin commitear** e informar.

### 6. Commit (uno por acorde)

Stagear **solo** el archivo del acorde y commitear con el mensaje `acordes Pieza Agrupación`,
copiando `pieza` y `agrupacion` del frontmatter **tal cual** (respetando mayúsculas y tildes):

```powershell
git add -- "src/content/acordes/<slug>.md"
git commit -m "acordes <Pieza> <Agrupación>"
```

Ejemplo: `git commit -m "acordes Pasodoble La Marea"`.

Si hay varios acordes, repetir `git add` + `git commit` para cada uno (un commit por acorde),
en el mismo orden alfabético en que se asignaron las fechas.

**Nunca** usar `git add .` ni `git add -A`: el working tree puede tener otros cambios
(configuración, docs, otros acordes) que no deben subirse.

Si el usuario pide **subir sin avisos** («súbelo sin avisos», «sin posts», «sin avisar»),
añadir `[sin aviso]` al final del asunto del commit:

```powershell
git commit -m "acordes <Pieza> <Agrupación> [sin aviso]"
```

Ese marcador hace que la Action de Telegram no notifique (`difundir.mjs` lo comprueba) y
que no se lancen ni WhatsApp ni X. El `.md` se publica en la web igual que siempre.

### 7. Push

Un único push al final:

```powershell
git push origin master
```

Si el push falla, informar del error y avisar de que los commits quedan locales.

### 7-bis. Aviso en WhatsApp (si el acorde es nuevo)

Telegram lo manda solo la Action al hacer push. WhatsApp no tiene API oficial, así que se
publica desde este equipo con Chrome y Playwright, **después** del push:

```powershell
npm run wa -- --solo <slug>[,<slug>]
```

- Solo para `.md` **nuevos**. Si se está editando o cambiando la fecha de una copla ya
  publicada, no se avisa (la misma regla que Telegram).
- El script espera a que la ficha responda 200 (1-2 min tras el push), abre el canal
  «Acordes Gaditanos», escribe (vaciando antes cualquier borrador) y **envía solo** tras
  15 s de margen: si el usuario cierra la ventana en ese tiempo, no se envía nada.
- Lanzarlo en segundo plano y decir al usuario que se publica solo, que **no cierre la
  ventana** si quiere que se confirme y se apunte en `wa-enviados.json`.
- Con `--manual` vuelve al modo anterior (deja el mensaje escrito y espera el Enter).
- Si sale `2` (sesión caducada): pedir que ejecute `npm run wa:login` y dejar el texto
  del aviso a mano para pegarlo, sin reintentar en bucle.
- Si sale `5` (no enviado o no confirmado): comprobar el canal antes de repetir; para
  repetir, `--forzar`.
- Si sale `3` o `4`: mirar la captura de `wa-debug/` y avisar de que los selectores de
  WhatsApp pueden haber cambiado.
- Guardar el `MENSAJE` completo (o el texto del `--dry-run`) en la respuesta, para que se
  pueda pegar a mano si algo falla.

### 7-ter. Aviso en X (si el acorde es nuevo)

Mismo patrón que WhatsApp, después del push y también solo para `.md` **nuevos**:

```powershell
npm run x -- --solo <slug>[,<slug>]
```

- Formato: cabecera «🆕 Nuevos acordes en la web», línea `🎭 Pieza – Agrupación`,
  `🎵 música` y `✏️ letra` (si son la misma persona, una sola línea) y el enlace al final.
- Descarga el `img` del `.md`, lo valida (WebP/JPEG/PNG/GIF y ≤5 MB) y lo adjunta.
- Etiqueta en la imagen a @Carnavaladictos y @Orteguilla25 (constante `ETIQUETAS` en
  `scripts/lib/tuit.mjs`). Si X no encuentra alguna, avisa y publica igual: no se aborta.
- Escribe el tuit (vaciando antes cualquier borrador) y **publica solo** tras 15 s de
  margen. Con `--manual` deja el tuit escrito esperando «Publicar».
- Verifica el tuit en `x.com/<cuenta>` antes de darlo por bueno; si no lo confirma, sale
  con `5` y no lo marca como publicado.
- Códigos: `2` sesión caducada (`npm run x:login`), `3` compositor no encontrado
  (mirar `x-debug/`), `5` no publicado.
- Si hay varias coplas, el tuit lleva una línea por copla y el enlace a `/lista/`.
- Recordar que el enlace externo reduce alcance en X, pero no hay penalización escrita ni
  riesgo de «softban» a este volumen: un tuit por copla, imagen adjunta y sin repetir.

### 8. Reportar

Informar de:

- Acordes subidos (ruta final, fecha anterior → fecha nueva).
- Mensaje de commit de cada uno.
- Resultado del push.
- Resultado del aviso de WhatsApp (enviado, pendiente de Enter o fallido con el motivo).
- Resultado del tuit (publicado, pendiente de «Publicar» o fallido con el motivo).
- Acordes omitidos por no existir o pendientes de confirmación.

## Ejemplo

Con el repo en su estado habitual, "sube el pasodoble la marea":

- Archivo: `src/content/acordes/pasodoble-la-marea.md` (nuevo, sin rastrear).
- Último publicado en HEAD: `23/10/2026`.
- Fecha nueva: `24/10/2026`.
- `git commit -m "acordes Pasodoble La Marea"`.
- `git push origin master`.

Con dos acordes (`el circo` y `la marea`), en orden alfabético:

| Archivo | Fecha nueva | Commit |
|---|---|---|
| `pasodoble-el-circo.md` | máx + 1 | `acordes Pasodoble El Circo` |
| `pasodoble-la-marea.md` | máx + 2 | `acordes Pasodoble La Marea` |

Y un solo `git push origin master` al final (siempre y cuando la intención del usuario sea subir ambos a la vez).

## Notas

- La referencia es **siempre HEAD** (último commit local), no el working tree ni `acordes2/`.
- La fecha de un acorde ya publicado no se toca salvo que el usuario lo pida explícitamente.
- El mensaje de commit respeta el frontmatter: `acordes <Pieza> <Agrupación>`.
- Un commit por acorde; un solo push al final.
- Solo se modifica la línea `date`; el contenido (letra y acordes) nunca se altera.
- No envolver acordes en `<a>` (eso es `chord-formatting`).
- Herramientas: `git add`, `git commit`, `git push` y la edición del `date` del frontmatter.
- Flujo típico: `promover-acorde` → `chord-formatting` → **`subir-acorde`**.
