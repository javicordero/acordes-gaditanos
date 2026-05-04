// scripts/generate-pdf.mjs

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';

// ─── COLORES ────────────────────────────────────────────────────────────────

const COLORS = {
  brand: rgb(0, 0, 0), // fondo cabecera
  headerText: rgb(0.988, 0.635, 0.067), // #fca311
  title: rgb(0, 0, 0), // #000000
  meta: rgb(0.078, 0.129, 0.239), // #14213d
  acordeLink: rgb(0.0, 0.266, 0.8),
  text: rgb(0.13, 0.13, 0.13),
  muted: rgb(0.45, 0.45, 0.45),
  white: rgb(1, 1, 1),
};
// ─── LAYOUT ─────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function sanitize(text) {
  return text.replace(/\r/g, '').replace(/\t/g, '    ');
}

function extractPreContent(markdownBody) {
  const match = markdownBody.match(/<pre>([\s\S]*?)<\/pre>/);
  return match ? match[1] : '';
}

function parseLines(preContent) {
  return sanitize(preContent).split('\n');
}

function isChordLine(line) {
  return /^[\s]*([A-G][^a-záéíóú\s]{0,5}\s{2,})+/.test(line) && !/[a-záéíóúñ]{4,}/.test(line);
}

// ─── DIBUJO DE LÍNEAS ───────────────────────────────────────────────────────

function drawChordLine(page, line, x, y, size, font, defaultColor) {
  if (!line) return;

  line = sanitize(line);

  const parts = [];
  let lastIndex = 0;

  const regex = /<a[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: line.slice(lastIndex, match.index), color: defaultColor });
    }

    parts.push({ text: match[1], color: COLORS.acordeLink });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push({ text: line.slice(lastIndex), color: defaultColor });
  }

  let cursorX = x;

  for (const part of parts) {
    if (!part.text) continue;

    page.drawText(part.text, {
      x: cursorX,
      y,
      size,
      font,
      color: part.color,
    });

    cursorX += font.widthOfTextAtSize(part.text, size);
  }
}

// ─── GENERADOR ──────────────────────────────────────────────────────────────

async function generateAcordePDF(mdFilePath) {
  const raw = fs.readFileSync(mdFilePath, 'utf-8');
  const { data: fm, content: body } = matter(raw);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // ── FUENTES ───────────────────────────────────────────────────────────────

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let fontMono, fontMonoB;

  try {
    fontMono = await pdfDoc.embedFont(fs.readFileSync('fonts/RobotoMono-Regular.ttf'));
    fontMonoB = await pdfDoc.embedFont(fs.readFileSync('fonts/RobotoMono-Bold.ttf'));
  } catch {
    fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
    fontMonoB = await pdfDoc.embedFont(StandardFonts.CourierBold);
  }

  const { width, height } = page.getSize();

  // ── HEADER ────────────────────────────────────────────────────────────────

  const HEADER_H = 50;

  page.drawRectangle({
    x: 0,
    y: height - HEADER_H,
    width,
    height: HEADER_H,
    color: COLORS.title,
  });

  page.drawText('Acordes Gaditanos', {
    x: MARGIN,
    y: height - HEADER_H + 16,
    size: 18,
    font: fontBold,
    color: COLORS.headerText,
  });

  const url = 'acordesgaditanos.com';
  const urlW = fontReg.widthOfTextAtSize(url, 9);

  page.drawText(url, {
    x: width - MARGIN - urlW,
    y: height - HEADER_H + 18,
    size: 9,
    font: fontReg,
    color: COLORS.headerText,
  });

  let cursorY = height - HEADER_H - 30;

  // ── TÍTULO ────────────────────────────────────────────────────────────────

  const title = `${fm.pieza || ''} ${fm.agrupacion || ''}`;

  page.drawText(title, {
    x: MARGIN,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: COLORS.title,
  });

  cursorY -= 18;

  // ── METADATOS ─────────────────────────────────────────────────────────────

  const metas = [
    { label: 'Música:', value: fm.musica },
    { label: 'Letra:', value: fm.letra },
    { label: 'Año:', value: fm.year },
    { label: 'Cejilla:', value: fm.cejilla },
  ].filter((m) => m.value);

  for (const m of metas) {
    const labelW = fontBold.widthOfTextAtSize(m.label, 10);

    page.drawText(m.label, {
      x: MARGIN,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: COLORS.meta,
    });

    page.drawText(String(m.value), {
      x: MARGIN + labelW + 4,
      y: cursorY,
      size: 10,
      font: fontReg,
      color: COLORS.meta,
    });

    cursorY -= 14;
  }

  cursorY -= 10;

  // ── CONTENIDO ─────────────────────────────────────────────────────────────

  const lines = parseLines(extractPreContent(body));
  const lineH = 12;

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (cursorY < MARGIN) {
      pdfDoc.addPage();
      cursorY = PAGE_HEIGHT - 60;
    }

    if (isChordLine(line) && i + 1 < lines.length) {
      drawChordLine(page, line, MARGIN, cursorY, 9, fontMonoB, COLORS.text);
      cursorY -= lineH;

      i++;

      drawChordLine(page, lines[i], MARGIN, cursorY, 9, fontMono, COLORS.text);
      cursorY -= lineH + 2;
    } else {
      drawChordLine(page, line, MARGIN, cursorY, 9, fontMono, COLORS.text);
      cursorY -= lineH;
    }

    i++;
  }

  // ── GUARDAR ───────────────────────────────────────────────────────────────

  const pdfBytes = await pdfDoc.save();

  const outPath = path.join(path.dirname(mdFilePath), path.basename(mdFilePath, '.md') + '.pdf');

  fs.writeFileSync(outPath, pdfBytes);

  console.log('✅ PDF generado:', outPath);
}

// ─── ENTRY ──────────────────────────────────────────────────────────────────

const [, , mdPath] = process.argv;

if (!mdPath) {
  console.error('❌ Uso: node scripts/generate-pdf.mjs archivo.md');
  process.exit(1);
}

if (!fs.existsSync(mdPath)) {
  console.error('❌ No existe:', mdPath);
  process.exit(1);
}

generateAcordePDF(mdPath).catch(console.error);
