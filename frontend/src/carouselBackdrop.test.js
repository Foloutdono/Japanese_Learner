// ── 下地 — what a reading challenge stands on (plan 309) ──
// frontend/carousel/backdrop.js: the print drawn once and kept, and what
// moves on it said by the moment alone (trainRun, liftAt, panAt, washAt,
// discAt). Each dial of plan 309 stands at what it was until the owner
// has seen it drawn (tune.js, BEFORE_309): there the helpers give the
// look before it, and the frame lays the one print it always laid.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { backdrop, discAt, liftAt, panAt, trainRun, washAt } from '../carousel/backdrop.js'
import { drawPrint, loadFailure, loadPrint, standInOpts, standInSays, standsOnFailure } from '../carousel/app.js'
import { challengePlan, challengePrintOpts, challengeTimeline } from '../carousel/challenge.js'
import { coverOn } from '../carousel/cover.js'
import { palette } from '../carousel/draw.js'
import { BEFORE_309, TUNABLES, tuned } from '../carousel/tune.js'
import { drawn } from './testing/challengeCanvas.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const data = JSON.parse(read('carousel/bank/comprehension.json'))
const meta = JSON.parse(read('src/components/station/print/print.json'))
const SEGS = ['hook', 'reading', 'question', 'answer', 'cta']
// Today's wash, the hour's share of paper over the print (plan 261).
const TODAY = { dawn: 0.72, day: 0.72, dusk: 0.82, night: 0.6 }
const PAPER = { ground: 'paper' }
const DARK = { ground: 'sumi' }
const was = k => BEFORE_309[`challenge.${k}`]

// A context that keeps what it is asked to draw, and how faint, through
// its saves; its gradients and its pixels are there to be asked for.
function recorder() {
  const calls = []
  const state = { globalAlpha: 1, fillStyle: null, filter: 'none', globalCompositeOperation: 'source-over' }
  const stack = []
  const methods = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop() || {}),
    drawImage: (img, ...a) => calls.push({ op: 'drawImage', img, a, alpha: state.globalAlpha, filter: state.filter, gco: state.globalCompositeOperation }),
    fillRect: (...a) => calls.push({ op: 'fillRect', a, fill: state.fillStyle, alpha: state.globalAlpha }),
    clearRect: (...a) => calls.push({ op: 'clearRect', a }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(8) }),
  }
  const ctx = new Proxy(state, { get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true } })
  return { ctx, calls, images: () => calls.filter(c => c.op === 'drawImage') }
}
// Canvases made away from the frame, each its own recorder.
function withCanvases(fn) {
  const had = globalThis.OffscreenCanvas
  const made = []
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { Object.assign(this, { width: w, height: h, r: recorder() }); made.push(this) }
    getContext() { return this.r.ctx }
  }
  try { return fn(made) } finally { globalThis.OffscreenCanvas = had }
}
// Today's print as loadPrint gives it, each picture a name.
function print(name, device = 'phone', scenery = device === 'desk' ? 'wide' : 'bay') {
  const scene = JSON.parse(read(`public/today/print/${meta.rev}/${name}-${device}.json`))
  const img = Object.fromEntries(['sky', 'back', 'train', 'front', 'grain', 'paper'].map(k => [k, { k }]))
  return { hour: name.split('-')[1], name, scenery, scene, frame: meta.frames[device], look: meta.prints[name], img: { ...img, backBare: null, bursts: null } }
}
// Fuji on a desk print: its outline (the clip of its body, lines from its
// foot round its crater and back), and where the mist over its foot
// begins (the top of the mist's gradient), in the print's units.
function fujiOf(scene) {
  const all = Object.values(scene.layers).join('')
  const outline = [...(/<clipPath id="tpr-s5FjClip"><path d="([^"]+)"/.exec(all)[1]).matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => [+m[1], +m[2]])
  return { outline, mist: +/<linearGradient id="tpr-s5FjMist" x1="[^"]*" y1="([^"]+)"/.exec(all)[1] }
}
/** Where Fuji's outline crosses the height `y`: its left flank and its right. */
function flanksAt({ outline }, y) {
  const xs = []
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length]
    if (y0 !== y1 && (y0 - y) * (y1 - y) <= 0) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0))
  })
  return [Math.min(...xs), Math.max(...xs)]
}
// The season's tree on a desk print: the front layer's top-level element
// holding the gust that sways from lowest (the trunk's, from below the
// print's foot; the bushes' from on it).
function treeOf(scene) {
  const front = scene.layers.front
  const parts = []
  let depth = 0
  let start = 0
  for (const m of front.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    if (m[1]) {
      if (--depth === 0) parts.push(front.slice(start, m.index + m[0].length))
    } else if (m[3]) {
      if (depth === 0) parts.push(m[0])
    } else if (depth++ === 0) start = m.index
  }
  const low = s => Math.max(-1, ...[...s.matchAll(/transform-origin: [\d.]+px ([\d.]+)px/g)].map(m => +m[1]))
  return parts.reduce((a, b) => (low(b) > low(a) ? b : a))
}
// The leftmost the tree's outline comes in the rows `y0` to `y1` (print
// units): of every path that reaches into them, each point it passes
// through or is pulled toward (an arc's end widened by its radii), less
// half its widest stroke. Read whole or not at all: a shape, a transform,
// a filter or a command the reading does not know fails it.
const ARITY = { M: 2, L: 2, C: 6, Q: 4, A: 7 }
function leftmostIn(tree, [y0, y1]) {
  expect(tree.match(/<\w+/g).filter(t => t !== '<g' && t !== '<path')).toEqual([])
  expect(tree).not.toMatch(/transform=|filter/)
  const half = Math.max(0, ...[...tree.matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1])) / 2
  let left = Infinity
  for (const [, d] of tree.matchAll(/ d="([^"]*)"/g)) {
    expect(d).toMatch(/^[MLCQAZmlcqaz\d\s.,-]*$/)
    const pts = []
    let at = [0, 0]
    let open = at
    for (const [, cmd, body] of d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
      const up = cmd.toUpperCase()
      if (up === 'Z') {
        at = open
        continue
      }
      const v = body.match(/-?(?:\d+\.?\d*|\.\d+)/g).map(Number)
      for (let i = 0; i < v.length; i += ARITY[up]) {
        const [ox, oy] = cmd === up ? [0, 0] : at
        if (up === 'A') {
          const r = Math.max(Math.abs(v[i]), Math.abs(v[i + 1]))
          at = [v[i + 5] + ox, v[i + 6] + oy]
          pts.push([at[0] - r, at[1] - r], [at[0] + r, at[1] + r])
          continue
        }
        for (let j = i; j < i + ARITY[up]; j += 2) pts.push([v[j] + ox, v[j + 1] + oy])
        at = pts.at(-1)
        if (up === 'M' && i === 0) open = at
      }
    }
    const ys = pts.map(([, y]) => y)
    if (Math.min(...ys) - half < y1 && Math.max(...ys) + half > y0) left = Math.min(left, ...pts.map(([x]) => x - half))
  }
  return left
}
// A challenge's frame of the backdrop, as its segment asks for it (challenge.js).
function at(P, T, plan, tl, t) {
  const s = tl.segs.find(x => t < x.start + x.dur) ?? tl.segs.at(-1)
  const r = recorder()
  const out = backdrop(r.ctx, P, T, { dark: 0.5, hour: plan.hour, wash: tuned(plan.tune, 'challenge.wash'), plan, tl, t, seg: s.key, cover: s.key === 'hook' && coverOn(plan) })
  return { ...r, ...out, seg: s.key }
}
const planOf = (tune, opts = {}) => challengePlan(data, 'n5-12', { lang: 'en', style: 'scroll', hour: 'day', season: 'winter', question: 8, tune, ...opts })
const reading = tl => tl.segs.find(s => s.key === 'reading')

