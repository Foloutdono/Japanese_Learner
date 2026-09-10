// Renders brand/icon.html to brand/icon.png (1024×1024) with the real
// Noto Serif JP, through the Playwright chromium the test lanes use —
// a build tool cannot rasterise the glyphs without the font installed,
// and the browser is the one thing here that has it. Dev-time only:
//
//   node scripts/render-icon.mjs && npx pwa-assets-generator
//
// --allow-file-access-from-files: the page is file://, and so is the
// @fontsource stylesheet it links, and chromium treats every file as
// its own origin for @font-face without it.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(here, '../brand/icon.html')
const out = path.resolve(here, '../brand/icon.png')

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] })
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
  await page.goto('file://' + src)
  await page.evaluate(() => document.fonts.ready)
  const loaded = await page.evaluate(() => document.fonts.check('620px "Noto Serif JP"'))
  if (!loaded) throw new Error('Noto Serif JP did not load — is @fontsource/noto-serif-jp installed?')
  await page.locator('.icon').screenshot({ path: out, omitBackground: false })
  console.log('wrote', path.relative(process.cwd(), out))
} finally {
  await browser.close()
}
