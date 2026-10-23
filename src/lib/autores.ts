// Recuento de créditos por autor para saber qué páginas existen realmente.
// Se calcula en build a partir de los acordes, no de los .md de autores,
// porque las rutas /autor/musica y /autor/letra solo se generan cuando hay coplas.

export type CreditosAutor = { musica: number; letra: number };

type AcordeConCreditos = {
  data: {
    musicaSlugs?: string[];
    letraSlugs?: string[];
  };
};

export function contarCreditosAutores(
  acordes: AcordeConCreditos[]
): Record<string, CreditosAutor> {
  const creditos: Record<string, CreditosAutor> = {};

  const sumar = (slugs: string[] | undefined, tipo: 'musica' | 'letra') => {
    // Set por acorde: un autor no debe contar dos veces en la misma copla
    new Set(slugs ?? []).forEach((slug) => {
      if (!slug) return;
      creditos[slug] ??= { musica: 0, letra: 0 };
      creditos[slug][tipo] += 1;
    });
  };

  acordes.forEach((acorde) => {
    sumar(acorde.data.musicaSlugs, 'musica');
    sumar(acorde.data.letraSlugs, 'letra');
  });

  return creditos;
}
