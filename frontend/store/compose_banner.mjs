// App Store artwork for the product page's header and the search results (landscape, sizes
// Apple lists: 5244×2950, 3840×2560, 1920×1280): the brand and a headline, the iPad on Today
// and the iPhone in front of it, from the iPad and iPhone captures (raw/<lang>-ipad/today.png,
// raw/<lang>-iphone/today_big.png). Everything that says something stays inside the middle.
//   node store/compose_banner.mjs [fr|en ...]
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const COPY = JSON.parse(readFileSync(join(here, 'copy.json'), 'utf8'))
const langs = process.argv.slice(2).filter(a => !a.startsWith('--'))
// each format drawn on a page half its size, saved at 2x
const FORMATS = [
  { file: 'header-5244x2950', W: 2622, H: 1475 },
  { file: 'search-3840x2560', W: 1920, H: 1280 },
]
const font = p => `file://${join(here, '..', 'node_modules', '@fontsource', p)}`
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

function html(lang, { W, H }) {
  const c = COPY[lang].banner
  const raw = (dir, n) => `file://${join(here, 'raw', `${lang}-${dir}`, n + '.png')}`
  const u = H / 1280 // the 1920×1280 layout's unit
  const wide = W / H > 1.6
  // the iPad: a 4:3 screen in a thin bezel; the iPhone in front of its lower left corner
  const PB = 18 * u, PW = (wide ? 1180 : 1000) * u, PSW = PW - 2 * PB, PSH = PSW * 1032 / 1376
  const PL = W - PW - (wide ? 150 : 90) * u, PT = (H - PSH - 2 * PB) / 2
  const IB = 12 * u, IW = (wide ? 330 : 300) * u, ISW = IW - 2 * IB, ISH = ISW * 852 / 393
  const IL = PL - IW * 0.42, IT = H - ISH - 2 * IB - 70 * u
  const LEFT = (wide ? 150 : 96) * u, COLW = IL - LEFT - 30 * u
  const title = c.h.map(l => `<span>${esc(l).replace(esc(c.hi), `<em>${esc(c.hi)}</em>`)}</span>`).join('')
  return `<!doctype html><meta charset="utf-8"><style>
@import url('${font('noto-serif-jp/900.css')}');
@import url('${font('space-grotesk/700.css')}');
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.b{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(160deg,#2f4086,#0e1330 70%);color:#fff;font-family:'Space Grotesk',sans-serif}
.mark{position:absolute;left:${-60 * u}px;bottom:${-330 * u}px;font:900 ${1100 * u}px/1 'Noto Serif JP',serif;opacity:.07}
.shade{position:absolute;inset:0;background:radial-gradient(${1300 * u}px ${900 * u}px at 18% 8%,rgba(255,255,255,.17),transparent 70%)}
.brand{position:absolute;left:${LEFT}px;top:${(wide ? 300 : 250) * u}px;font:700 ${34 * u}px 'Space Grotesk';letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.88)}
.brand b{font:900 ${56 * u}px 'Noto Serif JP';letter-spacing:0;margin-right:${16 * u}px;color:#ffe08f;vertical-align:-.08em}
h1{position:absolute;left:${LEFT}px;top:${(wide ? 390 : 340) * u}px;width:${COLW}px;font:900 ${112 * u}px/1.08 'Noto Serif JP',serif;text-shadow:0 ${7 * u}px 0 rgba(0,0,0,.22),0 ${16 * u}px ${36 * u}px rgba(0,0,0,.25)}
h1 span{display:block;white-space:nowrap}
h1 em{font-style:normal;color:#ffe08f}
.chips{position:absolute;left:${LEFT}px;width:${COLW}px;display:flex;flex-wrap:wrap;gap:${14 * u}px}
.chips span{font:700 ${30 * u}px 'Space Grotesk';padding:${13 * u}px ${26 * u}px;border-radius:999px;background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 ${2 * u}px rgba(255,255,255,.4)}
.chips span:last-child{background:#ffe08f;color:#1c1811;box-shadow:0 0 ${30 * u}px rgba(255,208,70,.6)}
.dev{position:absolute;background:linear-gradient(145deg,#4a4650,#15131a 30%,#0c0b10 70%,#3a363f);box-shadow:0 ${50 * u}px ${110 * u}px rgba(0,0,0,.55),inset 0 0 0 ${3 * u}px rgba(255,255,255,.18)}
.dev .s{display:block;width:100%;height:100%;overflow:hidden;background:#000}
.dev img{display:block;width:100%;height:100%}
.ipad{left:${PL}px;top:${PT}px;width:${PW}px;padding:${PB}px;border-radius:${PB + 26 * u}px}
.ipad .s{height:${PSH}px;border-radius:${26 * u}px}
.iphone{left:${IL}px;top:${IT}px;width:${IW}px;padding:${IB}px;border-radius:${IB + 48 * u}px;box-shadow:0 ${40 * u}px ${90 * u}px rgba(0,0,0,.6),0 0 0 ${3 * u}px rgba(255,255,255,.12),inset 0 0 0 ${3 * u}px rgba(255,255,255,.18)}
.iphone .s{position:relative;height:${ISH}px;border-radius:${48 * u}px}
.island{position:absolute;left:50%;top:${11 * ISW / 393}px;width:${112 * ISW / 393}px;height:${32 * ISW / 393}px;margin-left:${-56 * ISW / 393}px;border-radius:999px;background:#000}
</style>
<div class="b"><div class="mark">辻</div><div class="shade"></div>
  <div class="brand"><b>辻</b>Tsuji</div>
  <h1>${title}</h1>
  <div class="chips">${c.chips.map(t => `<span>${esc(t)}</span>`).join('')}</div>
  <div class="dev ipad"><div class="s"><img src="${raw('ipad', 'today')}"></div></div>
  <div class="dev iphone"><div class="s"><img src="${raw('iphone', 'today_big')}"><div class="island"></div></div></div>
</div>
<script>document.fonts.ready.then(() => {
  const h = document.querySelector('h1'); let fs = ${112 * u}
  while ([...h.children].some(l => l.scrollWidth > ${COLW}) && fs > ${56 * u}) { fs -= ${2 * u}; h.style.fontSize = fs + 'px' }
  document.querySelector('.chips').style.top = (h.offsetTop + h.offsetHeight + ${44 * u}) + 'px'
  document.body.dataset.ready = '1' })</script>`
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] })
for (const f of FORMATS) {
  const pg = await browser.newPage({ viewport: { width: f.W, height: f.H }, deviceScaleFactor: 2 })
  for (const lang of langs.length ? langs : ['fr', 'en']) {
    const out = join(here, 'out', `${lang}-appstore`); mkdirSync(out, { recursive: true })
    const tmp = join(here, '.tmp'); mkdirSync(tmp, { recursive: true })
    const file = join(tmp, `${lang}-${f.file}.html`)
    writeFileSync(file, html(lang, f))
    await pg.goto('file://' + file)
    await pg.waitForSelector('body[data-ready]', { timeout: 20000 })
    await pg.waitForTimeout(400)
    await pg.screenshot({ path: join(out, `${f.file}.png`) })
    console.log(lang, f.file)
  }
  await pg.close()
}
await browser.close()
