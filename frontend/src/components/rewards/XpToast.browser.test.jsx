import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { XpToast } from './XpToast'
import { CardFace } from '../pass/PassCard'
import { LEVEL_CLOCK } from '../../lib/audio/recipes'
import { seedSummary } from '../../stores/profileSummary'
import * as audio from '../../lib/audio'
import '../../index.css'

// ── 進級 — the level-up's card and its sound (plan 200) ─────────────
// The card's struck 辻 fills as the level turns over: the road 辶 and, as
// the road nears full, the crossing 十 it leads to, and both refill to
// what the new level already holds. The sound is scored
// against the card's animations (recipes.js's LEVEL_CLOCK), so this file
// holds the two to each other: a change to the CSS clock that the score
// did not follow fails here, instead of being heard as a sound that has
// slipped off its picture.

vi.mock('../../lib/audio', async o => ({
  ...(await o()), playFareTick: vi.fn(), playLevelCharge: vi.fn(), playLevelBurst: vi.fn(),
}))

const $ = sel => document.querySelector(sel)
const scaleY = el => new DOMMatrix(getComputedStyle(el).transform).d

// Every animation on the page, stopped at `seconds` from the card's arrival.
function seek(seconds) {
  for (const a of document.getAnimations()) {
    if ((a.animationName ?? '').includes('levelup-out')) continue
    a.pause()
    a.currentTime = seconds * 1000
  }
}

// The mark's fill line, in its own square: where a bar's top stands.
const level = bar => Number(bar.getAttribute('y')) + Number(bar.getAttribute('height')) * (1 - scaleY(bar))

async function mount({ xp = 120 } = {}) {
  document.body.innerHTML = ''
  seedSummary({ level: 3, xp, xpPrevLevel: 100, xpForNext: 400, username: 'Aiko', ratingScale: 'simple' })
  await render(
    <LangProvider>
      <XpToast toast={{ id: 1, leveledUp: true, newLevel: 3, amount: 24 }} />
    </LangProvider>
  )
  // Stopped at once, so the real clock never reaches the ring while the
  // test is reading it.
  seek(0)
  await new Promise(r => setTimeout(r, 30))
}

describe('the level-up fills the whole 辻 (plan 200)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('draws a bar of its own for 十, over its extent, empty at rest', async () => {
    await mount()
    const cross = $('.levelup .pcf__seal .ofr-mark__bar--cross')
    expect(cross).not.toBeNull()
    // 十's box in the mark's square: 31 to 783 (markParts.js's CROSS).
    expect(Number(cross.getAttribute('y'))).toBe(31)
    expect(Number(cross.getAttribute('y')) + Number(cross.getAttribute('height'))).toBe(783)
    expect($('.levelup .pcf__seal .ofr-mark__xp--cross path')).not.toBeNull()
  })

  it('fills 十 as the road nears full, to the burst, and empties both together', async () => {
    await mount()
    const road = $('.levelup .pcf__seal .ofr-mark__bar:not(.ofr-mark__bar--cross)')
    const cross = $('.levelup .pcf__seal .ofr-mark__bar--cross')

    seek(0.5)
    expect(scaleY(road)).toBe(0)
    expect(scaleY(cross)).toBe(0)

    // The road is under way and 十 has not been reached.
    seek(1.3)
    expect(scaleY(road)).toBeGreaterThan(0)
    expect(scaleY(road)).toBeLessThan(0.5)
    expect(scaleY(cross)).toBe(0)

    // 十 is rising, behind the road.
    seek(1.85)
    expect(scaleY(cross)).toBeGreaterThan(0.1)
    expect(scaleY(cross)).toBeLessThan(scaleY(road))

    // Held full a beat before the burst: the whole 辻 is lit.
    seek(LEVEL_CLOCK.BURST_AT - 0.05)
    expect(scaleY(road)).toBe(1)
    expect(scaleY(cross)).toBe(1)

    // Both empty in the one breath, then take the line the new level
    // already holds: the road its share, 十 not yet reached by it.
    seek(3)
    expect(scaleY(cross)).toBe(0)
    expect(scaleY(road)).toBeCloseTo(20 / 300, 2)
  })

  it('leaves 十 filled on the same line as the road when the new level holds enough', async () => {
    await mount({ xp: 360 })
    const road = $('.levelup .pcf__seal .ofr-mark__bar:not(.ofr-mark__bar--cross)')
    const cross = $('.levelup .pcf__seal .ofr-mark__bar--cross')

    seek(3)
    expect(scaleY(road)).toBeCloseTo(260 / 300, 2)
    expect(scaleY(cross)).toBeGreaterThan(0.5)
    expect(level(cross)).toBeCloseTo(level(road), 1)
  })

  it('bursts out of the crossing, 辻\'s namesake', async () => {
    await mount()
    const seal = $('.levelup .pcf__seal').getBoundingClientRect()
    const burst = $('.levelup__burst').getBoundingClientRect()
    // The crossing is where 十's bar and stroke meet: (657, 305) of 1000.
    expect(burst.left).toBeCloseTo(seal.left + seal.width * 0.657, -0.3)
    expect(burst.top).toBeCloseTo(seal.top + seal.height * 0.305, -0.3)
  })

  it('fills 十 on the road\'s line wherever the card is drawn, not only in the level-up', async () => {
    const face = async share => {
      document.body.innerHTML = ''
      await render(
        <LangProvider>
          <div style={{ width: 300 }}><CardFace tier="pro" name="Aiko" level={3} share={share} /></div>
        </LangProvider>
      )
      return {
        road: $('.pcf__seal .ofr-mark__bar:not(.ofr-mark__bar--cross)'),
        cross: $('.pcf__seal .ofr-mark__bar--cross'),
      }
    }

    // The line has not reached 十's foot: the road is lit, 十 is not.
    let { road, cross } = await face(0.1)
    expect($('.pcf__seal .ofr-mark__xp--cross path')).not.toBeNull()
    expect(scaleY(road)).toBeCloseTo(0.1, 3)
    expect(scaleY(cross)).toBe(0)

    // Past it: 十 rises on the very line the road's top stands on.
    ;({ road, cross } = await face(0.5))
    expect(scaleY(road)).toBeCloseTo(0.5, 3)
    expect(scaleY(cross)).toBeGreaterThan(0.3)
    expect(level(cross)).toBeCloseTo(level(road), 1)

    // Full is the whole 辻.
    ;({ road, cross } = await face(1))
    expect(scaleY(road)).toBe(1)
    expect(scaleY(cross)).toBe(1)
    expect(level(road)).toBe(31)
    expect(level(cross)).toBe(31)
  })
})

