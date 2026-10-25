// scripts/generar-qr.mjs
//
// Genera una sola vez los QR de los canales de avisos a partir de
// src/data/canales.json y los deja en public/ (qr-whatsapp.svg, qr-telegram.svg).
// No se ejecuta en el build: los SVG van versionados.
//
// Uso: node scripts/generar-qr.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const canales = JSON.parse(readFileSync('src/data/canales.json', 'utf8'));

for (const [nombre, url] of Object.entries(canales)) {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const ruta = `public/qr-${nombre}.svg`;
  writeFileSync(ruta, svg);
  console.log(`✓ ${ruta} (${url})`);
}
