import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import remarkAcordesColumna from './src/lib/remark-acordes-columna.mjs';

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  markdown: {
    remarkPlugins: [remarkAcordesColumna],
  },
  integrations: [
    icon({
      iconDir: 'src/icons',
    }),
    sitemap({
      filter: (page) =>
        !page.includes('/coming-soon') &&
        !page.includes('/en-construccion') &&
        !page.includes('/acordes2') &&
        !page.includes('/lista2') &&
        !page.includes('/reconocer-acorde'),
    }),
  ],

  vite: {
    server: {
      allowedHosts: [],
    },
  },
});
