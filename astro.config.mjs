import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  integrations: [
    icon({
      iconDir: 'src/icons', // o la ruta donde tengas tus SVGs
    }),
  ],

  vite: {
    server: {
      allowedHosts: ['88cddb6c0887.ngrok-free.app'],
    },
  },
});
