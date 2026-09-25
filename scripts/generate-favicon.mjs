import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public', 'img', 'logo-circular.png')
const outDir = path.join(root, 'public')
const imgDir = path.join(outDir, 'img')

const pngTargets = [
  { file: path.join(outDir, 'favicon-32.png'), size: 32 },
  { file: path.join(outDir, 'favicon-192.png'), size: 192 },
  { file: path.join(outDir, 'apple-touch-icon.png'), size: 180 },
]

const icoSizes = [16, 32, 48]

function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const entries = []
  const blobs = []
  let offset = 6 + images.length * 16

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    blobs.push(data)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...blobs])
}

await mkdir(imgDir, { recursive: true })

for (const { file, size } of pngTargets) {
  await sharp(source).resize(size, size, { fit: 'cover' }).png().toFile(file)
  console.log(`Generado ${path.relative(root, file)} (${size}x${size})`)
}

const icoImages = []
for (const size of icoSizes) {
  const data = await sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer()
  icoImages.push({ size, data })
}

await writeFile(path.join(outDir, 'favicon.ico'), buildIco(icoImages))
console.log(`Generado public/favicon.ico (${icoSizes.join('/')})`)
