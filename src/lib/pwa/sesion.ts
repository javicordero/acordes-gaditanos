// src/lib/pwa/sesion.ts
//
// Cuenta de páginas y de visitas hecha en el navegador. La web es estática y cada
// navegación es una carga completa, así que no hay estado en el servidor: el
// contador vive en localStorage (visitas) y sessionStorage (páginas de esta
// pestaña). Lo usan los avisos de la PWA para no salir en la primera página y
// para emitir un evento una sola vez por sesión.
//
// La sesión se corta a los 30 minutos sin actividad, como en GA4.

const CLAVE_PAGINAS = 'ag_paginas_sesion';
const CLAVE_VISITAS = 'ag_visitas';
const CLAVE_ULTIMA = 'ag_ultima_pagina';
// Tope de rutas guardadas: es solo para saber si ya ha navegado, no un registro.
const MAXIMO_PAGINAS = 40;
const CORTE_SESION = 30 * 60 * 1000;

export interface Navegacion {
  /** Páginas distintas vistas en esta sesión (recargar la misma no suma). */
  paginas: number;
  /** Visitas (sesiones) de este navegador, contando la de ahora. */
  visitas: number;
}

function almacen(nombre: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const store = (window as unknown as Record<string, Storage | undefined>)[nombre];
    return store ?? null;
  } catch {
    // Algunos modos privados lanzan al tocar el almacenamiento.
    return null;
  }
}

function leer(clave: string, store: Storage | null): string | null {
  try {
    return store ? store.getItem(clave) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string, store: Storage | null) {
  try {
    store?.setItem(clave, valor);
  } catch {
    /* sin almacenamiento se comporta como una primera visita */
  }
}

function leerRutas(store: Storage | null): string[] {
  try {
    const valor: unknown = JSON.parse(leer(CLAVE_PAGINAS, store) ?? '[]');
    if (!Array.isArray(valor)) return [];
    return valor.filter((ruta): ruta is string => typeof ruta === 'string');
  } catch {
    return [];
  }
}

function rutaActual(): string {
  if (typeof location === 'undefined') return '';
  // Sin barra final: /acordes/x/ y /acordes/x son la misma página.
  return location.pathname.replace(/\/+$/, '') || '/';
}

/**
 * Apunta la página que se acaba de cargar y devuelve el contexto de navegación.
 * Se llama una vez por carga: la segunda llamada en la misma página no suma.
 */
export function contarPagina(): Navegacion {
  const sesion = almacen('sessionStorage');
  const local = almacen('localStorage');

  const rutas = leerRutas(sesion);
  const ruta = rutaActual();
  if (ruta && !rutas.includes(ruta)) rutas.push(ruta);
  const guardadas = rutas.slice(-MAXIMO_PAGINAS);
  escribir(CLAVE_PAGINAS, JSON.stringify(guardadas), sesion);

  const ahora = Date.now();
  const ultima = Number(leer(CLAVE_ULTIMA, local) ?? 0);
  const previas = Number(leer(CLAVE_VISITAS, local) ?? 0);
  const sigueLaSesion =
    Number.isFinite(ultima) && ultima > 0 && ahora - ultima <= CORTE_SESION;
  const visitas = (Number.isFinite(previas) ? previas : 0) + (sigueLaSesion ? 0 : 1);

  escribir(CLAVE_ULTIMA, String(ahora), local);
  escribir(CLAVE_VISITAS, String(visitas), local);

  return { paginas: guardadas.length, visitas };
}

/** `true` la primera vez que se pregunta por `clave` en esta sesión. */
export function unaVezPorSesion(clave: string): boolean {
  const sesion = almacen('sessionStorage');
  if (leer(clave, sesion) === '1') return false;
  escribir(clave, '1', sesion);
  return true;
}
