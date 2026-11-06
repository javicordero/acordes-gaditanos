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

/** Engancha los clics de todos los enlaces que casen con `selector`. */
export function seguirEnlaces(selector: string, categoria?: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((enlace) => {
    enlace.addEventListener('click', () => {
      const evento = enlace.getAttribute('data-ga-event');
      if (!evento) return;

      let parametros: Parametros = {};
      try {
        parametros = JSON.parse(enlace.getAttribute('data-ga-params') || '{}') as Parametros;
      } catch {
        parametros = {};
      }

      enviarEvento(evento, parametros, categoria);
    });
  });
}
