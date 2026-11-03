import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
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
    // PWA instalable. Se registra al final para que el service worker se genere
    // después del resto de hooks de build.
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Acordes Gaditanos',
        short_name: 'Acordes Gaditanos',
        description:
          'Acordes de guitarra del Carnaval de Cádiz. Presentaciones, pasodobles, tangos, cuplés y popurrís para tocar con tu guitarra.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // El header es siempre negro (#000), así la barra de estado se funde con él.
        theme_color: '#000000',
        background_color: '#e5e5e5',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Solo el "chasis" (assets). Sin HTML: hay ~1.150 páginas y precargarlas
        // todas serían decenas de MB en el móvil. Las páginas se cachean al visitarlas.
        globPatterns: ['**/*.{js,css,woff2,woff,png,svg,ico,webmanifest}'],
        globIgnores: ['**/og-image.jpg'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Desactivamos el navigateFallback por defecto ("/") y servimos la página
        // offline explícita a través del precacheFallback de la ruta de navegación.
        navigateFallback: null,
        // La página offline se precachea tal cual (sin la reescritura de rutas).
        additionalManifestEntries: [{ url: '/offline.html', revision: null }],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Solo navegaciones (HTML). Así no se cachean /api/, el proxy CORS ni
            // los fetch del buscador, y los anuncios/analíticas quedan fuera.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'paginas-v1',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              precacheFallback: { fallbackURL: '/offline.html' },
            },
          },
        ],
      },
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
