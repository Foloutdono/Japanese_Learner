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
    const say = () => moments.map(([seg, x]) => [trainRun(seg, x / 2, 1), liftAt(seg, x, 1), panAt(seg, x / 2, { pan: 1, from: 847, span: 1446 }), washAt({ hour: 'dusk', read: 0.75, cover: true, seg, into: x }), discAt(seg, x, false)])
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

  it('carries the long view’s window from Fuji’s summit toward the tree, gently, and holds it on whole pixels', () => {
    const span = Math.ceil(1184 * (1920 / 900)) - 1080
    const from = Math.round(650 * (1920 / 900) - 540)
    expect([from, span]).toEqual([847, 1446])
    // Still: Fuji in the middle throughout.
    for (const seg of SEGS) for (const p of [0, 0.5, 1]) expect(panAt(seg, p, { pan: 0, from, span })).toBe(from)
    expect(panAt('hook', 0.7, { pan: 1, from, span })).toBe(from)
    expect(panAt('reading', 1, { pan: 1, from, span })).toBe(1356)
    for (const seg of ['question', 'answer', 'cta']) expect(panAt(seg, 0, { pan: 1, from, span })).toBe(1356)
    // However long the reading (the bank's scrolls take 63 to 123 s; the
    // owner's text 118.1, 4.3 px a second), never more than half again
    // as fast as its mean, never back.
    for (const dur of [63, 118.1, 123]) {
      let fastest = 0
      for (let t = 0; t < dur; t += 0.25) {
        const a = panAt('reading', t / dur, { pan: 1, from, span })
        const b = panAt('reading', Math.min(1, (t + 0.25) / dur), { pan: 1, from, span })
        expect(b).toBeGreaterThanOrEqual(a)
        fastest = Math.max(fastest, (b - a) / 0.25)
      }
      expect(fastest, `${dur} s`).toBeLessThanOrEqual(1.5 * ((1356 - from) / dur) + 0.01)
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

  it('stands the long view at the frame’s height, Fuji’s summit in the middle under the hook, then carried along', () => withCanvases(made => {
    const P = print('winter-day', 'desk')
    const plan = planOf({ ...BEFORE_309, 'challenge.lift': 1, 'challenge.disc': 1 }, { scenery: 'wide' })
    const tl = challengeTimeline(plan)
    const rd = reading(tl)
    const x = t => at(P, PAPER, plan, tl, t).images()[0].a[0]
    expect(x(1.6)).toBe(-847)
    expect(x(rd.start + rd.dur / 2)).toBeCloseTo(-(847 + 1356) / 2, 6)
    expect(x(tl.segs.at(-1).start + 1)).toBe(-1356)
    // Neither raised nor lit by a sun: the desk's own frame, at the frame's height.
    expect(made.map(c => [c.width, c.height])).toEqual([[2526, 1920]])
    const still = planOf({ ...BEFORE_309, 'challenge.pan': 0 }, { scenery: 'wide' })
    expect(at(P, PAPER, still, challengeTimeline(still), 90).images()[0].a[0]).toBe(-847)
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
