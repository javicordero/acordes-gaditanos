---
name: create-acorde
description: Crea un archivo markdown de acordes para el Carnaval de Cádiz. Usar cuando el usuario pida "crear acorde", "nuevo acorde", "añadir acorde" o proporcione datos de una canción de Carnaval.
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Crear Archivo de Acordes

Skill para generar archivos markdown de acordes del Carnaval de Cádiz en `src/content/acordes/`.

## Input del Usuario

El usuario proporcionará los datos en formato hablado, por ejemplo:

```
Pasodoble Los locos de la colina
Musica El Noly
Letra Joaquín Sánchez Alba
1986
Chirigota
Cejilla 4
Video https://www.youtube.com/watch?v=XDXMjadGQA0
Imagen https://example.com/imagen.jpg
```

## Tipos de Pieza Soportados

- Pasodoble
- Presentación
- Cuarteta
- Estribillo
- Popurri
- Final de popurrí
- Final de popuri
- Tango
- Credo

## Proceso

### 1. Parsear los datos

Identificar cada campo del input:
- **pieza**: Primer campo (tipo de canción)
- **agrupacion**: Segundo campo (nombre del grupo)
- **year**: Año (número de 4 dígitos)
- **musica**: Después de "Musica" o "Música"
- **letra**: Después de "Letra"
- **modalidad**: Chirigota o Comparsa (opcional)
- **cejilla**: Número de cejilla (opcional, por defecto "0")
- **video**: URL de YouTube (opcional)
- **img / imagen**: URL de imagen (opcional)

### 2. Convertir URL de YouTube

Si el usuario proporciona una URL de YouTube en formato normal:
- `youtube.com/watch?v=XXXX` → `youtube.com/embed/XXXX`
- `youtu.be/XXXX` → `youtube.com/embed/XXXX`

### 3. Generar nombre de archivo

El nombre del archivo debe seguir el formato:
`[tipo-pieza]-[agrupacion-normalizada].md`

Normalización:
- Minúsculas
- Quitar tildes
- Espacios a guiones
- Caracteres especiales eliminados

Ejemplo: `Pasodoble Los locos de la colina` → `pasodoble-los-locos-de-la-colina.md`

### 4. Generar frontmatter

```yaml
---
pieza: Pasodoble
agrupacion: Los locos de la colina
year: 1986
musica: El Noly
letra: Joaquín Sánchez Alba
modalidad: Chirigota
cejilla: 4
img: https://example.com/imagen.jpg
date: "DD/MM/AAAA"
video: 'https://www.youtube.com/embed/XXXX'
---
<pre>
<!-- El usuario añadirá la letra con acordes después -->
</pre>
```

**Importante:**
- `year` y `cejilla` deben ser números (sin comillas)
- `date` debe tener comillas
- `video` debe tener comillas simples

### 5. Crear el archivo

Guardar en `src/content/acordes/[nombre-archivo].md`

## Ejemplo Completo

**Input del usuario:**
```
Pasodoble Los locos de la colina
Musica El Noly
Letra Joaquín Sánchez Alba
1986
Chirigota
Cejilla 4
Video https://www.youtube.com/watch?v=XDXMjadGQA0
Imagen https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi3L8qAlUQ6ZfQP1AL5SanmxgqE1stmma4ovisc1EfHRC8twS-vejQBBuOB1onY6d5-dkWnvG68v18iuZHpNMcYrxHr6lk-vww5tP7DesZNuomtAdolyYikHPEUz6-S7flXcdDi2dLXWXou/s1600/1986loslocosdelacolina.jpg
```

**Archivo generado:** `src/content/acordes/pasodoble-los-locos-de-la-colina.md`

```markdown
---
pieza: Pasodoble
agrupacion: Los locos de la colina
year: 1986
musica: El Noly
letra: Joaquín Sánchez Alba
modalidad: Chirigota
cejilla: 4
img: https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi3L8qAlUQ6ZfQP1AL5SanmxgqE1stmma4ovisc1EfHRC8twS-vejQBBuOB1onY6d5-dkWnvG68v18iuZHpNMcYrxHr6lk-vww5tP7DesZNuomtAdolyYikHPEUz6-S7flXcdDi2dLXWXou/s1600/1986loslocosdelacolina.jpg
date: "05/05/2026"
video: 'https://www.youtube.com/embed/XDXMjadGQA0'
---
<pre>
<!-- Añadir aquí la letra con los acordes -->
</pre>
```

## Notas

- La fecha debe ser la fecha actual en formato DD/MM/AAAA
- Si no se especifica cejilla, usar "0"
- Si no se especifica modalidad, no incluir el campo
- El directorio de destino es siempre `src/content/acordes/`
- Mostrar al usuario la ruta del archivo creado