import { chromium } from './common.mjs'
import fs from 'fs'
const REPO = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '')
const WORK = process.env.FILM_DIR || '/tmp/tsuji-film'
const F = `${REPO}/frontend/node_modules/@fontsource`
const MARK = fs.readFileSync(`${REPO}/frontend/brand/mark.svg`, 'utf8')
const markData = 'data:image/svg+xml;base64,' + Buffer.from(MARK).toString('base64')
// layout shared with compose.py
export const PH = { x: 190, y: 400, w: 700, h: 1400, r: 64 }
const b64 = p => 'data:font/woff2;base64,' + fs.readFileSync(p).toString('base64')
const head = `<style>
@font-face{font-family:TsujiSerif;src:url(${b64(F + '/noto-serif-jp/files/noto-serif-jp-latin-900-normal.woff2')});font-weight:900}
@font-face{font-family:TsujiSerif;src:url(${b64(F + '/noto-serif-jp/files/noto-serif-jp-latin-700-normal.woff2')});font-weight:700}
@font-face{font-family:Grot;src:url(${b64(F + '/space-grotesk/files/space-grotesk-latin-700-normal.woff2')});font-weight:700}
@font-face{font-family:Grot;src:url(${b64(F + '/space-grotesk/files/space-grotesk-latin-500-normal.woff2')});font-weight:500}
html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}
.cap{position:absolute;left:60px;right:60px;top:120px;height:262px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  font-family:TsujiSerif;font-weight:900;color:#ece5d8;font-size:68px;line-height:1.16;letter-spacing:-0.5px;text-shadow:0 4px 24px rgba(0,0,0,.55)}
.cap b{font-weight:900;color:#e6b652}
.cap .dim{color:rgba(236,229,216,.42)}
.pill{display:inline-block;margin-top:22px;padding:14px 46px 18px;border-radius:999px;background:linear-gradient(180deg,#ecc56a,#c99a3e);color:#1c1811;
  font-family:Grot;font-weight:700;font-size:72px;letter-spacing:.5px;text-shadow:none;box-shadow:0 10px 40px rgba(201,154,62,.45)}
.mark{height:118px;vertical-align:-18px;margin-right:22px;filter:drop-shadow(0 6px 22px rgba(201,154,62,.5))}
</style>`
const caps = {
  hook:      `Fed up with never reaching<br><b>your Japanese goal?</b>`,
  try:       `<span style="font-size:104px"><img class="mark" src="${markData}">Try <b>Tsuji!</b></span>`,
  goalA:     `<b>Set up your goal</b><br><span class="dim">and follow your progress</span>`,
  goalB:     `<span class="dim">Set up your goal</span><br>and <b>follow your progress</b>`,
  boardA:    `<b>Connect,</b> <span class="dim">board</span><br><span class="dim">and you are on track</span>`,
  boardAB:   `<b>Connect, board</b><br><span class="dim">and you are on track</span>`,
  boardB:    `<span class="dim">Connect,</span> <b>board</b><br><span class="dim">and you are on track</span>`,
  boardC:    `<span class="dim">Connect, board</span><br>and <b>you are on track</b>`,
  modes:     `<span style="font-size:62px">Try <b>more complex</b><br><b>learning modes</b> if you like it</span>`,
  practice:  `Assimilate your study<br>with <b>the practice modes</b>`,
  join:      `<span style="font-size:70px">Join Tsuji right now on</span><br><span class="pill">tsuji.app</span>`,
}
fs.mkdirSync(`${WORK}/ov`, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
async function shot(html, out, transparent = true) {
  await page.setContent(`<!doctype html><html><head>${head}</head><body>${html}</body></html>`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: out, omitBackground: transparent })
}
const manifest = {}
for (const [k, v] of Object.entries(caps)) {
  await shot(`<div class="cap"><div>${v}</div></div>`, `${WORK}/ov/cap_${k}.png`)
  const boxes = await page.evaluate(() => {
    const root = document.querySelector('.cap > div')
    const walk = n => { for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) { const parts = c.textContent.split(/(\s+)/); const frag = document.createDocumentFragment()
        for (const p of parts) { if (!p) continue; if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p)); else { const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = p; frag.appendChild(sp) } }
        c.replaceWith(frag) }
      else if (c.nodeType === 1 && (c.classList.contains('pill') || c.tagName === 'IMG')) c.classList.add('w')
      else if (c.nodeType === 1) walk(c) } }
    walk(root)
    return [...root.querySelectorAll('.w')].map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, e.classList.contains('pill') ? 'pill' : e.tagName === 'IMG' ? 'mark' : 'word'] })
  })
  manifest[k] = { full: `ov/cap_${k}.png`, words: [] }
  for (let i = 0; i < boxes.length; i++) {
    await page.evaluate(i => document.querySelectorAll('.w').forEach((e, j) => { e.style.visibility = j === i ? 'visible' : 'hidden' }), i)
    // the bold/dim parents stay visible for layout; hide their own text nodes by colour only through the spans above
    await page.evaluate(() => document.querySelectorAll('.cap b, .cap span:not(.w), .cap div').forEach(e => { e.style.visibility = e.style.visibility }))
    const out = `ov/w_${k}_${i}.png`
    await page.screenshot({ path: `${WORK}/${out}`, omitBackground: true })
    manifest[k].words.push({ png: out, box: boxes[i].slice(0, 4), kind: boxes[i][4] })
  }
}
fs.writeFileSync(`${WORK}/ov/captions.json`, JSON.stringify(manifest, null, 1))
// the hook: a full-screen opener, one piece a beat (edit.py animates them)
const hook = [
  ['hook_1', 'top:470px;font-size:190px;color:#ece5d8', 'Fed up'],
  ['hook_2', 'top:715px;font-size:84px;color:#ece5d8', 'with never reaching'],
  ['hook_3', 'top:850px;font-size:124px;color:#e6b652', 'your Japanese'],
  ['hook_4', 'top:1010px;font-size:250px;color:#e6b652', 'goal?'],
]
for (const [k, css, text] of hook) {
  await shot(`<div style="position:absolute;left:0;right:0;${css};text-align:center;font-family:TsujiSerif;font-weight:900;line-height:1.05;letter-spacing:-1px;text-shadow:0 6px 30px rgba(0,0,0,.6)">${text}</div>`, `${WORK}/ov/${k}.png`)
}
// the gold line under "goal?": the app's route, ending on a station ring
await shot(`<div style="position:absolute;left:250px;top:1316px;width:560px;height:14px;border-radius:7px;background:linear-gradient(90deg,#c99a3e,#ecc56a);box-shadow:0 0 24px rgba(201,154,62,.45)"></div>
  <div style="position:absolute;left:792px;top:1297px;width:52px;height:52px;border-radius:50%;box-sizing:border-box;border:12px solid #ecc56a;background:#17151a"></div>`, `${WORK}/ov/hook_line.png`)
