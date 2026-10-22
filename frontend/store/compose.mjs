// Store screenshots, step 2: each captured screen set in a phone, under its
// headline, on its line's colour, as 1290×2796 PNGs (the App Store's 6.7"
// size; the 6.9" sets accept it scaled). See README.md.
//   node store/compose.mjs [fr|en ...] [--only today,grammar]
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const onlyAt = args.indexOf('--only')
const only = onlyAt >= 0 ? args[onlyAt + 1].split(',') : null
const langs = args.filter((a, i) => !a.startsWith('--') && (onlyAt < 0 || i !== onlyAt + 1))
const COPY = JSON.parse(readFileSync(join(here, 'copy.json'), 'utf8'))

const W = 1290, H = 2796
const PHONE = { w: 1000, top: 700, bezel: 18 }
const SCREEN_W = PHONE.w - 2 * PHONE.bezel
const K = SCREEN_W / 393 // css px of the app → canvas px

// One slide per feature, in the order of the store's row. `bg` is the line's
// colour, deepened (top, bottom); `mark` the watermark glyph behind the head;
// `bar` the status bar's ink over the screen's top (light on the HUD's sumi,
// dark on a paper screen), `home` the home indicator's over its foot.
// A callout is a piece of another captured screen: `crop` is [x, y, w, h] as
// fractions of the 1179×2556 capture, `box` where it lands on the canvas.
const SLIDES = [
  { id: 'today', shot: 'today', bg: ['#26356b', '#0e1330'], mark: '今', bar: 'light', home: 'light', callouts: [] },
  { id: 'grammar', shot: 'grammar', bg: ['#5a8a43', '#2a4a20'], mark: '文', bar: 'dark', home: 'light',
    callouts: [{ shot: 'grammar_trap', crop: [0.03, 0.235, 0.94, 0.43], box: { left: 500, top: 1800, width: 740 }, rot: 3 }] },
  { id: 'dictionary', shot: 'dictionary', bg: ['#b9811f', '#6a440a'], mark: '辞', bar: 'light', home: 'light',
    callouts: [{ shot: 'dictionary_entry', crop: [0.02, 0.13, 0.96, 0.44], box: { left: 50, top: 1880, width: 720 }, rot: -3 }] },
  { id: 'practice', shot: 'practice', bg: ['#2f8483', '#154543'], mark: '練', bar: 'light', home: 'light', callouts: [] },
  { id: 'exam', shot: 'exam', bg: ['#b34532', '#621f17'], mark: '試', bar: 'dark', home: 'light',
    callouts: [{ shot: 'exam_intro', crop: [0.04, 0.13, 0.92, 0.49], box: { left: 50, top: 1830, width: 660 }, rot: -3 }] },
  { id: 'kanji', shot: 'kanji_trace', bg: ['#7d69b3', '#3b2f6c'], mark: '漢', bar: 'dark', home: 'light',
    callouts: [{ shot: 'kanji_read', crop: [0.04, 0.23, 0.92, 0.54], box: { left: 60, top: 2040, width: 520 }, rot: -3 }] },
  { id: 'goal', shot: 'goal', bg: ['#3f7fb0', '#173f63'], mark: '標', bar: 'light', home: 'light',
    callouts: [{ shot: 'goal', crop: [0.04, 0.765, 0.92, 0.18], box: { left: 80, top: 2180, width: 1100 }, rot: -2 }] },
  { id: 'breakdown', shot: 'breakdown', bg: ['#a35f90', '#552b4c'], mark: '解', bar: 'dark', home: 'dark',
    callouts: [{ shot: 'breakdown_words', crop: [0.04, 0.73, 0.92, 0.22], box: { left: 70, top: 2250, width: 660 }, rot: -3 }] },
]