describe('what a reading challenge stands on (plan 309)', () => {
  it('moves nothing at what each dial was: the train parked halfway, the print where it stood, the hour’s wash', () => {
    for (const seg of [...SEGS, null]) {
      for (const p of [0, 0.25, 0.5, 1]) {
        expect(trainRun(seg, p, was('train')), seg).toBe(0.45)
        expect(liftAt(seg, p * 3, was('lift')), seg).toBe(0)
        for (const [hour, share] of Object.entries(TODAY)) {
          for (const wash of [0.6, 1, 1.2]) {
            // To the bit, as challenge.js washed it before: the hour's share times the maker's, held under 0.97.
            expect(washAt({ hour, wash, read: was('read'), cover: was('cover') > 0, seg, into: p * 3 }), `${seg} ${hour}`).toEqual({ alpha: Math.min(0.97, share * wash), laid: 1 })
          }
        }
      }
    }
  })

  it('says each moment the same way twice, whatever came between', () => {
    const moments = SEGS.flatMap(seg => [0, 0.3, 0.8, 2].map(x => [seg, x]))
    const say = () => moments.map(([seg, x]) => [trainRun(seg, x / 2, 1), liftAt(seg, x, 1), panAt(seg, x / 2, { pan: 1, from: 858, to: 738 }), washAt({ hour: 'dusk', read: 0.75, cover: true, seg, into: x }), discAt(seg, x, false)])
    const first = say()
    say().reverse()
    expect(say()).toEqual(first)
  })

  it('runs the train as the reading’s clock: halfway on the cover, across as the text is read, gone after', () => {
    expect(trainRun('hook', 0.9, 1)).toBe(0.45)
    expect(trainRun('reading', 0, 1)).toBe(0.45)
    expect(trainRun('reading', 0.5, 1)).toBeCloseTo(0.725, 9)
    expect(trainRun('reading', 1, 1)).toBe(1)
    for (const seg of ['question', 'answer', 'cta']) expect(trainRun(seg, 0, 1)).toBe(1)
    let last = 0
    for (let p = 0; p <= 1; p += 0.01) {
      const r = trainRun('reading', p, 1)
      expect(r).toBeGreaterThanOrEqual(last)
      last = r
    }
  })

  it('raises the print over the reading’s first 1.6 s, never under the hook', () => {
    expect(liftAt('hook', 3, 1)).toBe(0)
    expect(liftAt('reading', 0, 1)).toBe(0)
    expect(liftAt('reading', 0.8, 1)).toBeCloseTo(0.5, 9)
    expect(liftAt('reading', 1.6, 1)).toBe(1)
    expect(liftAt('reading', 40, 1)).toBe(1)
    for (const seg of ['question', 'answer', 'cta']) expect(liftAt(seg, 0, 1)).toBe(1)
  })

  it('carries the long view’s window from Fuji’s summit away from the season’s tree, gently, and holds it on whole pixels', () => {
    // The desk print 1936 px tall, its window with Fuji's summit (650
    // units across) in its middle, then with 594 in its middle at ×1.
    const u = 1936 / 900
    const [from, to] = [650, 594].map(mid => Math.round(mid * u - 540))
    expect([from, to]).toEqual([858, 738])
    // Still: Fuji in the middle throughout.
    for (const seg of SEGS) for (const p of [0, 0.5, 1]) expect(panAt(seg, p, { pan: 0, from, to })).toBe(from)
    expect(panAt('hook', 0.7, { pan: 1, from, to })).toBe(from)
    expect(panAt('reading', 1, { pan: 1, from, to })).toBe(to)
    for (const seg of ['question', 'answer', 'cta']) expect(panAt(seg, 0, { pan: 1, from, to })).toBe(to)
    // Half the way at ×0.5, a quarter at ×0.25, each end on a whole pixel.
    for (const [pan, end] of [[0.5, 798], [0.25, 828]]) {
      for (const seg of ['question', 'answer', 'cta']) expect(panAt(seg, 0, { pan, from, to }), `×${pan}`).toBe(end)
    }
    // However long the reading (the bank's scrolls take 63 to 123 s; the
    // owner's text 118.1, a pixel a second), never more than half again
    // as fast as its mean, never back.
    for (const dur of [63, 118.1, 123]) {
      let fastest = 0
      for (let t = 0; t < dur; t += 0.25) {
        const a = panAt('reading', t / dur, { pan: 1, from, to })
        const b = panAt('reading', Math.min(1, (t + 0.25) / dur), { pan: 1, from, to })
        expect(b).toBeLessThanOrEqual(a)
        fastest = Math.max(fastest, (a - b) / 0.25)
      }
      expect(fastest, `${dur} s`).toBeLessThanOrEqual(1.5 * ((from - to) / dur) + 0.01)
      // Eased in and out: over the reading's first and last 2% the
      // window all but stands, under a fifth of its mean pace.
      for (const [a, b] of [[0, 0.02], [0.98, 1]]) {
        for (let t = a * dur; t < b * dur - 1e-9; t += 0.05) {
          const pace = (panAt('reading', t / dur, { pan: 1, from, to }) - panAt('reading', Math.min(b, (t + 0.05) / dur), { pan: 1, from, to })) / 0.05
          expect(pace, `${dur} s, ${t.toFixed(2)} s`).toBeLessThan(0.2 * ((from - to) / dur))
        }
      }
    }
  })

  it('lays the paper as the text comes in after a cover, lighter under the reading, whole again for the question', () => {
    const base = TODAY.day
    expect(washAt({ hour: 'day', cover: true, seg: 'hook', into: 2 })).toEqual({ alpha: 0, laid: 0 })
    expect(washAt({ hour: 'day', cover: true, read: 0.75, seg: 'reading', into: 0 })).toEqual({ alpha: 0, laid: 0 })
    const mid = washAt({ hour: 'day', cover: true, read: 0.75, seg: 'reading', into: 0.35 })
    expect(mid.laid).toBeGreaterThan(0.5)
    expect(mid.laid).toBeLessThan(1)
    expect(washAt({ hour: 'day', cover: true, read: 0.75, seg: 'reading', into: 0.7 })).toEqual({ alpha: base * 0.75, laid: 1 })
    // Without a cover: from the hook's whole wash down to the reading's, never a jump.
    expect(washAt({ hour: 'day', read: 0.75, seg: 'reading', into: 0 }).alpha).toBe(base)
    expect(washAt({ hour: 'day', read: 0.75, seg: 'reading', into: 30 }).alpha).toBeCloseTo(base * 0.75, 12)
    expect(washAt({ hour: 'day', read: 0.75, seg: 'question', into: 0 }).alpha).toBeCloseTo(base * 0.75, 12)
    expect(washAt({ hour: 'day', read: 0.75, seg: 'question', into: 0.6 }).alpha).toBe(base)
    for (const seg of ['hook', 'answer', 'cta']) expect(washAt({ hour: 'day', read: 0.75, seg, into: 0.1 }).alpha).toBe(base)
  })

  it('lays the paper heavier once the text is read over the moonlit night, coming in with the question', () => {
    // The question comes in from the reading's wash to `end` of the
    // hour's; the answer and the way to the app stay there; the hook
    // and the reading are what `end` leaves them.
    const night = { hour: 'night', read: 0.75 }
    expect(washAt({ ...night, seg: 'question', into: 0, end: 1.1 }).alpha).toBeCloseTo(0.45, 12)
    expect(washAt({ ...night, seg: 'question', into: 0.6, end: 1.1 }).alpha).toBeCloseTo(0.66, 12)
    for (const seg of ['answer', 'cta']) expect(washAt({ ...night, seg, into: 0.1, end: 1.1 }).alpha, seg).toBeCloseTo(0.66, 12)
    expect(washAt({ ...night, wash: 1.5, seg: 'cta', end: 1.1 }).alpha).toBe(0.97)
    expect(washAt({ ...night, seg: 'hook', end: 1.1 }).alpha).toBe(0.6)
    expect(washAt({ ...night, seg: 'reading', into: 30, end: 1.1 }).alpha).toBeCloseTo(0.45, 12)
    // Through the backdrop: the paper's share of each fill it lays over
    // the frame, the moonlit night (challenge.night) at 0, 0.5 and 1.
    const bg = `rgba(${[1, 3, 5].map(k => parseInt(palette('paper').bg.slice(k, k + 2), 16)).join(',')},`
    const washes = (n, { hour = 'night', T = PAPER, seg, after }) => {
      const plan = planOf({ ...BEFORE_309, 'challenge.read': 0.75, 'challenge.night': n }, { hour, style: T === PAPER ? 'scroll' : 'along' })
      const tl = challengeTimeline(plan)
      const f = at(print(`winter-${hour}`), T, plan, tl, tl.segs.find(s => s.key === seg).start + after)
      expect(f.seg).toBe(seg)
      return f.calls.filter(c => c.op === 'fillRect' && String(c.fill).startsWith(bg)).map(c => +c.fill.slice(bg.length, -1))
    }
    const moments = [['hook', 1], ['reading', 30], ['question', 0], ['question', 0.6], ['answer', 0.5], ['cta', 3]]
    const want = { 0: [0.6, 0.45, 0.45, 0.6, 0.6, 0.6], 0.5: [0.6, 0.45, 0.45, 0.62, 0.62, 0.62], 1: [0.6, 0.45, 0.45, 0.64, 0.64, 0.64] }
    for (const [n, alphas] of Object.entries(want)) {
      moments.forEach(([seg, after], i) => {
        const got = washes(+n, { seg, after })
        expect(got, `${n} ${seg} ${after}`).toHaveLength(1)
        expect(got[0], `${n} ${seg} ${after}`).toBeCloseTo(alphas[i], 12)
      })
    }
    // By day the hour's wash whatever the dial; under the read-along no paper at all.
    for (const [seg, after] of moments.slice(3)) {
      expect(washes(1, { hour: 'day', seg, after }), `day ${seg}`).toEqual([0.72])
      expect(washes(1, { T: DARK, seg, after }), `along ${seg}`).toEqual([])
    }
  })

  it('shows the sun or moon above the chip once the print is raised, else under the hook alone', () => {
    for (const seg of SEGS) expect(discAt(seg, 0.2, true)).toBe(1)
    expect(discAt('hook', 2, false)).toBe(1)
    expect(discAt('reading', 0, false)).toBe(1)
    expect(discAt('reading', 0.35, false)).toBeLessThan(0.5)
    expect(discAt('reading', 0.7, false)).toBe(0)
    for (const seg of ['question', 'answer', 'cta']) expect(discAt(seg, 0, false)).toBe(0)
  })

  it('draws the print whole as it always did, or a part of it, the train where its run is asked', () => {
    const P = print('winter-day')
    const u = 1080 / 390
    const w = 390 * u
    const names = r => r.images().map(c => c.img.k).filter((k, i, all) => k !== all[i - 1])
    const whole = recorder()
    drawPrint(whole.ctx, P, 0, 0, u, { W: 1080, H: 1920 })
    expect(names(whole)).toEqual(['sky', 'grain', 'back', 'train', 'front', 'paper'])
    expect(whole.calls[0]).toMatchObject({ op: 'fillRect', a: [0, 0, 1080, 1920], fill: P.look.band })
    // Parked halfway, a still print's train (the look before plan 309).
    expect(whole.images().find(c => c.img.k === 'train').a).toEqual([-w + w * (P.scene.train.run / 100) * 0.45, 0, 2 * w, 746 * u])
    const parts = { under: ['sky', 'grain', 'back'], train: ['train'], over: ['front', 'paper'] }
    for (const [part, want] of Object.entries(parts)) {
      const r = recorder()
      drawPrint(r.ctx, P, 0, 0, u, { W: 1080, H: 1920, parts: { [part]: true } })
      expect(names(r), part).toEqual(want)
      // The band's ink fills behind the print only with what lies under it.
      expect(r.calls.some(c => c.op === 'fillRect' && c.fill === P.look.band), part).toBe(part === 'under')
    }
    const ran = recorder()
    drawPrint(ran.ctx, P, 10, 20, u, { W: 1080, H: 1920, parts: { train: true }, run: 0.7 })
    expect(ran.images()[0].a).toEqual([10 - w + w * (P.scene.train.run / 100) * 0.7, 20, 2 * w, 746 * u])
  })

  it('makes no canvas, gradient or readback where no print is loaded, whatever the dials say', () => withCanvases(made => {
    // Every dial of plan 309 as far as it goes from what it was: the cover on among them.
    const tune = Object.fromEntries(TUNABLES.filter(t => 'was' in t).map(t => [t.key, t.was === t.max ? t.min : t.max]))
    for (const style of ['scroll', 'along']) {
      const plan = planOf(tune, { style, hour: 'night' })
      const tl = challengeTimeline(plan)
      for (const s of tl.segs) {
        const { ctx } = drawn()
        // drawn() answers no radial gradient and no pixels: asked for either, it throws.
        const { laid } = backdrop(ctx, null, style === 'scroll' ? PAPER : DARK, { hour: 'night', plan, tl, t: s.start + 0.3, seg: s.key, cover: s.key === 'hook' })
        if (s.key === 'hook') expect(laid).toBe(0)
        else if (s.key === 'reading') expect(laid > 0 && laid < 1).toBe(true)
        else expect(laid, s.key).toBe(1)
      }
    }
    expect(made).toHaveLength(0)
  }))

  it('keeps the print once, and lays it whole where it always stood at what each dial was', () => withCanvases(made => {
    for (const [T, hour] of [[PAPER, 'day'], [PAPER, 'night'], [DARK, 'night']]) {
      made.length = 0
      const P = print(`winter-${hour}`)
      const plan = planOf(BEFORE_309, { hour, style: T === PAPER ? 'scroll' : 'along' })
      const tl = challengeTimeline(plan)
      for (const t of [1.6, 30, 60, tl.segs.at(-1).start + 1]) {
        const f = at(P, T, plan, tl, t)
        expect(f.images().map(c => [c.img, ...c.a]), `${hour} ${t}`).toEqual([[made[0], 0, 0]])
        expect(f.laid).toBe(1)
      }
      // One canvas the frame's size, drawn once; at night under the paper, three times as bright.
      expect(made.map(c => [c.width, c.height])).toEqual([[1080, 1920]])
      const filters = new Set(made[0].r.images().map(c => c.filter))
      expect([...filters], hour).toEqual([T === PAPER && hour === 'night' ? 'brightness(3)' : 'none'])
    }
  }))

  it('lights the moonlit night in the print’s own colours: three times as bright up to the night sky’s, then less, never to the ceiling', () => {
    // What the backdrop writes back over a print whose pixels are `pixels`
    // (each [r, g, b]), lit at the dial's `night`.
    const lit = (night, pixels) => {
      const had = globalThis.OffscreenCanvas
      const written = []
      globalThis.OffscreenCanvas = class {
        constructor(w, h) { Object.assign(this, { width: w, height: h }) }
        getContext() {
          const { ctx } = recorder()
          const read = () => ({ data: Uint8ClampedArray.from(pixels.flatMap(p => [...p, 255])) })
          return new Proxy(ctx, { get: (o, k) => (k === 'getImageData' ? read : k === 'putImageData' ? img => written.push(img.data) : o[k]) })
        }
      }
      try {
        const plan = planOf({ ...BEFORE_309, 'challenge.night': night }, { hour: 'night' })
        const tl = challengeTimeline(plan)
        backdrop(recorder().ctx, print('winter-night'), PAPER, { hour: 'night', plan, tl, t: 30, seg: 'reading' })
      } finally {
        globalThis.OffscreenCanvas = had
      }
      expect(written).toHaveLength(1)
      return pixels.map((_, i) => [...written[0].slice(4 * i, 4 * i + 3)])
    }
    // Every level, the channels alike: never darker for a lighter one.
    const grey = Array.from({ length: 256 }, (_, v) => [v, v, v])
    for (const night of [0.25, 0.5, 0.75, 1]) {
      const out = lit(night, grey).map(p => p[0])
      out.forEach((v, i) => expect(v, `${night} ${i}`).toBeGreaterThanOrEqual(out[i - 1] ?? 0))
    }
    const levels = lit(1, grey).map(p => p[0])
    // Up to the night sky's brightest channel, three times as bright, as
    // before plan 309 (the pale moonlit page the owner chose); past it
    // less and less, and none of the print's lights lit to 254 or over.
    levels.forEach((v, i) => expect(v, `${i}`).toBe(i <= 52 ? 3 * i : Math.min(v, 3 * i)))
    // The knee held from above too: from the first level the rounding
    // leaves apart, under three times, on the shoulder at these levels.
    levels.forEach((v, i) => { if (i >= 55) expect(v, `${i}`).toBeLessThan(3 * i) })
    for (const [i, v] of [[60, 174], [80, 198], [100, 211], [150, 231], [200, 243]]) expect(Math.abs(levels[i] - v), `${i}`).toBeLessThanOrEqual(1)
    expect(Math.max(...levels)).toBe(253)
    // Each pixel lifted whole, its channels in the print's own ratio: the
    // night sky, a dark pine, the maple's coral, the myrtle's leaf, the
    // blossom, the snow, a lamp; every channel as the brightest is lifted,
    // to the rounding, whatever the dial short of three times as bright.
    const colours = [[14, 25, 52], [5, 8, 12], [120, 50, 40], [40, 70, 45], [200, 150, 190], [210, 222, 244], [255, 214, 140], [255, 255, 255]]
    for (const night of [0.5, 1]) {
      lit(night, colours).forEach((p, i) => {
        const c = colours[i]
        const m = Math.max(...c)
        const k = (p[c.indexOf(m)] - (1 - night) * Math.min(255, 3 * m)) / m
        c.forEach((v, j) => expect(Math.abs(p[j] - ((1 - night) * Math.min(255, 3 * v) + v * k)), `${night} ${c} ${'rgb'[j]}`).toBeLessThanOrEqual(1))
        expect(Math.max(...p), `${night} ${c}`).toBeLessThanOrEqual(night === 1 ? 253 : 255)
      })
    }
    expect(lit(1, colours.slice(0, 2))).toEqual([[42, 75, 156], [15, 24, 36]])
  })

  it('raises the print as the text comes in, between pixels as it rises and on whole ones once raised, its foot at the frame’s', () => withCanvases(made => {
    const P = print('winter-day')
    const plan = planOf({ ...BEFORE_309, 'challenge.lift': 1 })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const y = t => at(P, PAPER, plan, tl, t).images()[0].a[1]
    expect(y(1.6)).toBe(0)
    // Kept whole, 746 units at 2.77 px a unit, so its foot can come up.
    expect(made.map(c => [c.width, c.height])).toEqual([[1080, 2066]])
    const rising = y(rd.start + 0.8)
    expect(rising).toBeLessThan(0)
    expect(rising).toBeGreaterThan(-145)
    // Halfway up, half a pixel along: it glides.
    expect(rising).toBeCloseTo(-72.5, 9)
    for (const t of [rd.start + 1.6, 60, tl.segs.at(-1).start + 1]) expect(y(t)).toBe(-145)
    expect(made).toHaveLength(1)
  }))

  it('runs the train between what lies under and over it, the sun or moon under it', () => withCanvases(made => {
    const P = print('winter-day')
    const plan = planOf({ ...BEFORE_309, 'challenge.train': 1, 'challenge.disc': 1, 'challenge.lift': 1 })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const w = 1080
    // The train's rows drawn a fraction of a pixel along, so that parked it lies on whole pixels.
    const parked = -w + w * (P.scene.train.run / 100) * 0.45
    const phase = parked - Math.floor(parked)
    for (const t of [1.6, rd.start + 0.5, 30, 90, tl.segs.at(-1).start + 1]) {
      const f = at(P, PAPER, plan, tl, t)
      const [under, over, strip, sun] = made
      const laid = f.images()
      expect(laid.map(c => c.img), `${t}`).toEqual([under, sun, strip, over])
      // The sun at the print's place, raised with it.
      const lift = laid[0].a[1]
      expect(laid[1].a[0] + sun.width / 2).toBeCloseTo(195 * (1080 / 390), 0)
      expect(laid[1].a[1] + sun.height / 2 - lift).toBeCloseTo(150 * (1080 / 390), 0)
      // The train where the reading's clock has run it, in its rows.
      const p = Math.min(1, Math.max(0, (t - rd.start) / rd.dur))
      expect(laid[2].a[0]).toBeCloseTo(-w + w * (P.scene.train.run / 100) * trainRun(f.seg, p, 1) - phase, 9)
      expect(laid[2].a[1] - lift).toBe(Math.floor(532 * (1080 / 390)))
      if (f.seg === 'hook') expect(Number.isInteger(laid[2].a[0])).toBe(true)
    }
    // Under, over, the train's rows at twice the print's width, the sun: each made once.
    expect(made.map(c => [c.width, c.height])).toEqual([[1080, 2066], [1080, 2066], [Math.ceil(2 * w + phase), 89], [made[3].width, made[3].width]])
  }))

  it('lays the read-along’s sun or moon over its darkening, in its own light, behind what stands in front of it', () => withCanvases(made => {
    // Under the darkening it came out a dull grey moon or a beige sun (plan 309).
    const P = print('winter-day')
    const u = 1080 / 390
    const plan = planOf({ ...BEFORE_309, 'challenge.train': 1, 'challenge.disc': 1, 'challenge.lift': 1 }, { style: 'along' })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    for (const t of [1.6, rd.start + 0.5, 30, tl.segs.at(-1).start + 1]) {
      const f = at(P, DARK, plan, tl, t)
      const [under, over, strip, sun, alone] = made
      // The print, its train between its parts, the darkening, then the sun, at the print's place, raised with it.
      expect(f.calls.filter(c => c.op === 'drawImage' || c.op === 'fillRect').map(c => (c.op === 'fillRect' ? 'dark' : c.img)), `${t}`).toEqual([under, strip, over, 'dark', alone])
      const lift = f.images()[0].a[1]
      const mine = f.images().at(-1)
      expect(mine.a[0] + alone.width / 2).toBeCloseTo(195 * u, 0)
      expect(mine.a[1] + alone.height / 2 - lift).toBeCloseTo(150 * u, 0)
      expect(mine.alpha).toBe(1)
      expect([alone.width, alone.height]).toEqual([sun.width, sun.height])
    }
    expect(made).toHaveLength(5)
    // Put together once: the sun, the front layer taken out of it, the paper's grain over what is left, its tiles where the print's lie.
    const [under, over, strip, sun, alone] = made
    const drawn = alone.r.images()
    expect(drawn.slice(0, 2).map(c => [c.img === sun ? 'sun' : c.img.k, c.gco])).toEqual([['sun', 'source-over'], ['front', 'destination-out']])
    expect(drawn[1].a).toEqual([-Math.floor(195 * u) + sun.width / 2, -Math.floor(150 * u) + sun.height / 2, 390 * u, 746 * u])
    // Every tile drawPrint lays the paper's grain in across the print and
    // down it, each at its place against the front layer's (across and
    // down alike), the last row cut at the print's foot.
    const [fx, fy, pw, ph] = drawn[1].a
    const T = 128 * u
    const tiles = []
    for (let ty = 0; ty < ph; ty += T) for (let tx = 0; tx < pw; tx += T) tiles.push([tx, ty, T, Math.min(T, ph - ty)])
    const grain = drawn.slice(2)
    expect(grain).toHaveLength(tiles.length)
    expect(new Set(tiles.map(([, ty]) => ty)).size).toBeGreaterThan(1)
    grain.forEach((c, i) => {
      expect([c.img.k, c.gco]).toEqual(['paper', 'source-atop'])
      const at = [c.a[0] - fx, c.a[1] - fy, c.a[2], c.a[3]]
      at.forEach((v, j) => expect(v, `tile ${i}, ${'xywh'[j]}`).toBeCloseTo(tiles[i][j], 6))
    })
    // On the paper the sun stays in the print, under its train (the scroll's look).
    const scroll = planOf(plan.tune)
    expect(at(P, PAPER, scroll, challengeTimeline(scroll), 30).images().map(c => c.img)).toEqual([under, sun, strip, over])
    // Where the print stays down it goes as the paper comes in, laid as faint.
    const down = planOf({ ...BEFORE_309, 'challenge.disc': 1 }, { style: 'along' })
    const dtl = challengeTimeline(down)
    const g = at(P, DARK, down, dtl, reading(dtl).start + 0.35)
    expect(g.images().at(-1).img).toBe(alone)
    expect(g.images().at(-1).alpha).toBeCloseTo(discAt('reading', 0.35, false), 9)
  }))

  it('lays the sun or moon under the hook alone where the print stays down, and none on August’s night', () => withCanvases(() => {
    const plan = planOf({ ...BEFORE_309, 'challenge.disc': 1 })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const P = print('winter-day')
    const count = t => at(P, PAPER, plan, tl, t).images().length
    // Under, the sun, the train, over.
    expect(count(1.6)).toBe(4)
    expect(count(rd.start + 2)).toBe(3)
    // August's night has its fireworks, and no moon: the print whole, as before.
    const night = print('summer-hanabi')
    const hanabi = planOf({ ...BEFORE_309, 'challenge.disc': 1, 'challenge.lift': 1 }, { hour: 'night', season: 'hanabi' })
    expect(at(night, PAPER, hanabi, challengeTimeline(hanabi), 1.6).images()).toHaveLength(1)
  }))

  it('leaves the bay’s spring night its own hazy moon, drawn round the app’s dial, and gives every other night its moon', () => withCanvases(() => {
    const on = season => planOf({ ...BEFORE_309, 'challenge.disc': 1 }, { hour: 'night', season })
    const spring = print('spring-night')
    // Its haze stands round the dial's place (195, 182), not the disc's (195, 150).
    expect(spring.scene.layers.sky).toMatch(/<circle cx="195" cy="182"[^>]*tpr-s5Oboro/)
    const plan = on('spring')
    expect(at(spring, PAPER, plan, challengeTimeline(plan), 1.6).images()).toHaveLength(1)
    for (const season of ['summer', 'autumn', 'winter']) {
      const P = print(`${season}-night`)
      expect(P.scene.layers.sky, season).not.toMatch(/tpr-s5Oboro/)
      // Under, the moon, the train, over.
      expect(at(P, PAPER, on(season), challengeTimeline(on(season)), 1.6).images(), season).toHaveLength(4)
    }
  }))

  it('stands the long view a little taller than the frame, Fuji’s summit in the middle and under the cover’s slip, then carried along', () => withCanvases(made => {
    const P = print('winter-day', 'desk')
    const plan = planOf({ ...BEFORE_309, 'challenge.lift': 1, 'challenge.disc': 1 }, { scenery: 'wide' })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const x = t => at(P, PAPER, plan, tl, t).images()[0].a[0]
    expect(x(1.6)).toBe(-858)
    expect(x(rd.start + rd.dur / 2)).toBeCloseTo(-(858 + 738) / 2, 6)
    expect(x(tl.segs.at(-1).start + 1)).toBe(-738)
    // Neither raised nor lit by a sun: the desk's own frame, cut at the frame's foot.
    expect(made.map(c => [c.width, c.height])).toEqual([[2547, 1920]])
    // Drawn 1936 px tall: Fuji's summit, the top of its outline on every
    // desk print, stands at 957 under the hook, below the lowest foot the
    // cover's slip has (940, carouselCover.test.js) by the 16 px the gate
    // keeps; drawn at the frame's height it stood at 949.
    const [, , w, h] = made[0].r.images().find(c => c.img.k === 'sky').a
    expect([w, h]).toEqual([1184 * (1936 / 900), 1936])
    for (const name of Object.keys(meta.prints)) {
      const outline = /<clipPath id="tpr-s5FjClip"><path d="([^"]+)"/.exec(Object.values(print(name, 'desk').scene.layers).join(''))[1]
      const top = Math.min(...[...outline.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => +m[2]))
      expect(top, name).toBe(445.1)
      expect(Math.floor((top * h) / 900), name).toBeGreaterThanOrEqual(940 + 16)
    }
    const still = planOf({ ...BEFORE_309, 'challenge.pan': 0 }, { scenery: 'wide' })
    expect(at(P, PAPER, still, challengeTimeline(still), 90).images()[0].a[0]).toBe(-858)
  }))

  it('ends the long view’s travel with Fuji whole and the season’s tree out of the feed’s buttons, on every desk print', () => withCanvases(made => {
    // The feed's buttons stand down the frame's right side, x 920 to 1080, y 1100 to 1700.
    const plan = planOf(BEFORE_309, { scenery: 'wide' })
    const tl = challengeTimeline(plan)
    const reached = []
    for (const name of Object.keys(meta.prints)) {
      const P = print(name, 'desk')
      // Where the window stands under the hook, and once carried (×1), on the print as laid.
      const [hook, end] = [1.6, tl.segs.at(-1).start + 1].map(t => -at(P, PAPER, plan, tl, t).images()[0].a[0])
      const u = made.at(-1).r.images().find(c => c.img.k === 'sky').a[3] / P.scene.h
      expect([hook, end], name).toEqual([858, 738])
      // Fuji's cone where the mist over its foot begins, 64 px inside either edge at either end of the travel.
      const fuji = fujiOf(P.scene)
      const [l, r] = flanksAt(fuji, fuji.mist).map(x => x * u)
      for (const left of [hook, end]) {
        expect(l - left, `${name} ${left}`).toBeGreaterThanOrEqual(64)
        expect(left + 1080 - r, `${name} ${left}`).toBeGreaterThanOrEqual(64)
      }
      // The tree in the buttons' rows: out of the frame once carried, where
      // under the hook its leaves reach in on the spring, summer and autumn
      // prints, so that carried toward it, it would stand behind the buttons.
      const tree = leftmostIn(treeOf(P.scene), [1100 / u, 1700 / u]) * u
      expect(tree - end, name).toBeGreaterThanOrEqual(1080)
      if (tree - hook < 1080) reached.push(name)
    }
    for (const name of ['spring-day', 'summer-day', 'summer-hanabi', 'autumn-night']) expect(reached).toContain(name)
    for (const name of ['winter-day', 'winter-night']) expect(reached).not.toContain(name)
  }))

  it('under a cover, stands the night’s print unlit and brings its light in with the paper', () => withCanvases(made => {
    const P = print('winter-night')
    const plan = planOf({ ...BEFORE_309, 'challenge.cover': 1 }, { hour: 'night' })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const hook = at(P, PAPER, plan, tl, 1.6)
    // Two prints kept, unlit and lit; the hook lays the unlit one alone, unwashed.
    expect(made).toHaveLength(2)
    expect(hook.laid).toBe(0)
    expect(hook.images().map(c => c.img)).toEqual([made[0]])
    expect(hook.calls.some(c => c.op === 'fillRect')).toBe(false)
    const after = at(P, PAPER, plan, tl, rd.start + 0.3)
    expect(after.laid).toBeGreaterThan(0)
    expect(after.laid).toBeLessThan(1)
    expect(after.images().map(c => [c.img, c.alpha])).toEqual([[made[0], 1], [made[1], after.laid]])
    expect(at(P, PAPER, plan, tl, 30).images().map(c => c.img)).toEqual([made[1]])
    expect(made).toHaveLength(2)
    // Once the paper is laid the unlit print is kept a frame on, the one look more:
    // the hook asked again lays it as it was drawn.
    expect(at(P, PAPER, plan, tl, 1.6).images().map(c => c.img)).toEqual([made[0]])
    expect(made).toHaveLength(2)
    // A third look between (the train run, the print split at it) lets it go: drawn again, once.
    const split = planOf({ ...BEFORE_309, 'challenge.cover': 1, 'challenge.train': 1 }, { hour: 'night' })
    at(P, PAPER, plan, tl, 30)
    at(P, PAPER, split, challengeTimeline(split), 30)
    expect(made).toHaveLength(5)
    expect(at(P, PAPER, plan, tl, 1.6).images().map(c => c.img)).toEqual([made[5]])
    expect(made).toHaveLength(6)
  }))

  it('draws neither look again while two players draw one print in turn (the studio’s, while it encodes)', () => withCanvases(made => {
    // The player in the reading, the lit night alone; the export under the
    // cover (the unlit laid, the lit drawn) and as the light comes in.
    const P = print('winter-night')
    const plan = planOf({ ...BEFORE_309, 'challenge.cover': 1, 'challenge.night': 1, 'challenge.train': 1, 'challenge.disc': 1, 'challenge.lift': 1 }, { hour: 'night' })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    at(P, PAPER, plan, tl, 1.6)
    // Each look kept tall, its under and over: the unlit, then the lit.
    const tall = () => made.filter(c => c.height === 2066)
    const [under0, over0, under1, over1] = tall()
    const looks = f => f.images().map(c => c.img).filter(c => c.height === 2066)
    for (let i = 0; i < 3; i++) {
      expect(looks(at(P, PAPER, plan, tl, 30 + i)), `reading ${i}`).toEqual([under1, over1])
      expect(looks(at(P, PAPER, plan, tl, 1.6 + i / 10)), `hook ${i}`).toEqual([under0, over0])
      expect(looks(at(P, PAPER, plan, tl, 40 + i)), `reading ${i}`).toEqual([under1, over1])
      // The light coming in: the unlit laid, the lit put together on the fade's canvas.
      const f = at(P, PAPER, plan, tl, rd.start + 0.2 + i / 10)
      expect(f.laid > 0 && f.laid < 1).toBe(true)
      expect(looks(f), `fade ${i}`).toEqual([under0, over0])
      expect(looks(f.images().at(-1).img.r), `fade ${i}`).toEqual([under1, over1])
    }
    expect(tall()).toHaveLength(4)
  }))

  it('brings a night’s light in after its cover as one picture, put together first, never part by part', () => withCanvases(made => {
    const P = print('winter-night')
    const plan = planOf({ ...BEFORE_309, 'challenge.cover': 1, 'challenge.night': 1, 'challenge.train': 1, 'challenge.disc': 1, 'challenge.lift': 1 }, { hour: 'night' })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const pictures = f => f.images().map(c => [c.img, c.alpha])
    // The hook: the unlit print, its moon and train between its parts; the lit one drawn, not laid.
    const hook = at(P, PAPER, plan, tl, 1.6)
    const [under0, over0, strip0, under1, over1, strip1, moon] = made
    expect(pictures(hook)).toEqual([[under0, 1], [moon, 1], [strip0, 1], [over0, 1]])
    // Coming in: the lit print put together on a canvas the frame's size, then laid over the unlit one once, as faint as the paper is laid.
    const f = at(P, PAPER, plan, tl, rd.start + 0.3)
    expect(f.laid > 0 && f.laid < 1).toBe(true)
    const fade = made[7]
    expect([fade.width, fade.height]).toEqual([1080, 1920])
    expect(pictures(f)).toEqual([[under0, 1], [moon, 1], [strip0, 1], [over0, 1], [fade, f.laid]])
    expect(pictures(fade.r)).toEqual([[under1, 1], [moon, 1], [strip1, 1], [over1, 1]])
    // Each frame of it put together afresh on the same canvas, wiped first.
    const next = at(P, PAPER, plan, tl, rd.start + 0.4)
    expect(made).toHaveLength(8)
    expect(next.images().at(-1).img).toBe(fade)
    expect(fade.r.calls.map(c => (c.op === 'clearRect' ? [c.op, ...c.a] : c.img))).toEqual([['clearRect', 0, 0, 1080, 1920], under1, moon, strip1, over1, ['clearRect', 0, 0, 1080, 1920], under1, moon, strip1, over1])
    // Laid: the lit print alone, part by part, nothing else kept.
    expect(pictures(at(P, PAPER, plan, tl, 30))).toEqual([[under1, 1], [moon, 1], [strip1, 1], [over1, 1]])
    expect(made).toHaveLength(8)
  }))

  it('lays August’s fireworks over the paper in their own colours, the print under them without its sky’s', () => withCanvases(made => {
    const P = print('summer-hanabi')
    P.img.backBare = { k: 'backBare' }
    P.img.bursts = { k: 'bursts' }
    const plan = planOf({ ...BEFORE_309, 'challenge.bursts': 1 }, { hour: 'night', season: 'hanabi' })
    const tl = challengeTimeline(plan)
    const f = at(P, PAPER, plan, tl, 30)
    const [print1, bursts] = made
    // The print, the paper over it, the fireworks over the paper.
    expect(f.calls.filter(c => c.op !== 'fillRect' || c.a[2] === 1080).map(c => c.op === 'fillRect' ? 'wash' : c.img)).toEqual([print1, 'wash', bursts])
    expect(print1.r.images().map(c => c.img.k)).toContain('backBare')
    expect(print1.r.images().map(c => c.img.k)).not.toContain('back')
    // The fireworks behind what the front layer stands in front of.
    expect(bursts.r.images().map(c => c.img.k)).toEqual(['bursts', 'front'])
    const off = planOf(BEFORE_309, { hour: 'night', season: 'hanabi' })
    made.length = 0
    at(P, PAPER, off, challengeTimeline(off), 30)
    expect(made[0].r.images().map(c => c.img.k)).toContain('back')
    expect(made).toHaveLength(1)
  }))
})

