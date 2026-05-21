# Autores múltiples en música y letra — Especificación completa

> Fecha: 21/05/2026
> Estado: Plan ✅ → Spec ✅ → Implementando → Completado

---

## Resumen

Permite que los campos `musica` y `letra` en los archivos `.md` de acordes acepten
múltiples autores separados por coma. Cada autor genera su propia ruta
(`/autor/musica/[slug]`, `/autor/letra/[slug]`) y el acorde aparece en la página
de todos los co-autores.

---

## Motivación

Muchas agrupaciones del Carnaval de Cádiz tienen co-autores en la música y/o la
letra (ej: Paco Cárdenas y Ramón Peñalver). Actualmente el sistema solo soporta
un autor por campo, lo que fuerza a elegir un único autor y perder información.

---

## Alcance

### Incluye
- Múltiples autores en `musica` y `letra` mediante separación por coma
- Cada autor genera su propia página (`/autor/musica/[slug]`)
- Los acordes aparecen en la página de TODOS los co-autores
- Display en la card con formato "Autor1, Autor2 y Autor3"
- Schema.org con arrays de `Person` para múltiples compositores/letristas
- Backward compatibility total con archivos existentes

### No incluye (fuera de scope)
- NO se modifica la colección `autores` (no requiere ficha para existir)
- NO se modifica la búsqueda (ya funciona con el string completo)
- NO se modifica la generación de PDF (usa el string original)
- NO se modifica el sitemap
- NO se crean redirecciones

---

## Formato de entrada

En el frontmatter de los `.md` se escribe igual que antes, permitiendo comas:

```yaml
# Antes (sigue funcionando)
letra: Paco Cárdenas
musica: El Noly

# Nuevo formato
letra: Paco Cárdenas, Ramón Peñalver
musica: El Noly, Juan Carlos Aragón
```

---

## Cambios detallados

| # | Archivo | Tipo | Descripción |
|---|---------|------|-------------|
| 1 | `src/content/config.ts` | Modificar | Añadir `splitAuthors()`, campos array en transform |
| 2 | `src/pages/autor/musica/[autorSlug].astro` | Modificar | Iterar `musicaSlugs[]` en getStaticPaths |
| 3 | `src/pages/autor/letra/[autorSlug].astro` | Modificar | Iterar `letraSlugs[]` en getStaticPaths |
| 4 | `src/pages/acordes/[id].astro` | Modificar | SEO texto, keywords, props arrays a componentes |
| 5 | `src/components/page/AcordeCard.astro` | Modificar | Renderizar múltiples autores con enlaces |
| 6 | `src/components/right-column/SigueTocando.astro` | Modificar | Props: arrays, múltiples `<li>` |
| 7 | `src/components/utils/MusicCompositionSchema.astro` | Modificar | Props: arrays, Schema con arrays de Person |

### Detalle por archivo

#### 1. `src/content/config.ts`

Añadir función auxiliar:

```ts
function splitAuthors(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
```

En el `.transform()`, añadir arrays:

```ts
.transform((data) => {
  const musicaList = splitAuthors(data.musica);
  const letraList = splitAuthors(data.letra);
  return {
    ...data,
    musicaList,
    letraList,
    musicaSlugs: musicaList.map(generateSlug),
    letraSlugs: letraList.map(generateSlug),
    musicaSlug: musicaList[0] ? generateSlug(musicaList[0]) : '',
    letraSlug: letraList[0] ? generateSlug(letraList[0]) : '',
    agrupacionSlug: generateSlug(data.agrupacion),
  };
})
```

#### 2. `src/pages/autor/musica/[autorSlug].astro`

**getStaticPaths:** Cambiar de slug único a iterar arrays:

```ts
acordes.forEach((acorde) => {
  const lista = acorde.data.musicaList ?? [];
  const slugs = acorde.data.musicaSlugs ?? [];
  lista.forEach((nombre, i) => {
    const slug = slugs[i];
    if (!autoresMap.has(slug)) {
      autoresMap.set(slug, { nombre, acordes: [] });
    }
    autoresMap.get(slug)!.acordes.push(acorde);
  });
});
```

**Breadcrumb:** Cambiar `acordes[0]?.data.musicaSlug` por `Astro.params.autorSlug`.

#### 3. `src/pages/autor/letra/[autorSlug].astro`

Mismo cambio que #2 pero con `letraList`/`letraSlugs`.

#### 4. `src/pages/acordes/[id].astro`

Añadir función de formateo:

