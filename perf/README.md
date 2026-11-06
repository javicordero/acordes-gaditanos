# Benchmarks de rendimiento (`perf/`)

Mediciones de la web con [Strobe](https://github.com/Hona/strobe) (`@hona/strobe`),
versionadas en el repo para poder repetirlas y detectar regresiones. El informe con
los resultados está en [`docs/operativa/rendimiento.md`](../docs/operativa/rendimiento.md).

## Instalación

Strobe es pre-release y **solo mide en la máquina donde se ejecuta**: no vale lo que
diga CI. En el proyecto ya está como devDependency (`npm install`). Una vez por
máquina:

```powershell
npx strobe up
```

Eso descarga el motor, arranca el demonio y registra el MCP y la skill en OpenCode.
Pide **un UAC** para el modo profundo (eventos de presentación del sistema y stacks
nativos). Sin aceptarlo se puede medir igual: los frames los cuenta Chromium por
dentro, que es lo que usan estos benchmarks.

Comprobación del entorno:

```powershell
npm run perf:status
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run perf:status` | Entorno y preflight (CPU, carga, pantalla, navegador, motor). |
| `npm run perf:check` | Valida `paginas.bench.ts`: una pasada por caso en `--head .`. **Es la forma de comprobar que los selectores siguen valiendo** tras tocar la interfaz. |
| `npm run perf:check:nav` | Igual con `navegacion.bench.ts`. |
| `npm run perf:perfilar` | `--check --why always`: además graba un bloque de atribución por caso (CPU por función, layouts forzados, GC, memoria). |
| `npm run perf:aa` | A/A con 8 pares: mide el **ruido** del método. Si sale «sin cambios», el banco está sano. |

Comparar dos versiones (la razón de ser de todo esto):

```powershell
npx strobe bench perf/paginas.bench.ts --base git:HEAD~1 --head . --why always
npx strobe report experiment exp_… --format md
```

Casos sueltos, para ir rápido:

```powershell
npx strobe bench perf/paginas.bench.ts --check --head . --filter lista-filtro
npx strobe record --bench "perf/paginas.bench.ts#lista-filtro" --head .   # grabación con atribución
npx strobe query rec_… hotspots
```

## Qué mide cada caso

Viewport **390×844** (móvil), que es de donde viene la mayoría del tráfico.

| Caso | Métrica principal | Qué es |
|---|---|---|
| `home-carga` | `main.work` | Cargar la home. |
| `lista-scroll` | `main.busy` | Recorrer el listado (el HTML más grande de la web). |
| `lista-filtro` | `main.work` | Abrir filtros y marcar «Pasodoble» (581 → 354 fichas y recalcula todas las facetas). |
| `glosario-busqueda` | `main.work` | Escribir en el buscador del glosario. |
| `glosario-scroll` | `main.busy` | Recorrer los 529 acordes. |
| `ficha-carga` | `main.work` | Cargar una ficha de acorde. |
| `ficha-autoscroll` | `main.busy` | 3 s de autoscroll. |
| `ficha-transponer` | `main.work` | 6 transportes seguidos. |
| `ficha-acorde` | `main.work` | Abrir el popover de un acorde (dibuja el SVG). |
| `navega-con-prefetch` | `main.work` | Navegar a una ficha ya precargada por el `prefetchAll`. |
| `home-produccion` / `ficha-produccion` / `glosario-produccion` | `main.work` | Igual, pero contra `acordesgaditanos.com` y **con AdSense, GTM y YouTube**. |

`main.work` es tiempo de tarea del hilo principal por pasada (continuo: es la métrica
para «¿esto cuesta menos?»). `main.busy` es porcentaje de hilo principal ocupado
(para scroll y animación). `interaction.p95` es de la tecla al frame que la muestra:
necesita muchas muestras, así que va como secundaria.

## Cómo se leen los números

- **Una pasada de `--check` no es un experimento.** Da valores reales (n = 1) e
  incluye trabajo de primera vez (compilación de shaders, cachés frías). Sirve para
  saber dónde mirar, no para decidir si algo mejoró.
- Para decidir hacen falta pares y un veredicto: `--base` / `--head`, o `--aa` para
  saber cuánto ruido hay. **Con 6 pares, por debajo del ~2 % no se distingue nada**
  (medido: A/A de `lista-filtro`, 161 ms vs 160 ms, IC −2,0 % … +2,3 %).
- Menos de 6 pares no da veredicto. Si sale `unclear` o `underpowered`, hay que
  subir pares o dejar la máquina tranquila, no leerlo como «no ha cambiado».

## Límites (leer antes de sacar conclusiones)

- **Aquí los anuncios no cargan.** `src/lib/anuncios.ts` desactiva AdSense y GA en
  `localhost`, `127.0.0.1` y cualquier IP literal. Los casos locales miden la web
  *sin* publicidad; el coste de AdSense, GTM y YouTube solo sale con los casos
  `*-produccion` (o `strobe record https://acordesgaditanos.com/`).
- Los terceros que sí cargan en local (GTM y el beacon de Cloudflare) se **cortan**
  en `prepare` para que dos pasadas sean comparables.
- **Móvil emulado no es un móvil.** Es Chromium de escritorio con ventana de 390 px:
  el hardware es este PC. Strobe no pone throttling de CPU ni de red (a propósito:
  movería el cuello de botella a un sitio donde ningún móvil real lo tiene).
- **El prefetch cuesta red, no CPU.** `net.requests` no ve las precargas
  declarativas (`<link rel="prefetch">`). Para juzgar el `prefetchAll` hay que mirar
  bytes contra producción y comparar contra una versión sin prefetch.
- **A/B contra un commit**: `--base git:HEAD~1` crea un worktree limpio, sin
  `node_modules`, y `npm run build` no arranca ahí. Hoy por hoy, para A/B se usa un
  **directorio** (una copia del repo con `node_modules`) como `--base`, o se compara
  `--aa` / contra producción. Las variantes que no cambian de dependencias reutilizan
  la caché de build de Strobe.
- Cada build son **1.616 HTML**. El primer caso de una tanda paga el build; los
  siguientes lo reutilizan mientras el árbol no cambie.
- Durante un bloque Strobe cambia el plan de energía a **Alto rendimiento** y aparta
  tus otros procesos de las CPUs del objetivo: no dejes builds ni indexaciones en
  marcha. La pantalla tiene que estar desbloqueada (sin sesión, no hay frames).
