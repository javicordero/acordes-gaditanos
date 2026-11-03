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
  // Logo en negro sobre transparente, a su proporción natural (sin forzar cuadrado,
  // para no introducir bandas de letterbox).
  const logo = await sharp(LOGO)
    .resize({ width: tam })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  // Lienzo ámbar a sangre y logo centrado.
  const lienzo = sharp({
    create: { width: px, height: px, channels: 4, background: AMBAR },
  });
  const left = Math.round((px - (meta.width ?? tam)) / 2);
  const top = Math.round((px - (meta.height ?? tam)) / 2);
  await lienzo
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(fileURLToPath(new URL(`../public/${nombre}`, import.meta.url)));
  console.log(`✓ public/${nombre} (${px}x${px})`);
}

// `any` rellena todo el lienzo; `maskable` deja el monograma dentro del safe zone (~60 %).
const soloBadge = process.argv.includes('--solo-badge');

if (!soloBadge) {
  await generar('icon-192.png', 192, 0.72);
  await generar('icon-512.png', 512, 0.72);
  await generar('maskable-512.png', 512, 0.58);
  await generar('apple-touch-icon.png', 180, 0.72);
}

// Badges de las notificaciones push. Android pinta solo la silueta (canal alfa)
// y la recolorea con el tema, así que necesita un PNG monocromo con
// transparencia. Windows enseña la imagen tal cual: ahí va la AG sobre el
// círculo ámbar de la web. El service worker elige según la plataforma.
async function generarBadgeMonocromo() {
  const TAM = 96;
  const ancho = Math.round(TAM * 0.92);
  const logo = await sharp(LOGO).resize({ width: ancho }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.round((TAM - (meta.width ?? ancho)) / 2);
  const top = Math.round((TAM - (meta.height ?? ancho)) / 2);

  await sharp({
    create: {
      width: TAM,
      height: TAM,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(fileURLToPath(new URL('../public/badge-96.png', import.meta.url)));
  console.log(`✓ public/badge-96.png (${TAM}x${TAM}, negro sobre transparente)`);
}

async function generarBadgeColor() {
  const TAM = 96;
  const ancho = Math.round(TAM * 0.62);
  const logo = await sharp(LOGO).resize({ width: ancho }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.round((TAM - (meta.width ?? ancho)) / 2);
  const top = Math.round((TAM - (meta.height ?? ancho)) / 2);
  const fondo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TAM}" height="${TAM}">` +
      `<circle cx="${TAM / 2}" cy="${TAM / 2}" r="${TAM / 2}" fill="#fca311"/></svg>`,
  );

  await sharp(fondo)
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(fileURLToPath(new URL('../public/badge-color-96.png', import.meta.url)));
  console.log(`✓ public/badge-color-96.png (${TAM}x${TAM}, ámbar con la AG)`);
}

await generarBadgeMonocromo();
await generarBadgeColor();
