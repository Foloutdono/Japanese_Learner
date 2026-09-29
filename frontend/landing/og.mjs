// ── `npm run landing:og`: the share cards, 1200 × 630 (plan 167) ──
// Renders public/landing/og-fr.png and og-en.png in Chromium from the
// canvas's share board: the mark, the page's h1, the seven lines as
// rings over their stripe. Run it after changing the h1 or the domain;
// the PNGs are committed. Chromium comes from Playwright; where its own
// download is missing, point CHROMIUM_PATH at a Chromium binary.
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'
import { DARK } from './tokens.mjs'
import { PAGES, SITE_ORIGIN } from './config.mjs'
import { readFacts } from './content.mjs'
import { STRINGS } from './strings.mjs'
import { typo } from './page.mjs'

const file = path => pathToFileURL(fileURLToPath(new URL(path, import.meta.url))).href
const LINES = [['kana', 'あ'], ['vocab', '語'], ['kanji', '漢'], ['grammar', '文'], ['reading', '読'], ['honyaku', '訳'], ['kakitori', '書']]

function card(lang, h1) {
  const c = line => DARK[`--line-${line}`]
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${file('../node_modules/@fontsource/noto-sans-jp/700.css')}">
<style>
@font-face{font-family:'Space Grotesk';font-weight:700;src:url(${file('../public/landing/fonts/space-grotesk-latin-700-normal.woff2')}) format('woff2')}
body{margin:0}
.og{width:1200px;height:630px;box-sizing:border-box;position:relative;overflow:hidden;display:flex;align-items:center;gap:72px;padding:0 88px;background:linear-gradient(155deg,color-mix(in srgb,${DARK['--text-primary']} 4%,${DARK['--bg-main']}) 0%,${DARK['--bg-main']} 55%,${DARK['--bg-panel']} 100%);color:${DARK['--text-primary']};font-family:'Space Grotesk',sans-serif}
.stripe{position:absolute;left:0;right:0;bottom:0;height:8px;display:flex}.stripe i{flex:1}
.copy{display:flex;flex-direction:column;gap:28px;min-width:0}
.name{font-weight:700;font-size:15px;letter-spacing:.18em;text-transform:uppercase;color:${DARK['--text-secondary']}}
h1{margin:0;font-weight:700;font-size:50px;line-height:1.1;letter-spacing:-.01em;text-wrap:balance}
.rings{display:flex;gap:12px}
.ring{width:52px;height:52px;box-sizing:border-box;border-radius:999px;border:2.5px solid var(--c);display:flex;align-items:center;justify-content:center;font-family:'Noto Sans JP',sans-serif;font-weight:700;font-size:20px;line-height:1;color:${DARK['--text-on-panel']}}
.domain{font-weight:700;font-size:18px;color:${DARK['--accent2']}}
</style></head><body><div class="og">
<div class="stripe">${LINES.map(([l]) => `<i style="background:${c(l)}"></i>`).join('')}</div>
<svg width="300" height="300" viewBox="0 0 1000 1000" style="flex-shrink:0"><path d="${MARK_ROAD}" fill="${DARK['--accent2']}"/><path d="${MARK_INK}" fill="${DARK['--text-primary']}"/></svg>
<div class="copy"><div class="name">Tsuji</div><h1>${h1}</h1>
<div class="rings">${LINES.map(([l, g]) => `<div class="ring" style="--c:${c(l)}" lang="ja">${g}</div>`).join('')}</div>
<div class="domain">${new URL(SITE_ORIGIN).host}</div></div>
</div></body></html>`
}

const facts = readFacts()
const dir = mkdtempSync(join(tmpdir(), 'tsuji-og-'))
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const p of Object.values(PAGES)) {
  const t = STRINGS[p.lang](facts)
  const html = join(dir, `og-${p.lang}.html`)
  writeFileSync(html, card(p.lang, typo(p.lang, t.hero.h1)))
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const out = fileURLToPath(new URL(`../public${p.ogImage}`, import.meta.url))
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } })
  console.log(`wrote public${p.ogImage}`)
}
await browser.close()
