# Autores múltiples en música y letra — Historial de decisiones

> Fecha de inicio: 21/05/2026

---

| # | Fecha | Decisión | Alternativas consideradas | Motivo |
|---|-------|----------|---------------------------|--------|
| 1 | 21/05/2026 | Separar autores por coma en el mismo campo string (`letra: A, B`) | Array YAML (`letra: [A, B]`), o campo separado por pipes | Las comas son intuitivas, no requieren cambiar la sintaxis YAML de los .md existentes, y `split(',')` es trivial |
| 2 | 21/05/2026 | Display con formato "A, B y C" (coma + y antes del último) | Solo comas, solo "y" entre todos | Es el formato natural en español para listas de personas |
| 3 | 21/05/2026 | Acorde aparece en la página de CADA co-autor | Solo en el primer autor, solo si tiene ficha en autores/ | Máxima visibilidad: cada autor merece su página aunque no tenga ficha dedicada |
| 4 | 21/05/2026 | Mantener `musica`/`letra` como strings originales | Eliminarlos y usar solo los arrays | Backward compatibility: otros procesos (PDF, búsqueda, CardsGroup) leen los strings directamente |
| 5 | 21/05/2026 | Mantener `musicaSlug`/`letraSlug` como primer autor | Eliminarlos | Minimizar cambios: Breadcrumb y otros usos del primer slug siguen funcionando |
| 6 | 21/05/2026 | `listasIguales()` comparando arrays ordenados | Comparar strings originales | Con comas los strings difieren aunque los autores sean los mismos (ej: `musica: El Noly` vs `letra: El Noly`) |

---

## Formato de cada entrada

- **#**: Número secuencial
- **Fecha**: DD/MM/AAAA
- **Decisión**: Qué se eligió hacer
- **Alternativas**: Qué otras opciones se consideraron (separadas por coma)
- **Motivo**: Por qué se eligió esta opción sobre las demás
