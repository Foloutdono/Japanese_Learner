// Store screenshots, step 2: each captured screen set in a phone under a big
// headline, on its line's colour, as 1080×1920 PNGs (Google Play's 9:16
// phone screenshot; the App Store takes 1290×2796 and 1242×2688 as well, see
// README.md). One thing on each screen is lifted out of the dimmed rest, or
// a piece of another screen floats over it.
//   node store/compose.mjs [fr|en ...] [--only today,grammar]
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const onlyAt = args.indexOf('--only')
const only = onlyAt >= 0 ? args[onlyAt + 1].split(',') : null
const variants = args.includes('--variants')
const langs = args.filter((a, i) => !a.startsWith('--') && (onlyAt < 0 || i !== onlyAt + 1))
const list = () => (variants ? VARIANTS : SLIDES)
const COPY = JSON.parse(readFileSync(join(here, 'copy.json'), 'utf8'))

const W = 1080, H = 1920
const PHONE = { w: 800, top: 500, bezel: 16 }
const SCREEN_W = PHONE.w - 2 * PHONE.bezel
const VH = 740 // the captured screen's height, css px
const K = SCREEN_W / 393 // css px of the app → canvas px
const SX = (W - PHONE.w) / 2 + PHONE.bezel, SY = PHONE.top + PHONE.bezel // the screen's corner on the canvas

// One slide per feature, in the order of the store's row. `bg` is the line's
// colour, deepened (top, bottom); `mark` the watermark glyph behind the head;
// `bar`/`home` the status bar's and home indicator's ink. `lift` names the
// pieces cut from this very screen (see capture.mjs) that stand out of the dim
// at their own place, grown by `s`; `float` the pieces of other screens set
// over it: `at` is canvas px (left, top, width), `rot` degrees.
const chevrons = (left, top) => `<svg style="position:absolute;left:${left}px;top:${top}px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))" width="90" height="300" viewBox="0 0 90 300"><g fill="none" stroke="#ffe08f" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M12 80 L45 36 L78 80"/><path d="M12 170 L45 126 L78 170" opacity=".65"/><path d="M12 260 L45 216 L78 260" opacity=".32"/></g></svg>`
const SLIDES = [
  { id: 'today', shot: 'today_big', bg: ['#2a3a78', '#0e1330'], mark: '今', bar: 'light', dim: 0, vignette: true,
    zoom: { x: 197, y: 400, z: 1.16 }, lift: [{ piece: 'today_depart', s: 1.0, shape: 'btn' }] },
  { id: 'grammar', shot: 'grammar', bg: ['#5f9248', '#2a4a20'], mark: '文', bar: 'dark', dim: 0.3,
    float: [{ piece: 'fiche', at: { left: 455, top: 1210, width: 590 }, rot: 3 }] },
  { id: 'dictionary', shot: 'dictionary', bg: ['#c28a22', '#6a440a'], mark: '辞', bar: 'light', dim: 0.3,
    float: [{ piece: 'dict_entry', at: { left: 330, top: 1170, width: 650 }, rot: 3 }] },
  { id: 'practice', shot: 'practice', bg: ['#2f8a89', '#154543'], mark: '練', bar: 'light', dim: 0.45,
    lift: [{ piece: 'practice_plates', s: 1.22 }] },
  { id: 'exam', shot: 'exam', bg: ['#bd4a36', '#621f17'], mark: '試', bar: 'dark', dim: 0.4,
    lift: [{ piece: 'exam_page', s: 1.1 }] },
  { id: 'kanji', shot: 'kanji_trace', bg: ['#8571bb', '#3b2f6c'], mark: '漢', bar: 'dark', dim: 0.5,
    lift: [{ piece: 'kanji_board', at: { left: 8, top: 930, width: 520 }, rot: -2 }],
    float: [{ piece: 'kanji_readings', at: { left: 540, top: 960, width: 510 }, rot: 2 }] },
  { id: 'goal', shot: 'flash', bg: ['#4283b6', '#173f63'], mark: '標', bar: 'dark', dim: 0.3,
    lift: [{ piece: 'flash_rating', s: 1.12 }],
    float: [{ piece: 'goal_card', at: { left: 56, top: 630, width: 940 }, rot: -2 }] },
  { id: 'comprehension', shot: 'comp', bg: ['#a8651f', '#5c3209'], mark: '読', bar: 'dark', dim: 0.5,
    lift: [{ piece: 'comp_text', s: 1.04, trail: true }, { piece: 'comp_ctl', at: { left: 80, top: 1700, width: 920 } }],
    decor: chevrons(968, 880) + chevrons(22, 880) },
]

