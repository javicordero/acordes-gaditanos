# {{TITULO_ESPEC}} — Especificación completa

> Fecha: {{FECHA}}
> Estado: {{ESTADO}} (Plan / Spec / Implementando / Completado)

---

## Resumen

{{DESCRIPCION}}

---

## Motivación

{{MOTIVACION}}

---

## Alcance

### Incluye
- {{INCLUYE_1}}
- {{INCLUYE_2}}

### No incluye (fuera de scope)
- {{EXCLUYE_1}}
- {{EXCLUYE_2}}

---

## Formato de entrada

Cómo se escribe en el frontmatter/código fuente:

```yaml
# {{EJEMPLO_ENTRADA}}
```

---

## Cambios detallados

| # | Archivo | Tipo de cambio | Descripción |
|---|---------|---------------|-------------|
| 1 | `{{RUTA_ARCHIVO}}` | {{MODIFICAR/CREAR}} | {{DESCRIPCION_CAMBIO}} |
| 2 | `{{RUTA_ARCHIVO}}` | {{MODIFICAR/CREAR}} | {{DESCRIPCION_CAMBIO}} |

### Detalle por archivo

#### 1. `{{RUTA_ARCHIVO}}`

**Antes:**
```{{LENGUAJE}}
{{CODIGO_ANTES}}
```

**Después:**
```{{LENGUAJE}}
{{CODIGO_DESPUES}}
```

#### 2. `{{RUTA_ARCHIVO}}`

**Antes:** ...
**Después:** ...

---

## Backward compatibility

{{BACKWARD_COMPAT}}

---

## Edge cases

| Caso | Comportamiento esperado |
|------|------------------------|
| {{CASO_1}} | {{COMPORTAMIENTO_1}} |
| {{CASO_2}} | {{COMPORTAMIENTO_2}} |

---

## Datos de prueba

Si aplica, incluir datos específicos para verificar la feature:

```yaml
# {{RUTA_ARCHIVO_PRUEBA}}
{{DATOS_PRUEBA}}
```

---

## Archivos NO modificados

| Archivo | Motivo |
|---------|--------|
| `{{RUTA}}` | {{MOTIVO}} |
| `{{RUTA}}` | {{MOTIVO}} |
