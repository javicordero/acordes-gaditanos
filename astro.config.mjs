import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

import partytown from '@astrojs/partytown';

export default defineConfig({
  integrations: [
    icon({
      iconDir: 'src/icons', // o la ruta donde tengas tus SVGs
    }),
    partytown({ config: { forward: ['dataLayer.push'] } }),
  ],

  vite: {
    server: {
      allowedHosts: [],
    },
  },
});
