# Fichas del cancionero (`src/content`)

En `acordes`, `acordes3` y `acordes2` un `.md` es una ficha; `autores` y `donaciones` tienen
su propio esquema. El del frontmatter está en `src/content/config.ts`: esa es la fuente de
verdad; no lo repitas de memoria.

- **`acordes`** es lo que está en la web (se compila). **`acordes3`** son borradores y no se
  compila: lo nuevo o a medias vive ahí. **`acordes2`** es la importación del cancionero
  (local, en `.gitignore`).
- En `acordes` y `acordes3` los acordes van **envueltos en `<a>…</a>` dentro de `<pre>`**.
  En `acordes2` van sin envolver a propósito; los envuelve `importar:borrador` o el panel.
- Máximo **55 columnas** por línea dentro del `<pre>` (el editor y `AnchoPreInit` lo miden).
- **`date` es la fecha de alta**, no la de la copla. No la toques a mano: la ajustan
  `publicar-acorde.mjs` y `npm run promover`.
- No inventes campos ni cambies el nombre del archivo: es el slug y la URL.
- Formato, letras alternativas y herramientas: `docs/operativa/cancionero-y-contenido.md` y
  las skills `create-acorde`, `chord-formatting`, `cifrado-a-formato`, `letra-alternativa`.
