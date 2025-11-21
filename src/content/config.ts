import { defineCollection, z } from 'astro:content';

const acordes = defineCollection({
  schema: z.object({
    pieza: z.string(),
    agrupacion: z.string(),
    musica: z.string(),
    letra: z.string(),
    img: z.string(),
    year: z.number().transform((n) => n.toString()),
    date: z.string().regex(/^\d{2}[-/]\d{2}[-/]\d{4}$/),
    video: z.string().optional(),
    video2: z.string().optional(),
  }),
});

export const collections = {
  acordes: acordes,
};
