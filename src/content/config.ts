import { defineCollection, z } from 'astro:content';

const acordes = defineCollection({
  schema: z.object({
    pieza: z.string(),
    agrupacion: z.string(),
    musica: z.string(),
    letra: z.string(),
    img: z.string(),
    year: z.number().transform((n) => n.toString()),
  }),
});

export const collections = {
  acordes: acordes,
};
