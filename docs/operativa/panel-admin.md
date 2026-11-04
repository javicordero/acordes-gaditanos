# Panel `/admin` — las pestañas de la lista

Detalle del modelo de pestañas del panel. En `AGENTS.md` queda el resumen; **lee esto antes
de tocar la lista** (`src/scripts/estudio.js` y `src/pages/admin.astro`).

## Las cuatro pestañas

Cada ficha sale **en una sola** pestaña. La clasificación combina dos datos: si está en git
(es decir, si está en la web) y si está en la cola de revisión.

| Pestaña | Qué entra |
|---|---|
| **Por revisar** | en `src/content/acordes` **y en git** (ya en la web), sin revisar |
| **Borradores** | en `src/content/acordes3` **∪** `acordes` sin commit, sin revisar y **nuevas** |
| **Por publicar** | `acordes` con cambios que la web aún no tiene: sin commit (modificadas, borradas, sin push o nuevas ya revisadas) **o** en una PR abierta |
| **Publicadas** | `acordes` en git, revisadas y sin PR abierta |

```
sin revisar ─ en git ────────────→ Por revisar
            └ no git ─ nueva ────→ Borradores
                     └ modificada → Por publicar
revisada    ─ en git ────────────→ Publicadas
            └ no git ────────────→ Por publicar
```

Una ficha **publicada y modificada** (en el ordenador o desde el móvil, en una PR) ya está
en la web: lo único que falta es el commit y el push, o fusionar la PR, así que va a **Por
publicar** aunque siga en la cola de revisión (se le pone la marca `SIN REVISAR`). Solo las
**nuevas** sin revisar se quedan en **Borradores**, porque todavía no están en la web.

«En git» significa rastreado y sin cambios pendientes: lo que hay en `master` y sirve la
web. Un commit local sin push (estado `sin-push`) cuenta como no publicado.

## Cómo se avanza

| Desde | Botón | Qué hace |
|---|---|---|
| **Por revisar** | **Revisado ✓** | guarda, sale de la cola → **Publicadas** |
| **Borradores** (`acordes` sin commit y nueva) | **Revisado ✓** | guarda, sale de la cola → **Por publicar** |
| **Borradores** (`acordes3`, en local) | **Revisado ✓** | guarda, sale de la cola **y lo promueve** → **Por publicar** |
| **Borradores** (`acordes3`, en producción) | **Revisado ✓** | guarda y marca; **Promover** abre la PR de publicación |
| **Por publicar** (sin commit) | **Publicar / Subir** | commit + push → **Publicadas** |
| **Por publicar** (`EN PR`) | **Publicar** | fusiona la PR (squash) → **Publicadas** |

El botón va **en la fila**, sin abrir el editor. En el editor sigue estando **Revisado ✓**
en la cabecera, con el mismo efecto. **Promover** (editor) mueve a `acordes` sin marcar
revisado.

## Guardar una ficha publicada

Guardar desde el editor una ficha de `acordes` la deja **al momento** en **Por publicar**, sin
recargar la página, porque es una corrección de algo que ya está en la web:

- **En local** escribe el `.md` en el proyecto y sale con la marca `MODIFICADA` (hará falta
  commit y push). Si el archivo queda idéntico al de git no hay nada pendiente y sigue en
  **Publicadas**.
- **En producción** guarda en una rama y sale con la marca `EN PR` (hay que fusionarla; el
  botón **Publicar** de la fila hace el squash merge).

El panel lo refresca con `/admin/api/lista?solo=pendientes` (cola de revisión + `git status`
+ PRs abiertas de fichas publicadas), sin las llamadas a GitHub de la lista completa.

## De dónde sale cada dato

- **`/admin/api/lista`** (`netlify/functions/lista.mjs`): los borradores (`acordes3`), las
  fichas con PR abierta, la cola de revisión y, en local, las fichas de `acordes` que no
  están en git (`git status` + `git diff origin/master..HEAD`). Una PR es de publicación si
  la rama empieza por `publica/` o si su cuerpo dice que el archivo está en `acordes/` (así
  se reconoce una corrección guardada desde el móvil, que usa una rama `estudio/*`). Con
  `?solo=pendientes` devuelve solo la cola, lo que falta subir y esas PRs: es lo que pide el
  panel tras **guardar** o **promover** para que la ficha aparezca al momento en «Por
  publicar», sin recargar.
