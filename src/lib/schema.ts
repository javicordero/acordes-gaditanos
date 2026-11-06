// src/lib/schema.ts
//
// Datos estructurados de la ficha: el `VideoObject` del vídeo de YouTube.
// Funciones puras, se usan en el build.

import { CONFIG } from './constants';

/** `DD/MM/AAAA` (o `DD-MM-AAAA`) → `AAAA-MM-DDTHH:MM:SSZ`. */
export function fechaISO(fecha: string | undefined): string {
  if (!fecha) return '';
  const partes = String(fecha).split(/[/-]/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return '';
  const [dia, mes, anio] = partes;
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T00:00:00Z`;
}

/** Segundos → duración ISO 8601 (`PT1H02M03S`). */
export function duracionISO(segundos: number | undefined): string {
  if (!segundos || segundos <= 0) return '';
  const total = Math.round(segundos);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const seg = total % 60;

  let texto = 'PT';
  if (horas) texto += `${horas}H`;
  if (minutos) texto += `${minutos}M`;
  if (seg || (!horas && !minutos)) texto += `${seg}S`;
  return texto;
}

export interface DatosVideo {
  id: string;
  nombre: string;
  descripcion: string;
  /** Fecha de subida en ISO (`AAAA-MM-DD`), si se conoce. */
  fecha?: string;
  /** Duración en segundos, si se conoce. */
  duracion?: number;
  /** Página de la ficha, para el `@id`. */
  pagina: string;
}

/**
 * `VideoObject` del vídeo de YouTube de la ficha. Google exige `name`,
 * `description`, `thumbnailUrl` y `uploadDate`; si falta la fecha de subida
 * (la consigue `npm run videos -- --detalles`) no se debe emitir.
 */
export function videoYouTube(datos: DatosVideo) {
  const miniatura = `https://i.ytimg.com/vi/${datos.id}/hqdefault.jpg`;
  const duracion = duracionISO(datos.duracion);

  return {
    '@type': 'VideoObject',
    '@id': `${datos.pagina}#video`,
    name: datos.nombre,
    description: datos.descripcion,
    thumbnailUrl: miniatura,
    ...(datos.fecha ? { uploadDate: datos.fecha } : {}),
    ...(duracion ? { duration: duracion } : {}),
    embedUrl: `https://www.youtube.com/embed/${datos.id}`,
    contentUrl: `https://www.youtube.com/watch?v=${datos.id}`,
    url: `https://www.youtube.com/watch?v=${datos.id}`,
    inLanguage: 'es-ES',
    isFamilyFriendly: true,
    publisher: {
      '@type': 'Organization',
      name: 'Acordes Gaditanos',
      url: CONFIG.site,
    },
  };
}
