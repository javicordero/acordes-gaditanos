# Quickstart: Banner Vuestras Coplas

## What

Componente `BannerCoplasComunidad.astro` que reemplaza a `BannerMartin` en la página de inicio. Muestra un banner a pantalla completa con:
- Título "Vuestras coplas"
- Párrafo 1: Invitación a hacer peticiones y votar
- Párrafo 2: Referencia a donaciones
- Indicador de donaciones (`DonationIndicator`)

## Files to create/modify

| File | Action |
|------|--------|
| `src/components/page/BannerCoplasComunidad.astro` | CREATE |
| `src/pages/index.astro` | MODIFY (import + use) |

## How to verify

```bash
npm run dev
```

Open `http://localhost:4321` and check:
1. Banner shows "Vuestras coplas" title
2. First paragraph has link to `/pedir-copla`
3. Second paragraph mentions donations
4. DonationIndicator renders
5. Responsive at < 640px (background image adapts)
6. Links work correctly

## How to type-check

```bash
npm run astro check
```
