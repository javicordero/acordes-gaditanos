// scripts/generar-iconos-pwa.mjs
//
// Genera los iconos de la PWA (192, 512, maskable y apple-touch-icon a sangre)
// a partir de `public/icons/logo.svg` (el monograma AG en negro) sobre fondo
// ámbar #fca311. Requiere sharp (dependencia de Astro, ya instalada).
//
// Uso: node scripts/generar-iconos-pwa.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const AMBAR = { r: 252, g: 163, b: 17, alpha: 1 };
const LOGO = fileURLToPath(new URL('../public/icons/logo.svg', import.meta.url));

async function generar(nombre, px, fraccion) {
  const tam = Math.round(px * fraccion);
  // Logo en negro sobre transparente, reducido a la fracción pedida.
  const logo = await sharp(LOGO)
    .resize(tam, tam, { fit: 'contain' })
    .png()
    .toBuffer();
  // Lienzo ámbar a sangre y logo centrado.
  const lienzo = sharp({
    create: { width: px, height: px, channels: 4, background: AMBAR },
  });
  const offset = Math.round((px - tam) / 2);
  await lienzo
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(fileURLToPath(new URL(`../public/${nombre}`, import.meta.url)));
  console.log(`✓ public/${nombre} (${px}x${px})`);
}

// `any` rellena todo el lienzo; `maskable` deja el monograma dentro del safe zone (~60 %).
await generar('icon-192.png', 192, 0.72);
await generar('icon-512.png', 512, 0.72);
await generar('maskable-512.png', 512, 0.58);
await generar('apple-touch-icon.png', 180, 0.72);
