import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import GATE from './components/practice/gate/gate.json'
import { KEEP, PILLAR, SCENE, fitScene } from './components/practice/gate/gateFit'
import { FOLDED, RAISED, folding, pose, rising } from './components/practice/gate/pantograph'
import { workbox } from '../pwa.workbox.js'

// ── 練習の改札 — the painted platform (plan 225) ──────────────────────
// The platform is the owner's painting, cut and lit ahead of time
// (scripts/practice-gate/build.py) into public/practice/gate/<rev>/,
// and drawn over by the app (components/practice/gate). The two are
// written apart, so this holds them together: every layer the gate can
// ask for is on disk at the revision it asks for, the inks its drawn
// parts take at each hour are there, the scene stands in any frame as
// the gate's rules say, and the pantograph stands on the painting's
// measurements.

const HOURS = ['dawn', 'day', 'dusk', 'night']
const ROOT = new URL(`../public/practice/gate/${GATE.rev}/`, import.meta.url)
const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const HEX = /^#[0-9a-f]{6}$/

describe('the painted platform on disk', () => {
  it('holds every layer at every hour, at the revision the app asks for', () => {
    for (const hour of HOURS) {
      for (const layer of ['bg', 'car', 'car2', 'near']) {
        expect(existsSync(new URL(`${layer}-${hour}.webp`, ROOT)), `${layer}-${hour}`).toBe(true)
      }
    }
    expect(existsSync(new URL('band-car.png', ROOT))).toBe(true)
    expect(existsSync(new URL('band-car2.png', ROOT))).toBe(true)
  })

  it('lights the door and fills the frame at every hour', () => {
    for (const hour of HOURS) {
      const leaf = GATE.leaf[hour]
      expect(Object.keys(leaf).sort(), hour).toEqual(['band', 'brass', 'edge', 'faceA', 'glass', 'glassEdge'])
      expect(leaf.faceA, hour).toHaveLength(4)
      expect(leaf.glass, hour).toHaveLength(4)
      expect(leaf.band, hour).toHaveLength(7)
      for (const ink of Object.values(leaf).flat()) expect(ink, hour).toMatch(HEX)
      expect(GATE.fill[hour].top, hour).toMatch(HEX)
      expect(GATE.fill[hour].side, hour).toMatch(HEX)
    }
  })

  it('is kept cache-first under its revision, like Today\'s print', () => {
    const rule = workbox.runtimeCaching.find(r => r.urlPattern({ url: new URL(`https://x.test/practice/gate/${GATE.rev}/bg-day.webp`), sameOrigin: true, request: { mode: 'no-cors' } }) && r.options?.cacheName === 'gate')
    expect(rule?.handler).toBe('CacheFirst')
  })
})

describe('the scene in its frame', () => {
  it('fills a phone between the bars, cropping a sliver of the pillars', () => {
    // 390 × 844, under a 49px HUD and over a 51px tab bar.
    const { u, x, y } = fitScene(390, 744)
    expect(u).toBeCloseTo(744 / SCENE.h, 6)
    expect(x).toBeLessThan(0)
    expect(-x).toBeLessThan(PILLAR * u)
    expect(y).toBeCloseTo(0, 6)
  })

  it('gives up the sky first where the frame is shorter', () => {
    // An installed app under a notch: 663px between the bars.
    const { u, x, y } = fitScene(390, 663)
    expect(u).toBe(1)
    expect(x).toBe(0)
    expect(y).toBeCloseTo(663 - SCENE.h, 6)
    expect(-y).toBeLessThan(KEEP.top)
  })

  it('keeps the wire to the button whole on the shortest, the pillars running on beside it', () => {
    // An iPhone SE in the browser: 375 × 453 between the bars.
    const { u, x, y } = fitScene(375, 453)
    expect((KEEP.bottom - KEEP.top) * u).toBeCloseTo(453, 6)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeCloseTo(-KEEP.top * u, 6)
  })

  it('never crops more than the pillars where the frame is taller', () => {
    const { u, x, y } = fitScene(360, 820)
    expect(u).toBeCloseTo(360 / (SCENE.w - 2 * PILLAR), 6)
    expect(x).toBeCloseTo(-PILLAR * u, 6)
    // What it cannot fill above is the canopy's colour (gate.json's fill).
    expect(y).toBeGreaterThan(0)
    expect(y + SCENE.h * u).toBeCloseTo(820, 6)
  })

  it('stands nowhere until the frame has a size', () => {
    expect(fitScene(0, 0)).toBeNull()
    expect(fitScene(390, 0)).toBeNull()
  })
})

describe('the pantograph', () => {
  it('stands on the painting\'s measurements, on the wire and folded', () => {
    expect(pose(RAISED)).toEqual({
      lower: 'translate(137.06px, 312.18px) rotate(-133.27deg)',
      upper: 'translate(78.71px, 250.19px) rotate(-54.36deg)',
      knee: 'translate(78.71px, 250.19px)',
      head: 'translateY(0.00px)',
      strut: 'translate(128.74px, 310.88px) rotate(-123.07deg) scaleX(1.0000)',
    })
    expect(pose(FOLDED)).toEqual({
      lower: 'translate(137.06px, 312.18px) rotate(-171.49deg)',
      upper: 'translate(52.87px, 299.57px) rotate(4.13deg)',
      knee: 'translate(52.87px, 299.57px)',
      head: 'translateY(104.50px)',
      strut: 'translate(128.74px, 310.88px) rotate(-178.73deg) scaleX(0.8929)',
    })
  })

  it('rises to the wire, touching it at 78% of the way, and folds back onto the roof', () => {
    expect(rising(0)).toBe(FOLDED)
    expect(rising(0.78)).toBeCloseTo(RAISED, 6)
    expect(rising(1)).toBeCloseTo(RAISED, 6)
    // The wire gives it back a little, never above the wire.
    for (let k = 0; k <= 1; k += 0.01) expect(rising(k)).toBeGreaterThanOrEqual(RAISED - 1e-9)
    expect(folding(0)).toBe(RAISED)
    expect(folding(1)).toBe(FOLDED)
  })
})

describe('its styles', () => {
  it('lights the signs, the clock and the pantograph at every hour but the painting\'s own', () => {
    for (const hour of ['dawn', 'dusk', 'night']) {
      expect(CSS, hour).toContain(`.pgate--${hour} {`)
      expect(CSS, hour).toContain(`.pgate--${hour} .pgate-panto {`)
      expect(CSS, hour).toContain(`.pgate--${hour} .pgate-clock {`)
    }
  })

  it('names an ink for every platform on the gate', () => {
    for (const key of ['reading', 'comprehension', 'translation', 'dictation', 'composition', 'exam', 'conversation']) {
      expect(CSS, key).toMatch(new RegExp(`--pg-ink-${key}: #[0-9a-f]{6};`))
    }
  })

  it('keeps the train still under reduced motion', () => {
    const still = CSS.slice(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce) {', CSS.indexOf('.pgate-spark { display: none; }')))
    for (const part of ['.pgate__train', '.pgate-roll__row', '.pgate-leaf', '.pgate-panto__bob--on', '.pgate-clock__hand']) {
      expect(still.slice(0, still.indexOf('}\n}') + 3), part).toContain(part)
    }
  })
})
