# Research: Indicador de donaciones

**Date**: 15/06/2026

## Decisions

### 1. Formato del indicador
- **Decision**: Total histórico acumulado (sin meta mensual ni barra de progreso)
- **Rationale**: El usuario prefiere mostrar el impacto comunitario acumulado en lugar de presionar hacia una meta. Genera más confianza.
- **Alternatives considered**: Barra de progreso mensual con goal, timeline de donaciones individuales como lista.

### 2. Carga de datos
- **Decision**: Fetch cliente desde `public/donaciones.json`
- **Rationale**: FR-003 exige actualización sin redeploy. SSG no permite datos dinámicos en build time si cambian frecuentemente. El JSON pesa <1KB, la petición es imperceptible y se cachea en el navegador.
- **Alternatives considered**: Inyección en build time (rechazada: obligaría a rebuildear por cada donación).

### 3. Plataforma de pagos
- **Decision**: Buy Me a Coffee (la actual)
- **Rationale**: Ya está configurada y operativa. Migrar a Ko-fi no aporta beneficio suficiente para el esfuerzo.
- **Alternatives considered**: Ko-fi (0% comisiones), PayPal directo.

### 4. Ubicación del indicador
- **Decision**: Columna lateral derecha (refactorizando `Apoyar.astro`) + banner homepage (`BannerNoly.astro`)
- **Rationale**: La columna derecha está visible en todas las páginas. El banner de homepage es un extra para máxima visibilidad. El usuario sugirió refactorizar el componente existente.
- **Alternatives considered**: Solo columna derecha, solo footer, solo header.

### 5. Estructura del JSON de donaciones
- **Decision**: Array de objetos con fecha, importe y donante opcional
- **Rationale**: El usuario quiere timeline. El array permite calcular totales (sumando importes) y mostrar las últimas N donaciones como lista.
- **Structure**:
  ```json
  [
    { "fecha": "01/06/2026", "importe": 5, "donante": "Juan" },
    { "fecha": "28/05/2026", "importe": 10, "donante": "María" },
    { "fecha": "15/05/2026", "importe": 3 }
  ]
  ```
- **Field rules**: `fecha` (string DD/MM/YYYY, required), `importe` (number positivo, required), `donante` (string opcional, default "Anónimo").

### 6. Arquitectura de componentes
- **Decision**: Componente compartido `DonationIndicator` con prop `variant`
- **Rationale**: Evita duplicar la lógica de fetch y cálculo. El componente acepta `variant: 'compact' | 'timeline'` para adaptar el layout según el contenedor.
- **Alternatives considered**: Lógica duplicada en cada componente, componente sin prop (renderizado fijo).

### 7. Manejo de errores
- **Decision**: Si el JSON falta o es inválido, el indicador se oculta sin romper la página
- **Rationale**: Degradación graceful. El resto de la web debe funcionar independientemente del estado del indicador.
- **Edge case**: Array vacío → mensaje "Sé el primero en apoyar el proyecto". Más de 200 donaciones → mostrar solo últimas 10.
