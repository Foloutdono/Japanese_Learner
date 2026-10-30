// Store screenshots, tablet (7-inch, landscape): 1920×1080 PNGs (16:9, Google Play's tablet
// screenshot). The title and an enlarged piece of the app on the left, a tablet showing the
// app's own wide layout on the right, the same piece lifted out of the dimmed screen.
//   node store/compose_tablet.mjs [fr|en ...] [--only today,grammar] [--device tablet7|tablet10|chromebook|xr]
// The same slides for every 16:9 surface Play asks for, the frame and the pixel size per
// device: a 7-inch tablet (1920×1080), a 10-inch one and a Chromebook (2560×1440, each side
// at least 1080), Android XR (the app as a window floating in its space, 2560×1440).
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const onlyAt = args.indexOf('--only')
const only = onlyAt >= 0 ? args[onlyAt + 1].split(',') : null
const langs = args.filter((a, i) => !a.startsWith('--') && (onlyAt < 0 || i !== onlyAt + 1) && (args.indexOf('--device') < 0 || i !== args.indexOf('--device') + 1))
const COPY = JSON.parse(readFileSync(join(here, 'copy.json'), 'utf8'))

const devAt = args.indexOf('--device')
const DEVICE = devAt >= 0 ? args[devAt + 1] : 'tablet7'
const OUT_SCALE = DEVICE === 'tablet7' ? 1 : 4 / 3 // drawn on the same 1920×1080 page, saved larger
const W = 1920, H = 1080
const FRAME = {
  tablet7: { FL: 650, FW: 1240, BZ: 22, FT: 190 },
  tablet10: { FL: 640, FW: 1250, BZ: 16, FT: 196 },
  chromebook: { FL: 660, FW: 1220, BZ: 14, FT: 150 },
  xr: { FL: 660, FW: 1220, BZ: 0, FT: 200 },
}[DEVICE]
const { FL, FW, BZ, FT } = FRAME // the device: left, width, bezel, top
const K = (FW - 2 * BZ) / 1280 // css px of the app → canvas px
const SX = FL + BZ, SY = FT + BZ
const SH = Math.round(720 * K)
const COL = { left: 78, width: 540 } // the title's column

// `lift`: pieces cut from this very screen (rects.json), left in place in a gold ring over the
// dimmed rest; `callout`: the piece enlarged in the left column; `shape: 'btn'` the glowing button.
const SLIDES = [
  { id: 'today', shot: 'today', bg: ['#2a3a78', '#0e1330'], mark: '今', dim: 0.5,
    lift: [{ piece: 'today_plan' }, { piece: 'today_board', shape: 'btn' }], callout: { piece: 'today_plan' } },
  { id: 'grammar', shot: 'grammar', bg: ['#5f9248', '#2a4a20'], mark: '文', dim: 0.5,
    lift: [{ piece: 'grammar_fiche' }], callout: { piece: 'grammar_rule', maxH: 540 } },
  { id: 'dictionary', shot: 'dictionary', bg: ['#c28a22', '#6a440a'], mark: '辞', dim: 0.5,
    lift: [{ piece: 'dict_entry' }], callout: { piece: 'dict_entry' } },
  { id: 'practice', shot: 'practice', bg: ['#2f8a89', '#154543'], mark: '練', dim: 0, chips: true },
  { id: 'exam', shot: 'exam', bg: ['#bd4a36', '#621f17'], mark: '試', dim: 0.5,
    lift: [{ piece: 'exam_sheet' }], callout: { piece: 'exam_sheet' } },
  { id: 'kanji', shot: 'kanji', bg: ['#8571bb', '#3b2f6c'], mark: '漢', dim: 0.5,
    lift: [{ piece: 'kanji_board' }], callout: { piece: 'kanji_readings' } },
  { id: 'goal', shot: 'flash', bg: ['#4283b6', '#173f63'], mark: '標', dim: 0.5,
    lift: [{ piece: 'flash_intervals' }], callout: { piece: 'goal_card' } },
  { id: 'comprehension', shot: 'comp', bg: ['#a8651f', '#5c3209'], mark: '読', dim: 0.5,
    lift: [{ piece: 'comp_card' }], callout: { piece: 'comp_card', trail: true }, chevrons: true },
]

