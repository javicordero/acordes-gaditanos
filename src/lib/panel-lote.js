// Qué fichas de «Por publicar» se pueden subir en lote y en qué orden.
//
// Es lógica pura (sin DOM ni fetch) para poder probarla desde Node con
// `npm run auditar:lote`. El panel le pasa las filas tal cual las tiene: las de
// `pendientesPublicar` (cambios del ordenador sin commit) y las de una PR
// abierta (`enPR`).
//
//   subir    → `POST /admin/api/publicar-local` con todos los slugs
//   fusionar → `POST /admin/api/fusionar` uno a uno (squash de la PR)

const SUBIBLES = new Set(['nueva', 'modificada', 'borrada', 'sin-push']);

/** Una ficha nueva lleva aviso en los canales; una corrección o una baja, no. */
export const avisa = (item) => Boolean(item) &&
  (item.estado === 'nueva' || (item.estado === 'sin-push' && item.cambio === 'nueva'));

/** ¿Esta fila puede entrar en un lote de «Publicar»? */
export function puedeSubir(item, modoLocal = true) {
  if (!item) return false;
  if (item.enPR) return true;
  // En producción no hay disco: solo se publica lo que está en una PR.
  if (!modoLocal) return false;
  return SUBIBLES.has(String(item.estado || ''));
}

/** Cómo se publica una fila: fusionando su PR o subiendo los cambios. */
export const accionDe = (item) => (item && item.enPR ? 'fusionar' : 'subir');

/**
 * Reparte la selección. `omitidos` son las que se han colado (una ficha que ya
 * no está pendiente, un borrador…) y el panel avisa de que se quedan fuera.
 */
export function dividirLote(items, modoLocal = true) {
  const subir = [];
  const fusionar = [];
  const omitidos = [];
  for (const item of items || []) {
    if (!puedeSubir(item, modoLocal)) {
      omitidos.push(item);
      continue;
    }
    if (accionDe(item) === 'fusionar') fusionar.push(item);
    else subir.push(item);
  }
  return { subir, fusionar, omitidos };
}

/** `publicar-local` acepta 20 slugs por trabajo: el resto van en tandas. */
export function enTandas(items, max = 20) {
  const tam = Math.max(1, Number(max) || 20);
  const out = [];
  for (let i = 0; i < (items || []).length; i += tam) out.push(items.slice(i, i + tam));
  return out;
}
