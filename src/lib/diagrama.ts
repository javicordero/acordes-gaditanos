/**
 * Generador de diagramas SVG de acordes para guitarra (afinación estándar).
 *
 * Se usa tanto en build (componente `DiagramaAcorde.astro`) como en el
 * navegador (popover y glosario), de forma que solo existe un renderizador.
 */

import type { Cejilla } from './acordes';

export interface PosicionDibujo {
  trastes: number[];
  baseTraste: number;
  cejilla: Cejilla | null;
}

export interface OpcionesDiagrama {
  /** Nombre del acorde tal y como se muestra (Mi7, Sib, Re/Fa#…). */
  nombre: string;
  posicion: PosicionDibujo;
  /** Índice 0-based de la posición actual. */
  indice?: number;
  total?: number;
  ancho?: number;
  alto?: number;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

function n(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Devuelve el SVG de una posición del acorde.
 * 6 cuerdas (6ª a 1ª de izquierda a derecha) y 5 trastes visibles.
 */
export function svgDiagrama({
  nombre,
  posicion,
  indice = 0,
  total = 1,
  ancho = 116,
  alto = 148,
}: OpcionesDiagrama): string {
  const W = ancho;
  const H = alto;
  const padL = 17;
  const padR = 6;
  const padT = 20;
  const padB = 6;
  const x0 = padL;
  const x1 = W - padR;
  const y0 = padT;
  const y1 = H - padB;
  const sg = (x1 - x0) / 5;
  const fg = (y1 - y0) / 5;
  const radio = 4.2;

  const base = posicion.baseTraste > 0 ? posicion.baseTraste : 1;
  const trastes = posicion.trastes;
  const etiqueta = `Acorde ${nombre}${total > 1 ? `, posición ${indice + 1} de ${total}` : ''}`;

  const partes: string[] = [];
  partes.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="diagrama-svg" role="img" aria-label="${esc(etiqueta)}">`,
  );
  partes.push(`<title>${esc(etiqueta)}</title>`);

  // Mástil: cuerdas y trastes.
  partes.push('<g stroke="currentColor" fill="none" stroke-linecap="square">');
  for (let i = 0; i < 6; i += 1) {
    const x = x0 + i * sg;
    partes.push(`<line x1="${n(x)}" y1="${y0}" x2="${n(x)}" y2="${y1}" stroke-width="1"/>`);
  }
  for (let k = 1; k <= 5; k += 1) {
    const y = y0 + k * fg;
    partes.push(`<line x1="${x0}" y1="${n(y)}" x2="${x1}" y2="${n(y)}" stroke-width="1"/>`);
  }
  if (base === 1) {
    partes.push(`<line x1="${x0 - 2}" y1="${y0}" x2="${x1 + 2}" y2="${y0}" stroke-width="3.4"/>`);
  } else {
    partes.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke-width="1"/>`);
  }
  partes.push('</g>');

  // Número de traste cuando el diagrama no empieza en la cejuela.
  if (base > 1) {
    partes.push(
      `<text x="${x0 - 5}" y="${n(y0 + fg * 0.5)}" text-anchor="end" dominant-baseline="middle" font-family="'Roboto Mono', monospace" font-size="9" font-weight="700" fill="currentColor">${base}</text>`,
    );
  }

  // Cuerdas mudas y al aire.
  for (let i = 0; i < 6; i += 1) {
    const traste = trastes[i] ?? -1;
    const x = x0 + i * sg;
    const y = y0 - 9;
    if (traste === 0) {
      partes.push(
        `<circle cx="${n(x)}" cy="${n(y)}" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
      );
    } else if (traste === -1) {
      partes.push(
        `<path d="M${n(x - 3)} ${n(y - 3)} L${n(x + 3)} ${n(y + 3)} M${n(x + 3)} ${n(y - 3)} L${n(x - 3)} ${n(y + 3)}" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
      );
    }
  }

  // Cejilla (barra continua).
  const cejilla = posicion.cejilla;
  if (cejilla && cejilla.traste >= base && cejilla.traste < base + 5) {
    const celda = cejilla.traste - base + 1;
    const xa = x0 + cejilla.desde * sg;
    const xb = x0 + cejilla.hasta * sg;
    const cy = y0 + (celda - 0.5) * fg;
    partes.push(
      `<rect x="${n(xa - radio)}" y="${n(cy - radio * 0.85)}" width="${n(xb - xa + radio * 2)}" height="${n(radio * 1.7)}" rx="${n(radio * 0.85)}" fill="var(--acorde-color, #04c)"/>`,
    );
  }

  // Puntos.
  for (let i = 0; i < 6; i += 1) {
    const traste = trastes[i] ?? -1;
    if (traste <= 0) continue;
    const celda = traste - base + 1;
    if (celda < 1 || celda > 5) continue;
    if (cejilla && traste === cejilla.traste && i >= cejilla.desde && i <= cejilla.hasta) {
      continue;
    }
    const x = x0 + i * sg;
    const y = y0 + (celda - 0.5) * fg;
    partes.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${radio}" fill="var(--acorde-color, #04c)"/>`);
  }

  partes.push('</svg>');
  return partes.join('');
}
