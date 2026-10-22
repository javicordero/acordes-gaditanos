# Data Model: Transportador de Acordes

**Date**: 04/09/2026 | **Spec**: [spec.md](./spec.md)

## Entities

### Transportador (runtime state, no persistence)

| Field | Type | Description |
|-------|------|-------------|
| `currentTranspose` | `number` | Semitonos acumulados (0 = original, positivo = subir, negativo = bajar) |
| `preElement` | `HTMLElement` | Referencia al `<pre>` que contiene los acordes |
| `originalChords` | `Map<Element, string>` | Cache del texto original de cada `<a>` para poder resetear |

### Escala Cromática (constante)

| Nota | Índice |
|------|--------|
| Do | 0 |
| Do# | 1 |
| Re | 2 |
| Re# | 3 |
| Mi | 4 |
| Fa | 5 |
| Fa# | 6 |
| Sol | 7 |
| Sol# | 8 |
| La | 9 |
| La# | 10 |
| Si | 11 |

**Total**: 12 notas

### Regex de parsing de acordes

```
/^([DoReMiFaSolLaSi#b]+)(.*)$/
```

- Grupo 1: nota fundamental (incluye sostenidos/bemoles)
- Grupo 2: sufijo (7, m, M7, add9, /Fa, etc.)

Ejemplos:
- `LaM7` → nota=`La`, sufijo=`M7`
- `Fa#m` → nota=`Fa#`, sufijo=`m`
- `Mi/add9` → nota=`Mi`, sufijo=`/add9`
- `Do/Fa` → nota=`Do`, sufijo=`/Fa`

### Estado del botón reset

| `currentTranspose` | Botón reset visible |
|---------------------|---------------------|
| `0` | No (oculto o deshabilitado) |
| `!== 0` | Sí |

### Validación de límites

No hay límites superior/inferior. El usuario puede subir/bajar indefinidamente (módulo 12). La escala cromática es circular: subir 12 semitonos = volver al original.
