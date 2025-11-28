import { defineCollection, z } from 'astro:content';

// Función para generar slugs automáticamente
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\s-]/g, '') // Quitar caracteres especiales
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno solo
    .replace(/^-|-$/g, ''); // Quitar guiones al inicio/final
}

const acordes = defineCollection({
  schema: z
    .object({
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
      cover: z.string().optional().nullable(),
      autorCover: z.string().optional().nullable(),
      fraseClave: z.string().optional(),
      destacada: z.boolean().optional().nullable(),
    })
    .transform((data) => ({
      ...data,
      // Generar slugs automáticamente
      musicaSlug: data.musica ? generateSlug(data.musica) : '',
      letraSlug: data.letra ? generateSlug(data.letra) : '',
      agrupacionSlug: generateSlug(data.agrupacion),
    })),
});

const autores = defineCollection({
  schema: z
    .object({
      nombre: z.string(),
      img: z.string(),
      destacado: z.boolean().optional().nullable(),
      order: z.number().optional(),
    })
    .transform((data) => ({
      ...data,
      autorSlug: generateSlug(data.nombre),
    })),
});

export const collections = {
  acordes: acordes,
  autores: autores,
};
