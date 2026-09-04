import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { CardStamp } from './CardStamp'
// The hold ends in a real CSS animation, and the beats it is timed
// against are CSS too, so the sheet has to be loaded for any of this
// to exist.
import '../../index.css'

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playStamp: vi.fn() }))

// LangProvider fetches the content translations on mount — the same
// offline stub every other browser test uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

// ── The stamp holds exactly as long as it has something to show ──
// This hold is dead time: every study screen keeps the next card
// waiting until the stamp's fade-out ends (see hooks/useReviewGates),
// so a hold of 2.3s is 2.3s of the reviewer looking at a card they
// have already answered. The press replaced a production that held
// that long; these pin that it never drifts back.
//
// Both directions matter, so both are pinned per variant:
//   too short — the fade starts before the last beat has played, and
//     the learner watches a seal dissolve half-struck;
//   too long  — the seal sits there finished, and the queue with it.
//
// One mount per test, deliberately: three renders in a single browser
// test and the third one never comes up.

const realMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = realMatchMedia })

function mount(transition, onDone) {
  return render(
    <LangProvider>
      <CardStamp transition={transition} onDone={onDone} />
    </LangProvider>
  )
}

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
    selector: '.card-stamp__seal', animationName: 'card-stamp-strike',
    slackMs: 250, budgetMs: 1200,
  },
  {
    name: 'a graduation',
    transition: { id: 2, to: 'mastered' },
    selector: '.card-stamp__ripple', animationName: 'card-stamp-ripple',
    slackMs: 250, budgetMs: 1500,
  },
  {
    name: 'a demotion',
    transition: { id: 3, to: 'learning', demoted: true },
    selector: '.card-stamp__seal', animationName: 'card-stamp-reink',
    slackMs: 250, budgetMs: 1400,
  },
]

describe('CardStamp — how long it holds', () => {
  for (const { name, transition, selector, animationName, slackMs, budgetMs } of CASES) {
    it(`${name} fades once its last beat has played, and closes its gate soon after`, async () => {
      const started = performance.now()
      let doneAt = 0
      const screen = await mount(transition, () => { doneAt = performance.now() - started })

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

  it('lands on the corner the resting seal sits in, wearing its form', async () => {
    // The press is the badge being struck, so it has to BE the badge:
    // same classes, so an equipped 印 shapes it, and the same stage
    // colour, so 極 lands gold and 習 vermillion.
    const screen = await mount({ id: 4, to: 'mastered' }, () => {})
    const seal = screen.container.querySelector('.card-stamp__seal')
    expect(seal.classList.contains('stage-badge')).toBe(true)
    expect(seal.classList.contains('stage-badge--mastered')).toBe(true)
    expect(seal.textContent).toBe('極')
    // The caption names the stage in the learner's language, not in a
    // hardcoded one.
    expect(screen.container.querySelector('.card-stamp__caption').textContent).toBe('Maîtrisé')
  })

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
    await mount({ id: 9, to: 'mastered' }, () => { doneAt = performance.now() - started })
    await new Promise(r => setTimeout(r, 1200))
    expect(doneAt, 'the reduced-motion hold never finished').toBeGreaterThan(0)
    expect(doneAt, `held ${Math.round(doneAt)}ms with nothing to show`).toBeLessThan(900)
  }, 30000)
})
