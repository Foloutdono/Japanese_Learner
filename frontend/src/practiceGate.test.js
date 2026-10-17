import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import GATE from './components/practice/gate/gate.json'
import { KEEP, PILLAR, SCENE, fitScene } from './components/practice/gate/gateFit'
import { FOLDED, RAISED, folding, pose, rising } from './components/practice/gate/pantograph'
import DESK from './components/practice/gate/desk.json'
import { AIR, CLEAR, ROOF, SCENE as DESK_SCENE, fitDesk } from './components/practice/gate/deskFit'
import { workbox } from '../pwa.workbox.js'

// ── 練習の改札 — the painted platform (plan 225) ──────────────────────
// The platform is the owner's painting, cut and lit ahead of time
// (scripts/practice-gate/build.py) into public/practice/gate/<rev>/,
// and drawn over by the app (components/practice/gate). The two are
// written apart, so this holds them together: every layer the gate can
// ask for is on disk at the revision it asks for, the inks its drawn
// parts take at each hour are there, the scene stands in any frame as
// the gate's rules say, and the pantograph stands on the painting's
// measurements. The desk's own painting (plan 244, scripts/practice-gate/
// desk.py into public/practice/gate/desk/<rev>/) is held the same way.

const HOURS = ['dawn', 'day', 'dusk', 'night']
const ROOT = new URL(`../public/practice/gate/${GATE.rev}/`, import.meta.url)
const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const HEX = /^#[0-9a-f]{6}$/

