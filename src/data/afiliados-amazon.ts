/**
 * Catálogo de afiliados de Amazon para las fichas.
 *
 * Se usa en dos sitios:
 *   - el bloque «Carnaval y guitarra» de la columna derecha (4 productos);
 *   - la franja pequeña que va debajo de la cejilla, antes del <pre> (1 producto).
 *
 * Para retirar un producto del reparto basta con poner `activo: false`; para
 * añadir uno nuevo, un objeto más. Los IDs deben ser cortos y seguros para GA4
 * (minúsculas, números y guiones bajos; el evento final es
 * `click_amazon_<id>` y no puede pasar de 40 caracteres).
 *
 * `autores` queda preparado para una segunda fase: priorizar libros de un autor
 * cuando la ficha es suya. En la primera fase no se usa, para que todos los
 * productos tengan la misma oportunidad.
 */

export type TipoProducto = 'libro' | 'guitarra' | 'carnaval';

export interface ProductoAmazon {
  id: string;
  asin: string;
  tipo: TipoProducto;
  nombre: string;
  /** Autor o responsable visible en la ficha del producto. */
  autor?: string;
  /** Personas o agrupaciones sobre las que trata el producto (fase 2). */
  autores?: string[];
  imagen: string;
  url: string;
  /** `false` lo saca de la rotación sin borrar la ficha del catálogo. */
  activo?: boolean;
}

