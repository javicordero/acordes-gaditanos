import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  integrations: [
    icon({
      iconDir: 'src/icons', // o la ruta donde tengas tus SVGs
    }),
    sitemap({
      filter: (page) => !page.includes('/coming-soon'),
    }),
  ],

  vite: {
    server: {
      allowedHosts: ['af66b9db8db4.ngrok-free.app'],
    },
  },
});
