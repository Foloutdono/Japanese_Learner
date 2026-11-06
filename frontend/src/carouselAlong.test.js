// The reading challenge's words over the print (plan 309,
// frontend/carousel/challenge.js): the paper look's inks, the read-along's
// panel, its credit and its hook, and the scroll's text after a cover.
// Every dial is named as it is read, never left to its default, which
// plan 309 moves last (tune.js).
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, SP, alpha, palette } from '../carousel/draw.js'
import { PRINT_HOURS } from '../carousel/app.js'
import { backdrop, liftAt } from '../carousel/backdrop.js'
import { CH, CTA, RISEN, alongBox, alongPanel, bandOf, challengePlan, challengeTimeline, chipShown, discDrawn, drawChallenge, hookBand, inksOf, lookOf, raisedGlow } from '../carousel/challenge.js'
import { PRINTS_REV, SCENERIES, sceneryOf } from '../carousel/sceneries.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

// With no print in the lane the wash always lies whole: a test may say
// how much of it the backdrop has laid (the moment after a cover), and
// keep the cover from drawing, to see the hook's own masthead alone.
const seam = vi.hoisted(() => ({ laid: null, cover: true }))
vi.mock('../carousel/backdrop.js', async o => {
  const real = await o()
  return { ...real, backdrop: (...args) => ({ ...real.backdrop(...args), ...(seam.laid == null ? {} : { laid: seam.laid }) }) }
})
vi.mock('../carousel/cover.js', async o => {
  const real = await o()
  return { ...real, drawCover: (...args) => (seam.cover ? real.drawCover(...args) : undefined) }
})

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const bank = JSON.parse(read('carousel/bank/comprehension.json'))
const META = JSON.parse(read('src/components/station/print/print.json'))
const jp = t => /[぀-ヿ㐀-鿿]/.test(t)
const PAPER = palette('paper')
// The paper look as it was written before plan 309 (challenge.js, LOOK.paper).
const BEFORE = {
  ground: 'paper', ink: PAPER.ink, soft: PAPER.ink2, title: PAPER.line.rikai, ruby: PAPER.ink2, ring: PAPER.gold, road: PAPER.gold,
  panel: alpha(PAPER.card, 0.94), edge: PAPER.surfaceLine, chip: PAPER.ink, chipInk: PAPER.bg, shadow: false, track: alpha(PAPER.ink, 0.14), dot: alpha(PAPER.ink, 0.08),
}
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).reduce((L, v, i) => L + [0.2126, 0.7152, 0.0722][i] * lin(v), 0)
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
const draw = (plan, t) => {
  const { ctx, at } = drawn()
  drawChallenge(ctx, plan, challengeTimeline(plan), t, null)
  return at
}
/** drawn(), keeping each text's ink and face and the masthead's rim: its
 *  rings round TSUJI and round the mark, their ink and their width on the frame. */
function traced() {
  const { ctx: base, at } = drawn()
  const texts = []
  const rings = []
  const ctx = new Proxy(base, {
    get: (o, k) => {
      if (k === 'fillText') return (t, x, y) => { o.fillText(t, x, y); texts.push({ ...at.at(-1), ink: o.fillStyle, font: o.font }) }
      if (k === 'strokeText') return t => rings.push({ of: t, w: o.lineWidth * o.sx, ink: o.strokeStyle })
      if (k === 'stroke') return path => { if (path) rings.push({ of: 'mark', w: o.lineWidth * o.sx, ink: o.strokeStyle }) }
      return o[k]
    },
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, texts, rings }
}
const rgbaOf = s => s.match(/[\d.]+/g).map(Number)
/** drawn(), keeping every linear gradient made (its line, its stops) and
 *  every rectangle filled, in what. */
function painted() {
  const { ctx: base, at } = drawn()
  const grads = []
  const rects = []
  const ctx = new Proxy(base, {
    get: (o, k) => {
      if (k === 'createLinearGradient') {
        return (...line) => {
          const g = { line, stops: [], addColorStop: (s, c) => g.stops.push([s, c]) }
          grads.push(g)
          return g
        }
      }
      if (k === 'fillRect') return (...r) => rects.push({ r, style: o.fillStyle })
      return o[k]
    },
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, grads, rects }
}
/** A context keeping the images laid on it; what else it is asked does
 *  nothing, and its gradients and pixels are there to be asked for. */
function recorder() {
  const calls = []
  const state = { globalAlpha: 1, fillStyle: null, filter: 'none', globalCompositeOperation: 'source-over' }
  const stack = []
  const methods = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop() || {}),
    drawImage: (img, ...a) => calls.push({ op: 'drawImage', img, a }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(8) }),
  }
  const ctx = new Proxy(state, { get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true } })
  return { ctx, calls }
}
/** Runs `fn` with canvases to draw away from the frame, each a recorder,
 *  so the backdrop keeps its print and lays its parts (backdrop.js, rastersOf). */
