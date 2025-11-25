import { defineCollection, z } from 'astro:content';

const acordes = defineCollection({
  schema: z.object({
    pieza: z.string(),
    agrupacion: z.string(),
    musica: z.string().optional(),
    letra: z.string().optional(),
    img: z.string(),
    year: z.number().transform((n) => n.toString()),
    modalidad: z.string().optional(),
    cejilla: z
      .number()
      .transform((n) => n.toString())
      .optional(),
    date: z.string().regex(/^\d{2}[-/]\d{2}[-/]\d{4}$/),
    video: z.string().optional(),
    cover: z.string().optional(),
    coverAuthor: z.string().optional(),
  }),
});

export const collections = {
  acordes: acordes,
};
