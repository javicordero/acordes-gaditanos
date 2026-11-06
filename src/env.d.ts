/// <reference types="astro/client" />

declare global {
  /** GTM/GA4: lo crea el fragmento de Google en el navegador, fuera de los módulos. */
  function gtag(...args: unknown[]): void;

  interface Window {
    /** Marca que el script de AnchoPreInit ya está presente (evita duplicarlo). */
    __AnchoPreInit_present?: boolean;
    /** Marca que ya se ha parcheado `history` para detectar navegación client-side. */
    __ancho_history_patched?: boolean;
  }

  interface HTMLElement {
    /** Recarga la lista de comentarios de la sección (la usa `comment-added`). */
    __reloadComments?: () => void;
  }
}

export {};
