// src/lib/pwa/analytics.ts
//
// Detección de sistema, display-mode y envío de eventos PWA a GA4 (gtag).
// Usa el gtag que ya existe en la web: no se carga un segundo GA ni se duplica
// el pageview. Todo evento respeta el Consent Mode: si no hay consentimiento de
// analytics, el evento se encola y solo se envía cuando el CMP lo concede.

export type OS = 'android' | 'ios' | 'desktop' | 'otro';

export function detectarOs(): OS {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipod/i.test(ua)) return 'ios';
  if (/ipad/i.test(ua)) return 'ios';
  // iPadOS 13+ se presenta como Macintosh pero con pantalla táctil.
  if (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return 'ios';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop';
  return 'otro';
}

export function esStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    matchMedia?: (q: string) => { matches: boolean };
  };
  const displayMode =
    w.matchMedia?.('(display-mode: standalone)').matches ||
    w.matchMedia?.('(display-mode: fullscreen)').matches ||
    w.matchMedia?.('(display-mode: minimal-ui)').matches ||
    // Safari iOS no soporta display-mode: se detecta por navigator.standalone.
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(displayMode);
}

// ---------------------------------------------------------------------------
// Consentimiento + cola de eventos
// ---------------------------------------------------------------------------

type Gtag = (...args: unknown[]) => void;

let consentido = false;
let gtagEnvuelto = false;
const cola: Array<[string, Record<string, unknown>]> = [];
const MAX_COLA = 30;

function gtag(): Gtag | undefined {
  return (window as unknown as { gtag?: Gtag }).gtag;
}

function leerConsentDeGooglefc(): boolean {
  try {
    const fc = (window as unknown as {
      googlefc?: {
        getGoogleConsentModeValues?: () => Record<string, unknown>;
        ConsentModePurposeStatusEnum?: Record<string, unknown>;
      };
    }).googlefc;
    if (!fc || typeof fc.getGoogleConsentModeValues !== 'function') return false;
    const vals = fc.getGoogleConsentModeValues() as Record<string, unknown>;
    const negado = fc.ConsentModePurposeStatusEnum?.CONSENT_MODE_PURPOSE_STATUS_DENIED;
    return vals.analyticsStoragePurposeConsentStatus !== negado;
  } catch {
    return false;
  }
}

function vaciarCola() {
  const g = gtag();
  if (!g) return;
  while (cola.length) {
    const [nombre, params] = cola.shift()!;
    g('event', nombre, params);
  }
}

function aplicarConsent(values: Record<string, unknown>) {
  consentido = values.analytics_storage === 'granted';
  if (consentido) vaciarCola();
}

// Envuelve gtag para enterarse de los `consent update` del CMP sin interferir en
// el resto (pageviews, configuración, etc. siguen pasando tal cual).
function envolverGtag() {
  if (gtagEnvuelto) return;
  const original = gtag();
  if (typeof original !== 'function') return;
  gtagEnvuelto = true;
  (window as unknown as { gtag?: Gtag }).gtag = function (...args: unknown[]) {
    if (args[0] === 'consent' && args[1] === 'update' && args[2]) {
      aplicarConsent(args[2] as Record<string, unknown>);
    }
    return original.apply(this, args);
  };
}

function sePuedeMedir(): boolean {
  if (consentido) return true;
  // El CMP puede haber concedido sin pasar por nuestro wrapper (p. ej. cargó antes).
  if (leerConsentDeGooglefc()) {
    consentido = true;
    vaciarCola();
    return true;
  }
  return false;
}

export function eventoPwa(nombre: string, params: Record<string, unknown> = {}) {
  const g = gtag();
  if (typeof g !== 'function') return;
  const payload: Record<string, unknown> = { ...params, os: detectarOs() };
  if (sePuedeMedir()) {
    g('event', nombre, payload);
  } else if (cola.length < MAX_COLA) {
    cola.push([nombre, payload]);
  }
}

// display_mode (y os) como user property, para comparar el uso de la app instalada
// frente a la web. Se llama una vez por carga.
export function registrarDisplayMode() {
  envolverGtag();
  const g = gtag();
  if (typeof g !== 'function') return;
  g('set', 'user_properties', {
    display_mode: esStandalone() ? 'standalone' : 'browser',
    os: detectarOs(),
  });
}

// Inicializa el observador de consentimiento y limpia la cola si la página se
// cierra sin consentir (para no acumular eventos huérfanos).
export function iniciarAnaliticaPwa() {
  envolverGtag();
  if (leerConsentDeGooglefc()) {
    consentido = true;
    vaciarCola();
  }
  window.addEventListener('pagehide', () => {
    if (!consentido) cola.length = 0;
  });
}