const font = p => `file://${join(here, '..', 'node_modules', '@fontsource', p)}`
const css = `
@import url('${font('noto-serif-jp/900.css')}');
@import url('${font('space-grotesk/700.css')}');
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
.slide{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:'Space Grotesk',system-ui,sans-serif;color:#fff}
.mark{position:absolute;left:-60px;bottom:-250px;font:900 900px/1 'Noto Serif JP',serif;opacity:.075}
.shade{position:absolute;inset:0;background:radial-gradient(1100px 800px at 10% 0%,rgba(255,255,255,.18),transparent 70%)}
.brand{position:absolute;left:${COL.left}px;top:58px;font:700 26px 'Space Grotesk';letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.85)}
.brand b{font:900 36px 'Noto Serif JP';letter-spacing:0;margin-right:12px;color:#ffe08f}
h1{position:absolute;left:${COL.left}px;top:112px;width:${COL.width}px;font:900 100px/1.08 'Noto Serif JP',serif;letter-spacing:-.01em;text-shadow:0 7px 0 rgba(0,0,0,.22),0 16px 36px rgba(0,0,0,.25)}
h1 em{font-style:normal;color:#ffe08f}
.tablet{position:absolute;left:${FL}px;top:${FT}px;width:${FW}px;padding:${BZ}px;border-radius:${BZ + 34}px;background:linear-gradient(145deg,#4a4650,#15131a 30%,#0c0b10 70%,#3a363f);box-shadow:0 50px 110px rgba(0,0,0,.55),inset 0 0 0 3px rgba(255,255,255,.18)}
.tablet .cam{position:absolute;left:${BZ / 2 - 5}px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#1d1b22;box-shadow:inset 0 0 0 2px #35323b}
.screen{position:relative;width:${FW - 2 * BZ}px;height:${SH}px;border-radius:${34}px;overflow:hidden;background:#000}
${DEVICE === 'tablet10' ? `.tablet{border-radius:${BZ + 26}px}.screen{border-radius:26px}` : ''}
${DEVICE === 'chromebook' ? `.tablet{border-radius:22px 22px 6px 6px;padding:${BZ}px ${BZ}px ${BZ + 16}px}.screen{border-radius:8px}.tablet .cam{left:50%;top:${BZ / 2 - 4}px;width:7px;height:7px;margin:0 0 0 -3px}
.base{position:absolute;left:${FL - 28}px;top:${FT + SH + 2 * BZ + 16}px;width:${FW + 56}px;height:30px;border-radius:2px 2px 26px 26px;background:linear-gradient(#cfcbd4,#8d8994 55%,#55525b);box-shadow:0 30px 60px rgba(0,0,0,.5)}
.base i{position:absolute;left:50%;top:0;width:190px;height:9px;margin-left:-95px;border-radius:0 0 10px 10px;background:#6c6873}` : ''}
${DEVICE === 'xr' ? `.tablet{background:none;box-shadow:none;padding:0;border-radius:34px}.tablet .cam{display:none}
.screen{border-radius:30px;box-shadow:0 0 0 2px rgba(255,255,255,.35),0 0 80px 10px rgba(255,255,255,.12),0 60px 120px rgba(0,0,0,.6)}
.xrbar{position:absolute;left:${FL + FW / 2 - 70}px;top:${FT + SH + 22}px;width:140px;height:12px;border-radius:6px;background:rgba(255,255,255,.55)}
.floor{position:absolute;left:0;right:0;bottom:0;height:300px;background:radial-gradient(1100px 160px at 65% 100%,rgba(255,255,255,.14),transparent 70%)}` : ''}
.screen img.s{display:block;width:100%;height:100%}
.dim{position:absolute;inset:0;background:#0b0914}
.lift{position:absolute;overflow:hidden;box-shadow:0 0 0 5px #ffe08f,0 0 0 14px rgba(255,224,143,.28),0 26px 60px rgba(0,0,0,.55)}
.lift.btn{border-radius:999px;box-shadow:0 0 0 4px rgba(255,224,143,.95),0 0 44px 16px rgba(255,208,70,.85),0 24px 60px rgba(0,0,0,.55);filter:saturate(1.9) brightness(1.1)}
.lift img,.call img{display:block;width:100%;height:100%}
.call{position:absolute;overflow:hidden;box-shadow:0 0 0 6px #fff,0 0 0 18px rgba(255,255,255,.2),0 40px 90px rgba(0,0,0,.55)}
.call img.ghost{position:absolute;left:0;mix-blend-mode:multiply;filter:url(#vb)}
.chips{position:absolute;left:${COL.left}px;width:${COL.width}px;display:flex;flex-wrap:wrap;gap:14px}
.chips span{font:700 31px 'Space Grotesk';padding:13px 26px;border-radius:999px;background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)}
.chev{position:absolute;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
`
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const pngSize = f => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)] }
const chev = (left, top) => `<svg class="chev" style="left:${left}px;top:${top}px" width="84" height="270" viewBox="0 0 90 300"><g fill="none" stroke="#ffe08f" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M12 80 L45 36 L78 80"/><path d="M12 170 L45 126 L78 170" opacity=".65"/><path d="M12 260 L45 216 L78 260" opacity=".32"/></g></svg>`

function slideHtml(slide, lang) {
  const c = COPY[lang][slide.id]
  const rawDir = join(here, 'raw', `${lang}-tablet7`)
  const raw = n => `file://${join(rawDir, n + '.png')}`
  const rects = JSON.parse(readFileSync(join(rawDir, 'rects.json'), 'utf8'))
  // numbers keep their groups, a word of three letters at most stays with the next one
  const nb = t => t.replace(/(\d) (?=\d)/g, '$1\u00a0').replace(/(?<=^|\s)(\S{1,3}) (?=\S)/gu, '$1\u00a0')
  const nbNum = t => t.replace(/(\d) (?=\d)/g, '$1\u00a0').replace(/–/g, '\u2060–\u2060')
  // two versions of the title: short words held to the next one, and, where that leaves a block
  // too wide for the column, numbers alone held together (the page picks the first that fits)
  const titleOf = f => esc(f(c.h.join(' '))).replace(esc(f(c.hi)), `<em>${esc(f(c.hi))}</em>`)
  const title = titleOf(t => nbNum(nb(t))), titleLoose = titleOf(nbNum)
  const lifts = (slide.lift || []).map(k => {
    const [x, y, w, h, r = 0] = rects[k.piece]
    const rad = k.shape === 'btn' ? '' : `border-radius:${Math.max(r, 6) * K}px;`
    return `<div class="lift ${k.shape || ''}" style="${rad}left:${SX + x * K}px;top:${SY + y * K}px;width:${w * K}px;height:${h * K}px"><img src="${raw(k.piece)}"></div>`
  }).join('')
  let call = ''
  if (slide.callout) {
    const k = slide.callout
    const [pw, ph] = pngSize(join(rawDir, k.piece + '.png'))
    const [cx, cy, cw, ch] = k.crop || [0, 0, 1, 1]
    const sw = pw * cw, sh = ph * ch
    const maxH = (k.maxH || 470) - (k.trail ? 30 : 0)
    const bw = Math.min(COL.width - 20, maxH * sw / sh), bh = bw * sh / sw
    const left = COL.left + 8, top = H - 76 - bh
    const scale = bw / sw
    const r = Math.max(rects[k.piece]?.[4] || 0, 8) * scale * 2
    const img = (extra = '') => `<img ${extra} src="${raw(k.piece)}" style="position:absolute;width:${pw * scale}px;height:${ph * scale}px;left:${-cx * pw * scale}px;top:${-cy * ph * scale}px">`
    const ghosts = k.trail ? [[-30, .32], [-60, .16]].map(([dy, o]) => `<img class="ghost" src="${raw(k.piece)}" style="position:absolute;width:${pw * scale}px;height:${ph * scale}px;left:0;top:${dy}px;opacity:${o}">`).join('') : ''
    call = `<div class="call" style="border-radius:${r}px;left:${left}px;top:${top}px;width:${bw}px;height:${bh}px">${ghosts}${img()}</div>`
  }
  const chips = slide.chips ? `<div class="chips" style="top:520px">${c.chips.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''
  const chevs = slide.chevrons ? (() => { const [x, y, w, h] = rects.comp_card, cy = SY + (y + h / 2) * K - 135; return chev(SX + x * K - 84 - 26, cy) + chev(SX + (x + w) * K + 26, cy) })() : ''
  return `<!doctype html><meta charset="utf-8"><style>${css}</style>
<div class="slide" style="background:linear-gradient(165deg,${slide.bg[0]},${slide.bg[1]})">
  <div class="mark">${slide.mark}</div><div class="shade"></div>
  <div class="brand"><b>辻</b>Tsuji</div>
  <h1 data-loose="${esc(titleLoose)}">${title}</h1>
  ${chips}
  <svg width="0" height="0" style="position:absolute"><filter id="vb" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="0 5"/></filter></svg>
  ${DEVICE === 'xr' ? '<div class="floor"></div>' : ''}<div class="tablet"><div class="cam"></div><div class="screen"><img class="s" src="${raw(slide.shot)}"><div class="dim" style="opacity:${slide.dim}"></div></div></div>${DEVICE === 'chromebook' ? '<div class="base"><i></i></div>' : ''}${DEVICE === 'xr' ? '<div class="xrbar"></div>' : ''}
  ${lifts}${chevs}${call}
</div>
<script>document.fonts.ready.then(() => {
  const h = document.querySelector('h1'), tight = h.innerHTML, loose = h.dataset.loose
  const fits = () => h.scrollHeight <= 330 && h.scrollWidth <= h.clientWidth + 1
  let done = false
  for (let fs = 100; fs >= 60 && !done; fs -= 2) {
    h.style.fontSize = fs + 'px'
    for (const html of [tight, loose]) { h.innerHTML = html; if (fits()) { done = true; break } }
  }
  const c = document.querySelector('.chips'); if (c) c.style.top = (h.offsetTop + h.scrollHeight + 36) + 'px'
  document.body.dataset.ready = '1' })</script>`
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] })
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: OUT_SCALE })
for (const lang of langs.length ? langs : ['fr', 'en']) {
  const out = join(here, 'out', `${lang}-${DEVICE}`); mkdirSync(out, { recursive: true })
  const tmp = join(here, '.tmp'); mkdirSync(tmp, { recursive: true })
  for (const [i, s] of SLIDES.entries()) {
    if (only && !only.includes(s.id)) continue
    const file = join(tmp, `${lang}-${DEVICE}-${s.id}.html`)
    writeFileSync(file, slideHtml(s, lang))
    await pg.goto('file://' + file)
    await pg.waitForSelector('body[data-ready]', { timeout: 20000 })
    await pg.waitForTimeout(400)
    await pg.screenshot({ path: join(out, `${String(i + 1).padStart(2, '0')}-${s.id}.png`) })
    console.log(lang, s.id)
  }
}
await browser.close()
