---
name: transportar
description: Transporta(transpone) acordes de una tonalidad a otra según las equivalencias que indique el usuario. Usa cuando el usuario pida "transportar", "transponer", "cambiar tonalidad" o indicar equivalencias como "de La a Sol".
license: MIT
metadata:
  author: local
  version: "1.0"
---

# Transportar(Transponer) Acordes

Skill para transportar/transponer acordes del Carnaval de Cádiz de una tonalidad a otra. Funciona con cualquier tonalidad origen y destino entre las 12 notas musicales.

## Input del Usuario

El usuario puede proporcionar:
- "Transporta de La a Sol"
- "Transponer de Do a La"
- "Cambia los acordes de Sol a Fa"
- Equivalencias explícitas: "La→Sol, Re→Do, Mi→Re"
- "Quiero subir un tono" / "Bajar un semitono"

## Las 12 Notas Musicales

### Escala Cromática (en orden)
```
Do - Do# - Re - Re# - Mi - Fa - Fa# - Sol - Sol# - La - La# - Si
```

### índice de cada nota (para cálculos)
| Nota | Índice |
|------|--------|
| Do | 0 |
| Do# | 1 |
| Re | 2 |
| Re# | 3 |
| Mi | 4 |
| Fa | 5 |
| Fa# | 6 |
| Sol | 7 |
| Sol# | 8 |
| La | 9 |
| La# | 10 |
| Si | 11 |

## Proceso

### 1. Determinar tonalidad origen y destino

El usuario indica "de X a Y" donde X e Y son notas musicales.

Ejemplos válidos:
- De Do a Sol
- De La a Mi
- De Fa# a Re
- De Sib a Do (o de Si bemol a Do)

### 2. Calcular el intervalo

```
intervalo = índice_destino - índice_origen
```

Ejemplos:
- De La(9) a Sol(7): 7 - 9 = -2 (bajar 2 semitonos = un tono)
- De Do(0) a La(9): 9 - 0 = +2 (subir 2 tonos)
- De Fa(5) a Do(0): 0 - 5 = -5 (bajar 5 semitonos = subir 7 semitonos)

### 3. Crear tabla de equivalencias

Para cada una de las 12 notas, mover esa nota el intervalo calculado.

**Fórmula**: nueva_nota = nota_origen + intervalo

Como es circular (módulo 12), si el resultado es negativo sumar 12, si es >11 restar 12.

### 4. Tablas Precalculadas

#### De La a Sol (bajar un tono = -2)
| Original | Nuevo |
|----------|-------|
| La | Sol |
| La7 | Sol7 |
| LaM7 | SolM7 |
| Lam | Solm |
| Si | La |
| Si7 | La7 |
| Sim | Lam |
| Do | Si |
| Do7 | Si7 |
| Dom | Sim |
| Re | Do |
| Re7 | Do7 |
| Rem | Dom |
| Mi | Re |
| Mi7 | Re7 |
| Mim | Rem |
| Fa | Mi |
| Fa7 | Mi7 |
| Fam | Mim |
| Fa# | Mi |
| Fa#7 | Mi7 |
| Fa#m | Mim |
| Sol | Fa# |
| Sol7 | Fa#7 |
| Solm | Fa#m |

#### De Do a La (subir 2 tonos = +2)
| Original | Nuevo |
|----------|-------|
| Do | Re |
| Do7 | Re7 |
| DoM7 | ReM7 |
| Dom | Rem |
| Re | Mi |
| Re7 | Mi7 |
| Rem | Mim |
| Mi | Fa# |
| Mi7 | Fa#7 |
| Mim | Fa#m |
| Fa | Sol |
| Fa7 | Sol7 |
| FaM7 | SolM7 |
| Fam | Solm |
| Sol | La |
| Sol7 | La7 |
| SolM7 | LaM7 |
| Solm | Lam |
| La | Si |
| La7 | Si7 |
| LaM7 | SiM7 |
| Lam | Sim |
| Si | Do# |
| Si7 | Do#7 |
| Sim | Do#m |
| Do# | Re# |
| Do#7 | Re#7 |

