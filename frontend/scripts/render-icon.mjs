// Rasterises the mark's SVGs (plan 158, written by scripts/build-mark.py
// from the font's outlines) to the PNGs the two icon generators read:
// brand/icon.png for pwa-assets-generator (`npm run icons`), and the
// custom-mode sources in assets/ for @capacitor/assets
// (`npm run assets:native`). Through the Playwright chromium the test
// lanes use, so there is no second rasteriser to disagree with the
// browser about a curve. The SVGs are outlines, so no font is needed
// here. Dev-time only:
//
//   node scripts/render-icon.mjs && npx pwa-assets-generator
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

// [source svg, output png, size, transparent]
const JOBS = [
  ['brand/icon.svg', 'brand/icon.png', 1024, false],
  ['brand/icon.svg', 'assets/icon-only.png', 1024, false],
  ['brand/icon-foreground.svg', 'assets/icon-foreground.png', 1024, true],
  ['brand/icon-background.svg', 'assets/icon-background.png', 1024, false],
  ['brand/splash.svg', 'assets/splash.png', 2732, false],
  ['brand/splash.svg', 'assets/splash-dark.png', 2732, false],
]

const browser = await chromium.launch()
try {
  for (const [src, out, size, transparent] of JOBS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    const svg = readFileSync(path.join(root, src), 'utf8')
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
    )
    mkdirSync(path.dirname(path.join(root, out)), { recursive: true })
    await page.locator('svg').screenshot({ path: path.join(root, out), omitBackground: transparent })
    await page.close()
    console.log('wrote', out)
  }
} finally {
  await browser.close()
}
