// src/lib/videos.ts
//
// Estado de los vídeos de YouTube de las fichas. Lo genera
// scripts/auditar-videos.mjs (`npm run videos`): si un vídeo está borrado o no
// permite incrustarse, la ficha no pinta un iframe roto en su lugar.
//
// Sin datos (vídeo recién añadido, o un cover que no se audita) se asume que
// está bien: preferimos intentar el iframe antes que ocultar algo que funciona.

import datos from '../data/videos-estado.json';

export type EstadoVideo = 'ok' | 'muerto' | 'bloqueado';

const VIDEOS = (datos as { videos: Record<string, { estado: EstadoVideo }> }).videos || {};

export function idYoutube(url: string | undefined): string {
  if (!url) return '';
  const coincidencia = String(url).match(/(?:embed\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return coincidencia ? coincidencia[1] : '';
}

export function estadoDeVideo(url: string | undefined): EstadoVideo {
  const id = idYoutube(url);
  return (id && VIDEOS[id] && VIDEOS[id].estado) || 'ok';
}

export function enlaceYoutube(url: string | undefined): string {
  const id = idYoutube(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : '';
}

export function busquedaYoutube(...partes: Array<string | number | undefined>): string {
  const consulta = partes.filter(Boolean).join(' ').trim();
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(consulta);
}
