/**
 * Benchmarks de las páginas que de verdad importan: home, /lista, /glosario y
 * una ficha de acorde.
 *
 * Cómo se leen los números (y cómo no):
 * - `main.work` es tiempo de tarea del hilo principal por pasada: es la métrica
 *   para «¿esto cuesta menos?».
 * - `main.busy` es hilo principal ocupado: la de scroll y animación.
 * - `interaction.p95` mide de la tecla al primer frame que la muestra; necesita
 *   muchas muestras, así que aquí va como secundaria.
 * - Una pasada de `--check` da valores reales pero ruidosos (n = 1). Para
 *   comparar dos versiones hace falta `--base` / `--head` o `--aa`.
 *
 * La web carga GTM, el beacon de Cloudflare y, en producción, AdSense y YouTube.
 * Aquí se cortan: cambian entre pasadas y taparían el coste propio. Su coste se
 * mide aparte, contra la web publicada (`docs/operativa/rendimiento.md`).
 */
import { bench, web } from '@hona/strobe';
import type { PrepareContext } from '@hona/strobe';

// Viewport de móvil: el 60 % del tráfico viene de ahí. Es Chromium de escritorio
// con ventana pequeña, no un móvil de gama baja: el hardware es el del PC.
const MOVIL = { width: 390, height: 844 };

const FICHA = '/acordes/pasodoble-guenagente/';

// En /lista los filtros arrancan plegados por debajo de 640 px (móvil), así que
// hay que abrir el panel antes de tocar una faceta. Marcar «Pasodoble» deja el
// listado en 354 fichas y recalcula el recuento de todas las facetas.
const CASILLA_PASODOBLE = '#filtro-pieza-panel input[value="pasodoble"]';

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

export default bench({
  targets: {
    home: web({ url: '/', viewport: MOVIL, prepare: sinTerceros }),
    lista: web({ url: '/lista/', viewport: MOVIL, prepare: sinTerceros }),
    glosario: web({ url: '/glosario/', viewport: MOVIL, prepare: sinTerceros }),
    ficha: web({ url: FICHA, viewport: MOVIL, prepare: sinTerceros }),
  },

  cases: {
    // --- Home ---------------------------------------------------------------
    'home-carga': {
      targets: ['home'],
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'frames.dropped.pct'],
      run: async ({ page, phase }) => {
        await phase('carga', () => page.goto('/', { until: 'idle' }));
      },
    },

    // --- Listado ------------------------------------------------------------
    // /lista es el HTML más grande de la web (~1,26 MB) y filtra 611 fichas en
    // cliente. Primero lo que cuesta recorrerlo; después, filtrar.
    'lista-scroll': {
      targets: ['lista'],
      primary: 'main.busy',
      metrics: ['main.script', 'frames.dropped.pct'],
      run: async ({ page }) => {
        await page.scroll('html', { by: 4000, speed: 3000 });
      },
      reset: async ({ page }) => {
        await page.eval(() => window.scrollTo(0, 0));
      },
    },
    'lista-filtro': {
      targets: ['lista'],
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'main.style', 'interaction.p95'],
      run: async ({ page }) => {
        await page.click('.filtros-lista-toggle');
        // Los filtros se despliegan con una animación de altura: hasta que
        // termina, los botones de dentro no tienen sitio donde recibir el clic.
        await page.wait(400);
        await page.click('#filtro-pieza');
        await page.click(CASILLA_PASODOBLE);
      },
      reset: async ({ page }) => {
        await page.click(CASILLA_PASODOBLE);
        await page.press('Escape');
        await page.click('.filtros-lista-toggle');
        await page.wait(400);
      },
    },

    // --- Glosario -----------------------------------------------------------
    'glosario-busqueda': {
      targets: ['glosario'],
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'main.style', 'interaction.p95'],
      run: async ({ page }) => {
        await page.type('#glosario-buscar', 'semidisminuido', { delay: 80 });
      },
      reset: async ({ page }) => {
        await page.press('ControlOrMeta+a', { selector: '#glosario-buscar' });
        await page.press('Backspace', { selector: '#glosario-buscar' });
      },
    },
    'glosario-scroll': {
      targets: ['glosario'],
      primary: 'main.busy',
      metrics: ['main.script', 'frames.dropped.pct'],
      run: async ({ page }) => {
        await page.scroll('html', { by: 4000, speed: 3000 });
      },
      reset: async ({ page }) => {
        await page.eval(() => window.scrollTo(0, 0));
      },
    },

    // --- Ficha de acorde ----------------------------------------------------
    'ficha-carga': {
      targets: ['ficha'],
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'frames.dropped.pct'],
      run: async ({ page, phase }) => {
        await phase('carga', () => page.goto(FICHA, { until: 'idle' }));
      },
    },
    'ficha-autoscroll': {
      targets: ['ficha'],
      primary: 'main.busy',
      metrics: ['main.script', 'frames.dropped.pct'],
      run: async ({ page }) => {
        await page.click('.play-btn');
        await page.wait(3000);
        await page.click('.pause-btn');
      },
      reset: async ({ page }) => {
        await page.eval(() => window.scrollTo(0, 0));
      },
    },
    'ficha-transponer': {
      targets: ['ficha'],
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'main.style'],
      run: async ({ page }) => {
        for (let i = 0; i < 6; i += 1) await page.click('.transpose-up');
      },
      reset: async ({ page }) => {
        for (let i = 0; i < 6; i += 1) await page.click('.transpose-down');
      },
    },
    'ficha-acorde': {
      targets: ['ficha'],
      primary: 'main.work',
      metrics: ['main.script', 'main.layout', 'main.style'],
      run: async ({ page }) => {
        // Abre el popover de un acorde: dibuja el diagrama SVG en el navegador.
        await page.click('pre a.acorde-interactivo:first-of-type');
      },
      reset: async ({ page }) => {
        await page.press('Escape');
      },
    },
  },
});