export const CATALOGO_AMAZON: ProductoAmazon[] = [
  // ----- Libros de Carnaval -----
  {
    id: 'libro_pasodoble',
    asin: '8494588567',
    tipo: 'libro',
    nombre: 'El pasodoble interminable',
    autor: 'Juan Carlos Aragón',
    autores: ['Juan Carlos Aragón'],
    imagen: 'https://m.media-amazon.com/images/I/61ZarQGAiNL._SY522_.jpg',
    url: 'https://amzn.to/48dgg8V',
    activo: true,
  },
  {
    id: 'libro_aragon',
    asin: '8417950893',
    tipo: 'libro',
    nombre: 'Juan Carlos Aragón: El Carnaval con mayúsculas',
    autor: 'Jaime Cedillo',
    autores: ['Juan Carlos Aragón'],
    imagen: 'https://m.media-amazon.com/images/I/612iOqw3piL._SY522_.jpg',
    url: 'https://amzn.to/4oZmpg1',
    activo: true,
  },
  {
    id: 'libro_historias',
    asin: '8419188565',
    tipo: 'libro',
    nombre: 'Historias del Carnaval de Cádiz que nunca te contaron',
    autor: 'David Franco Monthiel',
    imagen: 'https://m.media-amazon.com/images/I/71jfKjBr7WL._SY522_.jpg',
    url: 'https://amzn.to/3Kr244l',
    activo: true,
  },
  {
    id: 'libro_educacion',
    asin: '8410286300',
    tipo: 'libro',
    nombre: 'Carnaval de Cádiz y Educación',
    autor: 'Álvaro Pérez García',
    imagen: 'https://m.media-amazon.com/images/I/71W8Tj0xfSL._SY522_.jpg',
    url: 'https://amzn.to/4inguz8',
    activo: true,
  },
  {
    id: 'libro_patrimonio',
    asin: '8410525984',
    tipo: 'libro',
    nombre: 'El carnaval de Cádiz (Arte y patrimonio)',
    autor: 'Moisés Camacho Ortega',
    imagen: 'https://m.media-amazon.com/images/I/711ulr18EEL._SY522_.jpg',
    url: 'https://amzn.to/4inuj0d',
    activo: true,
  },
  {
    id: 'libro_historia',
    asin: '8412297334',
    tipo: 'libro',
    nombre: 'Historia general del Carnaval de Cádiz',
    autor: 'David Monthiel',
    imagen: 'https://m.media-amazon.com/images/I/71Bh-P1a+2L._SY522_.jpg',
    url: 'https://amzn.to/4imMYt2',
    activo: true,
  },
  {
    id: 'libro_republica',
    asin: '8498286719',
    tipo: 'libro',
    nombre: 'Las Coplas del Carnaval de Cádiz durante la Segunda República (1932-1936)',
    autor: 'Santiago Moreno Tello',
    imagen: 'https://m.media-amazon.com/images/I/61ioXVCMKaL._SY522_.jpg',
    url: 'https://amzn.to/4p6vILt',
    activo: true,
  },
  {
    id: 'libro_subiela',
    asin: '8494802879',
    tipo: 'libro',
    nombre: 'El corazón del ángel: vida, obra y confesiones de Ángel Subiela',
    autor: 'El Chapa',
    autores: ['Ángel Subiela'],
    imagen: 'https://m.media-amazon.com/images/I/81ULQS4z5sL._SY522_.jpg',
    url: 'https://amzn.to/48qYNu1',
    activo: true,
  },
  {
    id: 'libro_ares',
    asin: 'B0G2QVRWP8',
    tipo: 'libro',
    nombre: 'Martínez Ares: sus comparsas tras un viento de 13 años',
    autor: 'Carmen Miera',
    autores: ['Martínez Ares'],
    imagen: 'https://m.media-amazon.com/images/I/71f8U-jWsBL._SL1500_.jpg',
    url: 'https://amzn.to/4qS7Hs1',
    activo: true,
  },
  {
    id: 'libro_veneno',
    asin: 'B0CNH6GFY3',
    tipo: 'libro',
    nombre: 'Veneno de Capitán',
    autor: 'Martín Palomar',
    imagen: 'https://m.media-amazon.com/images/I/61Z2e9bIwbL._SL1500_.jpg',
    url: 'https://amzn.to/47irRnC',
    activo: true,
  },
  {
    id: 'libro_coplas_arte',
    asin: 'B0F9YTNGJX',
    tipo: 'libro',
    nombre: 'El carnaval de las coplas, un arte de Cádiz',
    autor: 'María Luisa Páramo',
    imagen: 'https://m.media-amazon.com/images/I/61GfvTpNdRL._SY385_.jpg',
    url: 'https://link.amazon/B0eNI0lEF',
    activo: true,
  },
  {
    id: 'guia_carnaval',
    asin: 'B0CJXCNW71',
    tipo: 'libro',
    nombre: 'Guía breve del Carnaval de Cádiz para forasteros',
    autor: 'tusitala ed.',
    imagen: 'https://m.media-amazon.com/images/I/710To4tiPrL._SY385_.jpg',
    url: 'https://link.amazon/B0hs46w9h',
    activo: true,
  },
  {
    id: 'generacion_tangai',
    asin: '8478989617',
    tipo: 'libro',
    nombre: 'Generación Tangai',
    autor: 'Manuel J. Casal y Modesto Barragán',
    imagen: 'https://m.media-amazon.com/images/I/51nXcek2qUL._SY385_.jpg',
    url: 'https://link.amazon/B0b2v75xJ',
    activo: true,
  },

  // ----- Guitarra y cosas de Carnaval -----
  {
    id: 'guitarra_cejilla',
    asin: 'B00TDMA1LE',
    tipo: 'guitarra',
    nombre: 'Cejilla metálica',
    imagen: 'https://m.media-amazon.com/images/I/61PYWd6mVuL._AC_SX679_.jpg',
    url: 'https://amzn.to/4pstLsj',
    activo: true,
  },
  {
    id: 'guitarra_afinador',
    asin: 'B073ZPTM1F',
    tipo: 'guitarra',
    nombre: 'Afinador de pinza',
    imagen: 'https://m.media-amazon.com/images/I/710EIwj4oRL._AC_SX679_.jpg',
    url: 'https://amzn.to/3XRjLNw',
    activo: true,
  },
  {
    id: 'cejilla_madera',
    asin: 'B0BC1RMMXP',
    tipo: 'guitarra',
    nombre: 'Cejilla de madera',
    imagen: 'https://m.media-amazon.com/images/I/51fxFmlGsQL._AC_SX679_.jpg',
    url: 'https://amzn.to/4p77lgA',
    activo: true,
  },
  {
    id: 'guitarra_cuerdas',
    asin: 'B000EEL6J6',
    tipo: 'guitarra',
    nombre: "Cuerdas D'Addario",
    imagen: 'https://m.media-amazon.com/images/I/8169k0GrNyL._AC_SX679_.jpg',
    url: 'https://amzn.to/4ioVPuD',
    activo: true,
  },
  {
    id: 'guitarra_funda',
    asin: 'B07BMQMF9N',
    tipo: 'guitarra',
    nombre: 'Funda acolchada',
    imagen: 'https://m.media-amazon.com/images/I/61zTQVs3vxL._AC_SX679_.jpg',
    url: 'https://amzn.to/48xhLjH',
    activo: true,
  },
  {
    id: 'guitarra_estuche',
    asin: 'B08ZN6YBTD',
    tipo: 'guitarra',
    nombre: 'Estuche rígido',
    imagen: 'https://m.media-amazon.com/images/I/81cOIPsTcLL._AC_SX679_.jpg',
    url: 'https://amzn.to/43U2GpM',
    activo: true,
  },
  {
    id: 'guitarra_puas',
    asin: 'B09F6QQW2P',
    tipo: 'guitarra',
    nombre: 'Púas con caja metálica',
    imagen: 'https://m.media-amazon.com/images/I/719n0LcSC-L._AC_SX522_.jpg',
    url: 'https://amzn.to/4prKSKS',
    activo: true,
  },
  {
    id: 'guitarra_soporte',
    asin: 'B0932MSRV2',
    tipo: 'guitarra',
    nombre: 'Soporte para guitarra',
    imagen: 'https://m.media-amazon.com/images/I/61V2DtVXbqL._AC_SX679_.jpg',
    url: 'https://amzn.to/4pt1v8V',
    activo: true,
  },
  {
    id: 'taza_buenos_dias',
    asin: 'B07XXD5HF5',
    tipo: 'carnaval',
    nombre: 'Taza «buenos días tú»',
    imagen: 'https://m.media-amazon.com/images/I/41qVKsJnRAL._AC_.jpg',
    url: 'https://amzn.to/3YzhvLj',
    activo: true,
  },
  {
    id: 'taza_aragon',
    asin: 'B0847SV4BW',
    tipo: 'carnaval',
    nombre: 'Taza Juan Carlos Aragón',
    autores: ['Juan Carlos Aragón'],
    imagen: 'https://m.media-amazon.com/images/I/41RsofNSvzL._AC_.jpg',
    url: 'https://amzn.to/3YvkiVX',
    activo: true,
  },
  {
    id: 'taza_carnaval_cadiz',
    asin: 'B0786KGD9Z',
    tipo: 'carnaval',
    nombre: 'Taza Carnaval de Cádiz',
    imagen: 'https://m.media-amazon.com/images/I/61F-SqJRsoL._AC_SX569_.jpg',
    url: 'https://link.amazon/B09Q0InZy',
    activo: true,
  },
  {
    id: 'juego_mesa',
    asin: 'B0DK94BXFQ',
    tipo: 'carnaval',
    nombre: 'Juego de mesa: «Después de Cádiz ni hablar»',
    imagen: 'https://m.media-amazon.com/images/I/61iRyEJNF4L._AC_SL1200_.jpg',
    url: 'https://amzn.to/3LuQCoW',
    activo: true,
  },
  {
    id: 'felpudo_carnaval',
    asin: 'B0B852PQDZ',
    tipo: 'carnaval',
    nombre: 'Felpudo Carnaval 365 días',
    imagen: 'https://m.media-amazon.com/images/I/61E9+uyXmML._AC_SX569_.jpg',
    url: 'https://link.amazon/B0ggERWbg',
    activo: true,
  },
  {
    id: 'taza_great_theater',
    asin: 'B0DTL82R5D',
    tipo: 'carnaval',
    nombre: 'Taza Great Theater Falla',
    imagen: 'https://m.media-amazon.com/images/I/61JK9pDF-BL._AC_SX569_.jpg',
    url: 'https://link.amazon/B07Ddh6JL',
    activo: true,
  },
  {
    id: 'pito_madera',
    asin: 'B0D5DFD3F3',
    tipo: 'carnaval',
    nombre: 'Pito de Carnaval de madera',
    imagen: 'https://m.media-amazon.com/images/I/416cxZYzH+L._AC_SX679_.jpg',
    url: 'https://link.amazon/B049OAosD',
    activo: true,
  },
  {
    id: 'juego_credo',
    asin: 'B0G64F2ZFZ',
    tipo: 'carnaval',
    nombre: 'Juego de mesa «El Credo»',
    imagen: 'https://m.media-amazon.com/images/I/41+AeV+9nTL._AC_SX569_.jpg',
    url: 'https://link.amazon/B0heOdg8C',
    activo: true,
  },
];