describe('the level-up\'s sound is on the card\'s clock (plan 200)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const animation = (el, name) => el.getAnimations().find(a => a.animationName === name)
  const seconds = (animation_, offset) => offset * animation_.effect.getTiming().duration / 1000

  it('is scored from the road\'s own fill: its start, its span, its ease', async () => {
    await mount()
    const road = $('.levelup .pcf__seal .ofr-mark__bar:not(.ofr-mark__bar--cross)')
    const fill = animation(road, 'levelup-fill')
    const frames = fill.effect.getKeyframes()
    const empty = frames.find(f => f.offset > 0 && scaleOf(f) === 0)
    const full = frames.find(f => scaleOf(f) === 1)
    expect(seconds(fill, empty.offset)).toBeCloseTo(LEVEL_CLOCK.FILL_FROM, 2)
    expect(seconds(fill, full.offset)).toBeCloseTo(LEVEL_CLOCK.FILL_FROM + LEVEL_CLOCK.FILL_SPAN, 2)
    expect(empty.easing).toBe(`cubic-bezier(${LEVEL_CLOCK.FILL_CURVE.join(', ')})`)
  })

  it('is scored from the tremble\'s own steps', async () => {
    await mount()
    const shake = animation($('.levelup__shake'), 'levelup-shake')
    const steps = shake.effect.getKeyframes().filter(f => String(f.transform).includes('rotate'))
    expect(steps).toHaveLength(LEVEL_CLOCK.TREMBLE_STEPS)
    expect(seconds(shake, steps[0].offset)).toBeCloseTo(LEVEL_CLOCK.TREMBLE_FROM, 2)
    expect(seconds(shake, steps[1].offset) - seconds(shake, steps[0].offset)).toBeCloseTo(LEVEL_CLOCK.TREMBLE_STEP, 2)
  })

  it('has its burst on the frame the ring opens', async () => {
    await mount()
    const ring = $('.levelup__ring')
    expect(parseFloat(getComputedStyle(ring).animationDelay)).toBeCloseTo(LEVEL_CLOCK.BURST_AT, 3)
  })

  it('sounds the build on the real fill\'s start, and not the burst with it', async () => {
    await mount()
    await vi.waitFor(() => expect(audio.playLevelCharge).toHaveBeenCalledTimes(1))
    expect(audio.playLevelBurst).not.toHaveBeenCalled()
  })

  it('sounds each of the two once, whatever else animates', async () => {
    await mount()
    // The real fill has started and sounded the build already (above):
    // what else the card animates is not the build, and a second start
    // of the fill is not a second build.
    await vi.waitFor(() => expect(audio.playLevelCharge).toHaveBeenCalledTimes(1))
    const road = $('.levelup .pcf__seal .ofr-mark__bar:not(.ofr-mark__bar--cross)')
    const ring = $('.levelup__ring')
    const start = (el, animationName) =>
      el.dispatchEvent(new AnimationEvent('animationstart', { animationName, bubbles: true }))

    start($('.ofr-mark__bar--cross'), 'levelup-fill-cross')
    start($('.levelup__shake'), 'levelup-shake')
    start(road, 'levelup-fill')
    expect(audio.playLevelCharge).toHaveBeenCalledTimes(1)
    expect(audio.playLevelBurst).not.toHaveBeenCalled()

    start(ring, 'levelup-ring')
    start(ring, 'levelup-ring')
    expect(audio.playLevelBurst).toHaveBeenCalledTimes(1)
    expect(audio.playLevelCharge).toHaveBeenCalledTimes(1)
  })
})

// The scale a keyframe holds, from the `transform` the keyframe was written with.
function scaleOf(frame) {
  const m = /scaleY\(([^)]+)\)/.exec(String(frame.transform))
  return m ? Number(m[1]) : null
}
