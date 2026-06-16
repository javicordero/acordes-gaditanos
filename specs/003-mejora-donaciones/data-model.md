# Data Model: Indicador de donaciones

## Entity: Donación

Entidad que representa una donación individual recibida.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `fecha` | string (DD/MM/YYYY) | Sí | Fecha de la donación |
| `importe` | number (positivo) | Sí | Cantidad donada en euros |
| `donante` | string | No | Nombre del donante. Default: "Anónimo" si no se especifica |

### Validation rules (Zod schema en `src/content/config.ts`)
- `fecha`: validada por regex `/^\d{2}\/\d{2}\/\d{4}$/`
- `importe`: número positivo (> 0)
- `donante`: string opcional; si se omite, se muestra como "Anónimo"

## Content collection: `donaciones`

Único entry: `src/content/donaciones/datos.md`

```yaml
---
donaciones:
  - fecha: "01/06/2026"
    importe: 5
    donante: "Juan"
  - fecha: "28/05/2026"
    importe: 10
...
---
```

El array se envuelve en un objeto con clave `donaciones` porque Astro content collections requieren un objeto como frontmatter raíz.

## Derived data

El componente `DonationIndicator.astro` calcula en frontmatter (build-time):
- **totalRecaudado**: suma de `importe` de todas las donaciones
- **totalDonantes**: count de elementos del array
- **ultimas**: últimos N elementos (3 para variant compact, 10 para timeline), ordenados por fecha descendente

Estos valores se pasan al script del cliente via `define:vars` para renderizado en el navegador. Sin fetch ni cálculos en cliente.
