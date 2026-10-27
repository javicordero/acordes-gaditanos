// Letras alternativas de una misma música.
//
// En el Carnaval una música puede cantarse con varias letras. Cada letra es una
// ficha propia (con su URL) y se relacionan de forma implícita: misma
// agrupación, mismo año y mismo tipo base de pieza. No hay campo de unión en el
// `.md`; solo la ficha alternativa lleva `letraTitulo`.
//
// De momento solo se agrupan pasodobles, que es donde la música se repite. Para
// otros tipos basta con añadirlos a `TIPOS_CON_LETRAS`.

export interface FichaConLetra {
  slug: string;
  data: {
    pieza: string;
    agrupacion: string;
    agrupacionSlug?: string;
    year: string | number;
    letraTitulo?: string | null;
    fraseClave?: string | null;
    date?: string;
  };
}

/** Tipos de pieza en los que varias fichas pueden compartir música. */
export const TIPOS_CON_LETRAS = new Set(['pasodoble']);

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Tipo de pieza sin el título entrecomillado (`Cuarteta "X"` → `cuarteta`). */
export function tipoBase(pieza: string): string {
  return normalizar((pieza || '').replace(/"[^"]*"/g, ''));
}

/** Fecha del frontmatter (`DD/MM/AAAA` o `DD-MM-AAAA`) como marca de tiempo. */
function fecha(valor?: string): number {
  const partes = (valor || '').split(/[/-]/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return 0;
  return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
}

/**
 * Fichas que comparten música con la actual, con la ficha original primero.
 * Si no hay grupo (o no hay ninguna letra marcada) devuelve solo la actual.
 */
export function hermanasDe<T extends FichaConLetra>(acorde: T, todas: T[]): T[] {
  const tipo = tipoBase(acorde.data.pieza);
  if (!TIPOS_CON_LETRAS.has(tipo)) return [acorde];

  const agrupacion = acorde.data.agrupacionSlug || acorde.data.agrupacion;
  const year = String(acorde.data.year);

  const grupo = todas.filter(
    (otra) =>
      tipoBase(otra.data.pieza) === tipo &&
      (otra.data.agrupacionSlug || otra.data.agrupacion) === agrupacion &&
      String(otra.data.year) === year,
  );

  if (grupo.length < 2) return [acorde];
  // Sin al menos una letra marcada no sabemos si son la misma música o dos
  // pasodobles distintos; en ese caso no se agrupan.
  if (!grupo.some((otra) => (otra.data.letraTitulo || '').trim())) return [acorde];

  return [...grupo].sort((a, b) => {
    const sinTituloA = (a.data.letraTitulo || '').trim() ? 1 : 0;
    const sinTituloB = (b.data.letraTitulo || '').trim() ? 1 : 0;
    if (sinTituloA !== sinTituloB) return sinTituloA - sinTituloB;
    return fecha(a.data.date) - fecha(b.data.date);
  });
}

/** Etiqueta corta de una letra: `letraTitulo`, la `fraseClave` o `Letra`. */
export function etiquetaLetra(acorde: FichaConLetra): string {
  const titulo = (acorde.data.letraTitulo || '').trim();
  if (titulo) return titulo;

  const frase = (acorde.data.fraseClave || '').trim();
  return frase || 'Letra';
}

/** Pieza con el título de la letra intercalado: `Pasodoble "La mujer nube"`. */
export function piezaConTitulo(data: {
  pieza: string;
  letraTitulo?: string | null;
}): string {
  const pieza = (data.pieza || '').trim();
  const titulo = (data.letraTitulo || '').trim();
  return titulo ? `${pieza} "${titulo}"` : pieza;
}

/** Nombre completo: `Pasodoble "La mujer nube" Los Colgaos`. */
export function nombrePieza(acorde: FichaConLetra): string {
  const agrupacion = (acorde.data.agrupacion || '').trim();
  return [piezaConTitulo(acorde.data), agrupacion].filter(Boolean).join(' ');
}