const font = p => `file://${join(here, '..', 'node_modules', '@fontsource', p)}`
const css = `
@import url('${font('noto-serif-jp/700.css')}');
@import url('${font('noto-serif-jp/900.css')}');
@import url('${font('space-grotesk/500.css')}');
@import url('${font('space-grotesk/700.css')}');
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.slide{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:'Space Grotesk',system-ui,sans-serif;color:#fff}
.mark{position:absolute;right:-90px;top:-170px;font:900 980px/1 'Noto Serif JP',serif;color:#fff;opacity:.085}
.shade{position:absolute;inset:0;background:radial-gradient(1200px 900px at 20% 8%,rgba(255,255,255,.16),transparent 70%)}
.route{position:absolute;left:0;right:0;top:92px;height:112px;display:flex;align-items:center}
.route i{display:block;height:16px;background:rgba(255,255,255,.4)}
.code{width:112px;height:112px;border-radius:56px;background:#f6efe0;color:var(--deep);display:grid;place-items:center;font:700 44px 'Space Grotesk';letter-spacing:.02em;border:10px solid var(--deep);box-shadow:0 0 0 8px rgba(255,255,255,.55)}
.plate{margin:0 34px;font:700 46px 'Space Grotesk';letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
h1{position:absolute;left:80px;right:80px;top:250px;font:700 92px/1.14 'Noto Serif JP',serif;letter-spacing:-.01em}
h1 span.l{display:block;white-space:nowrap}
h1 em{font-style:normal;color:#ffe08f}
.sub{position:absolute;left:80px;right:110px;top:512px;font:500 43px/1.32 'Space Grotesk';color:rgba(255,255,255,.88)}
.phone{position:absolute;left:${(W - PHONE.w) / 2}px;top:${PHONE.top}px;width:${PHONE.w}px;border-radius:${PHONE.bezel + 141}px;padding:${PHONE.bezel}px;
  background:linear-gradient(145deg,#4a4650,#15131a 30%,#0c0b10 70%,#3a363f);box-shadow:0 60px 120px rgba(0,0,0,.5),inset 0 0 0 3px rgba(255,255,255,.18)}
.screen{position:relative;width:${SCREEN_W}px;height:${Math.round(852 * K)}px;border-radius:141px;overflow:hidden;background:#000}
.screen img{display:block;width:100%;height:100%}
.island{position:absolute;left:50%;top:${11 * K}px;width:${125 * K}px;height:${37 * K}px;margin-left:${-62.5 * K}px;border-radius:${19 * K}px;background:#000}
.sb{position:absolute;top:${14 * K}px;height:${30 * K}px;display:flex;align-items:center;font:700 ${17 * K}px 'Space Grotesk',system-ui}
.sb.l{left:${40 * K}px;width:${64 * K}px;justify-content:center}
.sb.r{right:${30 * K}px;gap:${6 * K}px}
.sb.light{color:#fff}.sb.dark{color:#1c1811}
.home{position:absolute;left:50%;bottom:${8 * K}px;width:${134 * K}px;height:${5 * K}px;margin-left:${-67 * K}px;border-radius:9px}
.home.light{background:rgba(255,255,255,.9)}.home.dark{background:rgba(28,24,17,.85)}
.call{position:absolute;border:8px solid #f6efe0;border-radius:44px;overflow:hidden;background:#f6efe0;box-shadow:0 36px 80px rgba(0,0,0,.5)}
.call div{width:100%;height:100%;background-repeat:no-repeat}
`

