// public/push-sw.js
//
// Handlers de Web Push que se enganchan al service worker que genera Workbox
// (`workbox.importScripts` en astro.config.mjs). Va suelto, sin imports ni
// precache: aquí solo se pinta la notificación y se decide qué abrir al pulsarla.
//
// El payload lo manda scripts/push.mjs:
//   { titulo, cuerpo, url, icono, tag }

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
    icon: datos.icono || '/icon-192.png',
    badge: '/badge-96.png',
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
