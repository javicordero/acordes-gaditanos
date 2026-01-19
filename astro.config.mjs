import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  integrations: [
    icon({
      iconDir: 'src/icons',
    }),
    sitemap({
      filter: (page) => !page.includes('/coming-soon') && !page.includes('/en-construccion'),
    }),
    partytown(),
  ],

  vite: {
    server: {
      allowedHosts: [],
    },
  },
});
