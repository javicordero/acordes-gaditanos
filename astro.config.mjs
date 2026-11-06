import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import remarkAcordesColumna from './src/lib/remark-acordes-columna.mjs';
import enlacesConBarra from './src/integrations/enlaces-con-barra.mjs';
import { fechasSitemap } from './scripts/lib/fechas-sitemap.mjs';

// El sitemap necesita el `lastmod` real de cada ficha. Se lee del frontmatter
// la primera vez que se serializa (solo en el build) para no tocar 586
// archivos al arrancar `astro dev`.
let fechasCache = null;
const fechaDe = (url) => {
  if (!fechasCache) fechasCache = fechasSitemap();
  return fechasCache.get(new URL(url).pathname) || null;
};

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
        // Panel privado de edición: noindex y fuera del sitemap (también el viejo /estudio).
        !page.includes('/admin') &&
        !page.includes('/estudio') &&
        // Página de resultados: noindex y fuera del sitemap.
        !page.includes('/buscar'),
      // `lastmod` con la fecha de la ficha (o de su año en los listados), no la
      // del build: así Google sabe qué rastrear antes.
      serialize: (item) => {
        const fecha = fechaDe(item.url);
        if (fecha) item.lastmod = fecha;
        return item;
      },
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
        // Acceso al panel privado desde el icono de la app: mantener pulsado
        // Acordes Gaditanos → «Admin». Solo lo pinta Android; en el navegador
        // normal no existe.
        shortcuts: [
          {
            name: 'Admin',
            short_name: 'Admin',
            description: 'Panel de edición',
            url: '/admin/',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Solo el "chasis" (assets). Sin HTML: hay ~1.150 páginas y precargarlas
        // todas serían decenas de MB en el móvil. Las páginas se cachean al visitarlas.
        globPatterns: ['**/*.{js,css,woff2,woff,png,svg,ico,webmanifest}'],
        // Handlers de Web Push (public/push-sw.js): se enganchan al SW generado.
        importScripts: ['push-sw.js'],
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
    build: {
      // Strobe exporta STROBE_SOURCEMAP=hidden al construir una variante para
      // medirla: así escribe los mapas al lado de cada script (sin el comentario
      // sourceMappingURL) y `strobe query hotspots` nombra el archivo y la
      // función de verdad. En un build normal la variable no existe y el valor
      // queda `undefined`, que es el comportamiento de siempre.
      sourcemap: process.env.STROBE_SOURCEMAP,
    },
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
