# Rendimiento: primeros números (Strobe)

Medido con [Strobe](https://github.com/Hona/strobe) `@hona/strobe` 0.6.0 el 4 de
noviembre de 2026. Los benchmarks viven en [`perf/`](../../perf/README.md) y se repiten
con `npm run perf:check` (validar) y `--base` / `--head` (comparar).

> **Qué es esto y qué no.** Son mediciones reales de *esta* máquina, con las cifras
> tal como salieron. Las de local son **una pasada de `--check`** (n = 1, cachés
> frías): sirven para saber dónde mirar, no para decidir si algo mejoró. Las de
> producción son grabaciones de atribución. Nada de aquí está estimado a ojo.

## Entorno

| | |
|---|---|
| Sistema | Windows 11 26300 (26H2) |
| CPU | AMD Ryzen 7 7800X3D, 8 núcleos / 16 hilos |
| GPU | NVIDIA RTX 4080 SUPER |
| Pantalla | 144 Hz, desbloqueada |
| Navegador | Chrome 156 |
| Plan de energía | Equilibrado; los benchmarks pasan a Alto rendimiento y lo devuelven |
| Modo profundo | **No instalado** (UAC rechazado): sin eventos de presentación del sistema ni stacks nativos. Los frames los cuenta Chromium por dentro, que basta para estos casos |

## Local (sin publicidad)

Viewport 390×844. Terceros de red cortados en `prepare` (GTM, Cloudflare, YouTube,
AdSense). `/lista` y `/glosario` recorridos con 4.000 px de scroll.

| Caso | Métrica principal | Valor | Otras |
|---|---|---|---|
| `home-carga` | `main.work` | **43,6 ms** | script 3,1 ms · layout 11,6 ms · 0 % frames perdidos |
| `ficha-carga` | `main.work` | **33,6 ms** | script 3,1 ms · layout 4,4 ms · 0 % frames perdidos |
| `glosario-busqueda` | `main.work` | **62,0 ms** | script 20,5 ms · style 9,7 ms · `interaction.p95` 20,7 ms |
| `glosario-scroll` | `main.busy` | **2,68 %** | script 2,7 ms |
| `lista-scroll` | `main.busy` | **7,70 %** | script 3,0 ms |
| `lista-filtro` | `main.work` | **171 ms** | script 6,0 ms · **layout 40,3 ms** · `interaction.p95` 19,5 ms |
| `ficha-transponer` | `main.work` | **25,8 ms** | script 7,3 ms · layout 4,5 ms |
| `ficha-autoscroll` | `main.busy` | **2,46 %** | script 4,5 ms · **5,19 % frames perdidos** |
| `ficha-acorde` | `main.work` | **4,36 ms** | script 1,0 ms (abrir el popover es barato) |
| `navega-con-prefetch` | `main.work` | **16,6 ms** | script 1,1 ms |

**Ruido del método.** Esta tabla es **una** pasada. Repetirla mueve cosas: en la
segunda tanda `lista-filtro` dio 129 ms (antes 171) y `home-carga` 3,45 ms de layout
(antes 11,6). Es la prueba de que n = 1 no decide nada: sirve para ver el orden de
magnitud y dónde mirar. Para decidir, A/B.

Y el A/A lo concreta (6 pares, mismo build a los dos lados): `lista-filtro`
161 ms vs 160 ms, −0,2 %, IC −2,0 % … +2,3 %, veredicto `unclear`. Es decir: **con 6
pares, una mejora por debajo del ~2 % no se distingue**. Para cambios pequeños hacen
falta más pares.

## Producción (con AdSense, GTM y YouTube)

Contra `https://acordesgaditanos.com`, mismo viewport, grabación con atribución
(CPU por función, layouts forzados, GC). **No se comparan versiones aquí**: el
contenido cambia; sirve para saber cuánto cuesta la web tal como la recibe un usuario.

| Página | `main.work` | script | layout | style | Red | Frames perdidos |
|---|---|---|---|---|---|---|
| Home | **115 ms** | 24,6 ms | 7,3 ms | 8,6 ms | 47 peticiones · 145 KB | 10,0 % |
| Ficha | **142 ms** | 33,5 ms | 25,0 ms | 10,5 ms | 50 peticiones · 200 KB | **38,9 %** |

Comparado con local (misma página, mismos selectores): cargar la home cuesta
**+71 ms** de hilo principal y la ficha **+108 ms**. Eso es lo que añaden la
publicidad, GTM y el reproductor, y es la mayor diferencia que hay en toda la medición.

Y no es solo tiempo de CPU: **fuerza maquetación**.

- Home: 19 layouts y 28 recálculos de estilo por pasada (9,86 ms, **5 % del trabajo
  del hilo principal**), casi todo desde
  `pagead2.googlesyndication.com/…/show_ads_impl_fy2021.js`.
- Ficha: 34 layouts y 49 recálculos (24,6 ms, **12 %**), y el que más pesa es
  `doAdjustAttempt` (40,1 % + 38,8 % del layout forzado), el ajuste automático de
  tamaño de los anuncios, inyectado en la propia página.

## Cuellos de botella, por orden de tamaño

1. **La publicidad en la ficha**: +108 ms de hilo principal y 12 % de trabajo en
   layouts forzados, con un 38,9 % de frames perdidos durante la carga. Es lo más
   caro y lo único que además afecta a los ingresos, así que se toca con cuidado.
2. **El filtrado de `/lista`**: 129–171 ms de `main.work` con 29–40 ms de layout,
   entre tres y cinco veces la carga de la home. El HTML de `/lista` son **1,26 MB**
   (611 fichas con todos sus `data-*`); marcar una casilla recorre la lista entera y
   recalcula el recuento de todas las facetas (`aplicar()` en
   `src/components/page/FiltrosLista.astro`).
3. **10 módulos de JS por ficha** (`page`, `Layout`, `SugerenciasBusqueda`,
   `AcordesDeLaPieza`, `GlosarioPopover`, `AcordeCard`, `InstalarAppCard`,
   `AvisoInstalar`, `AvisoAvisos`, `PrefetchTap`), además de GTM y Cloudflare.
   En local se nota poco (33,6 ms), pero cada módulo es una petición y una
   evaluación en el móvil.
4. **El glosario escribir**: 62 ms para 15 teclas (~4 ms por tecla) y `interaction.p95`
   de 20,7 ms. No es grave; el scroll del glosario (2,68 %) va mejor que el de
   `/lista` (7,70 %).
5. **El autoscroll de la ficha**: 5,19 % de frames perdidos. Barato de arreglar si se
   confirma con más pares.

## Propuestas (ordenadas por impacto y esfuerzo)

Ninguna está implementada: son hipótesis a validar con `--base` / `--head` antes y
después. Un cambio por tarjeta, con su medición.

| # | Cambio | Impacto esperado | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | Revisar **Auto Ads** de AdSense (o limitar a un formato) para que deje de redimensionar: es el `doAdjustAttempt` que fuerza 34 layouts por carga | Alto (hasta 12 % del hilo principal en la ficha) | Bajo (panel de AdSense) | **Ingresos**: medir una semana, no un día |
| 2 | `/lista`: `content-visibility: auto` en las secciones por año y no recalcular las cinco facetas en cada cambio (diferir a `requestAnimationFrame` o recalcular solo la faceta tocada) | Alto (171 ms → ?) | Medio | Que el recuento y los filtros dejen de cuadrar |
| 3 | Servir el listado por años bajo demanda o recortar los `data-*` que no se usan | Alto (1,26 MB de HTML) | Alto | SEO: el listado es una página indexable |
| 4 | `content-visibility: auto` en las cards del glosario y de `/lista` para el scroll | Medio (7,7 % de `main.busy` en `/lista`) | Bajo | Saltos visuales al hacer scroll |
| 5 | Unir los módulos pequeños de la ficha (`InstalarAppCard`, `AvisoInstalar`, `AvisoAvisos`, `PrefetchTap`) en uno | Bajo-medio | Bajo | Ninguno serio |
| 6 | Decidir el `prefetchAll` con datos: en móvil se dispara en `pointerdown`, justo antes del clic. Medir bytes contra producción | Bajo | Bajo | Perder el ahorro en escritorio |

## Lo que no se ha medido (y por qué)

- **PWA y service worker**: el coste de registro y la segunda visita con caché. Se
  puede medir, pero necesita un caso propio (el SW no existe en la primera carga).
- **Memoria a lo largo del tiempo**: haría falta `--probes memory --repeat 10` por caso.
- **Móvil de verdad**: esto es Chromium de escritorio con ventana de 390 px. Strobe,
  a propósito, no aplica throttling de CPU ni de red.
- **Navegación completa entre páginas**: solo hay un caso (home → ficha con prefetch).

## Repetir la medición

```powershell
npm run perf:status                 # entorno
npm run perf:check                  # valida casos y da el baseline local
npx strobe record --bench "perf/produccion.bench.ts#ficha-produccion" --head .
npx strobe query rec_… insights
npx strobe bench perf/paginas.bench.ts --base <copia-del-repo> --head . --why always
```

Detalles de cada caso y límites en [`perf/README.md`](../../perf/README.md).
