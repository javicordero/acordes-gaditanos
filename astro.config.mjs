import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import remarkAcordesColumna from './src/lib/remark-acordes-columna.mjs';
import enlacesConBarra from './src/integrations/enlaces-con-barra.mjs';

// En `astro dev` no existen las Netlify Functions del panel /admin, así que se
// inyecta una ruta real que las ejecuta con la petición completa. `prerender: false`
// es imprescindible: sin él, la ruta hereda el `prerender: true` del output estático
// y Astro pide `getStaticPaths` (404 en dev).
const estudioApiDev = {
  name: 'estudio-api-dev',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({
        pattern: '/admin/api/[...ruta]',
        entrypoint: './src/integrations/estudio-api.ts',
        prerender: false,
      });
    },
  },
};

export default defineConfig({
  site: 'https://acordesgaditanos.com',
  // Fuera la barra de herramientas de desarrollo de Astro: solo estorba en
  // `astro dev` (tapa la esquina del cifrado) y no se usa ninguna de sus
  // utilidades. Solo afecta al modo desarrollo, no al build.
  devToolbar: { enabled: false },
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
    estudioApiDev,
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
        !page.includes('/acordes3') &&
        !page.includes('/lista2') &&
        !page.includes('/reconocer-acorde') &&
        // Panel privado de edición: noindex y fuera del sitemap (también el viejo /estudio).
        !page.includes('/admin') &&
        !page.includes('/estudio') &&
        // Página de resultados: noindex y fuera del sitemap.
        !page.includes('/buscar'),
    }),
  ],

  vite: {
    server: {
      // En `astro dev`, guardar un borrador desde el panel escribe en
      // `src/content/acordes3`; si el watcher lo ve, Astro recarga la página y
      // se pierde el editor. Esa colección solo la usa el panel (lee el archivo
      // directamente), así que se ignora. `acordes` sí se vigila: el preview
      // del sitio tiene que actualizarse al editar una ficha publicada.
      watch: { ignored: ['**/src/content/acordes3/**'] },
      allowedHosts: [],
    },
  },
});
