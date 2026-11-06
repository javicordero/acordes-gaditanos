/**
 * Lo que en local no se puede medir: AdSense, GTM, el beacon de Cloudflare y el
 * iframe de YouTube. Estos casos van contra la web publicada, con la red de
 * verdad; no los use para comparar versiones (cambia el contenido), solo para
 * saber cuánto cuesta cargar la web tal y como la recibe un usuario.
 *
 *   npx strobe record --bench "perf/produccion.bench.ts#home-produccion" --head .
 *   npx strobe query <rec_…> hotspots
 *   npx strobe query <rec_…> insights
 *
 * Viewport de móvil (390×844), que es de donde viene la mayoría del tráfico.
 */
import { bench, url } from '@hona/strobe';

const MOVIL = { width: 390, height: 844 };
const SITIO = 'https://acordesgaditanos.com';
const FICHA = `${SITIO}/acordes/pasodoble-guenagente/`;

export default bench({
  targets: {
    produccion: url(`${SITIO}/`, { viewport: MOVIL }),
  },

  cases: {
    'home-produccion': {
      primary: 'main.work',
      metrics: [
        'main.script',
        'main.layout',
        'main.style',
        'net.requests',
        'net.bytes',
        'frames.dropped.pct',
      ],
      run: async ({ page, phase }) => {
        await phase('carga', () => page.goto(`${SITIO}/`, { until: 'idle' }));
      },
    },

    'ficha-produccion': {
      primary: 'main.work',
      metrics: [
        'main.script',
        'main.layout',
        'main.style',
        'net.requests',
        'net.bytes',
        'frames.dropped.pct',
      ],
      run: async ({ page, phase }) => {
        await phase('carga', () => page.goto(FICHA, { until: 'idle' }));
      },
    },

    'glosario-produccion': {
      primary: 'main.work',
      metrics: [
        'main.script',
        'main.layout',
        'main.style',
        'net.requests',
        'net.bytes',
        'frames.dropped.pct',
      ],
      run: async ({ page, phase }) => {
        await phase('carga', () => page.goto(`${SITIO}/glosario/`, { until: 'idle' }));
      },
    },
  },
});