// Today's design options (node store/compose.mjs --variants): A lifts the day's window,
// B zooms the print so the sun is big on its own, C leaves the screen whole and enlarges its
// forecast line.
const TODAY = { shot: 'today', bg: ['#2a3a78', '#0e1330'], mark: '今', bar: 'light' }
const VARIANTS = [
  { ...TODAY, id: 'today', file: '01-today-A', dim: 0.55,
    lift: [{ piece: 'today_dial', s: 1.2 }, { piece: 'today_depart', s: 1.16, shape: 'btn' }] },
  { ...TODAY, id: 'today', file: '01-today-B', shot: 'today_big', dim: 0, vignette: true, zoom: { x: 197, y: 400, z: 1.16 },
    lift: [{ piece: 'today_depart', s: 1.0, shape: 'btn' }] },
  { ...TODAY, id: 'today', file: '01-today-C', dim: 0,
    lift: [{ piece: 'today_eta', s: 1.5 }, { piece: 'today_depart', s: 1.16, shape: 'btn' }] },
]

const font = p => `file://${join(here, '..', 'node_modules', '@fontsource', p)}`
const css = `
@import url('${font('noto-serif-jp/900.css')}');
@import url('${font('space-grotesk/700.css')}');
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.slide{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:'Space Grotesk',system-ui,sans-serif;color:#fff}
.mark{position:absolute;right:-80px;top:-150px;font:900 900px/1 'Noto Serif JP',serif;color:#fff;opacity:.08}
.shade{position:absolute;inset:0;background:radial-gradient(1000px 800px at 20% 6%,rgba(255,255,255,.18),transparent 70%)}
h1{position:absolute;left:30px;right:30px;top:78px;text-align:center;font:900 140px/1.1 'Noto Serif JP',serif;letter-spacing:-.01em;text-shadow:0 8px 0 rgba(0,0,0,.22),0 18px 40px rgba(0,0,0,.25)}
h1 span.l{display:block;white-space:nowrap}
h1 em{font-style:normal;color:#ffe08f}
.phone{position:absolute;left:${(W - PHONE.w) / 2}px;top:${PHONE.top}px;width:${PHONE.w}px;border-radius:${PHONE.bezel + 100}px;padding:${PHONE.bezel}px;
  background:linear-gradient(145deg,#4a4650,#15131a 30%,#0c0b10 70%,#3a363f);box-shadow:0 50px 110px rgba(0,0,0,.55),inset 0 0 0 3px rgba(255,255,255,.18)}
.screen{position:relative;width:${SCREEN_W}px;height:${Math.round(VH * K)}px;border-radius:100px;overflow:hidden;background:#000}
.screen img.s{display:block;width:100%;height:100%}
.dim{position:absolute;inset:0;background:#0b0914}
.vig{position:absolute;inset:0;background:linear-gradient(to bottom,#0b0e26 0,#0b0e26 6%,rgba(11,14,38,0) 15%),linear-gradient(to top,rgba(8,6,24,.92) 0,rgba(8,6,24,.55) 18%,transparent 34%),radial-gradient(ellipse 62% 48% at 50% 40%,transparent 55%,rgba(8,6,24,.5) 100%)}
.island{position:absolute;left:50%;top:${11 * K}px;width:${112 * K}px;height:${32 * K}px;margin-left:${-56 * K}px;border-radius:${16 * K}px;background:#000}
.sb{position:absolute;top:${14 * K}px;height:${28 * K}px;display:flex;align-items:center;font:700 ${16 * K}px 'Space Grotesk',system-ui}
.sb.l{left:${36 * K}px;width:${60 * K}px;justify-content:center}
.sb.r{right:${28 * K}px;gap:${5 * K}px}
.sb.light{color:#fff}.sb.dark{color:#1c1811}
.piece{position:absolute;border-radius:30px;overflow:hidden;box-shadow:0 0 0 7px #ffe08f,0 0 0 18px rgba(255,224,143,.28),0 34px 80px rgba(0,0,0,.6)}
.piece img{display:block;width:100%;height:100%}
.piece img.ghost{position:absolute;left:0;width:100%;height:100%;mix-blend-mode:multiply;filter:url(#vb)}
.piece{position:absolute}
.piece.sun{border-radius:50%;box-shadow:0 0 0 6px rgba(255,246,205,.95),0 0 70px 30px rgba(255,228,140,.9),0 0 220px 110px rgba(255,190,80,.45)}
.piece.btn{border-radius:999px;box-shadow:0 0 0 5px rgba(255,224,143,.95),0 0 60px 22px rgba(255,208,70,.85),0 30px 70px rgba(0,0,0,.55);filter:saturate(1.9) brightness(1.1)}
.float{position:absolute;border-radius:34px;overflow:hidden;border:7px solid #fff;box-shadow:0 0 0 14px rgba(255,255,255,.22),0 40px 90px rgba(0,0,0,.6)}
.float img{display:block;width:100%}
`
const statusIcons = tone => {
  const c = tone === 'light' ? '#fff' : '#1c1811'
  const s = 16 * K
  return `
  <svg width="${s * 1.1}" height="${s * .75}" viewBox="0 0 19 12" fill="${c}"><rect x="0" y="8" width="3.4" height="4" rx="1"/><rect x="5" y="5.5" width="3.4" height="6.5" rx="1"/><rect x="10" y="3" width="3.4" height="9" rx="1"/><rect x="15" y="0" width="3.4" height="12" rx="1"/></svg>
  <svg width="${s * 1.05}" height="${s * .78}" viewBox="0 0 17 12" fill="${c}"><path d="M8.5 2.4c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8.5.8 10.2 10.2 0 0 0 1.4 3.6l1.1 1.2a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.1-1.2a7.2 7.2 0 0 0-9 0l1.1 1.2c.9-.8 2.1-1.3 3.4-1.3Zm0 3.5c-.6 0-1.2.2-1.6.6L8.5 12l1.6-1.9c-.4-.4-1-.6-1.6-.6Z"/></svg>
  <svg width="${s * 1.6}" height="${s * .78}" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="22" height="12" rx="3.6" stroke="${c}" opacity=".45"/><rect x="2" y="2" width="19" height="9" rx="2.4" fill="${c}"/><path d="M24.2 4.4v4.2c.9-.3 1.6-1.2 1.6-2.1s-.7-1.8-1.6-2.1Z" fill="${c}" opacity=".5"/></svg>`
}
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const heading = (lines, hi) => lines.map(l => `<span class="l">${esc(l).replace(esc(hi), `<em>${esc(hi)}</em>`)}</span>`).join('')
const pngSize = f => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)] }

