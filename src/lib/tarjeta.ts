// src/lib/tarjeta.ts
//
// Datos que pinta una card de copla (`src/components/ui/Card.astro`), ya
// masticados. Vive aquí para que la card del build y el catálogo de
// `/indice-tarjetas.json` (el que usa `/buscar` para pintar resultados en el
// navegador) no se puedan desincronizar: las dos salen de `prepararTarjeta()`.
//
// Sin DOM y sin `astro:content`: entra una ficha y sale lo que necesita la card.

export type TipoPiezaTarjeta = 'presentacion' | 'pasodoble' | 'tango' | 'estribillo' | 'default';

/** Lo que hace falta de una ficha para pintar su card. */
export interface EntradaTarjeta {
  slug: string;
  agrupacion: string;
  pieza: string;
  year: string;
  img: string;
  letraTitulo?: string;
  musica?: string;
  letra?: string;
  /** Autores ya separados (`musica:`/`letra:` divididos por coma). */
  musicaList?: string[];
  letraList?: string[];
  musicaSlugs?: string[];
  letraSlugs?: string[];
  musicaSlug?: string;
  letraSlug?: string;
}

export interface AutorTarjeta {
  nombre: string;
  /** Ruta con barra final, o `null` si el autor no tiene slug. */
  href: string | null;
}

export interface DatosTarjeta {
  slug: string;
  year: string;
  img: string;
  agrupacion: string;
  /** Pieza tal cual viene del frontmatter (es lo que busca `/buscar`). */
  pieza: string;
  /** Pieza como se ve en el badge: sin «Cuarteta "…"» y con «final popurrí». */
  piezaDisplay: string;
  /** Tipo de pieza para colorear el badge. */
  piezaTipo: TipoPiezaTarjeta;
  letraTitulo: string;
  /** Nombre completo para el `aria-label` del enlace y el `alt` de la imagen. */
  nombreCompleto: string;
  autores: AutorTarjeta[];
}

/**
 * Entrada del catálogo de `/indice-tarjetas.json`: la card ya masticada más los
 * campos por los que busca `/buscar` (los mismos de siempre).
 */
export interface CatalogoTarjeta extends DatosTarjeta {
  musica: string;
  letra: string;
}

/** Texto del badge de pieza: quita «Cuarteta "…"» y unifica el final de popurrí. */
export function piezaVisible(pieza: string): string {
  let piezaDisplay = pieza || '';
  if (pieza) {
    const cuartetaMatch = pieza.match(/^Cuarteta\s+"(.+)"$/i);
    if (cuartetaMatch) {
      piezaDisplay = cuartetaMatch[1];
    }
    piezaDisplay = piezaDisplay.replace(/\bfinal\s+de\s+popur(?:r\u00ED|ri)/gi, 'final popurr\u00ED');
  }
  return piezaDisplay;
}

/** Color del badge de pieza (ver `Card.astro`). */
export function tipoDePieza(piezaDisplay: string): TipoPiezaTarjeta {
  const piezaLower = (piezaDisplay || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (piezaLower.includes('presentacion')) return 'presentacion';
  if (piezaLower.includes('pasodoble')) return 'pasodoble';
  if (piezaLower.includes('tango')) return 'tango';
  if (piezaLower.includes('estribillo')) return 'estribillo';
  return 'default';
}

/**
 * Autores de la card: primero música y después letra. Si alguien firma las dos
 * cosas se queda como música, para que su enlace lleve a su página de música.
 */
export function autoresDeTarjeta(entrada: EntradaTarjeta): AutorTarjeta[] {
  const letraNombres = entrada.letraList?.length ? entrada.letraList : entrada.letra ? [entrada.letra] : [];
  const musicaNombres = entrada.musicaList?.length
    ? entrada.musicaList
    : entrada.musica
      ? [entrada.musica]
      : [];

  const vistos = new Set<string>();
  const combinados: { nombre: string; tipo: 'letra' | 'musica' }[] = [];

  musicaNombres.forEach((nombre) => {
    if (vistos.has(nombre)) return;
    vistos.add(nombre);
    combinados.push({ nombre, tipo: 'musica' });
  });
  letraNombres.forEach((nombre) => {
    if (vistos.has(nombre)) return;
    vistos.add(nombre);
    combinados.push({ nombre, tipo: 'letra' });
  });

  return combinados.map(({ nombre, tipo }) => {
    const lista = tipo === 'letra' ? letraNombres : musicaNombres;
    const slugs = tipo === 'letra' ? entrada.letraSlugs : entrada.musicaSlugs;
    const unico = tipo === 'letra' ? entrada.letraSlug : entrada.musicaSlug;
    const slug = slugs?.[lista.indexOf(nombre)] || unico || '';
    return { nombre, href: slug ? `/autor/${tipo}/${slug}/` : null };
  });
}

/** Todo lo que necesita la card, sin tocar el DOM. */
export function prepararTarjeta(entrada: EntradaTarjeta): DatosTarjeta {
  const pieza = entrada.pieza || '';
  const piezaDisplay = piezaVisible(pieza);
  const letraTitulo = entrada.letraTitulo || '';
  const agrupacion = entrada.agrupacion || '';

  const nombreCompleto = [
    letraTitulo ? `${piezaDisplay} "${letraTitulo}"` : piezaDisplay,
    agrupacion,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    slug: entrada.slug,
    year: String(entrada.year ?? ''),
    img: entrada.img || '',
    agrupacion,
    pieza,
    piezaDisplay,
    piezaTipo: tipoDePieza(piezaDisplay),
    letraTitulo,
    nombreCompleto,
    autores: autoresDeTarjeta(entrada),
  };
}