// The print loaded as the page loads it, its files served from the
// frontend: `fail` answers a path with a status, a page that is not JSON
// ('html') or no answer at all ('net'); a picture whose source holds
// `broken` does not decode, and a print's layer marked (`mark`) holds it.
async function loading(opts, { fail = {}, mark = null, broken = '@@broken@@' } = {}) {
  const had = { fetch: globalThis.fetch, Image: globalThis.Image }
  globalThis.fetch = async url => {
    const path = url.replace(/^\//, '')
    const how = fail[path]
    if (how === 'net') throw new TypeError('Failed to fetch')
    if (typeof how === 'number') return { ok: false, status: how, text: async () => '' }
    let body = how === 'html' ? '<!doctype html><title>Not here</title>' : read(path)
    if (mark?.path === path) {
      const scene = JSON.parse(body)
      scene.layers[mark.layer] += `<!--${broken}-->`
      body = JSON.stringify(scene)
    }
    return { ok: true, status: 200, text: async () => body }
  }
  globalThis.Image = class {
    set src(v) { setTimeout(() => (decodeURIComponent(v).includes(broken) ? this.onerror() : this.onload())) }
  }
  try {
    return await loadPrint('day', { base: '/', season: 'winter', ...opts }).then(() => null, e => e.message)
  } finally {
    globalThis.fetch = had.fetch
    if (had.Image === undefined) delete globalThis.Image
    else globalThis.Image = had.Image
  }
}

describe('what a reading challenge stands on, when it does not load (plan 309)', () => {
  const lake = challengePlan(data, 'n5-12', { scenery: 'lake' })
  const bay = challengePlan(data, 'n5-12', {})
  const own = 'carousel/prints/1/lake'

  it('loads the print whole where every file is there', async () => {
    expect(await loading({ scenery: 'lake' })).toBeNull()
    expect(await loading({})).toBeNull()
  })

  it('names the file that failed and how, and says a scenery has no prints yet only where its own are not there', async () => {
    // Each: the print asked for, how it fails, what is said, whether the
    // file is not there (a 404), and whether that file is the scenery's own.
    const cases = [
      // Not drawn yet: a file of its own folder is not there.
      [{ scenery: 'lake' }, { fail: { [`${own}/meta.json`]: 404 } }, `print: ${own}/meta.json 404`, true, true],
      [{ scenery: 'lake' }, { fail: { [`${own}/winter-day.json`]: 404 } }, `print: ${own}/winter-day.json 404`, true, true],
      // Not there, but a file of the app's own: drawing the lake again would not bring it.
      [{ scenery: 'lake' }, { fail: { 'src/components/station/print/print.json': 404 } }, 'print: src/components/station/print/print.json 404', true, false],
      [{ scenery: 'lake' }, { fail: { 'src/index.css': 404 } }, 'print: src/index.css 404', true, false],
      // There, but broken: served wrong, not JSON, a layer that does not decode, a file of the app's own.
      [{ scenery: 'lake' }, { fail: { [`${own}/winter-day.json`]: 500 } }, `print: ${own}/winter-day.json 500`, false, false],
      [{ scenery: 'lake' }, { fail: { [`${own}/meta.json`]: 'html' } }, `print: ${own}/meta.json is not JSON (`, false, false],
      [{ scenery: 'lake' }, { mark: { path: `${own}/winter-day.json`, layer: 'sky' } }, `print: ${own}/winter-day.json, its sky layer, did not decode`, false, false],
      [{ scenery: 'lake' }, { broken: 'grain.png' }, `print: public/today/print/${meta.rev}/grain.png did not load`, false, false],
      [{ scenery: 'lake' }, { fail: { 'src/index.css': 'net' } }, 'print: src/index.css could not be fetched (Failed to fetch)', false, false],
    ]
    for (const [opts, how, said, missing, notDrawn] of cases) {
      const message = await loading(opts, how)
      expect(message, said).toMatch(new RegExp(`^${said.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
      // As the render reads it back from the page: Playwright's prefix, then the page's stack.
      const failed = loadFailure(`page.evaluate: Error: ${message}\n    at get (http://127.0.0.1:1/carousel/app.js:440:11)`)
      expect(failed, said).toEqual({ line: message, missing })
      const line = notDrawn
        ? `Mirror lake (逆さ富士) has no prints yet (${message}): draw them with python3 scripts/sceneries/build.py`
        : `Mirror lake (逆さ富士) did not load (${message})`
      expect(standsOnFailure(lake, failed), said).toBe(line)
      // The studio says the same of the error loadPrint gives it, then what stands in.
      expect(standInSays(lake, message, 'bay'), said).toEqual({
        said: `${line}. The bay at this hour stands in.`,
        label: `Mirror lake ${notDrawn ? 'has no prints yet' : 'did not load'}`,
      })
    }
    // Its own folder only: another scenery's, or a revision drawn before, is no print of the lake's.
    for (const path of ['carousel/prints/1/torii/meta.json', 'carousel/prints/0/lake/meta.json', 'carousel/prints/1/lakes/meta.json']) {
      expect(standsOnFailure(lake, loadFailure(`print: ${path} 404`)), path).toBe(`Mirror lake (逆さ富士) did not load (print: ${path} 404)`)
    }
    // Today's print, the bay's and the long view's, whatever failed.
    const gone = await loading({}, { fail: { 'src/components/station/print/print.json': 404 } })
    expect(gone).toBe('print: src/components/station/print/print.json 404')
    expect(standsOnFailure(bay, loadFailure(gone))).toBe(`Today's print did not load (${gone})`)
    const wide = challengePlan(data, 'n5-12', { scenery: 'wide' })
    expect(standsOnFailure(wide, loadFailure('print: public/today/print/3/winter-day-desk.json 404'))).toBe("Today's print did not load (print: public/today/print/3/winter-day-desk.json 404)")
    // The maker's photo.
    const photo = challengePlan(data, 'n5-12', { photo: 'carousel/mine.jpg' })
    expect(standsOnFailure(photo, loadFailure('page.evaluate: Error: photo: carousel/mine.jpg'))).toBe('the photo carousel/mine.jpg did not load: --photo takes a path under frontend/')
  })

  it('leaves any other failure to be thrown as it is, never said to be a print missing', () => {
    for (const message of [
      "page.evaluate: SyntaxError: The requested module './backdrop.js' does not provide an export named 'nope'",
      'page.evaluate: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:1/carousel/challenge.js',
      "page.evaluate: TypeError: Cannot read properties of undefined (reading 'layers')\n    at loadPrint (http://127.0.0.1:1/carousel/app.js:469:5)",
      // A line about a print is one that opens the message, never words met halfway along another.
      'page.evaluate: Error: unexpected (print: nothing)\n    at x (y:1:1)',
      'page.evaluate: Error: the photo: no\n    at x (y:1:1)',
      '', undefined,
    ]) expect(loadFailure(message), String(message)).toBeNull()
    // The render stops on what loadFailure reads and throws the rest on.
    const render = read('carousel/long/render.mjs')
    expect(render).toMatch(/const failed = loadFailure\(e\.message\)\n\s*if \(!failed\) \{\n\s*await closeAll\(\)\n\s*throw e\n\s*\}\n\s*await stop\(standsOnFailure\(plan, failed\)\)/)
    // However the run ends (done, stopped, a bug thrown anywhere, Ctrl-C),
    // its work folder goes with it: on Node's exit, set before it is made.
    expect(render).toMatch(/process\.on\('exit', \(\) => \{\n\s*for \(const d of \[WORK, \.\.\.CLEAN\]\) rmSync\(d, \{ recursive: true, force: true \}\)\n\s*\}\)/)
    expect(render.indexOf("process.on('exit'")).toBeLessThan(render.indexOf('mkdirSync(d, { recursive: true })'))
  })

  it('says in the studio what the render says of a print that did not load, then what stands in for it', () => {
    const lake = challengePlan(data, 'n5-12', { scenery: 'lake' })
    const bay = challengePlan(data, 'n5-12', {})
    const own = 'print: carousel/prints/1/lake/meta.json 404'
    expect(standInSays(lake, own, 'last')).toEqual({
      said: `Mirror lake (逆さ富士) has no prints yet (${own}): draw them with python3 scripts/sceneries/build.py. The last print drawn stands in.`,
      label: 'Mirror lake has no prints yet',
    })
    // Nothing stands in: what failed alone.
    expect(standInSays(lake, own).said).toBe(`Mirror lake (逆さ富士) has no prints yet (${own}): draw them with python3 scripts/sceneries/build.py.`)
    // An error that names no file (a bug in the page) is said as it is, never as prints missing.
    const bug = "Cannot read properties of undefined (reading 'layers')"
    expect(standInSays(lake, bug, 'bay')).toEqual({ said: `Mirror lake (逆さ富士) did not load (${bug}). The bay at this hour stands in.`, label: 'Mirror lake did not load' })
    // Today's print, with the last print drawn in its place, or nothing.
    const gone = `print: public/today/print/${meta.rev}/winter-day-phone.json 404`
    expect(standInSays(bay, gone, 'last')).toEqual({ said: `Today's print did not load (${gone}). The last print drawn stands in.`, label: 'The bay did not load' })
    expect(standInSays(bay, gone).said).toBe(`Today's print did not load (${gone}).`)
    // The studio's status line and its buttons say it so, never in words of their own.
    const studio = read('carousel/studio.js')
    expect(studio).toMatch(/const says = standInSays\(pl, failure\.message, bay \? 'bay' : lastPrint \? 'last' : null\)\n\s*standInSaid = before \? says\.said : standInSays\(\{ \.\.\.pl, scenery: 'bay' \}, bayFailure\.message\)\.said\n\s*status\(standInSaid\)/)
    expect(studio).toMatch(/return \{ P: before, standIn: before \|\| instead \? says\.label : '' \}/)
    const challengePrint = /\nasync function challengePrint\(pl, mine\) \{\n[\s\S]*?\n\}\n/.exec(studio)[0]
    expect(challengePrint).not.toMatch(/did not load|stands in\./)
  })

  it('has the bay stand in, in the studio, as it would have stood: its season, its petals, its fireworks; none for the bay', () => {
    const dials = { 'challenge.falls': 1, 'challenge.bursts': 1 }
    const asked = (opts, tune = dials) => challengePrintOpts(challengePlan(data, 'n5-12', { ...opts, tune }))
    for (const scenery of ['lake', 'torii', 'river', 'station', 'wide']) {
      expect(standInOpts(asked({ scenery, season: 'spring' })), scenery).toEqual({ season: 'spring', scenery: 'bay', falls: true, bursts: true })
    }
    // Each dial's part as it was asked, and the date's season where none was chosen.
    expect(standInOpts(asked({ scenery: 'lake', season: 'hanabi' }, { 'challenge.falls': 1, 'challenge.bursts': 0 }))).toEqual({ season: 'hanabi', scenery: 'bay', falls: true, bursts: false })
    expect(standInOpts(asked({ scenery: 'river' }, { 'challenge.falls': 0, 'challenge.bursts': 1 }))).toEqual({ season: null, scenery: 'bay', falls: false, bursts: true })
    expect(standInOpts(asked({ scenery: 'station', season: 'winter' }, BEFORE_309))).toEqual({ season: 'winter', scenery: 'bay', falls: false, bursts: false })
    // The bay is what failed, dialled or not: the last print drawn stands in.
    expect(standInOpts(asked({ season: 'spring' }))).toBeNull()
    expect(standInOpts(asked({}, BEFORE_309))).toBeNull()
    // The studio loads the stand-in so, at the hour and season the print asked for was loaded at,
    // and its loader hands every dial's part on to loadPrint.
    const studio = read('carousel/studio.js')
    expect(studio).toMatch(/const asked = challengePrintOpts\(pl\)\n[\s\S]*?await printFor\(state\.hour, seasonOf\(\), asked\)[\s\S]*?const instead = standInOpts\(asked\)\n\s*let bayFailure = instead \? null : failure\n\s*const bay = instead \? await printFor\(state\.hour, seasonOf\(\), instead\)/)
    expect(studio).toMatch(/function printFor\(hour, season = seasonOf\(\), \{ scenery = 'bay', falls = false, bursts = false \} = \{\}\) \{\n[\s\S]*?loadPrint\(hour, \{ base: BASE, season, scenery, falls, bursts \}\)/)
  })
})