function slideHtml(slide, lang) {
  const c = COPY[lang][slide.id]
  const rawDir = join(here, 'raw', lang)
  const raw = name => `file://${join(rawDir, name + '.png')}`
  const rects = JSON.parse(readFileSync(join(rawDir, 'rects.json'), 'utf8'))
  const lifts = (slide.lift || []).map(k => {
    const [x, y, w, h] = rects[k.piece]
    const zm = slide.zoom
    const zx = zm ? zm.x + (x + w / 2 - zm.x) * zm.z : x + w / 2, zy = zm ? zm.y + (y + h / 2 - zm.y) * zm.z : y + h / 2
    const sc = (k.s || 1) * (zm ? zm.z : 1)
    let cw = w * K * sc, ch = h * K * sc
    let left = SX + zx * K - cw / 2, top = SY + (zy + (k.dy || 0)) * K - ch / 2
    if (k.at) { cw = k.at.width; ch = cw * h / w; left = k.at.left; top = k.at.top }
    const ghosts = k.trail ? [[-34, .3], [-68, .16]].map(([dy, o]) => `<img class="ghost" style="top:${dy}px;opacity:${o}" src="${raw(k.piece)}">`).join('') : ''
    return `<div class="piece ${k.shape || ''}" style="left:${left}px;top:${top}px;width:${cw}px;height:${ch}px;${k.rot ? `transform:rotate(${k.rot}deg)` : ''}"><img src="${raw(k.piece)}">${ghosts}</div>`
  }).join('')
  const floats = (slide.float || []).map(k => {
    const [pw, ph] = pngSize(join(rawDir, k.piece + '.png'))
    const bw = k.at.width, bh = bw * ph / pw
    return `<div class="float" style="left:${k.at.left}px;top:${k.at.top}px;width:${bw + 14}px;transform:rotate(${k.rot}deg)"><img src="${raw(k.piece)}" style="height:${bh}px"></div>`
  }).join('')
  return `<!doctype html><meta charset="utf-8"><style>${css}</style>
<div class="slide" style="background:linear-gradient(170deg,${slide.bg[0]},${slide.bg[1]})">
  <div class="mark">${slide.mark}</div><div class="shade"></div>
  <h1>${heading(c.h, c.hi)}</h1>
  <div class="phone"><div class="screen"><img class="s" src="${raw(slide.shot)}"${slide.zoom ? ` style="transform-origin:${slide.zoom.x * K}px ${slide.zoom.y * K}px;transform:scale(${slide.zoom.z})"` : ''}>
    ${slide.vignette ? '<div class="vig"></div>' : ''}
    <div class="dim" style="opacity:${slide.dim}"></div>
    <div class="island"></div>
    <div class="sb l ${slide.bar}">9:41</div><div class="sb r ${slide.bar}">${statusIcons(slide.bar)}</div></div></div>
  <svg width="0" height="0" style="position:absolute"><filter id="vb" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="0 5"/></filter></svg>
  ${lifts}${floats}${slide.decor || ''}
</div>
<script>
  // The headline at the largest size that keeps every line inside the margins.
  document.fonts.ready.then(() => {
    const h = document.querySelector('h1'); let fs = 140
    const over = () => [...h.querySelectorAll('.l')].some(l => l.scrollWidth > ${W - 60})
    h.style.fontSize = fs + 'px'
    while (over() && fs > 70) { fs -= 2; h.style.fontSize = fs + 'px' }
    document.body.dataset.ready = '1'
  })
</script>`
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (const lang of langs.length ? langs : ['fr', 'en']) {
  const out = join(here, 'out', lang); mkdirSync(out, { recursive: true })
  const tmp = join(here, '.tmp'); mkdirSync(tmp, { recursive: true })
  for (const [i, s] of list().entries()) {
    if (only && !only.includes(s.id)) continue
    const file = join(tmp, `${lang}-${s.file || s.id}.html`)
    writeFileSync(file, slideHtml(s, lang))
    await page.goto('file://' + file)
    await page.waitForSelector('body[data-ready]', { timeout: 20000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, `${s.file || `${String(i + 1).padStart(2, '0')}-${s.id}`}.png`) })
    console.log(lang, s.id)
  }
}
await browser.close()
