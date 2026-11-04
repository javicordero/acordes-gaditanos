// public/push-sw.js
//
// Handlers de Web Push que se enganchan al service worker que genera Workbox
// (`workbox.importScripts` en astro.config.mjs). Va suelto, sin imports ni
// precache: aquí solo se pinta la notificación y se decide qué abrir al pulsarla.
//
// El payload lo manda scripts/push.mjs:
//   { titulo, cuerpo, url, icono, tag }

const ICONO = '/icon-192.png';
const BADGE = '/badge-96.png';

/**
 * Las dos imágenes del aviso se piden con URL absoluta. Dentro de una PWA
 * instalada (WebAPK) una ruta relativa no siempre cae en el dominio, y si el
 * navegador no consigue el badge Android pinta su **campana** por defecto en
 * lugar de la AG. Con la URL entera no hay duda de dónde está el fichero.
 */
function absoluta(src, porDefecto) {
  try {
    return new URL(src || porDefecto, self.location.origin).href;
  } catch {
    return new URL(porDefecto, self.location.origin).href;
  }
}

self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = {};
  }

  const titulo = datos.titulo || 'Acordes Gaditanos';
  const opciones = {
    body: datos.cuerpo || 'Hay coplas nuevas en el cancionero.',
    icon: absoluta(datos.icono, ICONO),
    // Monocromo y transparente: Android y Windows usan solo la silueta y la
    // recolorean ellos. Un badge a color sale como un círculo liso.
    badge: absoluta(BADGE, BADGE),
    // Mismo tag para que un aviso nuevo sustituya al anterior y no se apilen.
    tag: datos.tag || 'coplas',
    renotify: false,
    data: { url: datos.url || '/' },
  };

  evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/';

  evento.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Si la ficha ya está abierta, se enfoca en vez de abrir otra pestaña.
      const ruta = new URL(destino, self.location.origin).pathname;
      for (const cliente of clientes) {
        try {
          if (new URL(cliente.url).pathname === ruta) {
            await cliente.focus();
            return;
          }
        } catch {
          /* cliente con URL rara: se ignora */
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(destino);
    })(),
  );
});
