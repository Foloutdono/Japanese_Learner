// The paper round the scroll's words (plan 309, frontend/carousel/halo.js):
// a rim grown once from the strip the text is written on, on one canvas of
// its own, made after the strip, so the glide's test still finds the strip
// by its height (carousel.test.js, the last of the reading challenges).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS } from '../carousel/draw.js'
import { RIM, RIM_AT, RIM_INK, haloStrip, rimInk } from '../carousel/halo.js'
import { CH, challengePlan, challengeTimeline, drawChallenge } from '../carousel/challenge.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

const bank = JSON.parse(readFileSync(new URL('../carousel/bank/comprehension.json', import.meta.url), 'utf8'))

/** A canvas keeping everything done on it: each call, in the ink, the
 *  strength and the mode it was made in. */
function recorder(width, height) {
  const calls = []
  const state = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', font: '10px sans-serif' }
  const stack = []
  const methods = {
    measureText: t => ({ width: [...String(t)].length * 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop() || {}),
  }
  const ctx = new Proxy(state, {
    get: (o, k) => (k in methods ? methods[k] : k in o ? o[k] : (...args) => calls.push({ op: k, args, ink: o.fillStyle, alpha: o.globalAlpha, mode: o.globalCompositeOperation })),
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { width, height, calls, getContext: () => ctx }
}
/** Runs `fn` with the canvases a drawing makes kept, in the order it makes them. */
function canvases(fn) {
  const had = globalThis.OffscreenCanvas
  const made = []
  globalThis.OffscreenCanvas = class {
    constructor(w, h) {
      const c = recorder(w, h)
      made.push(c)
      return c
    }
  }
  try { return fn(made) } finally { globalThis.OffscreenCanvas = had }
}

describe('the paper round the scroll’s words (plan 309)', () => {
  it('grows nothing at ×0, and with no strip, on no canvas', () => {
    const made = []
    const canvasOf = (w, h) => { const c = recorder(w, h); made.push(c); return c }
    const strip = recorder(800, 3000)
    for (const k of [0, -1, undefined, null, NaN]) haloStrip(strip, canvasOf, k)
    haloStrip(null, canvasOf, 1)
    expect(made).toEqual([])
    expect(strip.calls).toEqual([])
    // Nowhere to grow it (a lane with no canvas): the strip is left as it is.
    haloStrip(strip, () => null, 1)
    expect(strip.calls).toEqual([])
  })

  it('grows the rim on one canvas the strip’s size: the strip sixteen ways round at each ring, in paper, laid under the ink', () => {
    for (const k of [1, 0.5, 2]) {
      const made = []
      const canvasOf = (w, h) => { const c = recorder(w, h); made.push(c); return c }
      const strip = recorder(812, 2741)
      haloStrip(strip, canvasOf, k)
      expect(made, `×${k}`).toHaveLength(1)
      const [rim] = made
      expect([rim.width, rim.height], `×${k}`).toEqual([strip.width, strip.height])
      // The strip laid sixteen ways round itself at each ring's distance and strength, then once where it is.
      const laid = rim.calls.filter(c => c.op === 'drawImage')
      expect(laid.every(c => c.args[0] === strip && c.mode === 'source-over'), `×${k}`).toBe(true)
      expect(laid).toHaveLength(RIM.length * 16 + 1)
      RIM.forEach(([r, a], ring) => {
        const these = laid.slice(ring * 16, ring * 16 + 16)
        for (const c of these) {
          expect(Math.hypot(c.args[1], c.args[2]), `×${k} ring ${ring}`).toBeCloseTo(r * k, 6)
          expect(c.alpha, `×${k} ring ${ring}`).toBe(a)
        }
        // Every way round, none twice.
        expect(new Set(these.map(c => `${c.args[1].toFixed(3)},${c.args[2].toFixed(3)}`)).size).toBe(16)
      })
      expect(laid.at(-1)).toMatchObject({ args: [strip, 0, 0], alpha: 1 })
      // Then all of it the page's paper, a little of the print through it.
      expect(rim.calls.at(-1)).toMatchObject({ op: 'fillRect', args: [0, 0, strip.width, strip.height], ink: RIM_INK, mode: 'source-in' })
      expect(RIM_INK).toBe('rgba(246,241,228,0.7)')
      // Laid under the ink on the strip itself, and the strip's own mode given back.
      expect(strip.calls).toEqual([{ op: 'drawImage', args: [rim, 0, 0], ink: '#000', alpha: 1, mode: 'destination-over' }])
      expect(strip.getContext().globalCompositeOperation).toBe('source-over')
    }
    // Two pixels whole at ×1, thinning to nothing past five.
    expect(RIM).toEqual([[2, 1], [3.5, 0.4], [5, 0.15]])
  })

  it('lays the rim as much of the page’s paper as the hour’s page is: quieter on the night’s moonlit page', () => {
    const inkAt = hour => {
      const made = []
      const canvasOf = (w, h) => { const c = recorder(w, h); made.push(c); return c }
      haloStrip(recorder(812, 2741), canvasOf, 1, hour)
      return made[0].calls.at(-1).ink
    }
    // By day, at dawn and at dusk, as it was first laid; at night, quieter.
    expect(RIM_AT).toEqual({ dawn: 0.7, day: 0.7, dusk: 0.7, night: 0.45 })
    for (const hour of ['dawn', 'day', 'dusk']) expect(inkAt(hour), hour).toBe(RIM_INK)
    expect(inkAt('night')).toBe('rgba(246,241,228,0.45)')
    expect(rimInk('night')).toBe(inkAt('night'))
    // An hour it does not know, or none, is the day's.
    expect(inkAt(undefined)).toBe(RIM_INK)
    expect(inkAt('noon')).toBe(RIM_INK)
    // The paper itself every hour, only its strength told apart.
    for (const hour of Object.keys(RIM_AT)) expect(rimInk(hour)).toBe(`rgba(246,241,228,${RIM_AT[hour]})`)
  })

  it('grows it on the scroll’s strip, after it, and writes the strip again when its rim or its readings change', () => withPath2D(() => canvases(made => {
    const pl = (tune, extra = {}) => challengePlan(bank, 'n4-01', { style: 'scroll', tune, ...extra })
    const frame = (plan, t) => {
      const { ctx } = drawn()
      ctx.drawImage = () => {}
      drawChallenge(ctx, plan, challengeTimeline(plan), t, null)
    }
    const reading = challengeTimeline(pl({})).segs.find(s => s.key === 'reading')
    const at = reading.start + CH.into + 8
    // The strip, then its rim the strip's size, then the layer it is laid on.
    const on = pl({ 'challenge.halo': 1, 'challenge.ruby': 0 })
    frame(on, at)
    const [strip, rim, layer] = made
    expect(made).toHaveLength(3)
    expect([rim.width, rim.height]).toEqual([strip.width, strip.height])
    expect(layer.height).toBe(FORMATS.story.h)
    // The glide finds the strip by its height: the first canvas not the frame's.
    expect(made.find(c => c.height !== FORMATS.story.h)).toBe(strip)
    // Written first, then the rim laid under the writing.
    const written = strip.calls.filter(c => c.op === 'fillText').length
    expect(written).toBeGreaterThan(0)
    expect(strip.calls.at(-1)).toMatchObject({ op: 'drawImage', args: [rim, 0, 0], mode: 'destination-over' })
    expect(strip.calls.findLastIndex(c => c.op === 'fillText')).toBeLessThan(strip.calls.length - 1)
    // Written once: the next frames lay the same strip.
    frame(on, at + 1 / 60)
    frame(on, at + 2)
    expect(made).toHaveLength(3)
    expect(strip.calls.filter(c => c.op === 'fillText')).toHaveLength(written)
    expect(layer.calls.filter(c => c.op === 'drawImage' && c.args[0] === strip)).toHaveLength(3)

    // Another rim, or none: the strip is written again, with no rim at ×0.
    frame(pl({ 'challenge.halo': 0, 'challenge.ruby': 0 }), at)
    expect(made).toHaveLength(4)
    expect(made[3].height).toBe(strip.height)
    expect(made[3].calls.some(c => c.op === 'drawImage')).toBe(false)
    frame(pl({ 'challenge.halo': 1.5, 'challenge.ruby': 0 }), at)
    expect(made).toHaveLength(6)
    // Another ink for the readings: written again, the readings in it.
    const inksOn = c => new Set(c.calls.filter(x => x.op === 'fillText').map(x => x.ink))
    expect(inksOn(made[3])).toEqual(new Set(['#221d15', '#665c4a']))
    frame(pl({ 'challenge.halo': 0, 'challenge.ruby': 0.9 }), at)
    expect(made).toHaveLength(7)
    expect(inksOn(made[6])).toEqual(new Set(['#221d15', '#29231a']))
    frame(pl({ 'challenge.halo': 0, 'challenge.ruby': 0.9 }), at + 1)
    expect(made).toHaveLength(7)

    // Light words over a photo take no paper round them, however it is tuned.
    frame(pl({ 'challenge.halo': 2 }, { photo: 'carousel/mine.jpg' }), at)
    expect(made).toHaveLength(8)
    expect(made[7].calls.some(c => c.op === 'drawImage')).toBe(false)

    // Another hour: written again, its rim in that hour's ink; the day's (the plan's default) as before.
    frame(pl({ 'challenge.halo': 1, 'challenge.ruby': 0 }, { hour: 'night' }), at)
    expect(made).toHaveLength(10)
    expect(made[9].calls.at(-1)).toMatchObject({ op: 'fillRect', ink: rimInk('night'), mode: 'source-in' })
    frame(pl({ 'challenge.halo': 1, 'challenge.ruby': 0 }, { hour: 'night' }), at + 1)
    expect(made).toHaveLength(10)
    frame(on, at)
    expect(made).toHaveLength(12)
    expect(made[11].calls.at(-1)).toMatchObject({ op: 'fillRect', ink: RIM_INK, mode: 'source-in' })
  })))
})
