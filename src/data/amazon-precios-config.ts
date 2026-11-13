/**
 * Interruptores del experimento de precios de Amazon.
 *
 * NO poner `PRECIOS_AMAZON_ACTIVOS` a true hasta que se cumplan las tres cosas:
 *
 * 1. La cuenta de Amazon Afiliados sea elegible para Creators API.
 *    Hoy la API devuelve `AssociateNotEligible` con las credenciales actuales.
 * 2. Amazon autorice por escrito el uso de Product Advertising Content en este
 *    sitio responsive/móvil. La licencia europea (IP License 2.d) lo exige.
 * 3. Exista una forma conforme de mostrar los gastos de envío. OffersV2 no
 *    devuelve `ShippingCharges`; sin ese dato no se puede activar el precio.
 *
 * Mientras cualquiera de las tres falle, las fichas se sirven con la variante A
 * (sin precio) y no se asigna ningún bucket.
 */

export const PRECIOS_AMAZON_ACTIVOS = false;

/** Solo true con autorización previa y expresa de Amazon para el sitio móvil. */
export const LICENCIA_MOVIL_APROBADA = false;

/** La licencia permite cachear contenido que no sea imagen hasta 24 horas. */
export const MINUTOS_VIGENCIA_PRECIOS = 24 * 60;

export interface PrecioAmazon {
  asin: string;
  precio: number;
  moneda: string;
  precioTexto: string;
  disponibilidad: string;
  actualizado: string;
}

export interface DatosPreciosAmazon {
  actualizado: string;
  moneda: string;
  productos: Record<string, PrecioAmazon>;
  /** true solo si todos los productos activos tienen precio válido. */
  completo: boolean;
  sinPrecio?: Record<string, string>;
}

/**
 * Devuelve true solo si el experimento está autorizado y el JSON es fresco.
 * Se usa en el build y en el cliente: si el HTML queda cacheado más de 24 h,
 * el cliente deja de mostrar precios.
 */
export function preciosAmazonActivos(
  datos: DatosPreciosAmazon | null,
  ahora = Date.now(),
): boolean {
  if (!PRECIOS_AMAZON_ACTIVOS || !LICENCIA_MOVIL_APROBADA) return false;
  if (!datos || !datos.productos || datos.completo !== true) return false;
  if (Object.keys(datos.productos).length === 0) return false;

  const fecha = Date.parse(datos.actualizado);
  if (!Number.isFinite(fecha)) return false;

  const edad = ahora - fecha;
  const cincoMinutos = 5 * 60 * 1000;
  return edad >= -cincoMinutos && edad <= MINUTOS_VIGENCIA_PRECIOS * 60 * 1000;
}
