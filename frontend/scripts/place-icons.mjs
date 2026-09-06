// The generator writes next to its source (brand/icon.png); the app
// serves from public/. Node rather than `mv` so the script runs the
// same on every OS. Part of `npm run icons`.
import { renameSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const brand = path.resolve(here, '../brand')
const pub = path.resolve(here, '../public')
const files = [
  'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png',
  'maskable-icon-512x512.png', 'apple-touch-icon-180x180.png', 'favicon.ico',
]
for (const f of files) {
  const from = path.join(brand, f)
  if (!existsSync(from)) throw new Error(`missing ${f} — run pwa-assets-generator first`)
  renameSync(from, path.join(pub, f))
  console.log('placed public/' + f)
}
