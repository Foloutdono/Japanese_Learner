import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { CardStamp } from './CardStamp'
// The hold ends in a real CSS animation, and the beats it is timed
// against are CSS too, so the sheet has to be loaded for any of this
// to exist.
import '../../index.css'

// ── The stamp holds exactly as long as it has something to show ──
// This hold is dead time: every study screen keeps the next card
// waiting until the stamp's fade-out ends (see each screen's
// pendingGatesRef), so a hold of 2.3s is 2.3s of the reviewer looking
// at a card they have already answered. It was set by feel and had
// drifted well past the animation it was covering.
//
// Both directions matter, so both are pinned per variant:
//   too short — the fade starts before the last beat has played, and
//     the learner watches a promotion dissolve half-struck;
//   too long  — the seal sits there finished, and the queue with it.
//
// One mount per test, deliberately: three renders in a single browser
// test and the third one never comes up.

const realMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = realMatchMedia })

// Wait for the overlay to enter its 'leaving' phase, then report how
// the named animation stood at that instant: whether it had finished,
// and how long the hold went on after its last frame. The gap has to
// come off the wall clock — a finished CSS animation pins its own
// currentTime at endTime, so it stops counting exactly where the
// interesting part starts.
function atFade(container, selector, animationName, startedAt) {
  return new Promise((resolve, reject) => {
    const tick = () => {
      const overlay = container.querySelector('.card-stamp-overlay')
      if (!overlay) return reject(new Error('the overlay went away before it faded'))
      if (overlay.classList.contains('card-stamp-overlay--leaving')) {
        const el = container.querySelector(selector)
        const anim = el?.getAnimations().find(a => a.animationName === animationName)
        if (!anim) return reject(new Error(`no ${animationName} on ${selector}`))
        const { endTime } = anim.effect.getComputedTiming()
        return resolve({
          // A frame or two short counts as played: the hold and the
          // animation run off independent clocks, so under load the
          // timer can win a race it does not lose in the product by a
          // margin anyone could see. A hold genuinely cut short misses
          // by hundreds of ms, not by one frame.
          finished: anim.playState === 'finished' || endTime - anim.currentTime < 40,
          deadAirMs: (performance.now() - startedAt) - endTime,
        })
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// The beat each hold exists to cover, how much stillness is allowed
// after it, and the whole hold-plus-fade the queue waits through.
const CASES = [
  {
    name: 'a routine promotion',
    transition: { id: 1, to: 'learning' },
    selector: '.card-stamp', animationName: 'card-stamp-strike',
    slackMs: 250, budgetMs: 1200,
  },
  {
    name: 'a graduation',
    transition: { id: 2, to: 'mastered' },
    selector: '.card-stamp__brush', animationName: 'card-stamp-brush-draw',
    slackMs: 250, budgetMs: 1800,
  },
  {
    // The demotion holds longest on purpose: the seal lands into a card
    // that is still burning, so it needs a beat of stillness afterwards
    // to read as the replacement rather than as part of the fire.
    name: 'a demotion',
    transition: { id: 3, to: 'learning', demoted: true },
    selector: '.card-stamp', animationName: 'card-stamp-strike',
    slackMs: 450, budgetMs: 2300,
  },
]

describe('CardStamp — how long it holds', () => {
  for (const { name, transition, selector, animationName, slackMs, budgetMs } of CASES) {
    it(`${name} fades once its last beat has played, and closes its gate soon after`, async () => {
      const started = performance.now()
      let doneAt = 0
      const screen = await render(
        <CardStamp transition={transition} onDone={() => { doneAt = performance.now() - started }} />
      )

      const { finished, deadAirMs } = await atFade(screen.container, selector, animationName, started)
      expect(finished, `${animationName} was still running when the fade began`).toBe(true)
      expect(deadAirMs, `the stamp sat finished for ${Math.round(deadAirMs)}ms before fading`)
        .toBeLessThan(slackMs)

      await new Promise(r => setTimeout(r, budgetMs))
      expect(doneAt, 'the stamp never reported done, so the queue never advances')
        .toBeGreaterThan(0)
      expect(doneAt, `the card was held for ${Math.round(doneAt)}ms`).toBeLessThan(budgetMs)
    }, 30000)
  }

  it('barely holds at all under reduced motion, where nothing animates', async () => {
    // The CSS hands every part of this its final state on the first
    // frame under reduced motion, so there is no arc left to wait out.
    window.matchMedia = vi.fn(q => ({
      matches: String(q).includes('prefers-reduced-motion'),
      addEventListener() {}, removeEventListener() {},
    }))
    const started = performance.now()
    let doneAt = 0
    // The variant that holds longest under normal motion, so what is
    // being measured is the branch and not the transition.
    await render(
      <CardStamp
        transition={{ id: 9, to: 'learning', demoted: true }}
        onDone={() => { doneAt = performance.now() - started }}
      />
    )
    await new Promise(r => setTimeout(r, 1400))
    expect(doneAt, 'the reduced-motion hold never finished').toBeGreaterThan(0)
    expect(doneAt, `held ${Math.round(doneAt)}ms with nothing to show`).toBeLessThan(1000)
  }, 30000)
})
