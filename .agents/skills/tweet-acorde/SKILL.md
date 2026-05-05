---
name: tweet-acorde
description: Genera un tweet para anunciar nuevos acordes de Carnaval de Cádiz. Usar cuando el usuario pida "tweet", "tuit", "anunciar acorde" o "nuevo post".
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Generar Tweet para Acordes

Skill para generar tweets listos para publicar en X/Twitter announcing nuevos acordes del Carnaval de Cádiz.

## Input del Usuario

El usuario puede proporcionar:
- Nombre del autor (ej: "Paco Alba", "El Noly")
- Lista de nombres de acordes
- O simplemente "últimos acordes" para auto-detectar los últimos 3 añadidos

## Tipos de Tweet

### Un solo acorde

```
🆕 Nuevos acordes en la web

🎭 Presentación – Los Humanos
🎵 Antonio Martínez Ares

🔗https://acordesgaditanos.com/acordes/presentacion-los-humanos/
```

### Varios acordes del mismo autor

```
🆕 Nuevos acordes en la web

🎵 Pasodobles de Paco Alba

🎭 Los Beduinos
🎭 Los corrusquillos gaditanos
🎭 Pancho Albachi y sus Mamarrachi

🔗 https://acordesgaditanos.com/autor/musica/paco-alba/
```

## Detectar Tipo de Pieza

El tipo de pieza se detecta del nombre del archivo en `src/content/acordes/`:

- `pasodoble-*.md` → "Pasodoble"
- `presentacion-*.md` → "Presentación"
- `popurri-*.md` → "Popurrí"
- `final-de-popurri-*.md` → "Final de popurrí"
- `cuarteta-*.md` → "Cuarteta"
- `estribillo-*.md` → "Estribillo"
- `tango-*.md` → "Tango"
- `credo-*.md` → "Credo"

Para varios del mismo tipo usar plural: "Pasodobles", "Popurrís", etc.

## Generar URLs

- Acorde individual: `https://acordesgaditanos.com/acordes/[slug-del-acorde]`
- Autor música: `https://acordesgaditanos.com/autor/musica/[slug-del-autor]`
- Autor letra: `https://acordesgaditanos.com/autor/letra/[slug-del-autor]`

Slug: minúsculas, sin tildes, espacios a guiones.

## Proceso

1. **Si el usuario pasa "últimos" o no especifica**: buscar los últimos 3 archivos añadidos en `src/content/acordes/` por fecha de commit o date en frontmatter
2. **Si especifica autor**: buscar todos los acordes de ese autor en la colección
3. **Detectar tipo de pieza** del nombre del archivo
4. **Generar URL**对应的 basada en si es 1 o varios acuerdos
5. **Formatear el tweet** según los ejemplos

## Ejemplos

**Input:**
```
Tweet de los últimos 3 acordes subidos
```

**Output:**
```
🆕 Nuevos acordes en la web

🎵 Pasodobles de El Noly

🎭 Los locos de la colina
🎭 Que viene el coco
🎭 Las brujas Piti

🔗 https://acordesgaditanos.com/autor/musica/el-noly/
```

**Input:**
```
Tweet
Acorde: Presentación Los Humanos
Autor: Antonio Martínez Ares
```

**Output:**
```
🆕 Nuevos acordes en la web

🎭 Presentación – Los Humanos
🎵 Antonio Martínez Ares

🔗https://acordesgaditanos.com/acordes/presentacion-los-humanos/
```

## Notas

- Usar siempre el emoji correcto: 🎵 para tipo de canción, 🎭 para cada acorde
- La URL siempre al final con 🔗
- No incluir año entre paréntesis en los nombres de los acordes
- Si es un solo acuerdo, usar formato corto
- Si son varios del mismo autor, usar formato largo