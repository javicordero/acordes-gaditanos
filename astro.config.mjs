import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  integrations: [
    icon({
      iconDir: 'src/icons',
    }),
    partytown({ config: { forward: ['dataLayer.push'] } }),
    sitemap({
      filter: (page) => !page.includes('/coming-soon') && !page.includes('/en-construccion'),
    }),
  ],

  vite: {
    server: {
      allowedHosts: [],
    },
  },
});
