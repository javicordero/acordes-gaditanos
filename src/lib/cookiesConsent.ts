// src/utils/cookiesConsent.ts
import { anunciosPermitidos, SCRIPT_ADSENSE } from './anuncios.ts';

export function loadAdsense() {
  if (typeof window === 'undefined') return;
  // Red de seguridad: en desarrollo (local, túneles, previews) y en las rutas
  // privadas no se carga nunca, aunque alguien llame a esta función.
  if (!anunciosPermitidos(location.hostname, location.pathname)) return;
  if (document.querySelector('script[src*="googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
    return; // ya cargado
  }

  // SCRIPT
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT_ADSENSE;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}