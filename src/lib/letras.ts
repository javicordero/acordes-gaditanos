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

/** Coplas y letras alternativas que hay en un conjunto de fichas. */
export interface RecuentoCoplas {
  /** Piezas distintas: cada grupo de letras cuenta una sola vez. */
  coplas: number;
  /** Letras que acompañan a una copla ya contada (las demás del grupo). */
  letras: number;
}

/** Recuento de coplas y letras extras, con el mismo criterio que `hermanasDe`. */
export function contarCoplas(fichas: FichaConLetra[]): RecuentoCoplas {
  const grupos = new Map<string, FichaConLetra[]>();

  for (const ficha of fichas) {
    const tipo = tipoBase(ficha.data.pieza);
    if (!TIPOS_CON_LETRAS.has(tipo)) continue;
    const agrupacion = ficha.data.agrupacionSlug || ficha.data.agrupacion;
    const clave = `${tipo}|${agrupacion}|${ficha.data.year}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(ficha);
    else grupos.set(clave, [ficha]);
  }

  let letras = 0;
  for (const grupo of grupos.values()) {
    // Dos pasodobles sueltos de la misma agrupación y año no son una letra
    // alternativa: sin `letraTitulo` no sabemos que compartan música.
    if (grupo.length < 2) continue;
    if (!grupo.some((ficha) => (ficha.data.letraTitulo || '').trim())) continue;
    letras += grupo.length - 1;
  }

  return { coplas: fichas.length - letras, letras };
}

/** Tipos de pieza en los que varias fichas pueden compartir música. */
export const TIPOS_CON_LETRAS = new Set(['pasodoble']);

/** `1 copla` / `3 coplas`: la cifra con su palabra en singular o plural. */
export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * `38 coplas` o `49 coplas y 2 letras extras`: la parte de letras solo aparece
 * cuando hay alguna; un año sin letras alternativas se queda en las coplas.
 */
export function textoRecuento({ coplas, letras }: RecuentoCoplas): string {
  const base = plural(coplas, 'copla', 'coplas');
  return letras ? `${base} y ${plural(letras, 'letra extra', 'letras extras')}` : base;
}

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

/** Caracteres a los que se recorta la frase clave dentro del título. */
const MAX_FRASE_SEO = 35;

/** Caracteres a los que se intenta ajustar el título entero. */
const MAX_TITULO_SEO = 100;

/** Longitud mínima que se le deja a la agrupación al recortar. */
const MIN_AGRUPACION_SEO = 25;

/** Frase cortada por palabra completa (y sin la puntuación que quede al final). */
function recortarFrase(frase: string, max = MAX_FRASE_SEO): string {
  const limpia = (frase || '').trim();
  if (limpia.length <= max) return limpia;

  let corte = '';
  for (const palabra of limpia.split(/\s+/)) {
    const siguiente = corte ? `${corte} ${palabra}` : palabra;
    if (siguiente.length > max && corte) break;
    corte = siguiente;
  }

  return corte.replace(/[,;:.!?¡¿"'…]+$/, '').trim();
}

/**
 * Frases de tarareo (`ba ba ba`, `tutu tutu`, `uuuh`), que no sirven de título:
 * todas sus palabras son cortas o la misma sílaba repetida.
 */
function esRelleno(frase: string): boolean {
  const palabras = (frase || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ');

  if (!palabras[0]) return true;

  return palabras.every((palabra) => {
    if (palabra.length <= 3) return true;
    for (let k = 1; k <= Math.min(4, palabra.length - 1); k++) {
      let periodica = true;
      for (let i = k; i < palabra.length; i++) {
        if (palabra[i] !== palabra[i - k]) {
          periodica = false;
          break;
        }
      }
      if (periodica) return true;
    }
    return false;
  });
}

/**
 * Agrupación recortada por el sitio más natural que quepa en `max`: antes de un
 * paréntesis o una coma si cae cerca, y si no por palabra completa. Siempre
 * con puntos suspensivos, para que se vea que el nombre está cortado.
 */
function acortarNombre(nombre: string, max: number): string {
  if (!nombre || nombre.length <= max) return nombre;

  const corte = nombre.slice(0, max);
  const natural = Math.max(
    corte.lastIndexOf('('),
    corte.lastIndexOf(','),
    corte.lastIndexOf(';'),
  );
  const desde =
    natural >= Math.min(12, Math.floor(max / 2))
      ? nombre.slice(0, natural)
      : corte.slice(0, Math.max(corte.lastIndexOf(' '), 0));
  const limpio = desde.trim().replace(/[,;(]+$/, '').trim();

  return `${limpio || corte.trim()}…`;
}

/**
 * Título de la pestaña y del resultado de Google: pieza, agrupación, nombre de
 * la copla y año, sin la marca, para que quepa entero en Google.
 *
 *   `Acordes Pasodoble Los Colgaos "Y en el Gran Astillero" - Carnaval 2024`
 *   `Acordes Popurrí Los Ángeles Caídos - Carnaval 2002`
 *
 * El nombre de la copla sale de `letraTitulo` y, si no lo hay, de la
 * `fraseClave` (el primer verso, que es lo que se busca), recortada a
 * `MAX_FRASE_SEO` caracteres por palabra completa; si la frase es puro
 * tarareo, se deja sin nombre. Si la pieza ya lo trae entrecomillado
 * (`Cuarteta "Castigo divino"`), no se repite. La agrupación se acorta solo
 * cuando el título pasa de `MAX_TITULO_SEO`.
 */
export function tituloSeo(acorde: FichaConLetra): string {
  const data = acorde.data;
  const pieza = (data.pieza || '').trim();
  const agrupacion = (data.agrupacion || '').trim();
  const year = String(data.year ?? '').trim();
  const letraTitulo = (data.letraTitulo || '').trim();
  const frase = (data.fraseClave || '').trim();
  const nombre = letraTitulo || (esRelleno(frase) ? '' : recortarFrase(frase));
  const yaEnPieza = /"[^"]+"/.test(pieza) || (!!nombre && pieza.includes(nombre));
  const titulo = nombre && !yaEnPieza ? `"${nombre}"` : '';
  const cola = year ? `- Carnaval ${year}` : '';

  // Hueco que le queda a la agrupación: el resto del título ya está ocupado.
  const resto = ['Acordes', pieza, titulo, cola].filter(Boolean).join(' ');
  const hueco = Math.max(MIN_AGRUPACION_SEO, MAX_TITULO_SEO - resto.length - 1);

  return ['Acordes', pieza, acortarNombre(agrupacion, hueco), titulo, cola]
    .filter(Boolean)
    .join(' ');
}

/** Nombre completo: `Pasodoble "La mujer nube" Los Colgaos`. */
export function nombrePieza(acorde: FichaConLetra): string {
  const agrupacion = (acorde.data.agrupacion || '').trim();
  return [piezaConTitulo(acorde.data), agrupacion].filter(Boolean).join(' ');
}
