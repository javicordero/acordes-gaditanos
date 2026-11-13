/**
 * Envío de eventos a GA4 desde los scripts de cliente.
 *
 * Se comparte entre el índice del glosario, las páginas de acorde y el bloque
 * «Acordes usados» de las fichas para no repetir el mismo patrón en cada
 * componente. Los enlaces llevan `data-ga-event` y `data-ga-params` (JSON).
 */

type Parametros = Record<string, unknown>;

export function enviarEvento(
  evento: string,
  parametros: Parametros = {},
  categoria = 'glosario',
): void {
  const w = window as any;

  if (typeof w.gtag === 'function') {
    w.gtag('event', evento, {
      ...parametros,
      event_category: categoria,
      event_label: window.location.pathname,
    });
  } else {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: evento, ...parametros });
  }
}

/**
 * Engancha los clics de todos los enlaces que casen con `selector`.
 *
 * Puede llamarse desde varios componentes de la misma página (por ejemplo, el
 * bloque de Amazon y su franja inline): `data-ga-init` evita duplicar el
 * listener y, por tanto, el evento en GA4.
 */
export function seguirEnlaces(selector: string, categoria?: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((enlace) => {
    if (enlace.dataset.gaInit === '1') return;
    enlace.dataset.gaInit = '1';
    enlace.addEventListener('click', () => {
      const evento = enlace.getAttribute('data-ga-event');
      if (!evento) return;

      let parametros: Parametros = {};
      try {
        parametros = JSON.parse(enlace.getAttribute('data-ga-params') || '{}') as Parametros;
      } catch {
        parametros = {};
      }

      // Un enlace puede forzar su categoría (p. ej. los afiliados de Amazon)
      // aunque lo recoja un listener genérico de la página.
      const categoriaFinal = enlace.dataset.gaCategoria || categoria;

      // Variante del experimento de precios, solo para los clics de Amazon y
      // solo cuando el experimento está realmente activo.
      const w = window as any;
      if (evento.startsWith('click_amazon') && w.__agAmazonExperimento) {
        parametros.variante = w.__agAmazonVariante || 'a';
      }

      enviarEvento(evento, parametros, categoriaFinal);
    });
  });
}
