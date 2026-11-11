// ── The hand that plays a scene (plan 283) ──────────────────────
// Presses, typing and drawing at a person's pace, and the cards the app
// served, so a scene answers as one who knows them. With --look a scene
// is not filmed: it leaves a screenshot at each look() and prints what
// can be pressed there, which is how a scene is written.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function hand(page, { desk, looking, shots, label }) {
  let n = 0
  const cards = []
  page.on('response', async r => {
    if (!/\/api\/.*cards?(\?|$)/.test(r.url())) return
    try {
      const j = await r.json()
      for (const c of (Array.isArray(j) ? j : j.cards ?? [j])) if (c && typeof c === 'object') cards.push(c)
    } catch { /* not JSON */ }
  })
  if (looking) mkdirSync(shots, { recursive: true })
  return {
    desk,
    cards,
    // The latest card served whose word or kanji is `text`.
    cardFor: text => [...cards].reverse().find(c => [c.kanji, c.kana].includes(text)),
    beat: ms => page.waitForTimeout(ms),
    async look(what) {
      if (!looking) return
      n += 1
      await page.screenshot({ path: join(shots, `${label}-${String(n).padStart(2, '0')}-${what}.png`) })
      const items = await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button], input, textarea, canvas')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight })
        .map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')} "${(e.getAttribute('aria-label') || e.innerText || e.placeholder || '').replace(/\s+/g, ' ').slice(0, 60)}"`))
      console.log(`--- ${what} ${page.url()}\n${items.join('\n')}`)
    },
    // A press as a person makes it: the pointer travels there on the
    // desk, so its hover shows; a tap on the phone. The first visible
    // match, since the desk keeps hidden twins of some controls.
    async press(loc, { pause = 500, after = 0 } = {}) {
      loc = loc.filter({ visible: true }).first()
      await loc.waitFor({ state: 'visible', timeout: 15000 })
      if (desk) {
        const box = await loc.boundingBox()
        if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
        await page.waitForTimeout(pause)
        await loc.click()
      } else {
        await page.waitForTimeout(pause)
        await loc.tap()
      }
      if (after) await page.waitForTimeout(after)
    },
    async type(loc, text, { delay = 110 } = {}) {
      await loc.click()
      for (const ch of text) {
        await page.keyboard.type(ch)
        await page.waitForTimeout(delay * (0.6 + Math.random() * 0.8))
      }
    },
    // A character's strokes, in order, from the app's own KanjiVG: each
    // a run of points 0..1 in KanjiVG's 109 box.
    strokes(ch, per = 18) {
      const code = ch.codePointAt(0).toString(16).padStart(5, '0')
      return page.evaluate(async ([url, per]) => {
        const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'image/svg+xml')
        const ns = 'http://www.w3.org/2000/svg'
        const host = document.createElementNS(ns, 'svg')
        host.style.cssText = 'position:absolute;left:-9999px'
        document.body.appendChild(host)
        const out = [...doc.querySelectorAll('path')].map(p => {
          const el = host.appendChild(document.createElementNS(ns, 'path'))
          el.setAttribute('d', p.getAttribute('d'))
          const len = el.getTotalLength()
          const k = Math.max(6, Math.round(per * len / 60))
          return Array.from({ length: k + 1 }, (_, i) => { const q = el.getPointAtLength(len * i / k); return [q.x / 109, q.y / 109] })
        })
        host.remove()
        return out
      }, [`/kanjivg/${code}.svg`, per])
    },
    // Strokes drawn into a canvas's box at a hand's pace.
    async draw(box, strokes, { inset = 0.05, stepMs = 14, between = 260 } = {}) {
      const x0 = box.x + box.width * inset, y0 = box.y + box.height * inset
      const w = box.width * (1 - 2 * inset), h = box.height * (1 - 2 * inset)
      for (const s of strokes) {
        const pts = s.map(([x, y]) => [x0 + x * w, y0 + y * h])
        await page.mouse.move(...pts[0])
        await page.mouse.down()
        for (const p of pts.slice(1)) {
          await page.mouse.move(...p)
          await page.waitForTimeout(stepMs)
        }
        await page.mouse.up()
        await page.waitForTimeout(between)
      }
    },
  }
}
