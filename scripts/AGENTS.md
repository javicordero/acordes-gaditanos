# Scripts del cancionero

Node ESM que se ejecutan a mano o desde el panel; **ninguno corre en el build**. El detalle
está en `docs/operativa/` y en las skills.

- `publicar-acorde.mjs` es la mecánica de publicación: ajusta la fecha, limpia el `<pre>`,
  pasa `auditar:pre` y `auditar:acordes`, hace un commit por ficha, push y avisos. El panel y
  la skill `subir-acorde` lo usan: no dupliques esa lógica.
- Es el **único** script que hace commit y push local, y solo cuando se le pide publicar. No
  añadas commit ni push a scripts que hacen otra cosa.
- Los `auditar:*` salen con código 1 si algo no cuadra; no los silencies.
- `npm run auditar:docs` comprueba que los `AGENTS.md`, `docs/` y las skills no tengan
  enlaces rotos ni docs huérfanos: pásalo al mover documentación.
- `otraweb` (su contenido y `importar-cancionero.mjs`) es local y está en `.gitignore`.
- Antes de tocar fechas: `publicar-acorde.mjs` pone la de las nuevas **un día después** de la
  última publicada en `HEAD`, no la de hoy.