/** Productos que entran en la rotación. */
export const PRODUCTOS_ACTIVOS = CATALOGO_AMAZON.filter((p) => p.activo !== false);

/** Etiqueta corta que se pinta bajo el nombre. */
export function etiquetaTipo(tipo: TipoProducto): string {
  if (tipo === 'libro') return 'Libro';
  if (tipo === 'guitarra') return 'Guitarra';
  return 'Carnaval';
}

/** Emplazamiento del producto dentro de la ficha. */
export type BloqueAmazon = 'bloque' | 'inline';

/**
 * Nombre del evento de GA4. Incluye el producto y el emplazamiento, así no
 * hacen falta dimensiones personalizadas:
 *   click_amazon_libro_pasodoble_bloque
 *   view_amazon_libro_pasodoble_inline
 *
 * GA4 limita los nombres a 40 caracteres; los IDs del catálogo están elegidos
 * para que `click_amazon_<id>_<bloque>` no pase de ahí.
 */
export function eventoAmazon(
  id: string,
  bloque: BloqueAmazon,
  accion: 'click' | 'view',
): string {
  return `${accion}_amazon_${id}_${bloque}`;
}

/**
 * Pide a Amazon una miniatura pequeña (~180 px) en vez de la imagen grande.
 * El CDN acepta `._SX180_.jpg` para todos los formatos que usamos.
 */
