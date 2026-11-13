/**
 * Asignación estable del experimento de precios.
 *
 * Se guarda en localStorage, no en cookie: no viaja al servidor y no necesita
 * un backend. Solo se asigna cuando la analítica está consentida; si no, el
 * visitante se queda en la variante A (sin precio).
 */

export type VariantePrecio = 'a' | 'b';

export const CLAVE_VARIANTE = 'ag_amazon_precio_v1';

export function leerVariante(): VariantePrecio | null {
  try {
    const valor = localStorage.getItem(CLAVE_VARIANTE);
    return valor === 'a' || valor === 'b' ? valor : null;
  } catch {
    return null;
  }
}

export function asignarVariante(): VariantePrecio {
  const azar = new Uint8Array(1);
  try {
    crypto.getRandomValues(azar);
  } catch {
    azar[0] = Math.floor(Math.random() * 256);
  }

  const variante: VariantePrecio = azar[0] < 128 ? 'a' : 'b';
  try {
    localStorage.setItem(CLAVE_VARIANTE, variante);
  } catch {
    // Sin almacenamiento no hay estabilidad: se quedará en A.
    return 'a';
  }
  return variante;
}

export function aplicarVariante(variante: VariantePrecio): void {
  document.documentElement.dataset.amazonPrecio = variante;
  (window as any).__agAmazonVariante = variante;
  document.dispatchEvent(
    new CustomEvent('ag:amazon-variante', { detail: { variante } }),
  );
}
