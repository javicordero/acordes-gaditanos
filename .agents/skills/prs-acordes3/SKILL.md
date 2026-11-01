---
name: prs-acordes3
description: Revisa y fusiona las PRs pendientes de los borradores de acordes3 (las que se crean desde el panel /admin en el móvil). Usar cuando el usuario diga "mira las PRs pendientes", "fusiona las PRs", "trae lo que subí desde el móvil", "¿qué tengo pendiente en acordes3?" o vuelva al ordenador después de editar desde el teléfono.
license: MIT
metadata:
  author: local
  version: "1.0"
---

# PRs pendientes de acordes3

Las fichas que se editan desde el móvil en `/admin` se guardan en una rama y
abren una PR. Esta skill las lista y las fusiona cuando vuelves al ordenador.

## Cuándo usarla

- El usuario dice que ha estado editando desde el móvil y quiere traerlo.
- Pide «mira qué PRs hay», «fusiona las pendientes», «¿qué tengo en acordes3?».
- Antes de empezar a trabajar en local, para no pisar cambios que están en una PR.

## Qué hace cada tipo de PR

| Rama | Qué es | Al fusionar |
|---|---|---|
| `estudio/<slug>-…` | Borrador guardado desde el panel | La ficha entra en `acordes3` en `master`. No se publica ni avisa. |
| `publica/<slug>-…` | «Publicar» desde el panel | La ficha pasa a `acordes` y, al reconstruir, **sale el aviso de Telegram**. |

Por defecto el script **solo toca las de borrador**. Las de publicar se ven con
`--todas` y conviene mirarlas antes: publican de verdad.

## Proceso

### 1. Ver qué hay

```bash
npm run prs
```

Muestra número, tipo, ficha, estado y enlace. El estado tiene que ser `lista`.
Si sale `conflicto`, `checks` o `desfasada`, no se fusiona sola.

### 2. Fusionar los borradores

```bash
npm run prs -- --merge        # pregunta antes
npm run prs -- --merge --si   # sin preguntar
```

Hace squash merge de cada PR y borra la rama. GitHub tiene que darlas por
buenas; `--forzar` se salta esa comprobación y no se recomienda.

Para publicar también lo que esté en `publica/*`:

```bash
npm run prs -- --merge --todas
```

Ojo: eso publica y dispara el aviso de Telegram. Confírmalo con el usuario.

### 3. Traer los cambios

```bash
git pull
```

Sin esto, en local sigues viendo `acordes3` como estaba. Después ya se puede
editar, promover o auditar.

### 4. Publicar los que toquen

Los borradores fusionados están en `acordes3`, sin publicar. Para pasarlos:

```bash
npm run promover -- --slug <slug>     # mueve, pone fecha y borra el borrador
npm run promover -- --todos --dry     # ver qué hay
```

Y después, como siempre, `auditar:pre`, `auditar:acordes` y el commit con
`subir-acorde` (que lanza los avisos).

## Token

El script necesita un token de GitHub porque `gh` no siempre está instalado:

1. Crea un token en <https://github.com/settings/tokens> con permiso
   `public_repo` (el repo es público) o `repo`.
2. Ponlo en `.env` en la raíz:

   ```
   GITHUB_TOKEN=ghp_...
   ```

   El `.env` está en `.gitignore`.

Si tienes `gh` instalado y autenticado, el script lo usa de reserva.

## Errores típicos

- **`Falta GITHUB_TOKEN`**: no hay `.env` o el token caducó. Se crea otro.
- **`conflicto`**: la rama se creó antes de otro cambio en `master`. Se resuelve
  desde GitHub o se vuelve a guardar desde el panel (crea rama nueva).
- **`checks`**: Netlify aún está construyendo el deploy preview. Espera un
  par de minutos y vuelve a listar.
- **Se fusionó pero en local no está**: falta `git pull`.