```ts
function formatearAutores(lista: string[]): string {
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];
  return lista.slice(0, -1).join(', ') + ' y ' + lista[lista.length - 1];
}

function listasIguales(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
```

Actualizar textos SEO, keywords y props a `SigueTocando` y `MusicCompositionSchema`.

#### 5. `src/components/page/AcordeCard.astro`

**Antes:**
```astro
<p><strong>Letra:</strong><a href={`/autor/letra/${letraSlug}`}>{letra}</a></p>
<p><strong>Música:</strong><a href={`/autor/musica/${musicaSlug}`}>{musica}</a></p>
```

**Después:**
```astro
<p>
  <strong>Letra:</strong>
  {letraList.map((nombre, i) => (
    <>{i > 0 && (i === letraList.length - 1 ? ' y ' : ', ')}<a href={`/autor/letra/${letraSlugs[i]}`}>{nombre}</a></>
  ))}
</p>
<p>
  <strong>Música:</strong>
  {musicaList.map((nombre, i) => (
    <>{i > 0 && (i === musicaList.length - 1 ? ' y ' : ', ')}<a href={`/autor/musica/${musicaSlugs[i]}`}>{nombre}</a></>
  ))}
</p>
```

Añadir `musicaList`, `letraList`, `musicaSlugs`, `letraSlugs` al destructuring.

#### 6. `src/components/right-column/SigueTocando.astro`

Props cambian de `{ letra, musica, letraSlug, musicaSlug }` a arrays:
`{ letraList, musicaList, letraSlugs, musicaSlugs }`.

Renderizar un `<li>` por cada autor.

#### 7. `src/components/utils/MusicCompositionSchema.astro`

Props cambian de `{ musica: string, letra: string }` a `{ musicaList: string[], letraList: string[] }`.

Schema cambia de objeto único a arrays:

```ts
composer: musicaList.map(n => ({ '@type': 'Person', name: n })),
lyricist: letraList.map(n => ({ '@type': 'Person', name: n })),
```

---

## Backward compatibility

- Los campos `musica` y `letra` se mantienen como strings (no se eliminan)
- El campo `musicaSlug`/`letraSlug` se mantiene como slug del primer autor
- Los `.md` existentes con un solo autor (sin coma) funcionan igual:
  `letra: Paco Cárdenas` → `letraList: ["Paco Cárdenas"]` → mismo comportamiento
- El PDF no cambia: lee `fm.musica`/`fm.letra` (strings) directamente del frontmatter
- La búsqueda no cambia: busca sobre el string completo

---

## Edge cases

| Caso | Comportamiento esperado |
|------|------------------------|
| Trailing comma (`letra: Autor1, `) | `filter(Boolean)` elimina strings vacíos → `["Autor1"]` |
| Campo vacío/undefined | `splitAuthors` devuelve `[]` |
| Un solo autor sin coma | `splitAuthors` devuelve `["Autor"]` → mismo comportamiento |
| Mismos autores en música y letra | `listasIguales()` detecta y evita duplicar en texto SEO |
| Espacios extra (`letra: Autor1 ,  Autor2`) | `trim()` normaliza cada nombre |
| 3+ autores | `formatearAutores()` → "A, B y C" |

---

## Datos de prueba

Para verificar la feature añadir temporalmente (opcional):

```yaml
# src/content/acordes/pasodoble-test-multiples-autores.md
pieza: Pasodoble
agrupacion: Test múltiples autores
year: 2026
musica: El Noly
letra: Paco Cárdenas, Ramón Peñalver
img: https://via.placeholder.com/480x320
date: "21/05/2026"
---
<pre></pre>
```

---

## Archivos NO modificados

| Archivo | Motivo |
|---------|--------|
| `src/pages/buscar.astro` | Ya funciona con strings |
| `src/pages/agrupacion/[agrupacionSlug].astro` | No usa autores |
| `src/pages/carnaval/[year].astro` | No usa autores |
| `src/content/autores/*.md` | No requiere cambios |
| `src/pages/admin/stats.astro` | No usa autores |
| `scripts/generate-pdf.mjs` | Lee fm.musica/letra (strings) |
| `src/components/page/CardsGroup.astro` | Pasa strings, no cambia |
| `src/components/ui/Card.astro` | Recibe strings, no cambia |
| `src/components/ui/Breadcrumb.astro` | Recibe strings, no cambia |
| `astro.config.mjs` | No afecta |
| `postcss.config.cjs` | No afecta |
