// src/pwa.ts
//
// Registro del service worker (solo en producción) e inicialización de la
// analítica PWA (display_mode como user property, consentimiento y panel).

import { registerSW } from 'virtual:pwa-register';
import { registrarDisplayMode } from './lib/pwa/analytics';
import { initPwa } from './lib/pwa/instalacion';

if (import.meta.env.PROD) {
  // autoUpdate: detecta la versión nueva, se activa y recarga la pestaña solo.
  registerSW({ immediate: true });
}

registrarDisplayMode();
initPwa();
