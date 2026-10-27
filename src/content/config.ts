import { defineCollection, z } from 'astro:content';

// Función para dividir autores por coma
function splitAuthors(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

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

// Esquema compartido por la colección oficial y la provisional de importación
const acordeSchema = z
  .object({
    pieza: z.string(),
    agrupacion: z.string(),
    musica: z.string().optional(),
    letra: z.string().optional(),
    // Título de una letra alternativa de la misma música ("La mujer nube").
    // Solo lo llevan las fichas que no son la original.
    letraTitulo: z.string().optional(),
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
    destacada: z.number().optional().nullable(),
    recomendada: z.boolean().optional().nullable(),
  })
  .transform((data) => {
    const musicaList = splitAuthors(data.musica);
    const letraList = splitAuthors(data.letra);
    return {
      ...data,
      musicaList,
      letraList,
      musicaSlugs: musicaList.map(generateSlug),
      letraSlugs: letraList.map(generateSlug),
      // Generar slugs automáticamente (primer autor para backward compatibility)
      musicaSlug: musicaList[0] ? generateSlug(musicaList[0]) : '',
      letraSlug: letraList[0] ? generateSlug(letraList[0]) : '',
      agrupacionSlug: generateSlug(data.agrupacion),
    };
  });

const acordes = defineCollection({ schema: acordeSchema });

// Colección provisional: acordes importados desde el cancionero, pendientes de revisar.
// Los acordes viven sin envolver en <a>; la envoltura se aplica al promover a `acordes`.
const acordes2 = defineCollection({ schema: acordeSchema });

const autores = defineCollection({
  schema: z
    .object({
      nombre: z.string(),
      img: z.string(),
      destacado: z.boolean().optional().nullable(),
      order: z.number().optional().nullable(),
      type: z.enum(['musica', 'letra']).optional().default('musica'),
    })
    .transform((data) => ({
      ...data,
      autorSlug: generateSlug(data.nombre),
    })),
});

const donaciones = defineCollection({
  schema: z.object({
    donaciones: z.array(z.object({
      fecha: z.string(),
      importe: z.number(),
      donante: z.string().optional(),
    })),
  }),
});

export const collections = {
  acordes: acordes,
  acordes2: acordes2,
  autores: autores,
  donaciones: donaciones,
};
