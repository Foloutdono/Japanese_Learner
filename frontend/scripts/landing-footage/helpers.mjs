// What a finger does on the phone, as the page sees it.
// On the film's own clock when it has one (deterministic.mjs), else the wall's.
export const beat = (page, ms) => (page.beat ? page.beat(ms) : page.waitForTimeout(ms))

// A press: the pointer goes there and presses, the way a touch does.
export async function press(page, locator, { before = 350, after = 700, steps = 8 } = {}) {
  const base = typeof locator === 'string' ? page.locator(locator) : locator
  const el = base.filter({ visible: true }).first()
  await el.waitFor({ state: 'visible', timeout: 8000 }).catch(e => { throw new Error(`press: ${base} never showed`) })
  const box = await el.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
  await beat(page, before)
  await page.mouse.down()
  await beat(page, 70)
  await page.mouse.up()
  await beat(page, after)
}

export const byText = (page, text) => page.getByText(text, { exact: true })
export const button = (page, name) => page.getByRole('button', { name })

// A stroke of a drawing: points in 0..1 of the canvas, drawn at a hand's pace.
export async function stroke(page, canvas, pts, { ms = 520 } = {}) {
  const box = await canvas.boundingBox()
  const at = ([x, y]) => [box.x + x * box.width, box.y + y * box.height]
  const [x0, y0] = at(pts[0])
  await page.mouse.move(x0, y0, { steps: 4 })
  await page.mouse.down()
  const per = Math.max(1, Math.round(ms / (pts.length - 1) / 16))
  for (const p of pts.slice(1)) {
    const [x, y] = at(p)
    await page.mouse.move(x, y, { steps: per * 3 })
  }
  await page.mouse.up()
  await beat(page, 260)
}

// A glyph's strokes, in writing order, as points in the canvas's own 0..1
// square: KanjiVG's paths (the app's own stroke-order data), sampled.
export async function glyphStrokes(page, ch) {
  const hex = ch.codePointAt(0).toString(16).padStart(5, '0')
  return page.evaluate(async hex => {
    const txt = await (await fetch(`/kanjivg/${hex}.svg`)).text()
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml')
    const paths = [...doc.querySelectorAll('path')].filter(p => /-s\d+$/.test(p.getAttribute('id') || ''))
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    return paths.map(p => {
      const el = document.createElementNS(ns, 'path')
      el.setAttribute('d', p.getAttribute('d'))
      svg.appendChild(el)
      const len = el.getTotalLength()
      const n = Math.max(6, Math.round(len / 4))
      return Array.from({ length: n + 1 }, (_, i) => {
        const pt = el.getPointAtLength((len * i) / n)
        return [pt.x / 109, pt.y / 109]
      })
    })
  }, hex)
}

// What the last batch of cards the app asked the backend for carried.
export const lastCard = page => page.cards.at(-1)?.cards?.[0]
export async function nextCards(page, from) {
  for (let i = 0; i < 100 && page.cards.length <= from; i++) await beat(page, 100)
  return lastCard(page)
}