function withCanvases(fn) {
  const had = globalThis.OffscreenCanvas
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { Object.assign(this, { width: w, height: h, r: recorder() }) }
    getContext() { return this.r.ctx }
  }
  try { return fn() } finally { globalThis.OffscreenCanvas = had }
}
/** A print as app.loadPrint gives it, each picture a name: the app's own
 *  (the phone's on the bay, the desk's on the long view), or a carousel
 *  scenery's, beside its `meta`. */
function printFor(scenery, name, meta = null) {
  const view = sceneryOf(scenery)
  const scene = JSON.parse(read(meta ? `carousel/prints/${PRINTS_REV}/${scenery}/${name}.json` : `public/today/print/${META.rev}/${name}-${view.device}.json`))
  const img = Object.fromEntries(['sky', 'back', 'train', 'front', 'grain', 'paper'].map(k => [k, { k }]))
  const hour = /hanabi/.test(name) ? 'night' : name.split('-')[1]
  return { hour, name, scenery, scene, frame: meta ? meta.frame : META.frames[view.device], look: (meta ?? META).prints[name], img: { ...img, backBare: null, bursts: null } }
}

describe('the words over the print (plan 309)', () => {
  it('inks the paper look as before at ×0, the readings in the text’s own ink toward ×1', () => {
    const at = r => inksOf(challengePlan(bank, 'n5-12', { style: 'scroll', tune: { 'challenge.ruby': r } }))
    expect(at(0)).toEqual(BEFORE)
    // Only the readings, the soft labels and the countdown's track move.
    for (const r of [0.3, 0.9, 1]) {
      const { ruby, soft, track, ...rest } = at(r)
      const { ruby: r0, soft: s0, track: t0, ...was } = BEFORE
      expect(rest, `×${r}`).toEqual(was)
      expect([ruby, soft, track], `×${r}`).not.toEqual([r0, s0, t0])
    }
    // ×0.9: the readings all but the text's ink; the labels and the
    // countdown's track dark enough for the night's print, measured.
    expect(at(0.9)).toMatchObject({ ruby: '#29231a', soft: '#3b3429', track: 'rgba(34,29,21,0.356)' })
    expect(at(1).ruby).toBe(PAPER.ink)
    // Darker the further it is turned: on the page's paper, the readings
    // go from the soft ink's 5.8:1 toward the text's own 14.8:1; the soft
    // labels darken too, and stay lighter than the stops already reached.
    const on = (r, k = 'ruby') => ratio(at(r)[k], PAPER.bg)
    for (let r = 0.1; r <= 1; r += 0.1) {
      expect(on(r)).toBeGreaterThan(on(r - 0.1))
      expect(on(r, 'soft')).toBeGreaterThan(on(r - 0.1, 'soft'))
      expect(on(r, 'soft')).toBeLessThan(ratio(PAPER.ink, PAPER.bg) - 1)
    }
    expect(on(0)).toBeLessThan(6)
    expect(on(0.9)).toBeGreaterThan(13.5)
  })

  it('sets the stops still ahead a weight lighter where the readings are in the text’s ink, so the stop reached stands apart', () => withPath2D(() => {
    const STOP = /^(Read|\d+ questions|Breakdown)$/
    for (const style of ['scroll', 'along']) {
      for (const ruby of [0, 0.9]) {
        const pl = challengePlan(bank, 'n5-12', { style, tune: { 'challenge.ruby': ruby } })
        const tl = challengeTimeline(pl)
        const cta = tl.segs.find(s => s.key === 'cta')
        const T = style === 'scroll' ? inksOf(pl) : { ink: '#f3ecdf', soft: alpha('#f3ecdf', 0.75) }
        // Each stop's ink and weight: before the reader's dot leaves the first, and once at the second.
        const stops = into => {
          const r = traced()
          drawChallenge(r.ctx, pl, tl, cta.start + into, null)
          return r.texts.filter(x => STOP.test(x.t)).map(x => [x.ink, Number(/^(\d+) /.exec(x.font)[1])])
        }
        // Ahead in the soft ink, a weight lighter only on the paper with the readings darkened.
        const ahead = [T.soft, style === 'scroll' && ruby > 0 ? 500 : 700]
        const reached = [T.ink, 700]
        const where = `${style} ×${ruby}`
        expect(stops(CTA.rail - 0.5), where).toEqual([reached, ahead, ahead])
        expect(stops(CTA.rail + 0.6), where).toEqual([reached, reached, ahead])
        expect(stops(CH.cta - 0.05), where).toEqual([reached, reached, reached])
      }
    }
  }))

  it('darkens the read-along’s panel by the hour of its print, never lighter than it was', () => {
    const plan = (along, extra = {}) => challengePlan(bank, 'n5-12', { style: 'along', tune: { 'challenge.along': along }, ...extra })
    const seasons = [null, 'spring', 'summer', 'hanabi', 'autumn', 'winter']
    // Off, it is the one darkness it always was, at every hour.
    for (const hour of PRINT_HOURS) for (const season of seasons) {
      expect(alongPanel(plan(0, { hour, season })), `${season} ${hour}`).toBe(0.62)
      expect(alongPanel(plan(0, { hour, season }), `${season || 'spring'}-${hour}`), `${season} ${hour}`).toBe(0.62)
    }
    // On, set by the hour, August's fireworks as dark as dawn: by the season asked, or by the print drawn.
    const ON = { dawn: 0.74, day: 0.76, dusk: 0.7, night: 0.72 }
    for (const hour of PRINT_HOURS) for (const season of seasons.filter(s => s !== 'hanabi')) {
      expect(alongPanel(plan(1, { hour, season })), `${season} ${hour}`).toBe(ON[hour])
      expect(alongPanel(plan(1, { hour, season }), `summer-${hour}`), `${season} ${hour}`).toBe(ON[hour])
    }
    expect(alongPanel(plan(1, { hour: 'night', season: 'hanabi' }))).toBe(0.74)
    expect(alongPanel(plan(1, { hour: 'night' }), 'summer-hanabi')).toBe(0.74)
    // The date's B print, with no season asked, as its A print.
    expect(alongPanel(plan(1, { hour: 'night' }), 'summer-hanabi-b')).toBe(0.74)
    expect(alongPanel(plan(1, { hour: 'night' }), 'summer-night-b')).toBe(ON.night)
    for (const hour of ['dawn', 'day', 'dusk']) expect(alongPanel(plan(1, { hour, season: 'hanabi' })), hour).toBe(ON[hour])
    // Never under the darkness it had before, whatever the print.
    for (const hour of PRINT_HOURS) for (const season of seasons) expect(alongPanel(plan(1, { hour, season })), `${season} ${hour}`).toBeGreaterThanOrEqual(0.62)
    // A photo has no hour: it keeps the look before.
    expect(alongPanel(plan(1, { hour: 'day', photo: 'carousel/mine.jpg' }))).toBe(0.62)
  })

  it('reads every sentence whole as it is said, at the title’s size, the voice’s credit in the panel’s foot under it', () => withPath2D(() => {
    const plan = (id, along, lang = 'en') => challengePlan(bank, id, { style: 'along', lang, tune: { 'challenge.along': along } })
    // Off, where it always was: under the panel, on the print.
    const was = alongBox(plan('n5-12', 0))
    expect(was.text).toBe(was.foot)
    expect(was.credit - FS.sm * 0.72).toBeGreaterThan(was.foot)
    // On, the panel stands where it did, its text's room the credit's line
    // less, the credit's letters inside its foot, under that room.
    const box = alongBox(plan('n5-12', 1))
    expect([box.top, box.foot]).toEqual([was.top, was.foot])
    expect(box.foot - box.text).toBeCloseTo(FS.sm * 1.4, 6)
    expect(box.credit - FS.sm * 0.72).toBeGreaterThan(box.text - SP[5] * 0.5)
    expect(box.credit + FS.sm * 0.12).toBeLessThan(box.foot)
    for (const P of bank.passages) {
      for (const lang of ['en', 'fr']) {
        for (const along of [0, 1]) {
          const pl = plan(P.id, along, lang)
          const tl = challengeTimeline(pl)
          const B = alongBox(pl)
          for (const line of tl.lines) {
            const { ctx, at } = drawn()
            drawChallenge(ctx, pl, tl, line.voice + 0.2, null)
            const where = `${P.id} ${lang} along ${along}, sentence ${line.i + 1}`
            // The sentence said, every word of it, at the title's size at least.
            const words = at.filter(x => x.size >= FS.title - 0.5 && x.alpha > 0.99)
            expect(words.map(x => x.t).join(''), where).toContain(pl.sents[line.i].map(r => r.t).join(''))
            const [credit, ...more] = at.filter(x => /VOICEVOX Nemo/.test(x.t))
            expect(more, where).toEqual([])
            expect(credit.y, where).toBeCloseTo(B.credit, 6)
            if (credit.alpha > 0.99) {
              for (const x of words) expect(x.y + x.size * 0.12, `${where} ${x.t}`).toBeLessThanOrEqual(B.text)
            } else {
              // Gone only while a sentence too tall for the room above it is
              // read, that sentence reaching into its room, inside the panel.
              expect([along, credit.alpha], where).toEqual([1, 0])
              const low = Math.max(...words.map(x => x.y + x.size * 0.12))
              expect(low, where).toBeGreaterThan(B.text - SP[5] * 0.5)
              expect(low, where).toBeLessThan(B.foot - SP[5] * 0.5)
            }
          }
        }
      }
    }
  }), 240000)

  it('gives a sentence too tall to stand above the credit the panel’s foot while it is read, never a smaller size', () => withPath2D(() => {
    // Fifty-eight words of one kanji under its reading: eight lines at the
    // title's size, too tall for the room above the credit, not for the panel.
    const yoru = { t: '夜', k: 'word', ro: 'yoru', fu: [['夜', 'よる']] }
    const tall = [...Array(58).fill(yoru), { t: '。', k: 'punct' }]
    const base = challengePlan(bank, 'n4-01', { style: 'along' })
    const plan = along => ({ ...base, id: 'eight-lines', tune: { 'challenge.along': along }, sents: [base.sents[0], tall, base.sents[1]] })
    const said = rows => rows.map(r => r.t).join('')
    const seen = (pl, t) => {
      const at = draw(pl, t)
      return { words: at.filter(x => x.size >= FS.title - 0.5 && x.alpha > 0.99), credit: at.find(x => /VOICEVOX Nemo/.test(x.t)) }
    }
    const on = plan(1)
    const tl = challengeTimeline(on)
    const box = alongBox(on)
    // Before it, the credit under the sentence said.
    let s = seen(on, tl.lines[0].voice + 0.2)
    expect(s.credit.alpha).toBe(1)
    expect(s.words.map(x => x.t).join('')).toContain(said(base.sents[0]))
    // Turned to, the credit going as the column turns.
    s = seen(on, tl.lines[1].at + CH.turn / 2)
    expect(s.credit.alpha).toBeGreaterThan(0)
    expect(s.credit.alpha).toBeLessThan(1)
    // Said: whole, at the title's size, down into the credit's room, the credit gone.
    s = seen(on, tl.lines[1].voice + 0.2)
    expect(s.credit.alpha).toBe(0)
    expect(s.words.map(x => x.t).join('')).toContain(said(tall))
    expect(Math.min(...s.words.filter(x => x.t === '夜').map(x => x.size))).toBeGreaterThanOrEqual(FS.title)
    const low = Math.max(...s.words.map(x => x.y + x.size * 0.12))
    expect(low).toBeGreaterThan(box.text - SP[5] * 0.5)
    expect(low).toBeLessThan(box.foot - SP[5] * 0.5)
    // Turned from, the credit back under the next.
    s = seen(on, tl.lines[2].at + CH.turn / 2)
    expect(s.credit.alpha).toBeGreaterThan(0)
    expect(s.credit.alpha).toBeLessThan(1)
    s = seen(on, tl.lines[2].voice + 0.2)
    expect(s.credit.alpha).toBe(1)
    expect(s.words.map(x => x.t).join('')).toContain(said(base.sents[1]))
    for (const x of s.words) expect(x.y + x.size * 0.12, x.t).toBeLessThanOrEqual(box.text)
    // Off, it stood whole on the panel as it always did, the credit under the panel.
    const off = plan(0)
    s = seen(off, challengeTimeline(off).lines[1].voice + 0.2)
    expect(s.words.map(x => x.t).join('')).toContain(said(tall))
    expect(s.credit).toMatchObject({ alpha: 1, y: alongBox(off).credit })
  }))

  it('lays a band of night behind the read-along’s hook, only where no cover stands', () => withPath2D(() => {
    const plan = (tune, extra = {}) => challengePlan(bank, 'n5-12', { style: 'along', tune, ...extra })
    expect(hookBand(plan({ 'challenge.along': 1, 'challenge.cover': 0 }))).toBe(true)
    expect(hookBand(plan({ 'challenge.along': 0, 'challenge.cover': 0 }))).toBe(false)
    expect(hookBand(plan({ 'challenge.along': 1, 'challenge.cover': 1 }))).toBe(false)
    expect(hookBand(plan({ 'challenge.along': 1, 'challenge.cover': 0 }, { photo: 'carousel/mine.jpg' }))).toBe(false)
    expect(hookBand(challengePlan(bank, 'n5-12', { style: 'scroll', tune: { 'challenge.along': 1, 'challenge.cover': 0 } }))).toBe(false)
    // It writes nothing: the hook's words are what they were.
    const words = tune => draw(plan(tune), 1.6).map(x => [x.t, x.y, x.alpha])
    expect(words({ 'challenge.along': 1, 'challenge.cover': 0 })).toEqual(words({ 'challenge.along': 0, 'challenge.cover': 0 }))
  }))

  it('lays the band whole from 540 to 1230, thinning over 130 px either side, across the frame; under the sun or moon, from below it', () => withPath2D(() => {
    const band = tune => {
      const pl = challengePlan(bank, 'n5-12', { style: 'along', tune: { 'challenge.along': 1, 'challenge.cover': 0, ...tune } })
      const r = painted()
      drawChallenge(r.ctx, pl, challengeTimeline(pl), 1.6, null)
      // The backdrop darkens from the frame's top; the band is the gradient laid lower.
      const laid = r.rects.filter(x => r.grads.includes(x.style) && x.r[1] > 0)
      expect(laid, JSON.stringify(tune)).toHaveLength(1)
      return { ...laid[0], at: bandOf(pl) }
    }
    for (const [tune, top, y0] of [[{ 'challenge.disc': 0 }, 540, 410], [{ 'challenge.disc': 1 }, 615, 485]]) {
      const { r, style, at } = band(tune)
      const where = JSON.stringify(tune)
      const y1 = 1360
      expect(at, where).toMatchObject({ top, foot: 1230, feather: 130, a: 0.72, y0, y1 })
      // Across the whole width, from where it begins to thin in to where it has thinned out.
      expect(style.line, where).toEqual([0, y0, 0, y1])
      expect(r, where).toEqual([0, y0, FORMATS.story.w, y1 - y0])
      // Night at 0.72 from its top to its foot, none at either end, eased between.
      const stops = [...style.stops].sort((p, q) => p[0] - q[0]).map(([s, c]) => [s, ...rgbaOf(c)])
      for (const [, R, G, B] of stops) expect([R, G, B], where).toEqual([12, 10, 22])
      expect(stops[0], where).toEqual([0, 12, 10, 22, 0])
      expect(stops.at(-1), where).toEqual([1, 12, 10, 22, 0])
      const whole = [(top - y0) / (y1 - y0), 1 - 130 / (y1 - y0)]
      expect(whole[0], where).toBeCloseTo(130 / (y1 - y0), 9)
      for (const [s, , , , a] of stops) {
        if (s >= whole[0] - 1e-9 && s <= whole[1] + 1e-9) expect(a, `${where} ${s}`).toBe(0.72)
        else expect(a, `${where} ${s}`).toBeLessThan(0.72)
      }
      const rising = stops.filter(([s]) => s <= whole[0] + 1e-9).map(x => x[4])
      expect(rising, where).toEqual([...rising].sort((p, q) => p - q))
      expect(rising, where).toHaveLength(9)
    }
    // Under the sun or moon (its foot at y 482 under the hook), none of the band.
    expect(band({ 'challenge.disc': 1 }).r[1]).toBeGreaterThanOrEqual(482)
    // From under a scenery's own disc (its meta: 24 units round 150 on a
    // print 390 wide), a few pixels clear of its foot on the frame.
    const lowered = extra => bandOf(challengePlan(bank, 'n5-12', { style: 'along', tune: { 'challenge.along': 1, 'challenge.cover': 0, 'challenge.disc': 1 }, ...extra }))
    for (const view of SCENERIES.filter(s => s.source === 'carousel')) {
      const { frame } = JSON.parse(read(`carousel/prints/${PRINTS_REV}/${view.id}/meta.json`))
      const foot = ((frame.cy + frame.disc) * FORMATS.story.w) / frame.w
      const { y0, top } = lowered({ scenery: view.id })
      expect(top, view.id).toBe(615)
      expect(foot, view.id).toBeLessThanOrEqual(y0)
      expect(y0 - foot, view.id).toBeLessThan(5)
    }
    // Only where one is drawn (discDrawn): never on the long view, August's
    // night or the bay's spring night, whose band stands where it always did,
    // by the season asked or by the print drawn (its B print as its A).
    for (const extra of [{ scenery: 'wide' }, { hour: 'night', season: 'hanabi' }, { scenery: 'torii', hour: 'night', season: 'hanabi' }, { hour: 'night', season: 'spring' }]) {
      expect(lowered(extra), JSON.stringify(extra)).toMatchObject({ top: 540, y0: 410 })
    }
    const dated = challengePlan(bank, 'n5-12', { style: 'along', hour: 'night', tune: { 'challenge.along': 1, 'challenge.cover': 0, 'challenge.disc': 1 } })
    for (const name of ['summer-hanabi', 'summer-hanabi-b', 'spring-night']) expect(bandOf(dated, name).top, name).toBe(540)
    for (const name of ['summer-night', 'summer-night-b', 'autumn-night']) expect(bandOf(dated, name).top, name).toBe(615)
    expect(lowered({ scenery: 'river', hour: 'night', season: 'spring' }).top).toBe(615)
  }))

  it('holds the reading’s chip while the print rises under the sun or moon, the cover on or off, until the lift is done (plan 309)', () => withPath2D(() => {
    // The lift is whole RISEN seconds into the reading, as backdrop.js's liftAt reads it.
    expect(liftAt('reading', RISEN, 1)).toBe(1)
    expect(liftAt('reading', RISEN - 0.01, 1)).toBeLessThan(1)
    const ON = { 'challenge.lift': 1, 'challenge.disc': 1 }
    for (const style of ['scroll', 'along']) {
      const counter = (tune, into, extra = {}) => {
        const pl = challengePlan(bank, 'n5-12', { style, tune, ...extra })
        const tl = challengeTimeline(pl)
        const at = draw(pl, tl.segs.find(s => s.key === 'reading').start + into)
        return at.find(x => / \/ \d+$/.test(x.t))?.alpha ?? 0
      }
      for (const cover of [1, 0]) {
        const tune = { ...ON, 'challenge.cover': cover }
        const where = `${style} cover ${cover}`
        // Held while the disc rises through its place, then in over 0.3 s.
        for (const into of [0, 0.3, 0.6, 1, 1.3, RISEN - 0.01]) expect(counter(tune, into), `${where} ${into}`).toBe(0)
        expect(counter(tune, RISEN + 0.1), where).toBeGreaterThan(0)
        expect(counter(tune, RISEN + 0.1), where).toBeLessThan(1)
        for (const into of [RISEN + 0.3, RISEN + 3]) expect(counter(tune, into), `${where} ${into}`).toBe(1)
        // The same over a carousel scenery with a moon of its own, at night.
        expect(counter(tune, 1, { scenery: 'river', hour: 'night', season: 'spring' }), where).toBe(0)
        // Where nothing rises through it, it comes as it always did: the
        // long view (never raised, no disc), August's night (its fireworks
        // and no moon), the bay's spring night (its own hazy moon), a photo.
        const none = [
          { scenery: 'wide' }, { hour: 'night', season: 'hanabi' }, { scenery: 'river', hour: 'night', season: 'hanabi' },
          { hour: 'night', season: 'spring' }, { photo: 'carousel/mine.jpg' },
        ]
        for (const extra of none) {
          const pl = challengePlan(bank, 'n5-12', { style, tune, ...extra })
          expect(chipShown(pl, 0.5), `${where} ${JSON.stringify(extra)}`).toBe(1)
          if (!(cover && style === 'scroll')) expect(counter(tune, 0.5, extra), `${where} ${JSON.stringify(extra)}`).toBe(1)
        }
        // Read off the print drawn where the season is the date's: its B print as its A.
        const dated = challengePlan(bank, 'n5-12', { style, tune, hour: 'night' })
        for (const name of ['summer-hanabi', 'summer-hanabi-b', 'spring-night']) expect(chipShown(dated, 0.5, name), `${where} ${name}`).toBe(1)
        for (const name of ['summer-night', 'summer-night-b', 'winter-night']) expect(chipShown(dated, 0.5, name), `${where} ${name}`).toBe(0)
      }
      // Not raised, or no disc: it comes as it always did, the cover on or off.
      for (const off of Object.keys(ON)) {
        for (const cover of [0, 1]) {
          const tune = { ...ON, [off]: 0, 'challenge.cover': cover }
          expect(chipShown(challengePlan(bank, 'n5-12', { style, tune }), 0.5), `${style} ${off} ${cover}`).toBe(1)
          expect(counter(tune, 1), `${style} ${off} ${cover}`).toBe(1)
          if (!cover) expect(counter(tune, 0), `${style} ${off} ${cover}`).toBe(1)
        }
      }
    }
  }))

  it('says where the sun or moon is drawn as backdrop.js draws it, on every print of every scenery', () => withCanvases(() => {
    // Every print a challenge may stand on, as loadPrint gives it.
    const prints = []
    for (const name of Object.keys(META.prints)) {
      prints.push(printFor('bay', name))
      prints.push(printFor('wide', name))
    }
    for (const view of SCENERIES.filter(s => s.source === 'carousel')) {
      const meta = JSON.parse(read(`carousel/prints/${PRINTS_REV}/${view.id}/meta.json`))
      for (const name of Object.keys(meta.prints)) prints.push(printFor(view.id, name, meta))
    }
    expect(prints.length).toBe(22 * 2 + 17 * 4)
    let drawnSome = 0
    for (const P of prints) {
      const { hour } = P
      for (const tune of [{ 'challenge.disc': 1 }, { 'challenge.disc': 0 }]) {
        const plan = challengePlan(bank, 'n5-12', { style: 'scroll', hour, scenery: P.scenery, tune })
        const tl = challengeTimeline(plan)
        // Under the hook, where the sun or moon always shows when it is drawn:
        // the print laid whole, or under it, the disc, (the train,) over it.
        const r = recorder()
        backdrop(r.ctx, P, lookOf(plan), { dark: 0.5, hour, wash: 1, plan, tl, t: 1.6, seg: 'hook', cover: false })
        const laid = r.calls.filter(c => c.op === 'drawImage').length
        const sun = laid > 1
        drawnSome += sun
        expect(discDrawn(plan, P.name), `${P.scenery} ${P.name} ${JSON.stringify(tune)}`).toBe(sun)
      }
    }
    // Most prints have one: every phone print but August's nights and the bay's spring night.
    expect(drawnSome).toBe(22 - 3 + (17 - 1) * 4)
  }))

  it('keeps half the masthead’s glow read along over the print raised, by day, come in with the lift; none at night or over a print left down', () => withPath2D(() => {
    const masts = (pl, t) => draw(pl, t).filter(x => x.t === 'TSUJI').map(x => x.alpha)
    const plan = (tune, extra = {}) => challengePlan(bank, 'n5-12', { style: 'along', tune: { 'challenge.along': 1, 'challenge.lift': 1, 'challenge.cover': 0, ...tune }, ...extra })
    const pl = plan({})
    const tl = challengeTimeline(pl)
    const seg = k => tl.segs.find(s => s.key === k)
    const rd = seg('reading')
    const later = [rd.start + RISEN, rd.start + 30, seg('question').start + 1, seg('answer').start + 1, seg('cta').start + 1]
    // Raised, in the reading, the question, the answer and the way to the
    // app: its glow's two shapes at half, then its ink once, whole.
    for (const t of later) expect(masts(pl, t), `${t}`).toEqual([0.5, 0.5, 1])
    // None under the hook, where the print is down; then come in as it rises.
    expect(masts(pl, 1.6)).toEqual([1])
    expect(masts(pl, rd.start)).toEqual([1])
    let was = 0
    for (const into of [0.2, 0.5, 0.8, 1.1, 1.4]) {
      const [g, again, ink] = masts(pl, rd.start + into)
      expect(g, `${into}`).toBeCloseTo(0.5 * liftAt('reading', into, 1), 9)
      expect([again, ink], `${into}`).toEqual([g, 1])
      expect(g, `${into}`).toBeGreaterThan(was)
      was = g
    }
    // After a cover, the cover's whole glow going down to it, never under it.
    const cov = plan({ 'challenge.cover': 1 })
    was = 1
    for (let into = 0; into <= RISEN + 0.2; into += 0.05) {
      const [g] = masts(cov, rd.start + into)
      expect(g, `${into}`).toBeLessThanOrEqual(was)
      expect(g, `${into}`).toBeGreaterThanOrEqual(0.5)
      was = g
    }
    expect(was).toBe(0.5)
    // At dawn and dusk too; at night the sky needs none.
    for (const hour of ['dawn', 'dusk']) expect(masts(plan({}, { hour }), rd.start + 30), hour).toEqual([0.5, 0.5, 1])
    for (const season of ['winter', 'hanabi']) for (const t of later) expect(masts(plan({}, { hour: 'night', season }), t), `${season} ${t}`).toEqual([1])
    // Over a print left down, none: the lift off, the long view, a photo; nor over the scroll's paper.
    for (const t of later) {
      expect(masts(plan({ 'challenge.lift': 0 }), t), `${t}`).toEqual([1])
      expect(masts(plan({}, { scenery: 'wide' }), t), `${t}`).toEqual([1])
      expect(masts(plan({}, { photo: 'carousel/mine.jpg' }), t), `${t}`).toEqual([1])
    }
    const scroll = challengePlan(bank, 'n5-12', { style: 'scroll', tune: { 'challenge.lift': 1 } })
    const stl = challengeTimeline(scroll)
    expect(raisedGlow(scroll, lookOf(scroll), 'reading', 30)).toBe(0)
    for (const s of stl.segs.filter(x => x.key !== 'hook')) expect(masts(scroll, s.start + s.dur / 2), s.key).toEqual([1])
  }))

  it('lets the scroll’s text and its counter wait for the paper after a cover, as they always came without one', () => withPath2D(() => {
    const plan = cover => challengePlan(bank, 'n4-01', { style: 'scroll', tune: { 'challenge.cover': cover } })
    const start = challengeTimeline(plan(0)).segs.find(s => s.key === 'reading').start
    const seen = (cover, t) => {
      const at = draw(plan(cover), start + t)
      // A counter not drawn at all is none of it.
      return { text: Math.max(0, ...at.filter(x => jp(x.t)).map(x => x.alpha)), counter: at.find(x => / \/ \d+$/.test(x.t))?.alpha ?? 0 }
    }
    // Without a cover: the text fading in from the reading's first frame, its counter there whole.
    expect(seen(0, 0.3).text).toBeGreaterThan(0.8)
    expect(seen(0, 0.3).counter).toBe(1)
    // After one: nothing until the wash has begun to come in, then both, whole by a second.
    for (const t of [0.05, 0.3, 0.34]) expect(seen(1, t), `${t}`).toEqual({ text: 0, counter: 0 })
    expect(seen(1, 0.5).text).toBeGreaterThan(0.3)
    expect(seen(1, 0.5).counter).toBe(seen(1, 0.5).text)
    expect(seen(1, 0.35 + 0.6)).toEqual({ text: 1, counter: 1 })
    expect(seen(1, CH.into + 3)).toEqual({ text: 1, counter: 1 })
  }))

  it('draws the masthead once a frame while the wash lies whole over the print', () => withPath2D(() => {
    for (const style of ['scroll', 'along']) {
      const pl = challengePlan(bank, 'n5-12', { style, tune: { 'challenge.cover': 0, 'challenge.read': 1, 'challenge.along': 1 } })
      const tl = challengeTimeline(pl)
      for (const s of tl.segs) {
        const at = draw(pl, s.start + s.dur / 2).filter(x => x.t === 'TSUJI')
        expect(at, `${style} ${s.key}`).toHaveLength(1)
        expect(at[0].alpha, `${style} ${s.key}`).toBe(1)
      }
    }
  }))

  it('stands the masthead on a glow as strong as the wash still to come, and leaves it to the cover under the cover', () => withPath2D(() => {
    const masts = (pl, t) => draw(pl, t).filter(x => x.t === 'TSUJI').map(x => x.alpha)
    try {
      for (const style of ['scroll', 'along']) {
        const pl = challengePlan(bank, 'n5-12', { style, tune: { 'challenge.cover': 1 } })
        const reading = challengeTimeline(pl).segs.find(s => s.key === 'reading')
        // The wash coming in after the cover: the masthead as the cover
        // stands it (cover.js, glowMasthead), in either style: its glow's two
        // shapes as strong as the wash still to come, then its ink once, whole.
        seam.laid = 0.25
        expect(masts(pl, reading.start + 0.2), style).toEqual([0.75, 0.75, 1])
        seam.laid = 1
        expect(masts(pl, reading.start + 2), style).toEqual([1])
        // Under the cover none of it is laid: the cover stands the masthead on
        // its own paper (cover.js), and the hook's own under it is plain.
        seam.laid = 0
        seam.cover = false
        expect(masts(pl, 1.6), style).toEqual([1])
        seam.cover = true
      }
    } finally {
      seam.laid = null
      seam.cover = true
    }
  }))

  it('keeps the masthead in one ink across the cut: the paper’s on paper, the read-along’s light on night from the cover’s first frame', () => withPath2D(() => {
    // Each style's ink and the colour of the rim round it, the cover's and the reading's alike.
    const looks = { scroll: [PAPER.ink, [246, 241, 228]], along: ['#f3ecdf', [12, 10, 22]] }
    for (const [style, [ink, rim]] of Object.entries(looks)) {
      const pl = challengePlan(bank, 'n5-12', { style, tune: { 'challenge.cover': 1 } })
      const tl = challengeTimeline(pl)
      const cut = tl.segs.find(s => s.key === 'reading').start
      const seen = t => {
        const r = traced()
        drawChallenge(r.ctx, pl, tl, t, null)
        return { mast: r.texts.filter(x => x.t === 'TSUJI'), rings: r.rings.filter(x => x.of === 'TSUJI') }
      }
      let was = Infinity
      // Under the cover, at its last frame, and as the cover is cut away.
      for (const t of [0, 1.6, cut - 1 / 60, cut, cut + 1 / 30, cut + 0.1, cut + 0.3, cut + 0.6]) {
        const { mast, rings } = seen(t)
        const where = `${style} ${t.toFixed(3)}`
        // Its ink laid last, whole, and never another: no colour changes at the cut.
        expect(mast.at(-1), where).toMatchObject({ ink, alpha: 1 })
        // On its rim, its three rings in the rim's colour, as strong as the
        // paper (or the dark) still to come: never stronger than a frame before.
        expect(rings.map(x => x.w), where).toEqual([4, 7, 10])
        for (const x of rings) expect(rgbaOf(x.ink).slice(0, 3), where).toEqual(rim)
        const strength = rgbaOf(rings[0].ink)[3]
        expect(strength, where).toBeGreaterThan(0)
        expect(strength, where).toBeLessThanOrEqual(was)
        was = strength
      }
      // Once the wash is laid, the masthead as it stands, in the same ink, on no rim.
      const after = seen(cut + 2)
      expect(after.rings, style).toEqual([])
      expect(after.mast, style).toEqual([expect.objectContaining({ ink, alpha: 1 })])
    }
  }))
})
