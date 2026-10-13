// Redraws Android's adaptive-icon foreground at the size the launcher
// shows it (plan 204). @capacitor/assets writes the foreground at the
// legacy icon's 48dp a density and insets it 16.7% into the 108dp layer,
// so every launcher drew those pixels 1.5 times up, into the 72dp
// viewport, and the mark's edges went soft. Same source
// (assets/icon-foreground.png, from brand/icon-foreground.svg), same
// resizer as the tool's, at 72dp. Last step of `npm run assets:native`.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const res = path.join(root, 'android/app/src/main/res')
const source = path.join(root, 'assets/icon-foreground.png')

// build-mark.py sizes the mark for that inset; a tool that stops writing
// it would show the foreground at another scale, so stop here instead.
const xml = readFileSync(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), 'utf8')
if (!xml.includes('android:inset="16.7%"')) {
  throw new Error('ic_launcher.xml no longer insets the foreground 16.7% -- re-measure brand/icon-foreground.svg (scripts/build-mark.py)')
}

const VIEWPORT_DP = 72
const DENSITIES = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [density, scale] of Object.entries(DENSITIES)) {
  const px = Math.round(VIEWPORT_DP * scale)
  const out = path.join(res, `mipmap-${density}`, 'ic_launcher_foreground.png')
  await sharp(source).resize(px, px).png().toFile(out)
  console.log(`wrote mipmap-${density}/ic_launcher_foreground.png (${px}px)`)
}
