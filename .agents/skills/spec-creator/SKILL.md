---
name: spec-creator
description: >-
  Crea y gestiona especificaciones técnicas con estructura de plan, tareas,
  progreso e historial de decisiones. Usar cuando el usuario pida "crear
  especificación", "hacer un plan", "diseñar una feature", "especificar
  requisitos" o similar.
license: MIT
metadata:
  author: local
  version: "1.0"
---

# spec-creator

Skill para diseñar, documentar y ejecutar especificaciones técnicas de features.
Genera una carpeta `specs/<NUMERO>-<NOMBRE_ESPEC>/` en la raíz del proyecto con
4 archivos dentro: especificación completa, tareas, progreso e historial de
decisiones. El número se auto-incrementa según las carpetas existentes.

## Flujo de trabajo

### Fase 1: Plan (solo lectura)

Investigación y diseño de la solución. NO se crean archivos aún.

1. **Entender qué quiere el usuario**
   - Preguntar hasta tener claros todos los requisitos
   - Si el usuario viene con una idea borrosa, ayudar a concretarla

2. **Investigar el código base**
   - Leer los archivos relevantes (config, schemas, componentes, páginas)
   - Identificar todos los puntos de impacto

3. **Diseñar la solución**
   - Definir el formato de entrada (frontmatter, props, etc.)
   - Listar cada archivo a modificar con el cambio exacto
   - Considerar backward compatibility
   - Identificar edge cases

4. **Confirmar con el usuario**
   - Checklist de transición a Spec:
     - [ ] ¿Todos los requisitos están claros?
     - [ ] ¿Se han identificado todos los archivos afectados?
     - [ ] ¿Se han considerado edge cases y backward compatibility?
     - [ ] ¿El usuario ha aprobado el diseño?

### Fase 2: Spec (escritura)

Crear la estructura `specs/<NUMERO>-<NOMBRE_ESPEC>/` con los 4 archivos
usando las plantillas.

1. Listar `specs/` para detectar el siguiente número disponible:
   - Si ya existe `01-*`, `02-*`, etc., el siguiente es el mayor + 1
   - Si no existe ninguna, usar `01`
2. Crear `specs/<NUMERO>-<NOMBRE_ESPEC>/` en la raíz del proyecto
3. Generar `01-especificacion-completa.md` rellenando la plantilla
4. Generar `02-tareas.md` con tareas desglosadas por fase
5. Generar `03-progreso.md` con estado inicial
6. Generar `04-historial-decisiones.md` con las decisiones tomadas
7. Checklist de transición a Implementar:
   - [ ] ¿La especificación está completa y revisada?
   - [ ] ¿El título del .md coincide con el nombre de la feature?
   - [ ] ¿Cada tarea tiene su estimación de esfuerzo?
   - [ ] ¿El usuario confirma que empezamos la implementación?

### Fase 3: Implementar (ejecución)

Ejecutar las tareas definidas en `02-tareas.md` en orden.

1. Seguir el orden de tareas del `02-tareas.md`
2. Después de cada tarea, actualizar `03-progreso.md`
3. Si surgen decisiones nuevas, añadirlas a `04-historial-decisiones.md`
4. Si aparece algo no contemplado en la spec, pausar y consultar al usuario
5. Al finalizar, actualizar todos los archivos de spec con el estado final

## Variables que recolectar durante la Fase 1

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NOMBRE_ESPEC` | Nombre corto para la carpeta y archivos | `autores-multiples` |
| `TITULO_ESPEC` | Título legible para mostrar | "Autores múltiples en música y letra" |
| `DESCRIPCION` | Resumen de 2-3 líneas | "Permite que los campos..." |
| `MOTIVACION` | Por qué se hace | "Hay canciones con co-autores..." |
| `ARCHIVOS_A_MODIFICAR` | Lista con cambios | Tabla en 01-especificacion |
| `ARCHIVOS_NO_TOCAR` | Lista de exclusión | "No se modifica buscar.astro" |
| `EDGE_CASES` | Casos borde | "Trailing comma, empty, etc." |
| `BACKWARD_COMPAT` | Compatibilidad hacia atrás | "Los .md existentes siguen..." |
| `DATOS_PRUEBA` | Datos para testear | Opcional |

## Convenciones de salida

- Todos los archivos en `specs/<NUMERO>-<NOMBRE_ESPEC>/` con encoding UTF-8
- Fechas en formato `DD/MM/AAAA`
- Las tareas en `02-tareas.md` se numeran secuencialmente
- El progreso en `03-progreso.md` usa: 📝 Pendiente / 🔄 En progreso / ✅ Completado / ❌ Bloqueado
- El commit sigue las convenciones de `AGENTS.md` del proyecto

## Git workflow

Al empezar la Fase 3 (Implementar):

1. `git stash push -u -m "<mensaje>"` si hay cambios sin commit
2. `git checkout -b <nombre-feature>` desde master/main
3. Implementar tarea por tarea
4. `git add -A` y `git commit -m "feat: ..."` al completar
5. `git checkout <rama-original>`
6. `git stash pop` si se había stashado algo

## Notas

- La Fase 1 siempre en modo solo lectura (plan mode)
- No saltarse el checklist de transición entre fases
- Consultar `AGENTS.md` del proyecto para comandos de build/test
- Si el proyecto no tiene `AGENTS.md`, el skill NO lo crea
