import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import remarkAcordesColumna from './src/lib/remark-acordes-columna.mjs';
import enlacesConBarra from './src/integrations/enlaces-con-barra.mjs';

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  // Precarga el HTML de los enlaces al pasar el ratón (escritorio).
  // Astro descarta conexiones lentas (saveData / 2g) y enlaces externos.
  // En móvil el prefetch se dispara desde PrefetchTap.astro.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  markdown: {
    remarkPlugins: [remarkAcordesColumna],
  },
  integrations: [
    // Añade la barra final a los enlaces internos (Netlify redirige sin ella).
    enlacesConBarra(),
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