#### De Sol a Fa# (subir un tono = +2)
| Original | Nuevo |
|----------|-------|
| Sol | La |
| Sol7 | La7 |
| Solm | Lam |
| La | Si |
| La7 | Si7 |
| Lam | Sim |
| Si | Do |
| Si7 | Do7 |
| Sim | Dom |
| Do | Re |
| Do7 | Re7 |
| Dom | Rem |
| Re | Mi |
| Re7 | Mi7 |
| Rem | Mim |
| Mi | Fa |
| Mi7 | Fa7 |
| Mim | Fam |
| Fa | Sol |
| Fa7 | Sol7 |
| Fam | Solm |
| Sol# | La# |
| Sol#7 | La#7 |

#### De La a Mi (subir 3 tonos = +3)
| Original | Nuevo |
|----------|-------|
| La | Do# |
| La7 | Do#7 |
| Lam | Do#m |
| Si | Re |
| Si7 | Re7 |
| Sim | Rem |
| Do | Mi |
| Do7 | Mi7 |
| Dom | Mim |
| Re | Fa# |
| Re7 | Fa#7 |
| Rem | Fa#m |
| Mi | Sol |
| Mi7 | Sol7 |
| Mim | Solm |
| Fa | La |
| Fa7 | La7 |
| Fam | Lam |
| Fa# | Si |
| Fa#7 | Si7 |
| Fa#m | Sim |
| Sol | Do |
| Sol7 | Do7 |
| Solm | Dom |

### 5. Aplicar transformación

Para cada acord en el archivo:
1. Extraer la nota fundamental (la parte antes de los sufijos)
2. Buscar la nota nueva en la tabla de equivalencias
3. Añadir los sufijos originales (7, m, M7, maj7, m7, aug, dim, sus2, sus4, add9, etc.)
4. Mantener一切的 modificadores y la barra si la hay (ej: Do/Fa → Re/Sol)

### 6. Preferencias de Notación

#### Notación española (default)
- Usar bemoles: Do#, Reb, Mi, Fa, Sol, La, Si
- Los bemoles se escriben con "b" después de la nota: Sib, Mib, Reb

#### Enarmónicos
Cuando hay dos formas de escribir la misma nota (ej: Fa# = Solb), usar la forma más común según la tonalidad destino:
- Si la tonalidad destino tiene sostenidos, usar sostenidos
- Si la tonalidad destino tiene bemoles, usar bemoles

Ejemplo:
- De Do a Fa# → usar Fa# (no Solb)
- De Do a Sib → usar Sib (no La#)

### 7. Confirmar antes de cambiar

Siempre mostrar la tabla de equivalencias al usuario y esperar confirmación antes de modificar el archivo.

## Ejemplo de Uso

**Usuario dice:** "Transporta de La a Sol"

**Respuesta:** Aquí está la tabla de equivalencias para transportar de La a Sol (bajar un tono):

| Original | Nuevo |
|----------|-------|
| La | Sol |
| La7 | Sol7 |
| LaM7 | SolM7 |
| Lam | Solm |
| Si | La |
| Si7 | La7 |
| Sim | Lam |
| Do | Si |
| Do7 | Si7 |
| Dom | Sim |
| Re | Do |
| Re7 | Do7 |
| Rem | Dom |
| Mi | Re |
| Mi7 | Re7 |
| Mim | Rem |
| Fa | Mi |
| Fa7 | Mi7 |
| Fam | Mim |
| Fa# | Mi |
| Fa#7 | Mi7 |
| Fa#m | Mim |
| Sol | Fa# |
| Sol7 | Fa#7 |
| Solm | Fa#m |

¿Confirmas aplicar estas equivalencias?

**Usuario confirma:** "Sí"

[Aplicar los cambios al archivo]

## Notas

- Esta skill funciona con cualquier par de tonalidades, no solo las precalculadas
- Mantener SIEMPRE los sufijos de los acordes (7, m, M7, maj7, aug, dim, sus2, sus4, etc.)
- Si hay barra (ej: Do/Fa), transponer ambas notas
- Preferir notación española (Sib en lugar de Bb, Mib en lugar de Eb, etc.)
- Si el usuario da equivalencias explícitas (ej: "La→Sol, Re→Do"), usar SOLO esas y dejar los demás sin cambiar