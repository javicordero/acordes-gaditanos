/**
 * Coste del `prefetchAll` de Astro (`astro.config.mjs`).
 *
 * `prefetch: { prefetchAll: true, defaultStrategy: 'hover' }` precarga el HTML
 * de cualquier enlace al pasar el ratón. En móvil el «hover» lo dispara
 * `PrefetchTap.astro` en `pointerdown`.
 *
 * Lo medido con Strobe hasta ahora (ver `docs/operativa/rendimiento.md`):
 * - El prefetch SÍ funciona: al pasar el ratón aparece un
 *   `<link rel="prefetch">` y la URL entra en `performance.getEntriesByType('resource')`.
 * - Su coste es de RED, no de CPU: `main.work` al precargar una ficha es ~2 ms y
 *   `net.requests` marca 0 porque una precarga declarativa (`rel=prefetch`) no
 *   pasa por el dominio Network de CDP.
 *
 * Por eso el caso que importa es la navegación ya precargada: si el prefetch
 * compensa o no solo se puede decidir comparando contra una versión sin él
 * (`--base` / `--head`) y, para los bytes, midiendo contra la web publicada.
 */
import { bench, web } from '@hona/strobe';
import type { PrepareContext } from '@hona/strobe';

const MOVIL = { width: 390, height: 844 };

/** Corta en la red los terceros que harían distinta cada pasada. Conserva la caché HTTP. */
async function sinTerceros({ mock }: PrepareContext<any>): Promise<void> {
  const nada = () => ({ status: 204, body: '' });
  await mock('*googletagmanager.com/*', nada);
  await mock('*google-analytics.com/*', nada);
  await mock('*cloudflareinsights.com/*', nada);
  await mock('*doubleclick.net/*', nada);
  await mock('*googlesyndication.com/*', nada);
  await mock('*youtube.com/*', nada);
  await mock('*ytimg.com/*', nada);
}

// Primera tarjeta de la home. Se recarga la home en cada reset porque Astro
// recuerda qué URLs ya ha precargado y, si no, solo la primera pasada las pide.
const TARJETA = '.card a.card-stretch';

export default bench({
  targets: {
    home: web({ url: '/', viewport: MOVIL, prepare: sinTerceros }),
  },

  cases: {
    'navega-con-prefetch': {
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'net.requests'],
      run: async ({ page, phase }) => {
        await page.hover(TARJETA);
        await phase('navega', () => page.click(TARJETA, { until: 'idle' }));
      },
      reset: async ({ page }) => {
        await page.goto('/', { until: 'idle' });
      },
    },
  },
});
