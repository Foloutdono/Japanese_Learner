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

// How long the hold lasts, read off its own timer. The beat it covers
// is a CSS animation, which the browser starts when it composites a
// frame; read on the wall clock, a busy runner started the graduation's
// ripple late and the fade began before it had played, with neither
// figure moved. So the clock is faked from the mount and walked from
// timer to timer to the instant the overlay leaves: the fake time then
// is the hold, to the millisecond, set against the beat's own delay and
// duration. One clock.
async function holdOf(container) {
  const leaving = () => container.querySelector('.card-stamp-overlay--leaving')
  const frame = () => new Promise(r => requestAnimationFrame(() => r()))
  const from = Date.now()
  for (let i = 0; i < 20 && !leaving(); i++) {
    await vi.advanceTimersToNextTimerAsync()
    await frame()
  }
  return leaving() ? Date.now() - from : null
}

// The beat each hold exists to cover, how much stillness is allowed
// after it, and the whole hold-plus-fade the queue waits through.
const CASES = [
  {
    name: 'a routine promotion',
    transition: { id: 1, to: 'learning' },
    selector: '.card-stamp__rakkan', animationName: 'card-stamp-rakkan',
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
    selector: '.card-stamp__rakkan', animationName: 'card-stamp-reink',
    slackMs: 250, budgetMs: 1400,
  },
]

describe('CardStamp — how long it holds', () => {
  for (const { name, transition, selector, animationName, slackMs, budgetMs } of CASES) {
    it(`${name} fades once its last beat has played, and closes its gate soon after`, async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
      try {
        // What had just ended, each time the stamp reported done.
        let ended = null
        const doneOn = []
        const screen = await mount(transition, () => { doneOn.push(ended) })
        const overlay = screen.container.querySelector('.card-stamp-overlay')
        overlay.addEventListener('animationend', e => { ended = e.animationName })

        // The beat starts with the stamp: there at the mount.
        const beat = screen.container.querySelector(selector)?.getAnimations().find(a => a.animationName === animationName)
        expect(beat, `no ${animationName} on ${selector}`).toBeTruthy()
        const { endTime } = beat.effect.getComputedTiming()

        const hold = await holdOf(screen.container)
        expect(hold, 'the stamp never began to fade').not.toBeNull()
        expect(hold, `the fade began ${Math.round(endTime - hold)}ms before ${animationName} had played`)
          .toBeGreaterThanOrEqual(endTime)
        expect(hold - endTime, `the stamp sat finished for ${Math.round(hold - endTime)}ms before fading`)
          .toBeLessThan(slackMs)

        // Done on the fade's own end, and the hold and the fade within
        // what the queue may wait.
        const fade = overlay.getAnimations().find(a => a.animationName === 'card-stamp-fade-out')
        expect(fade, 'the overlay never faded').toBeTruthy()
        const fadeMs = fade.effect.getComputedTiming().endTime
        vi.useRealTimers()
        await vi.waitFor(() => expect(doneOn.length, 'the stamp never reported done, so the queue never advances').toBeGreaterThan(0), { timeout: 3000 })
        await Promise.all(overlay.getAnimations({ subtree: true }).map(a => a.finished))
        expect(doneOn).toEqual(['card-stamp-fade-out'])
        expect(hold + fadeMs, `the card was held for ${Math.round(hold + fadeMs)}ms`).toBeLessThan(budgetMs)
      } finally {
        vi.useRealTimers()
      }
    })
  }

  it('presses the stage glyph as the impression and names the stage in the corner', async () => {
    // The impression says which stage was reached without a word —
    // 極 for a graduation — and the word that lands in the top corner
    // is in the learner's language, not a hardcoded one.
    const screen = await mount({ id: 4, to: 'mastered' }, () => {})
    expect(screen.container.querySelector('.card-stamp__rakkan').textContent).toBe('極')
    expect(screen.container.querySelector('.card-stamp__caption').textContent).toBe('Maîtrisé')
  })

  it('stays a detail: the impression is faint, never a poster', async () => {
    // The ink sits under a fifth of full opacity once landed. The
    // specimen and the meaning are what the card is for; the seal is
    // what you notice second.
    const screen = await mount({ id: 5, to: 'learning' }, () => {})
    const seal = screen.container.querySelector('.card-stamp__rakkan')
    await new Promise(r => setTimeout(r, 650))
    expect(parseFloat(getComputedStyle(seal).opacity)).toBeLessThanOrEqual(0.2)
    expect(parseFloat(getComputedStyle(seal).opacity)).toBeGreaterThan(0.05)
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
