import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  integrations: [
    icon({
      iconDir: 'src/icons',
    }),
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
