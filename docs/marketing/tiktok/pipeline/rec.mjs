import fs from 'fs'
import { execFileSync } from 'child_process'
import { SFX_LOG } from './common.mjs'
const REPO = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '')
const WORK = process.env.FILM_DIR || '/tmp/tsuji-film'
// CDP screencast recorder: crisp device-pixel frames, assembled to CFR mp4.
export async function startRec(page, name) {
  const dir = `${WORK}/frames/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; const file = `${dir}/${String(i).padStart(5, '0')}.jpg`
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'))
    frames.push({ file, t: f.metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
  const t0 = Date.now() / 1000
  return async function stop() {
    await new Promise(r => setTimeout(r, 300))
    await cdp.send('Page.stopScreencast')
    const end = Date.now() / 1000
    let list = ''
    for (let i = 0; i < frames.length; i++) {
      const next = i + 1 < frames.length ? frames[i + 1].t : end
      list += `file '${frames[i].file}'\nduration ${Math.max(0.001, next - frames[i].t).toFixed(4)}\n`
    }
    list += `file '${frames[frames.length - 1].file}'\n`
    fs.writeFileSync(`${dir}/list.txt`, list)
    const T0 = frames[0].t
    fs.writeFileSync(`${dir}/frames.json`, JSON.stringify({ t0: T0, end: end - T0, frames: frames.map(f => [f.file, +(f.t - T0).toFixed(4)]),
      events: SFX_LOG.filter(e => e.t >= T0 - 0.05 && e.t <= end).map(e => ({ ...e, t: +(e.t - T0).toFixed(4) })) }))
    const out = `${WORK}/clips/${name}.mp4`; fs.mkdirSync(`${WORK}/clips`, { recursive: true })
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`,
      '-vf', 'fps=30,scale=1170:2340:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', out])
    console.log(`rec ${name}: ${frames.length} frames, ${(end - frames[0]?.t).toFixed(1)}s -> ${out}`)
    return out
  }
}
// visible, human-paced tap
export async function tap(page, locator, pause = 700) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator
  await el.scrollIntoViewIfNeeded().catch(() => {})
  await el.tap()
  await page.waitForTimeout(pause)
}
// a finger drag: content moves up by dy (negative = back down), eased
export async function swipe(page, dy, { x = 200, ms = 650 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  const y0 = dy > 0 ? 640 : 140, y1 = y0 - dy
  await page.evaluate(([x, y]) => window.__ring && window.__ring(x, y), [x, y0])
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] })
  const n = Math.round(ms / 16)
  for (let i = 1; i <= n; i++) { const t = i / n, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * e, id: 1 }] }); await new Promise(r => setTimeout(r, 16)) }
  await new Promise(r => setTimeout(r, 60))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}
// draw a KanjiVG character with touch strokes onto the element matching sel
export async function drawKanji(page, sel, hex, { msPerStroke = 650 } = {}) {
  const fs = await import('fs')
  const svg = fs.readFileSync(`${REPO}/backend/kanjivg/${hex}.svg`, 'utf8')
  const ds = [...svg.matchAll(/<path[^>]* d="([^"]+)"/g)].map(m => m[1])
  const strokes = await page.evaluate(({ sel, ds }) => {
    const r = document.querySelector(sel).getBoundingClientRect()
    const ns = 'http://www.w3.org/2000/svg'; const s = document.createElementNS(ns, 'svg'); document.body.appendChild(s)
    const out = ds.map(d => { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.appendChild(p)
      const L = p.getTotalLength(); const n = Math.max(8, Math.round(L / 3)); const pts = []
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); pts.push([r.left + q.x / 109 * r.width, r.top + q.y / 109 * r.height]) }
      return pts })
    s.remove(); return out
  }, { sel, ds })
  const cdp = await page.context().newCDPSession(page)
  for (const pts of strokes) {
    const tp = ([x, y]) => [{ x, y, radiusX: 6, radiusY: 6, force: 1, id: 1 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) })
    for (const p of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) }); await new Promise(r => setTimeout(r, msPerStroke / pts.length)) }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await new Promise(r => setTimeout(r, 200))
  }
  await cdp.detach()
}
// the on-screen box of what a zoom should frame, logged with the time
// (fractions of the viewport, so the edit can frame it exactly)
export async function mark(page, name, target) {
  const vp = page.viewportSize()
  const r = typeof target === 'string'
    ? await page.locator(target).first().boundingBox()
    : await page.evaluate(texts => {   // the union of the elements holding these texts
        let box = null
        for (const t of texts) {
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
          let n; while ((n = w.nextNode())) if (n.textContent.includes(t)) {
            const b = n.parentElement.getBoundingClientRect(); if (!b.width) continue
            box = box ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y), r: Math.max(box.r, b.right), b: Math.max(box.b, b.bottom) } : { x: b.x, y: b.y, r: b.right, b: b.bottom }
            break }
        }
        return box && { x: box.x, y: box.y, width: box.r - box.x, height: box.b - box.y }
      }, target.texts)
  if (!r) { console.log('MARK MISS', name); return }
  SFX_LOG.push({ kind: 'rect', name, rect: [r.x / vp.width, r.y / vp.height, r.width / vp.width, r.height / vp.height], t: Date.now() / 1000 })
  console.log('mark', name, r.x.toFixed(0), r.y.toFixed(0), r.width.toFixed(0), r.height.toFixed(0))
}
