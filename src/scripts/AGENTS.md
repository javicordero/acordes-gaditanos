# Panel `/admin`: front (`estudio.js`)

`estudio.js` es todo el front; `src/pages/admin.astro` solo lo monta. El flujo está en
`docs/operativa/panel-admin.md`; esto son los invariantes que se rompen al editar.

- El HTML de la lista y del editor se monta por strings: **escapa con `escaparHtml()`**
  (`src/lib/escape.js`). Nunca metas datos de la API en `innerHTML` sin escapar.
- `MODO_LOCAL` lo confirma `/me` (`local: true`), no el hostname: por túnel o por la IP de la
  red el panel sigue en local.
- La pestaña activa se guarda en `sessionStorage`; al volver de **Ver** tiene que recuperarse.
- La clasificación de pestañas está en `esPorRevisar` / `esBorrador` / `esPorPublicar` /
  `esPublicada`. **Revisado ✓** (marca y, en local, promueve) y **Promover** (mueve a
  `acordes`) no son lo mismo.
- La estructura del `<pre>` se toca con `src/lib/editar-lineas.js` (puro); lo prueba
  `npm run auditar:editor`.
- Los estilos de `admin.astro` son `is:global` a propósito: el HTML que pinta el JS no lleva
  `data-astro-cid` y con estilos *scoped* la lista saldría sin ellos.