describe('the painted platform on disk', () => {
  it('holds every layer at every hour, at the revision the app asks for', () => {
    for (const hour of HOURS) {
      for (const layer of ['bg', 'clouds', 'car', 'car2', 'near']) {
        expect(existsSync(new URL(`${layer}-${hour}.webp`, ROOT)), `${layer}-${hour}`).toBe(true)
      }
    }
    expect(existsSync(new URL('band-car.png', ROOT))).toBe(true)
    expect(existsSync(new URL('band-car2.png', ROOT))).toBe(true)
    expect(existsSync(new URL('sky.png', ROOT))).toBe(true)
    expect(GATE.sky.top).toBeGreaterThanOrEqual(0)
    expect(GATE.sky.top + GATE.sky.height).toBeLessThanOrEqual(SCENE.h)
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

// ── 机 — the desk's painted platform (plan 244) ──
const DESK_ROOT = new URL(`../public/practice/gate/desk/${DESK.rev}/`, import.meta.url)

describe('the desk\'s painted platform on disk', () => {
  it('holds every layer and both leaves at every hour, at the revision the app asks for', () => {
    for (const hour of HOURS) {
      for (const layer of ['bg', 'car', 'car2', 'near', 'leaf-l', 'leaf-r']) {
        expect(existsSync(new URL(`${layer}-${hour}.webp`, DESK_ROOT)), `${layer}-${hour}`).toBe(true)
      }
      expect(DESK.fill[hour].top, hour).toMatch(HEX)
      expect(DESK.fill[hour].side, hour).toMatch(HEX)
    }
    for (const mask of ['band-car', 'band-car2', 'band-leaf-l', 'band-leaf-r']) {
      expect(existsSync(new URL(`${mask}.png`, DESK_ROOT)), mask).toBe(true)
    }
  })

  it('keeps what it draws over the painting inside it', () => {
    const { w, h } = DESK_SCENE
    const { door, clock, sign, car } = DESK
    expect(car.top + car.h).toBeLessThanOrEqual(h)
    // The door on the car, the clock and the sign under the canopy.
    expect(door.y).toBeGreaterThanOrEqual(car.top)
    expect(door.y + door.h).toBeLessThanOrEqual(car.top + car.h)
    expect(door.x + door.w).toBeLessThanOrEqual(w)
    expect(clock.cx - clock.r).toBeGreaterThan(door.x + door.w)
    expect(clock.cy + clock.r).toBeLessThan(car.top)
    expect(sign.right).toBeLessThan(door.x)
    for (const [x0, x1] of DESK.pillars) expect(x1 - x0).toBeGreaterThan(0)
  })

  it('is kept cache-first under its revision, as the phone\'s is', () => {
    const rule = workbox.runtimeCaching.find(r => r.urlPattern({ url: new URL(`https://x.test/practice/gate/desk/${DESK.rev}/bg-day.webp`), sameOrigin: true, request: { mode: 'no-cors' } }) && r.options?.cacheName === 'gate')
    expect(rule?.handler).toBe('CacheFirst')
  })
})

// The board is Today's column: clamp(360px, 36%, 440px), 28px from the
// frame's right edge. What it leaves at the left is the stage.
const stageOf = w => w - 28 - Math.min(440, Math.max(360, 0.36 * w))
const door = u => (DESK.door.x + DESK.door.w + AIR) * u
const clockAt = (u, x) => [(DESK.clock.cx - DESK.clock.r) * u + x, (DESK.clock.cx + DESK.clock.r) * u + x]

describe('the desk\'s scene in its frame', () => {
  it('stands whole in the picture\'s window: the sign, the door, the clock', () => {
    // 1877 × 920 less the rail.
    const w = 1621
    const { u, x, y } = fitDesk(w, 920, stageOf(w))
    expect(u).toBeCloseTo(920 / DESK_SCENE.h, 6)
    expect(x).toBe(0)
    expect(y).toBe(0)
    expect(clockAt(u, x)[1]).toBeLessThan(stageOf(w))
  })

  it('lets the sign go whole at the desk\'s tightest, the door and the clock on the stage', () => {
    // 1100 × 800 less the rail.
    const w = 844
    const stage = stageOf(w)
    const { u, x, y } = fitDesk(w, 800, stage)
    expect(u).toBeCloseTo(800 / DESK_SCENE.h, 6)
    expect(y).toBe(0)
    expect(door(u) + x).toBeLessThanOrEqual(stage + 1e-9)
    expect(x + (DESK.sign.right + CLEAR) * u).toBeLessThanOrEqual(1e-9)
    // The clock whole, at the stage's edge.
    expect((DESK.clock.cx + DESK.clock.r + CLEAR) * u + x).toBeCloseTo(stage, 6)
  })

  it('keeps the sign and takes the clock under the board on a laptop, giving up a little roof', () => {
    // 1280 × 800 less the rail: at the frame's height the clock would
    // stand half under the board's edge.
    const w = 1024
    const stage = stageOf(w)
    expect(clockAt(800 / DESK_SCENE.h, 0)[0]).toBeLessThan(stage)
    const { u, x, y } = fitDesk(w, 800, stage)
    expect(x).toBe(0)
    expect(clockAt(u, x)[0]).toBeCloseTo(stage, 6)
    expect(y).toBeCloseTo(800 - DESK_SCENE.h * u, 6)
    expect(-y).toBeLessThanOrEqual(ROOF * u)
  })

  it('covers every frame, the door on the stage, the sign whole or gone, the clock whole where it can be', () => {
    for (let w = 844; w <= 2400; w += 37) {
      for (let h = 560; h <= 1300; h += 23) {
        const stage = stageOf(w)
        const { u, x, y } = fitDesk(w, h, stage)
        const at = `${w}×${h}`
        expect(x, at).toBeLessThanOrEqual(0)
        expect(y, at).toBeLessThanOrEqual(0)
        expect(x + DESK_SCENE.w * u, at).toBeGreaterThanOrEqual(w - 1e-6)
        expect(y + DESK_SCENE.h * u, at).toBeGreaterThanOrEqual(h - 1e-6)
        expect(-y, at).toBeLessThanOrEqual(ROOF * u + 1e-6)
        expect(door(u) + x, at).toBeLessThanOrEqual(stage + 1e-6)
        expect(x === 0 || x + DESK.sign.right * u <= 0, at).toBe(true)
        const [left, right] = clockAt(u, x)
        const cut = left < stage && right > stage
        // Cut only where the sign stands and no roof is left to give.
        if (cut) expect(x === 0 && (DESK_SCENE.h - ROOF) * (stage / (left / u)) > h, at).toBe(true)
      }
    }
  })

  it('stands nowhere until the frame has a size', () => {
    expect(fitDesk(0, 0, 0)).toBeNull()
    expect(fitDesk(844, 0, 456)).toBeNull()
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

  it('keeps the desk\'s train still under reduced motion', () => {
    const desk = CSS.slice(CSS.indexOf('.pdesk__train {'))
    const still = desk.slice(desk.indexOf('@media (prefers-reduced-motion: reduce) {'))
    for (const part of ['.pdesk__train', '.pdesk-leaf', '.pdesk-band']) {
      expect(still.slice(0, still.indexOf('}')), part).toContain(part)
    }
  })

  it('keeps the train still under reduced motion', () => {
    const still = CSS.slice(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce) {', CSS.indexOf('.pgate-spark { display: none; }')))
    for (const part of ['.pgate__train', '.pgate-roll__row', '.pgate-leaf', '.pgate-panto__bob--on', '.pgate-clock__hand']) {
      expect(still.slice(0, still.indexOf('}\n}') + 3), part).toContain(part)
    }
  })
})