- **`/indice-busqueda.json`**: las fichas publicadas que se compilan. Se carga en la página;
  se fusiona con la anterior **por slug** (la de la API manda en `zona`/`local`/PR y el
  índice aporta música y letra para el buscador).
- La lista marca **BORRADOR**, **LOCAL**, **EN GITHUB**, **EN PR**, **SIN REVISAR**,
  **SIN LETRA** (el `<pre>` está vacío) y **SIN ACORDES** (la letra no lleva ningún `<a>`).
  Las incompletas se ordenan arriba. En **Por publicar**, las fichas `MODIFICADA` (una
  corrección de algo ya publicado) van primero; después las `NUEVA`, las `SIN PUSH` y las
  `BORRADA`; las `EN PR` se ordenan con el resto de su mismo tipo. La marca **PROMOVIDA**
  avisa de que la ficha viene de `acordes3` (se promovió y falta publicarla).

Vive en `src/scripts/estudio.js` (`esPorRevisar`, `esBorrador`, `esPorPublicar`,
`esPublicada`) y se pinta en `pintarLista()`.

## Las carpetas y por qué `acordes3` no se quita

- **`acordes`** se compila: todo lo que hay ahí tiene página, entra en el sitemap, en
  `/lista`, en la home y en el buscador.
- **`acordes3`** no se compila. Es lo único que impide que un borrador a medias salga en la
  web: no basta con git, porque los borradores también están commiteados.

Por eso una ficha **sin revisar** vive en `acordes3`, y solo pasa a `acordes` cuando se
revisa (o se promueve a mano). `npm run ajustar:borradores` deja cada una en su sitio:
mueve a `acordes3` las fichas de `acordes` que no están en git y siguen en la cola. Solo
mueve archivos sin rastrear; no toca contenido, no publica y no hace commit.

## Crear una ficha

**Nueva ficha** y **＋** (otra letra de la misma música) crean siempre en `acordes3` con
`zona: 'acordes3'`, así que aparecen en **Borradores**. En local el archivo se escribe en el
proyecto; en producción, en una rama `estudio/<slug>` con PR de borrador. Para avanzarla:
**Revisado ✓** (y en local ya queda en `acordes`, lista para **Publicar**).

## Local y producción

- En **local** (`astro dev`, `ESTUDIO_LOCAL=1`) todo se escribe en el disco y no se crean
  PR. «Por publicar» enseña lo que hay sin commit (`git status`) y, si quedó alguna PR
  abierta (una edición hecha desde el móvil), también, para poder fusionarla. Después de
  fusionar hay que hacer `git pull`.
- En **producción** (Netlify) no hay working tree: «Por publicar» enseña solo las PRs abiertas
  de fichas ya publicadas y «Borradores» se queda en los `acordes3`. Guardar abre/actualiza
  una PR `estudio/*`; **Promover** abre una `publica/*`.

## Avisos al publicar

Al pulsar **Publicar** en «Por publicar» (solo local) se abre un diálogo con las opciones de
aviso:

- **Sin tuit**: solo se manda WhatsApp.
- **Sin etiquetar a nadie en el tuit**: el tuit sale sin etiquetas.
- Sin marcar nada: WhatsApp y X normales.

Las casillas se recuerdan en `localStorage`. Al publicar:

1. El commit y el push disparan **Telegram** solos (`difundir.yml`).
2. Al terminar, el panel lanza los canales marcados (`publicar-acorde.mjs --avisar`).
   Necesitan tu Chrome con la sesión abierta.
3. Si alguno falla, la ficha **queda publicada igual**: el panel dice cuál ha fallado y
   **Copiar aviso** deja el texto para mandarlo a mano.

Las fichas `MODIFICADA`, `SIN PUSH` que no son nuevas y `BORRADA` no llevan aviso: el diálogo
lo dice y no se lanza nada. Desde Netlify no se puede lanzar ninguno (no hay navegador ni
sesión): allí solo se publica (PR) y el texto queda para copiar.

## Comprobarlo

```bash
npm run ajustar:borradores -- --dry   # qué fichas están fuera de sitio y los 4 recuentos
npm run revisar -- --auditar          # la cola apunta a fichas que existen
npm run astro check
```

Los cuatro recuentos tienen que sumar el total de fichas (`acordes` + `acordes3`).
