import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgBuffer = readFileSync(join(root, 'public', 'icon.svg'))

const sizes = [
  { name: 'icon-96.png',      size: 96  },
  { name: 'icon-192.png',     size: 192 },
  { name: 'icon-512.png',     size: 512 },
  { name: 'icon-maskable.png',size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(root, 'public', name))
  console.log(`✓ ${name}`)
}
