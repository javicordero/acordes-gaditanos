# Autores múltiples en música y letra — Tareas

> Estimación total: ~2h

---

## Preparación

- [ ] `P-01` — Stash de cambios actuales (`git stash push -u -m "cambios-previos"`) 🟢
- [ ] `P-02` — Crear rama feature (`git checkout -b autores-multiples`) 🟢

---

## Core

- [ ] `C-01` — Modificar `src/content/config.ts`: añadir `splitAuthors()` y campos array 🟡
- [ ] `C-02` — Modificar `src/pages/autor/musica/[autorSlug].astro`: iterar `musicaSlugs[]` 🟡
- [ ] `C-03` — Modificar `src/pages/autor/letra/[autorSlug].astro`: iterar `letraSlugs[]` 🟡

---

## Páginas

- [ ] `P-01` — Modificar `src/pages/acordes/[id].astro`: SEO, keywords, props arrays 🟡

---

## Componentes

- [ ] `CP-01` — Modificar `src/components/page/AcordeCard.astro`: render múltiples autores 🟡
- [ ] `CP-02` — Modificar `src/components/right-column/SigueTocando.astro`: props arrays 🟢
- [ ] `CP-03` — Modificar `src/components/utils/MusicCompositionSchema.astro`: props arrays 🟢

---

## Verificación

- [ ] `V-01` — Ejecutar `npm run build` y verificar que compila 🟡
- [ ] `V-02` — Ejecutar `npm run astro check` para type-check 🔴
- [ ] `V-03` — Revisar que los cambios no rompen nada visualmente 🟡

---

## Commit

- [ ] `CM-01` — Staging y commit con mensaje en español 🟢

---

## Cleanup

- [ ] `CL-01` — Volver a master y recuperar stash (`git checkout master && git stash pop`) 🟢

---

> Leyenda estimaciones: 🟢 <10min | 🟡 10-25min | 🔴 >25min
