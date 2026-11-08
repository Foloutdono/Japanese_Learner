// The reading challenge's words over the print (plan 309,
// frontend/carousel/challenge.js): the paper look's inks, the read-along's
// panel, its credit and its hook, and the scroll's text after a cover.
// Every dial is named as it is read, never left to its default, which
// plan 309 moves last (tune.js).
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, SP, alpha, palette } from '../carousel/draw.js'
import { PRINT_HOURS, printOf } from '../carousel/app.js'
import { backdrop, discAt, discDrawn, liftAt } from '../carousel/backdrop.js'
import { CH, CTA, CUT, FADED, RISEN, alongBox, alongLayout, alongPanel, bandOf, challengePlan, challengeTimeline, chipShown, cutOf, drawChallenge, hookBand, hookWords, inksOf, lookOf, raisedGlow } from '../carousel/challenge.js'
import { coverBox, drawSlip } from '../carousel/cover.js'
import { PRINTS_REV, SCENERIES, sceneryOf } from '../carousel/sceneries.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'
import { BEFORE_309 } from '../carousel/tune.js'

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
const draw = (plan, t, P = null) => {
  const { ctx, at } = drawn()
  drawChallenge(ctx, plan, challengeTimeline(plan), t, P)
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
/** drawn(), keeping every linear gradient made (its line, its stops),
 *  every rectangle filled, in what, and every circle and rounded box
 *  drawn, where on the frame. */
function painted() {
  const { ctx: base, at } = drawn()
  const grads = []
  const rects = []
  const arcs = []
  const boxes = []
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
      if (k === 'arc') return (x, y, r) => arcs.push({ x: o.tx + o.sx * x, y: o.ty + o.sy * y, r: r * o.sy })
      if (k === 'roundRect') return (x, y, w, h) => boxes.push({ x: o.tx + o.sx * x, y: o.ty + o.sy * y, w: w * o.sx, h: h * o.sy })
      return o[k]
    },
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, grads, rects, arcs, boxes }
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
const metaOf = id => JSON.parse(read(`carousel/prints/${PRINTS_REV}/${id}/meta.json`))
/** The print `name` of a scenery, as loadPrint gives it (a carousel scenery's beside its meta). */
const standIn = (scenery, name) => printFor(scenery, name, sceneryOf(scenery).source === 'carousel' ? metaOf(scenery) : null)
/** What a plan stands on, as the render loads it: its scenery's print of
 *  its season at its hour (winter's where the season is the date's), or
 *  the maker's photo. */
const printUnder = plan => (plan.photo ? { photo: { width: 1080, height: 1920 }, look: plan.photo.look } : standIn(plan.scenery, printOf(plan.season ?? 'winter', plan.hour)))
// What lays ink on a frame, as against what only asks it (a measure, a save).
const INKS = new Set(['fillText', 'strokeText', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'drawImage'])
/** drawn(), keeping every call that lays ink, in order, with what it is
 *  drawn in (its fill, stroke, strength, face and place): the stub's
 *  pixels, two frames alike only where every one of them is. */
