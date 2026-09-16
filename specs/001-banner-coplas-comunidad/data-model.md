# Data Model: Banner Vuestras Coplas

**Date**: 16/09/2026

## Summary

No hay nuevas entidades de datos. El componente es puramente visual y estático.

## Entities

### BannerCoplasComunidad (Componente Astro)

No persiste datos. Es un componente de presentación que renderiza:

| Prop | Tipo | Descripción |
|------|------|-------------|
| (ninguna) | - | El componente no tiene props. Todo el contenido es estático. |

### Datos hardcodeados en el componente

| Campo | Valor |
|-------|-------|
| Título | "Vuestras coplas" |
| Imagen desktop | `https://static.grupojoly.com/clip/e68a84a7-37c4-4bbe-a35c-f859862ca005_source-aspect-ratio_1600w_0.jpg` |
| Enlace peticiones | `/pedir-copla` |
| Enlace donaciones | `/colaborar` |
| DonationIndicator variant | `timeline` |
| DonationIndicator messageC | "Ayuda a que siga subiendo más coplas" |
| DonationIndicator listStyle | `pills` |

## Relationships

```
index.astro
  └── BannerCoplasComunidad.astro
        └── DonationIndicator.astro
```

## Notes

- No hay content collections nuevas
- No hay cambios en el esquema de datos existente
- Las donaciones se muestran desde la collection `donaciones` existente (lectura via DonationIndicator)