export function miniaturaAmazon(url: string): string {
  return url.replace(/\._[A-Za-z0-9_,]+_\.jpg$/i, '._SX180_.jpg');
}

/** Hash estable y barato: misma ficha, mismos productos en cada build. */
function hashSlug(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Baraja determinista: la semilla decide el orden y no cambia entre builds. */
function barajar<T>(elementos: T[], semilla: string): T[] {
  const copia = [...elementos];
  let estado = hashSlug(semilla) || 1;
  for (let i = copia.length - 1; i > 0; i--) {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    const j = estado % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Reparto de una ficha:
 *   - 1 producto para la franja inline;
 *   - 4 para el bloque, sin repetir el del inline ni entre ellos.
 *
 * La mezcla intenta 2 libros + 2 de guitarra/Carnaval. Si un grupo se queda
 * corto, se rellena con el otro.
 */
export function seleccionParaFicha(
  slug: string,
  total = 4,
): { inline: ProductoAmazon; bloque: ProductoAmazon[] } {
  if (PRODUCTOS_ACTIVOS.length === 0) {
    throw new Error('No hay productos de Amazon activos en el catálogo');
  }

  const inline = PRODUCTOS_ACTIVOS[hashSlug(`${slug}:inline`) % PRODUCTOS_ACTIVOS.length];
  const disponibles = PRODUCTOS_ACTIVOS.filter((p) => p.id !== inline.id);

  const libros = barajar(
    disponibles.filter((p) => p.tipo === 'libro'),
    `${slug}:libros`,
  );
  const otros = barajar(
    disponibles.filter((p) => p.tipo !== 'libro'),
    `${slug}:otros`,
  );

  const elegidos: ProductoAmazon[] = [];
  const usados = new Set<string>();

  const anadir = (producto?: ProductoAmazon) => {
    if (!producto || usados.has(producto.id) || elegidos.length >= total) return;
    usados.add(producto.id);
    elegidos.push(producto);
  };

  // Mezcla: libro, guitarra/Carnaval, libro, guitarra/Carnaval.
  anadir(libros[0]);
  anadir(otros[0]);
  anadir(libros[1]);
  anadir(otros[1]);

  // Si el catálogo o un grupo se queda corto, completa con lo que quede.
  if (elegidos.length < total) {
    for (const producto of barajar(disponibles, `${slug}:relleno`)) {
      if (elegidos.length >= total) break;
      anadir(producto);
    }
  }

  return { inline, bloque: barajar(elegidos, `${slug}:orden`) };
}
