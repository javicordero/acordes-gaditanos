// src/pwa.ts
//
// Registro del service worker (solo en producción) e inicialización de la
// analítica PWA (display_mode como user property, consentimiento y panel).

import { registerSW } from 'virtual:pwa-register';
import { registrarDisplayMode } from './lib/pwa/analytics';
import { initPwa } from './lib/pwa/instalacion';
import { sincronizarAvisos } from './lib/pwa/avisos';

if (import.meta.env.PROD) {
  // autoUpdate: detecta la versión nueva, se activa y recarga la pestaña solo.
  registerSW({ immediate: true });
}

registrarDisplayMode();
initPwa();

// Si el permiso de avisos se revocó en los ajustes del móvil (o se concedió en
// otro momento), la suscripción del worker se pone al día al abrir la app.
sincronizarAvisos();