// background: sumi, a warm glow behind the phone, the mark as a faint watermark
await shot(`<div style="position:absolute;inset:0;background:
  radial-gradient(ellipse 620px 760px at 540px 1120px, rgba(201,154,62,.20), transparent 70%),
  radial-gradient(ellipse 900px 520px at 540px 230px, rgba(201,154,62,.08), transparent 70%),
  linear-gradient(180deg,#1b181f 0%,#121015 100%)"></div>
  <img src="${markData}" style="position:absolute;width:1300px;left:-110px;top:520px;opacity:.035">`, `${WORK}/ov/bg.png`, false)
// phone: a mask for the screen and a frame (bezel + edge light) drawn over it
const { x, y, w, h, r } = PH
await shot(`<div style="position:absolute;inset:0;background:#000"></div><div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;background:#fff"></div>`, `${WORK}/ov/mask.png`, false)
await shot(`<div style="position:absolute;left:${x - 14}px;top:${y - 14}px;width:${w + 28}px;height:${h + 28}px;border-radius:${r + 14}px;
  box-shadow:0 40px 120px rgba(0,0,0,.65), 0 0 0 1.5px rgba(236,229,216,.16) inset; background:transparent;
  border:14px solid #0b0a0d; box-sizing:border-box"></div>
  <div style="position:absolute;left:${x - 15}px;top:${y - 15}px;width:${w + 30}px;height:${h + 30}px;border-radius:${r + 15}px;border:1.5px solid rgba(230,182,82,.35);box-sizing:border-box"></div>`, `${WORK}/ov/frame.png`)
await browser.close()
console.log('ok')
