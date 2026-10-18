// Renders assets/app-icon.svg into the PNG icons served from public/.
// Uses sharp, which Next.js already installs; run after changing the SVG:
//   node scripts/generate-icons.mjs
import sharp from 'sharp';

const SOURCE = new URL('../assets/app-icon.svg', import.meta.url);
const OUTPUTS = [
  ['../public/icon.png', 180],      // Apple touch icon and favicon
  ['../public/icon-192.png', 192],  // manifest
  ['../public/icon-512.png', 512],  // manifest and splash
];

for (const [path, size] of OUTPUTS) {
  await sharp(SOURCE.pathname, { density: 384 })
    .resize(size, size)
    .flatten({ background: '#0c0c0f' })
    .png({ compressionLevel: 9 })
    .toFile(new URL(path, import.meta.url).pathname);
  console.log(`${path.replace('../', '')} ${size}x${size}`);
}
