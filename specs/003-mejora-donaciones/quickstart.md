# Quickstart: Indicador de donaciones

## What you need to do

### 1. Register the content collection

Add `donaciones` collection to `src/content/config.ts`:

```typescript
const donaciones = defineCollection({
  schema: z.object({
    donaciones: z.array(z.object({
      fecha: z.string(),
      importe: z.number(),
      donante: z.string().optional(),
    })),
  }),
});

export const collections = { acordes, autores, donaciones };
```

### 2. Add donation data

Create `src/content/donaciones/datos.md`:

```yaml
---
donaciones:
  - fecha: "01/06/2026"
    importe: 5
    donante: "Juan"
  - fecha: "28/05/2026"
    importe: 10
  - fecha: "15/05/2026"
    importe: 3
    donante: "María"
---
```

### 3. The shared component

`src/components/DonationIndicator.astro` uses `getCollection('donaciones')` in frontmatter, computes totals there, and passes values to client via `define:vars`.

Props: `variant: 'compact' | 'timeline'` (default `'compact'`).

### 4. Integrate into existing components

**`src/components/right-column/Apoyar.astro`**:
- `<DonationIndicator variant="compact" />`

**`src/components/page/BannerNoly.astro`**:
- `<DonationIndicator variant="timeline" />` in the `.apoyar` section

### 5. Test

1. Run `npm run dev`
2. Verify indicator shows in right column on any page
3. Verify indicator shows in BannerNoly on homepage
4. Edit `src/content/donaciones/datos.md`, rebuild (`npm run build`) -> data should update

## Files to modify/create

| Action | File |
|--------|------|
| MODIFY | `src/content/config.ts` |
| NEW | `src/content/donaciones/datos.md` |
| NEW | `src/components/DonationIndicator.astro` |
| MODIFY | `src/components/right-column/Apoyar.astro` |
| MODIFY | `src/components/page/BannerNoly.astro` |
