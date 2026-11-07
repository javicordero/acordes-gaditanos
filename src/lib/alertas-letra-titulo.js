const normalizar = (texto) => String(texto || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const esPasodoble = (pieza) => /^pasodoble(?:\s|$)/i.test(String(pieza || '').trim());

/**
 * Avisa si se va a publicar un pasodoble con `letraTitulo` y hay otros
 * pasodobles de la misma agrupación que todavía no tienen título de letra.
 * Es una advertencia, no una validación bloqueante.
 */
export function avisosPasodoblesSinTitulo(fichas, slugs) {
  const porSlug = new Map((fichas || []).map((ficha) => [ficha.slug, ficha]));
  const vistos = new Set();
  const avisos = [];

  for (const slug of slugs || []) {
    const ficha = porSlug.get(slug);
    if (!ficha || !esPasodoble(ficha.pieza) || !String(ficha.letraTitulo || '').trim()) continue;

    const agrupacion = normalizar(ficha.agrupacion);
    if (!agrupacion || vistos.has(agrupacion)) continue;
    vistos.add(agrupacion);

    const faltan = (fichas || []).filter((otra) =>
      otra.slug !== ficha.slug &&
      esPasodoble(otra.pieza) &&
      normalizar(otra.agrupacion) === agrupacion &&
      !String(otra.letraTitulo || '').trim(),
    );

    if (faltan.length) avisos.push({
      agrupacion: ficha.agrupacion,
      titulo: ficha.letraTitulo,
      ficha: ficha.slug,
      faltan: faltan.map(({ slug: otroSlug, letraTitulo }) => ({ slug: otroSlug, letraTitulo: letraTitulo || '' })),
    });
  }

  return avisos;
}