function recorded() {
  const { ctx: base, at } = drawn()
  const calls = []
  const round = v => (typeof v === 'number' ? +v.toFixed(4) : typeof v === 'string' ? v : typeof v)
  const ctx = new Proxy(base, {
    get: (o, k) => {
      const v = o[k]
      if (typeof v !== 'function' || !INKS.has(k)) return v
      return (...args) => {
        // A face draws only text: what a measure left set is no ink of a shape's.
        calls.push({ op: k, args: args.map(round), fill: round(o.fillStyle), stroke: round(o.strokeStyle), alpha: o.globalAlpha, font: /Text$/.test(k) ? o.font : null, at: [o.tx, o.ty] })
        return v(...args)
      }
    },
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, calls }
}
/** Whether a text drawn on a frame is the slip's (cover.js, drawSlip): one
 *  of the words it lays, where it lays them, for the plan's hook words. */
function slipOf(plan) {
  const { ctx, at } = drawn()
  drawSlip(ctx, hookWords(plan, challengeTimeline(plan)))
  const keys = new Set(at.map(x => `${x.t}|${x.left.toFixed(3)}|${x.y.toFixed(3)}`))
  return x => keys.has(`${x.t}|${x.left.toFixed(3)}|${x.y.toFixed(3)}`)
}
/** drawn(), keeping every shape filled and in what (a panel, a chip). */
function filled() {
  const { ctx: base, at } = drawn()
  const fills = []
  const ctx = new Proxy(base, {
    get: (o, k) => (k === 'fill' ? () => fills.push(o.fillStyle) : o[k]),
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, fills }
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
    // The print drawn, by its name (app.loadPrint's).
    const named = name => ({ name })
    // Off, it is the one darkness it always was, at every hour.
    for (const hour of PRINT_HOURS) for (const season of seasons) {
      expect(alongPanel(plan(0, { hour, season })), `${season} ${hour}`).toBe(0.62)
      expect(alongPanel(plan(0, { hour, season }), named(`${season || 'spring'}-${hour}`)), `${season} ${hour}`).toBe(0.62)
    }
    // On, set by the hour, August's fireworks as dark as dawn: by the season asked, or by the print drawn.
    const ON = { dawn: 0.74, day: 0.76, dusk: 0.7, night: 0.72 }
    for (const hour of PRINT_HOURS) for (const season of seasons.filter(s => s !== 'hanabi')) {
      expect(alongPanel(plan(1, { hour, season })), `${season} ${hour}`).toBe(ON[hour])
      expect(alongPanel(plan(1, { hour, season }), named(`summer-${hour}`)), `${season} ${hour}`).toBe(ON[hour])
    }
    expect(alongPanel(plan(1, { hour: 'night', season: 'hanabi' }))).toBe(0.74)
    expect(alongPanel(plan(1, { hour: 'night' }), named('summer-hanabi'))).toBe(0.74)
    // The date's B print, with no season asked, as its A print.
    expect(alongPanel(plan(1, { hour: 'night' }), named('summer-hanabi-b'))).toBe(0.74)
    expect(alongPanel(plan(1, { hour: 'night' }), named('summer-night-b'))).toBe(ON.night)
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
            // The sentence said, every word of it, at the title's size at
            // least; one the panel cannot hold whole there smaller, as a
            // whole, never under the body's size (n4-21's fourth, nine lines
            // at the title's size since the analyser reads 十一時 as one
            // word: main's c1214cb35, plan 266).
            const L = alongLayout(ctx, pl, line.i)
            if (L.size < FS.title - 0.5) {
              expect(alongLayout(ctx, pl, line.i, { fit: false }).h, where).toBeGreaterThan(B.foot - B.top - SP[5] * 1.5)
              expect(L.size, where).toBeGreaterThanOrEqual(FS.body)
            }
            const words = at.filter(x => x.size >= Math.min(FS.title, L.size) - 0.5 && x.alpha > 0.99)
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

  it('sets a sentence the panel cannot hold whole at the title’s size smaller, as a whole, rather than leave the panel empty while it is said', () => withPath2D(() => {
    // Seventy-two words of one kanji under its reading: nine lines at the
    // title's size, more than the panel holds from under its top down into
    // its foot. Drawn only where it stood whole on the panel, it was never
    // drawn at all, and the voice read it over an empty panel (n4-21's
    // fourth sentence once the analyser read 十一時 as one word, plan 266).
    const yoru = { t: '夜', k: 'word', ro: 'yoru', fu: [['夜', 'よる']] }
    const long = [...Array(72).fill(yoru), { t: '。', k: 'punct' }]
    const base = challengePlan(bank, 'n4-01', { style: 'along' })
    const plan = along => ({ ...base, id: `nine-lines-${along}`, tune: { 'challenge.along': along }, sents: [base.sents[0], long, base.sents[1]] })
    const { ctx } = drawn()
    for (const along of [0, 1]) {
      const pl = plan(along)
      const box = alongBox(pl)
      const room = box.foot - box.top - SP[5] * 1.5
      // Taller than the panel at the title's size; set as large as the
      // panel holds it, never under the body's size. The sentences either
      // side keep their sizes.
      expect(alongLayout(ctx, pl, 1, { fit: false }).h).toBeGreaterThan(room)
      const L = alongLayout(ctx, pl, 1)
      expect(L.h).toBeLessThanOrEqual(room)
      expect(L.size).toBeLessThan(FS.title)
      expect(L.size).toBeGreaterThanOrEqual(FS.body)
      for (const i of [0, 2]) expect(alongLayout(ctx, pl, i).size, `sentence ${i + 1}`).toBeGreaterThanOrEqual(FS.title)
      // Said: whole, at that size, on the panel; the credit giving way to it
      // only where it is too tall for the room above the credit (the dial on).
      const at = draw(pl, challengeTimeline(pl).lines[1].voice + 0.2)
      const words = at.filter(x => x.size >= L.size - 0.5 && x.alpha > 0.99)
      expect(words.map(x => x.t).join(''), `along ${along}`).toContain(long.map(r => r.t).join(''))
      // (The sentence before it, turned from, is drawn above the panel's
      // clip on its way out: only the one said is measured.)
      const its = words.filter(x => x.t === '夜')
      expect(its).toHaveLength(72)
      for (const x of its) expect(x.size).toBeCloseTo(L.size, 6)
      expect(Math.min(...its.map(x => x.y - x.size * 0.72))).toBeGreaterThan(box.top)
      expect(Math.max(...its.map(x => x.y + x.size * 0.12))).toBeLessThan(box.foot - SP[5] * 0.5)
      const credit = at.find(x => /VOICEVOX Nemo/.test(x.t))
      const tall = box.top + SP[5] + L.h > box.text - SP[5] * 0.5
      expect(credit.alpha, `along ${along}`).toBe(along && tall ? 0 : 1)
    }
  }))

  it('lights each word read along as it is said whichever plan of the text draws it: two plans alike, one frame (plan 247)', () => withPath2D(() => {
    // The studio makes a plan per setting, each with rows of its own
    // (common.js, unpack), and a sentence is laid out once, for the plan
    // drawn first: a word is found by its place in its sentence, never by
    // the row the layout kept, which a later plan does not hold.
    const make = () => challengePlan(bank, 'n5-12', { style: 'along', tune: BEFORE_309 })
    const first = make()
    const tl = challengeTimeline(first)
    const GOLD = '#e6bd62'
    for (const i of [0, 2, 5]) {
      const line = tl.lines[i]
      // Halfway through the sentence: some of its words said, one being said, the rest to come.
      const t = line.voice + line.dur / 2
      const frameOf = pl => {
        const r = recorded()
        drawChallenge(r.ctx, pl, tl, t, null)
        return r
      }
      const a = frameOf(first)
      const b = frameOf(make())
      expect(b.calls, `sentence ${i + 1}`).toEqual(a.calls)
      for (const [name, r] of [['first', a], ['second', b]]) {
        const where = `sentence ${i + 1}, the ${name} plan`
        // One word underlined, the one being said; words said in gold, the rest still light.
        const rule = r.calls.filter(c => c.op === 'fill' && !c.args.length && c.fill === GOLD)
        expect(rule, where).toHaveLength(1)
        const inks = r.calls.filter(c => c.op === 'fillText' && jp(c.args[0])).map(c => c.fill)
        expect(inks, where).toContain(GOLD)
        expect(inks, where).toContain('#f3ecdf')
      }
    }
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
    // Over the bay's winter day, as the render loads it (its sun drawn with the dial on).
    const day = standIn('bay', 'winter-day')
    const band = tune => {
      const pl = challengePlan(bank, 'n5-12', { style: 'along', tune: { 'challenge.along': 1, 'challenge.cover': 0, ...tune } })
      const r = painted()
      drawChallenge(r.ctx, pl, challengeTimeline(pl), 1.6, day)
      // The backdrop darkens from the frame's top, and the print's sky is
      // laid from it; the band is the gradient laid lower.
      const laid = r.rects.filter(x => r.grads.includes(x.style) && x.r[1] > 0)
      expect(laid, JSON.stringify(tune)).toHaveLength(1)
      return { ...laid[0], at: bandOf(pl, day) }
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
    const dial = { 'challenge.along': 1, 'challenge.cover': 0, 'challenge.disc': 1 }
    const lowered = extra => {
      const pl = challengePlan(bank, 'n5-12', { style: 'along', tune: dial, ...extra })
      return bandOf(pl, printUnder(pl))
    }
    for (const view of SCENERIES.filter(s => s.source === 'carousel')) {
      const { frame } = metaOf(view.id)
      const foot = ((frame.cy + frame.disc) * FORMATS.story.w) / frame.w
      const { y0, top } = lowered({ scenery: view.id })
      expect(top, view.id).toBe(615)
      expect(foot, view.id).toBeLessThanOrEqual(y0)
      expect(y0 - foot, view.id).toBeLessThan(5)
    }
    // Only where one is drawn (backdrop.js, discDrawn): never on the long
    // view, August's night or the bay's spring night, whose band stands
    // where it always did, read off the print drawn (its B print as its A);
    // nor over a photo, or where no print is drawn at all.
    for (const extra of [{ scenery: 'wide' }, { hour: 'night', season: 'hanabi' }, { scenery: 'torii', hour: 'night', season: 'hanabi' }, { hour: 'night', season: 'spring' }]) {
      expect(lowered(extra), JSON.stringify(extra)).toMatchObject({ top: 540, y0: 410 })
    }
    const dated = challengePlan(bank, 'n5-12', { style: 'along', hour: 'night', tune: dial })
    for (const name of ['summer-hanabi', 'summer-hanabi-b', 'spring-night']) expect(bandOf(dated, standIn('bay', name)).top, name).toBe(540)
    for (const name of ['summer-night', 'summer-night-b', 'autumn-night']) expect(bandOf(dated, standIn('bay', name)).top, name).toBe(615)
    expect(lowered({ scenery: 'river', hour: 'night', season: 'spring' }).top).toBe(615)
    expect(bandOf(dated).top).toBe(540)
    expect(bandOf(dated, printUnder({ photo: { look: 'dark' } })).top).toBe(540)
  }))

  it('holds the reading’s chip while the sun or moon rises past it or fades from under it, the cover on or off, in either style (plan 309)', () => withPath2D(() => {
    // The lift is whole RISEN seconds into the reading, as backdrop.js's
    // liftAt reads it; a disc left down is gone FADED seconds in, as its
    // discAt reads it, before the lift would be whole.
    expect(liftAt('reading', RISEN, 1)).toBe(1)
    expect(liftAt('reading', RISEN - 0.01, 1)).toBeLessThan(1)
    expect(discAt('reading', FADED, false)).toBe(0)
    expect(discAt('reading', FADED - 0.01, false)).toBeGreaterThan(0)
    expect(FADED).toBeLessThan(RISEN)
    for (const style of ['scroll', 'along']) {
      // The counter `into` seconds into the reading, over the print the plan stands on (printUnder).
      const counter = (tune, into, extra = {}) => {
        const pl = challengePlan(bank, 'n5-12', { style, tune, ...extra })
        const tl = challengeTimeline(pl)
        const at = draw(pl, tl.segs.find(s => s.key === 'reading').start + into, printUnder(pl))
        return at.find(x => / \/ \d+$/.test(x.t))?.alpha ?? 0
      }
      for (const cover of [1, 0]) {
        for (const lift of [1, 0]) {
          const tune = { 'challenge.disc': 1, 'challenge.lift': lift, 'challenge.cover': cover }
          const where = `${style} cover ${cover} lift ${lift}`
          // Held while the disc rises through its place (the print raised)
          // or fades out from under it (left down), then in over 0.3 s.
          const clear = lift ? RISEN : FADED
          for (const into of [0, 0.3, 0.6, 1, 1.3, clear - 0.01].filter(x => x < clear)) expect(counter(tune, into), `${where} ${into}`).toBe(0)
          expect(counter(tune, clear + 0.1), where).toBeGreaterThan(0)
          expect(counter(tune, clear + 0.1), where).toBeLessThan(1)
          for (const into of [clear + 0.3, clear + 3]) expect(counter(tune, into), `${where} ${into}`).toBe(1)
          // The same over a carousel scenery with a moon of its own, at night.
          expect(counter(tune, 0.5, { scenery: 'river', hour: 'night', season: 'spring' }), where).toBe(0)
          // Where no disc is drawn it comes as it always did: the long view
          // (never raised, no disc), August's night (its fireworks and no
          // moon), the bay's spring night (its own hazy moon), a photo, and
          // no print at all.
          const none = [
            { scenery: 'wide' }, { hour: 'night', season: 'hanabi' }, { scenery: 'river', hour: 'night', season: 'hanabi' },
            { hour: 'night', season: 'spring' }, { photo: 'carousel/mine.jpg' },
          ]
          for (const extra of none) {
            const pl = challengePlan(bank, 'n5-12', { style, tune, ...extra })
            expect(chipShown(pl, 0.5, printUnder(pl)), `${where} ${JSON.stringify(extra)}`).toBe(1)
            if (!(cover && style === 'scroll')) expect(counter(tune, 0.5, extra), `${where} ${JSON.stringify(extra)}`).toBe(1)
          }
          expect(chipShown(challengePlan(bank, 'n5-12', { style, tune }), 0.5, null), where).toBe(1)
          // Read off the print drawn, the season the date's: its B print as its A.
          const dated = challengePlan(bank, 'n5-12', { style, tune, hour: 'night' })
          for (const name of ['summer-hanabi', 'summer-hanabi-b', 'spring-night']) expect(chipShown(dated, 0.5, standIn('bay', name)), `${where} ${name}`).toBe(1)
          for (const name of ['summer-night', 'summer-night-b', 'winter-night']) expect(chipShown(dated, 0.5, standIn('bay', name)), `${where} ${name}`).toBe(0)
        }
        // No disc: it comes as it always did, the print raised or not.
        for (const lift of [1, 0]) {
          const tune = { 'challenge.disc': 0, 'challenge.lift': lift, 'challenge.cover': cover }
          const where = `${style} cover ${cover} lift ${lift}, no disc`
          const pl = challengePlan(bank, 'n5-12', { style, tune })
          expect(chipShown(pl, 0.5, printUnder(pl)), where).toBe(1)
          expect(counter(tune, 1), where).toBe(1)
          if (!cover) expect(counter(tune, 0), where).toBe(1)
        }
      }
    }
  }))

  it('stands the read-along’s foot on a night of its own, eased in long and out longer, the way to the app’s rail on it with its stops’ names; the track firmer, the question and the way to the app darker; none of it over a photo (plan 309)', () => withPath2D(() => {
    // The countdown and its line, the hidden answer's two lines and the
    // stops on the way to the app stand where the print's darkening has
    // run out (1.0:1 over the snow, today's look as much as the new).
    const plan = along => challengePlan(bank, 'n5-12', { style: 'along', tune: { ...BEFORE_309, 'challenge.along': along } })
    const tl = challengeTimeline(plan(1))
    const seg = k => tl.segs.find(s => s.key === k)
    // Each moment, and the words that stand at its foot then.
    const moments = [
      ['question', seg('question').start + 2.5, x => /^\d$/.test(x.t) || x.t === 'Answer in the comments'],
      ['answer', seg('answer').start + 2, x => /^A, B, C or D\?$|^Write your answer/.test(x.t)],
      ['cta', seg('cta').start + 3, x => /^(Read|\d+ questions|Breakdown)$/.test(x.t)],
    ]
    for (const [name, t, foot] of moments) {
      for (const along of [1, 0]) {
        const pl = plan(along)
        const r = painted()
        drawChallenge(r.ctx, pl, tl, t, null)
        const where = `${name} along ${along}`
        // The gradients laid below the backdrop's own (that one from the frame's top).
        const bands = r.rects.filter(x => r.grads.includes(x.style) && x.r[1] > 0)
        // The backdrop's darkening: the question's as dark as the way to the
        // app's was (0.62), the way to the app's a little darker (0.68).
        const dark = r.grads.find(g => g.line[1] === 0 && g.line[3] > 1000)
        expect(rgbaOf(dark.stops[0][1])[3], where).toBe(along ? (name === 'cta' ? 0.68 : 0.62) : (name === 'cta' ? 0.62 : 0.5))
        if (!along) {
          expect(bands, where).toEqual([])
          continue
        }
        expect(bands, where).toHaveLength(1)
        const [{ r: [x, top, w, h], style }] = bands
        // Across the frame, its night the day's panel's, none at either end.
        expect([x, w], where).toEqual([0, FORMATS.story.w])
        expect(style.line, where).toEqual([0, top, 0, top + h])
        const stops = [...style.stops].sort((p, q) => p[0] - q[0]).map(([s, c]) => [s, ...rgbaOf(c)])
        for (const [, R, G, B] of stops) expect([R, G, B], where).toEqual([12, 10, 22])
        expect([stops[0][4], stops.at(-1)[4]], where).toEqual([0, 0])
        expect(Math.max(...stops.map(s => s[4])), where).toBe(0.76)
        // Whole from 150 px under its top to 220 px over its foot, eased either way.
        const whole = stops.filter(s => s[4] === 0.76)
        expect(whole[0][0] * h, where).toBeCloseTo(150, 6)
        expect((1 - whole.at(-1)[0]) * h, where).toBeCloseTo(220, 6)
        const up = stops.filter(s => s[0] <= whole[0][0]).map(s => s[4])
        expect(up, where).toEqual([...up].sort((p, q) => p - q))
        expect(up, where).toHaveLength(9)
        // What stands at the foot, every word of it on the whole night.
        const words = r.at.filter(foot)
        expect(words.length, where).toBeGreaterThanOrEqual(name === 'cta' ? 3 : 2)
        for (const x of words) {
          expect(x.y - x.size * 0.85, `${where} ${x.t}`).toBeGreaterThanOrEqual(top + 150)
          expect(x.y + x.size * 0.25, `${where} ${x.t}`).toBeLessThanOrEqual(top + h - 220)
        }
        if (name !== 'cta') continue
        // The way to the app's rail above its stops' names, on the whole
        // night too: its three stops' dots, ringed 6 px wide, the reader's
        // dot and the line between them, not only the names under them.
        const dots = r.arcs.filter(a => a.r === 17)
        expect(dots, where).toHaveLength(3)
        const cy = dots[0].y
        for (const d of dots) expect(d.y, where).toBe(cy)
        expect(r.arcs.filter(a => a.r === 9).map(a => a.y), where).toEqual([cy])
        const line = r.boxes.filter(b => b.h === 10 && Math.abs(b.y + 5 - cy) < 1e-9)
        expect(line, where).toHaveLength(2)
        for (const [y0, y1] of [[cy - 17 - 3, cy + 17 + 3], ...line.map(b => [b.y, b.y + b.h])]) {
          expect(y0, where).toBeGreaterThanOrEqual(top + 150)
          expect(y1, where).toBeLessThanOrEqual(top + h - 220)
        }
      }
    }
    // The countdown's track: light at 30% on its night, 22% as it was.
    for (const along of [1, 0]) {
      const r = recorded()
      drawChallenge(r.ctx, plan(along), tl, seg('question').start + 2.5, null)
      const track = r.calls.find(c => c.op === 'stroke' && c.stroke.startsWith('rgba(243,236,223,'))
      expect(rgbaOf(track.stroke)[3], `along ${along}`).toBe(along ? 0.3 : 0.22)
    }
    // The answers' panels as dark as the read-along's panel at the hour, as they were (0.62) off.
    for (const [along, hour, a] of [[1, 'day', 0.76], [1, 'dusk', 0.7], [0, 'day', 0.62]]) {
      const pl = challengePlan(bank, 'n5-12', { style: 'along', hour, tune: { ...BEFORE_309, 'challenge.along': along } })
      const r = filled()
      drawChallenge(r.ctx, pl, tl, seg('question').start + 2.5, null)
      expect(r.fills.filter(f => /^rgba\(16,14,19,/.test(f)), `${along} ${hour}`).toEqual(Array(4).fill(`rgba(16,14,19,${a})`))
    }
    // Over a photo of the maker's own (plan 276), darkened its own way and
    // read in the same light ink, none of it, the dial on: no night at the
    // foot, the photo darkened as it was, the countdown's track as it was.
    for (const look of ['dark', 'blur']) {
      const pl = challengePlan(bank, 'n5-12', { style: 'along', photo: 'carousel/mine.jpg', photoLook: look, tune: { ...BEFORE_309, 'challenge.along': 1 } })
      const P = printUnder(pl)
      expect(P.photo, look).toBeTruthy()
      for (const [name, t] of moments) {
        const r = painted()
        drawChallenge(r.ctx, pl, tl, t, P)
        const where = `${name} over a ${look} photo`
        expect(r.rects.filter(x => r.grads.includes(x.style) && x.r[1] > 0), where).toEqual([])
        const dark = r.grads.find(g => g.line[1] === 0 && g.line[3] > 1000)
        expect(rgbaOf(dark.stops[0][1])[3], where).toBe(name === 'cta' ? 0.62 : 0.5)
      }
      const r = recorded()
      drawChallenge(r.ctx, pl, tl, seg('question').start + 2.5, P)
      const track = r.calls.find(c => c.op === 'stroke' && c.stroke.startsWith('rgba(243,236,223,'))
      expect(rgbaOf(track.stroke)[3], look).toBe(0.22)
    }
  }))

  it('reads what the words stand on off the print drawn, not the plan: the chip, the hook’s band, the panel (plan 309)', () => withPath2D(() => {
    // The date's season, at night: the plan cannot say which print it
    // stands on, only the print drawn can (a moon, August's fireworks,
    // the bay's spring haze).
    const tune = { 'challenge.along': 1, 'challenge.cover': 0, 'challenge.disc': 1, 'challenge.lift': 1 }
    const moon = standIn('bay', 'winter-night')
    const fireworks = ['summer-hanabi', 'summer-hanabi-b'].map(name => standIn('bay', name))
    const haze = standIn('bay', 'spring-night')
    for (const style of ['scroll', 'along']) {
      const pl = challengePlan(bank, 'n5-12', { style, hour: 'night', tune })
      expect(pl.season, style).toBeNull()
      const rd = challengeTimeline(pl).segs.find(s => s.key === 'reading')
      // Half a second into the reading: held under the moon rising, whole where none rises.
      const counter = P => draw(pl, rd.start + 0.5, P).find(x => / \/ \d+$/.test(x.t))?.alpha ?? 0
      expect(counter(moon), style).toBe(0)
      for (const P of [...fireworks, haze]) expect(counter(P), `${style} ${P.name}`).toBe(1)
    }
    const pl = challengePlan(bank, 'n5-12', { style: 'along', hour: 'night', tune })
    const tl = challengeTimeline(pl)
    // The hook's band of night, where it begins: from under the moon, else where it always did.
    const band = P => {
      const r = painted()
      drawChallenge(r.ctx, pl, tl, 1.6, P)
      return r.rects.filter(x => r.grads.includes(x.style) && x.r[1] > 0).map(x => x.style.line[1])
    }
    expect(band(moon)).toEqual([485])
    for (const P of [...fireworks, haze]) expect(band(P), P.name).toEqual([410])
    // The panel: as dark as dawn over August's fireworks, its B print as its A; the night's elsewhere.
    const panel = P => {
      const r = filled()
      drawChallenge(r.ctx, pl, tl, tl.lines[1].voice + 0.2, P)
      return r.fills.filter(f => /^rgba\(16,14,19,0\.7\d\)$/.test(f))
    }
    for (const P of fireworks) expect(panel(P), P.name).toEqual(['rgba(16,14,19,0.74)'])
    for (const P of [moon, haze]) expect(panel(P), P.name).toEqual(['rgba(16,14,19,0.72)'])
  }))

  it('holds the chip for the print drawn, not the scenery asked: the bay standing in for the long view, its moon rising (plan 309)', () => withPath2D(() => {
    // Where a scenery's prints fail the studio stands the bay in (app.js,
    // standInOpts): the plan still says the long view, never raised and
    // with no disc of its own, but the print drawn is the bay's, raised
    // by its own scenery (backdrop.js) and its moon rising through the
    // chip's place. The chip waits for it as over the bay asked.
    const moon = standIn('bay', 'winter-night')
    const tune = { ...BEFORE_309, 'challenge.disc': 1, 'challenge.lift': 1 }
    for (const style of ['scroll', 'along']) {
      const wide = challengePlan(bank, 'n5-12', { style, hour: 'night', season: 'winter', scenery: 'wide', tune })
      const bay = challengePlan(bank, 'n5-12', { style, hour: 'night', season: 'winter', tune })
      expect(wide.scenery, style).toBe('wide')
      expect(chipShown(wide, 1, moon), style).toBe(0)
      for (const into of [0, 0.5, 1, 1.5, RISEN + 0.1, RISEN + 0.3]) expect(chipShown(wide, into, moon), `${style} ${into}`).toBe(chipShown(bay, into, moon))
      expect(chipShown(wide, RISEN + 0.31, moon), style).toBe(1)
      // Drawn so: no counter a second into the reading.
      const rd = challengeTimeline(wide).segs.find(s => s.key === 'reading')
      expect(draw(wide, rd.start + 1, moon).find(x => / \/ \d+$/.test(x.t))?.alpha ?? 0, style).toBe(0)
    }
  }))

  it('draws the sun or moon by backdrop.js’s one rule, the answer the words read, on every print of every scenery', () => withCanvases(() => {
    // Every print a challenge may stand on, as loadPrint gives it.
    const prints = []
    for (const name of Object.keys(META.prints)) {
      prints.push(printFor('bay', name))
      prints.push(printFor('wide', name))
    }
    const own = SCENERIES.filter(s => s.source === 'carousel').map(s => s.id)
    for (const id of own) {
      const meta = metaOf(id)
      for (const name of Object.keys(meta.prints)) prints.push(printFor(id, name, meta))
    }
    expect(prints.length).toBe(22 * 2 + 17 * 4)
    let drawnSome = 0
    const none = []
    for (const P of prints) {
      const { hour } = P
      for (const tune of [{ ...BEFORE_309, 'challenge.disc': 1 }, { ...BEFORE_309, 'challenge.disc': 0 }]) {
        const plan = challengePlan(bank, 'n5-12', { style: 'scroll', hour, scenery: P.scenery, tune })
        const tl = challengeTimeline(plan)
        // Under the hook, where the sun or moon always shows when it is drawn:
        // the print laid whole, or under it, the disc, (the train,) over it.
        const r = recorder()
        backdrop(r.ctx, P, lookOf(plan), { dark: 0.5, hour, wash: 1, plan, tl, t: 1.6, seg: 'hook', cover: false })
        const laid = r.calls.filter(c => c.op === 'drawImage').length
        const sun = laid > 1
        drawnSome += sun
        expect(discDrawn(plan, P), `${P.scenery} ${P.name} ${JSON.stringify(tune)}`).toBe(sun)
        if (tune['challenge.disc'] && !sun) none.push(`${P.scenery} ${P.name}`)
      }
      // Never over a photo, nor where no print is drawn.
      const plan = challengePlan(bank, 'n5-12', { scenery: P.scenery, tune: { 'challenge.disc': 1 } })
      expect(discDrawn(plan, null)).toBe(false)
      expect(discDrawn(plan, { photo: {}, look: 'dark' })).toBe(false)
    }
    // Most prints have one: every phone print but August's nights and the
    // bay's spring night (its own hazy moon); the long view none.
    expect(drawnSome).toBe(22 - 3 + (17 - 1) * 4)
    const wide = Object.keys(META.prints).map(name => `wide ${name}`)
    expect(none.sort()).toEqual(['bay spring-night', 'bay summer-hanabi', 'bay summer-hanabi-b', ...own.map(id => `${id} summer-hanabi`), ...wide].sort())
  }))

  it('keeps half the masthead’s glow read along over the print raised, by day, come in with the lift; at night the whole glow while it rises; none over a print left down', () => withPath2D(() => {
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
    // At dawn and dusk too; at night the sky needs none once raised, but
    // while it rises its stars pass behind the masthead: the whole glow
    // then, in and out with the rise.
    for (const hour of ['dawn', 'dusk']) expect(masts(plan({}, { hour }), rd.start + 30), hour).toEqual([0.5, 0.5, 1])
    for (const season of ['winter', 'hanabi']) {
      const night = plan({}, { hour: 'night', season })
      for (const t of later) expect(masts(night, t), `${season} ${t}`).toEqual([1])
      expect(masts(night, rd.start + 0.8), season).toEqual([1, 1, 1])
      for (const into of [0.2, 0.5, 1.1, 1.4]) {
        const [g, again, ink] = masts(night, rd.start + into)
        expect(g, `${season} ${into}`).toBeCloseTo(Math.sin(Math.PI * liftAt('reading', into, 1)), 9)
        expect([again, ink], `${season} ${into}`).toEqual([g, 1])
      }
    }
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

  it('keeps the raised masthead’s glow for the print drawn, not the scenery asked: the bay standing in for the long view, the long view for the bay (plan 309)', () => withPath2D(() => {
    // Where a scenery's prints fail the studio stands the bay in (app.js,
    // standInOpts), and where the bay's fail, the last print drawn: the
    // plan still says the scenery asked, but the print drawn is raised, or
    // not, by its own scenery (backdrop.js). The bay standing in for the
    // long view rises, the masthead keeping its glow as over the bay
    // asked; the long view standing in for the bay never rises, and the
    // masthead keeps none. Where no print is drawn, the plan's scenery says.
    const tune = { ...BEFORE_309, 'challenge.along': 1, 'challenge.lift': 1 }
    const masts = (pl, t, P) => draw(pl, t, P).filter(x => x.t === 'TSUJI').map(x => x.alpha)
    for (const hour of ['day', 'night']) {
      const asked = scenery => challengePlan(bank, 'n5-12', { style: 'along', hour, season: 'winter', scenery, tune })
      const wide = asked('wide')
      const bay = asked('bay')
      const T = lookOf(wide)
      const bayPrint = standIn('bay', `winter-${hour}`)
      const widePrint = standIn('wide', `winter-${hour}`)
      const tl = challengeTimeline(wide)
      const seg = k => tl.segs.find(s => s.key === k)
      const moments = [['reading', 0.2], ['reading', 0.8], ['reading', 1.4], ['reading', 30], ['question', 1], ['answer', 1], ['cta', 1]]
      for (const [key, after] of moments) {
        const where = `${hour} ${key} ${after}`
        // The moment as the frame reads it, seconds into its part.
        const t = seg(key).start + after
        const into = t - seg(key).start
        // The bay drawn, raised: its glow as over the bay asked, by the hour (half by day, the rise's at night).
        const glow = raisedGlow(bay, T, key, into, bayPrint)
        expect(glow, where).toBeCloseTo(hour === 'night' ? Math.sin(Math.PI * liftAt(key, into, 1)) : 0.5 * liftAt(key, into, 1), 9)
        expect(raisedGlow(wide, T, key, into, bayPrint), where).toBe(glow)
        // The long view drawn, never raised: none, whatever the plan says.
        expect(raisedGlow(bay, T, key, into, widePrint), where).toBe(0)
        expect(raisedGlow(wide, T, key, into, widePrint), where).toBe(0)
        // No print drawn: the plan's own scenery.
        expect(raisedGlow(bay, T, key, into, null), where).toBe(glow)
        expect(raisedGlow(wide, T, key, into, null), where).toBe(0)
        // Drawn so: the glow's two shapes, then its ink once, whole; no glow, its ink alone.
        expect(masts(wide, t, bayPrint), where).toEqual(glow > 0.001 ? [glow, glow, 1] : [1])
        expect(masts(bay, t, widePrint), where).toEqual([1])
      }
      // In figures: halfway up, a quarter by day (half of half) and the
      // whole glow at night; once raised, half by day and none at night.
      const [g, again, ink] = masts(wide, seg('reading').start + 0.8, bayPrint)
      expect(g, hour).toBeCloseTo(hour === 'day' ? 0.25 : 1, 9)
      expect([again, ink], hour).toEqual([g, 1])
      expect(masts(wide, seg('reading').start + 30, bayPrint), hour).toEqual(hour === 'day' ? [0.5, 0.5, 1] : [1])
    }
  }))

  it('lets the scroll’s text and its counter wait for the paper after a cover, as they always came without one', () => withPath2D(() => {
    const plan = cover => challengePlan(bank, 'n4-01', { style: 'scroll', tune: { ...BEFORE_309, 'challenge.cover': cover } })
    const start = challengeTimeline(plan(0)).segs.find(s => s.key === 'reading').start
    const seen = (cover, t) => {
      const pl = plan(cover)
      const at = draw(pl, start + t)
      // The text's own words, not the slip's leaving over the cut (its title is in Japanese too).
      const slip = slipOf(pl)
      // A counter not drawn at all is none of it.
      return { text: Math.max(0, ...at.filter(x => jp(x.t) && !slip(x)).map(x => x.alpha)), counter: at.find(x => / \/ \d+$/.test(x.t))?.alpha ?? 0 }
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

  it('cross-fades the cut after a cover: words at half their ink or more at every frame, nothing gone or come in a frame, the words only on a ground they read on, the voice’s credit with its panel (plan 309)', () => withPath2D(() => {
    const NEW = { ...BEFORE_309, 'challenge.ruby': 0.9, 'challenge.halo': 1, 'challenge.read': 0.75, 'challenge.cover': 1, 'challenge.lift': 1, 'challenge.disc': 1, 'challenge.night': 1, 'challenge.train': 1, 'challenge.falls': 1, 'challenge.bursts': 1, 'challenge.along': 1 }
    const PANEL = /^rgba\(16,14,19,0\.\d+\)$/
    for (const style of ['scroll', 'along']) {
      for (const [name, tune] of [['the cover alone', { ...BEFORE_309, 'challenge.cover': 1 }], ['every dial', NEW]]) {
        const pl = challengePlan(bank, 'n5-12', { style, tune })
        const tl = challengeTimeline(pl)
        const cut = tl.segs.find(s => s.key === 'reading').start
        const slip = slipOf(pl)
        const box = coverBox(drawn().ctx, pl, hookWords(pl, tl))
        const under = x => x.y > box.y && x.y < box.y + box.h
        const frames = []
        // Every frame at sixty a second from a little before the cut to a second after it.
        for (let f = Math.round((cut - 0.2) * 60); f <= Math.round((cut + 1) * 60); f++) {
          const t = f / 60
          const r = recorded()
          drawChallenge(r.ctx, pl, tl, t, null)
          const texts = r.calls.filter(c => c.op === 'fillText').map((c, i) => ({ ...r.at[i], t: String(c.args[0]) }))
          const slipA = Math.max(0, ...texts.filter(slip).map(x => x.alpha))
          const words = texts.filter(x => jp(x.t) && !slip(x))
          const wordsA = Math.max(0, ...words.map(x => x.alpha))
          // What shows of the reading's words: under the slip, only what it lets through.
          const seen = Math.max(0, ...words.map(x => x.alpha * (style === 'along' && under(x) ? 1 - slipA : 1)))
          const panel = Math.max(0, ...r.calls.filter(c => c.op === 'fill' && !c.args.length && PANEL.test(c.fill)).map(c => c.alpha))
          // The voice's credit, read along (the scroll has none).
          const credit = Math.max(0, ...texts.filter(x => /VOICEVOX Nemo/.test(x.t)).map(x => x.alpha))
          frames.push({ t, into: t - cut, slipA, wordsA, seen, panel, credit })
        }
        const where = x => `${style}, ${name}, ${x.t.toFixed(3)} s (${x.into.toFixed(3)} into)`
        for (const x of frames) {
          // Something to read at every frame: the slip's words, or the reading's, at half their ink or more.
          expect(Math.max(x.slipA, x.seen), where(x)).toBeGreaterThanOrEqual(0.5)
          if (x.into < 0) {
            expect([x.slipA, x.wordsA, x.credit], where(x)).toEqual([1, 0, 0])
            continue
          }
          // The read-along's words only on their panel, all but come; the scroll's once the paper has begun to.
          if (x.wordsA > 0) expect(style === 'along' ? x.panel : x.into, where(x)).toBeGreaterThanOrEqual(style === 'along' ? 0.9 : 0.35)
        }
        // The slip whole at the cut, gone within a second; the reading's words whole by then.
        const at = into => frames.find(x => Math.abs(x.into - into) < 1e-6)
        expect(at(0).slipA, style).toBe(1)
        expect(at(1).slipA, style).toBe(0)
        expect(at(1).wordsA, style).toBe(1)
        expect([at(0).credit, at(1).credit], style).toEqual(style === 'along' ? [0, 1] : [0, 0])
        // Nothing comes or goes in a frame: at thirty a second, no step of a third or more.
        for (let i = 2; i < frames.length; i++) {
          for (const k of ['slipA', 'wordsA', 'panel', 'credit']) expect(Math.abs(frames[i][k] - frames[i - 2][k]), `${where(frames[i])} ${k}`).toBeLessThan(0.34)
        }
        // The cut as cutOf has it: the read-along's credit comes in with its panel, as faint.
        for (const x of frames.filter(f => f.into >= 0)) {
          const c = cutOf(pl, x.into)
          expect(x.slipA, where(x)).toBeCloseTo(c.slip, 9)
          expect(x.wordsA, where(x)).toBeCloseTo(c.words, 9)
          expect(x.credit, where(x)).toBeCloseTo(style === 'along' ? c.page : 0, 9)
        }
      }
      // Without a cover the cut is as it was: no slip in the reading, the scroll's text in from the cut.
      const off = challengePlan(bank, 'n5-12', { style, tune: { ...BEFORE_309, 'challenge.cover': 0 } })
      const tl = challengeTimeline(off)
      expect(cutOf(off, 0.1), style).toBe(null)
      const rd = tl.segs.find(s => s.key === 'reading').start
      const slip = slipOf(off)
      for (const into of [0, 0.1, 0.3]) expect(draw(off, rd + into).filter(slip), `${style} ${into}`).toEqual([])
    }
    // Its beats: the scroll's slip stays while the paper comes, then leaves over half a second; the
    // read-along's is gone, and the sentence whole on its panel, by the time the voice starts.
    expect(CUT).toEqual({ scroll: { stay: 0.3, leave: 0.5 }, along: { panel: 0.15, words: 0.125, come: 0.15, stay: 0.18, leave: 0.2 } })
    const along = challengePlan(bank, 'n5-12', { style: 'along', tune: { ...BEFORE_309, 'challenge.cover': 1 } })
    const voice = challengeTimeline(along).lines[0].voice - challengeTimeline(along).segs.find(s => s.key === 'reading').start
    expect(voice).toBeCloseTo(CH.lead, 9)
    expect(cutOf(along, voice)).toMatchObject({ page: 1, words: 1 })
    expect(cutOf(along, voice).slip).toBeLessThan(0.1)
    expect(cutOf(along, CUT.along.stay + CUT.along.leave)).toEqual({ slip: 0, page: 1, words: 1 })
  }))

  it('draws the masthead once a frame while the wash lies whole over the print', () => withPath2D(() => {
    for (const style of ['scroll', 'along']) {
      const pl = challengePlan(bank, 'n5-12', { style, tune: { ...BEFORE_309, 'challenge.cover': 0, 'challenge.read': 1, 'challenge.along': 1 } })
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
        const pl = challengePlan(bank, 'n5-12', { style, tune: { ...BEFORE_309, 'challenge.cover': 1 } })
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
      const pl = challengePlan(bank, 'n5-12', { style, tune: { ...BEFORE_309, 'challenge.cover': 1 } })
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
