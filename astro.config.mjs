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
      allowedHosts: ['a4b30e9ad50b.ngrok-free.app'],
    },
  },
});