const statusIcons = tone => {
  const c = tone === 'light' ? '#fff' : '#1c1811'
  const s = 17 * K
  return `
  <svg width="${s * 1.1}" height="${s * .75}" viewBox="0 0 19 12" fill="${c}"><rect x="0" y="8" width="3.4" height="4" rx="1"/><rect x="5" y="5.5" width="3.4" height="6.5" rx="1"/><rect x="10" y="3" width="3.4" height="9" rx="1"/><rect x="15" y="0" width="3.4" height="12" rx="1"/></svg>
  <svg width="${s * 1.05}" height="${s * .78}" viewBox="0 0 17 12" fill="${c}"><path d="M8.5 2.4c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8.5.8 10.2 10.2 0 0 0 1.4 3.6l1.1 1.2a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.1-1.2a7.2 7.2 0 0 0-9 0l1.1 1.2c.9-.8 2.100-1.300 3.400-1.300Zm0 3.500c-.6 0-1.200.2-1.600.6L8.500 12l1.600-1.900c-.4-.4-1-.6-1.600-.6Z"/></svg>
  <svg width="${s * 1.6}" height="${s * .78}" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="22" height="12" rx="3.6" stroke="${c}" opacity=".45"/><rect x="2" y="2" width="19" height="9" rx="2.4" fill="${c}"/><path d="M24.200 4.400v4.200c.9-.3 1.600-1.200 1.600-2.100s-.7-1.800-1.600-2.100Z" fill="${c}" opacity=".5"/></svg>`
}

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const heading = (lines, hi) => lines.map(l => `<span class="l">${esc(l).replace(esc(hi), `<em>${esc(hi)}</em>`)}</span>`).join('')

function slideHtml(slide, lang) {
  const c = COPY[lang][slide.id]
  const raw = name => `file://${join(here, 'raw', lang, name + '.png')}`
  const calls = (slide.callouts || []).map(k => {
    const [x, y, w, h] = k.crop
    const bw = k.box.width, scale = bw / (w * 1179), bh = Math.round(h * 2556 * scale)
    return `<div class="call" style="left:${k.box.left}px;top:${k.box.top}px;width:${bw + 16}px;height:${bh + 16}px;transform:rotate(${k.rot}deg)"><div style="width:${bw}px;height:${bh}px;background-image:url('${raw(k.shot)}');background-size:${1179 * scale}px ${2556 * scale}px;background-position:${-x * 1179 * scale}px ${-y * 2556 * scale}px"></div></div>`
  }).join('')
  return `<!doctype html><meta charset="utf-8"><style>${css}</style>
<div class="slide" style="--deep:${slide.bg[1]};background:linear-gradient(170deg,${slide.bg[0]},${slide.bg[1]})">
  <div class="mark">${slide.mark}</div><div class="shade"></div>
  <div class="route"><i style="width:72px"></i><div class="code">${esc(c.code)}</div><i style="width:40px"></i><div class="plate">${esc(c.plate)}</div><i style="flex:1"></i></div>
  <h1>${heading(c.h, c.hi)}</h1>
  <p class="sub">${esc(c.sub)}</p>
  <div class="phone"><div class="screen"><img src="${raw(slide.shot)}">
    <div class="island"></div>
    <div class="sb l ${slide.bar}">9:41</div><div class="sb r ${slide.bar}">${statusIcons(slide.bar)}</div>
    <div class="home ${slide.home}"></div></div></div>
  ${calls}
</div>
<script>
  // Fit each headline line inside the margins, then stop at the smaller of the two.
  document.fonts.ready.then(() => {
    const h = document.querySelector('h1'); let fs = 92
    const over = () => [...h.querySelectorAll('.l')].some(l => l.scrollWidth > ${W - 160})
    while (over() && fs > 56) { fs -= 2; h.style.fontSize = fs + 'px' }
    document.body.dataset.ready = '1'
  })
</script>`
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (const lang of langs.length ? langs : ['fr', 'en']) {
  const out = join(here, 'out', lang); mkdirSync(out, { recursive: true })
  const tmp = join(here, '.tmp'); mkdirSync(tmp, { recursive: true })
  for (const [i, s] of SLIDES.entries()) {
    if (only && !only.includes(s.id)) continue
    const file = join(tmp, `${lang}-${s.id}.html`)
    writeFileSync(file, slideHtml(s, lang))
    await page.goto('file://' + file)
    await page.waitForSelector('body[data-ready]', { timeout: 20000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, `${String(i + 1).padStart(2, '0')}-${s.id}.png`) })
    console.log(lang, s.id)
  }
}
await browser.close()
