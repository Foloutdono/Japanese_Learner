import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import RatingBar from './RatingBar'

// Plan 045 — the keyboard contract this whole plan exists to protect.
//
// The buttons are defined best-first and the keyboard handler indexes
// them POSITIONALLY: `QUALITY_BTNS[idx].q` where idx = parseInt(e.key) - 1.
// So "1" means the best answer and the highest digit means the worst,
// regardless of what order the buttons are drawn in on screen.
//
// Plan 045 reordered the bar's VISUAL order to worst-first without
// touching the array or the handler (reversing only the JSX render), so
// this test must keep passing, unchanged, through every later step. If it
// ever starts failing, the array got reversed instead of the rendering,
// and every learner's muscle memory for the digit keys now submits the
// opposite rating with nothing to tell them it happened.
//
// Both bars are pinned. The four-button bar is the six-button one
// without its two extremes (domain/ratingScales.js), and the contract
// that has to survive that is "1 is the best answer" — which is the one
// digit anybody has muscle memory for.
//
// Silent audio playback. RatingBar plays a chime on every rating; keep
// the suite quiet and free of autoplay warnings. Spread the real module
// so any other export lib/audio provides stays intact for the component.
vi.mock('../../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playCorrect: () => {},
  playWrong: () => {},
}))

// LangProvider fetches /api/translations/{kanji,vocab} on mount -- stub
// fetch so this test stays offline. Same pattern as
// components/analysis/AnalyzerHistory.browser.test.jsx.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
})

// `scale` is passed explicitly rather than left to the learner's own
// setting: this file is about the keyboard, and reading the setting
// would make it about the profile fetch instead.
function renderBar(props) {
  return render(
    <LangProvider>
      <RatingBar scale="full" {...props} />
    </LangProvider>
  )
}

function press(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('RatingBar keyboard contract — six buttons', () => {
  it('"1" rates 5 (Perfect)', async () => {
    const onRate = vi.fn()
    await renderBar({ active: true, onRate })
    press('1')
    expect(onRate).toHaveBeenCalledWith(5)
  })

  it('"6" rates 0 (Blackout)', async () => {
    const onRate = vi.fn()
    await renderBar({ active: true, onRate })
    press('6')
    expect(onRate).toHaveBeenCalledWith(0)
  })

  it('"3" rates 3 (Difficult)', async () => {
    const onRate = vi.fn()
    await renderBar({ active: true, onRate })
    press('3')
    expect(onRate).toHaveBeenCalledWith(3)
  })

  it('AZERTY "&" behaves as "1" -> 5', async () => {
    const onRate = vi.fn()
    await renderBar({ active: true, onRate })
    press('&')
    expect(onRate).toHaveBeenCalledWith(5)
  })

  it('fires no call when the bar is inactive', async () => {
    const onRate = vi.fn()
    await renderBar({ active: false, onRate })
    press('1')
    press('6')
    expect(onRate).not.toHaveBeenCalled()
  })
})

describe('RatingBar keyboard contract — four buttons', () => {
  // Wrong / Almost / Difficult / Correct, i.e. qualities 1..4. Same
  // scale, same words, same digits-from-the-best rule.
  it('"1" rates 4 (Correct) — the best answer this bar can give', async () => {
    const onRate = vi.fn()
    await renderBar({ active: true, onRate, scale: 'simple' })
    press('1')
    expect(onRate).toHaveBeenCalledWith(4)
  })

  it('"4" rates 1 (Wrong)', async () => {
    const onRate = vi.fn()
    await renderBar({ active: true, onRate, scale: 'simple' })
    press('4')
    expect(onRate).toHaveBeenCalledWith(1)
  })

  it('offers no fifth or sixth button to press', async () => {
    // The digits past the end of a shorter bar must do NOTHING rather
    // than fall off the array and rate undefined — which reaches the
    // review endpoint as a null quality.
    const onRate = vi.fn()
    const screen = await renderBar({ active: true, onRate, scale: 'simple' })
    expect(screen.container.querySelectorAll('.rating-bar__btn')).toHaveLength(4)
    press('5')
    press('6')
    expect(onRate).not.toHaveBeenCalled()
  })

  it('draws neither blackout nor perfect', async () => {
    const screen = await renderBar({ active: true, onRate: vi.fn(), scale: 'simple' })
    expect(screen.container.querySelector('.rating-bar__btn--q0')).toBeNull()
    expect(screen.container.querySelector('.rating-bar__btn--q5')).toBeNull()
  })

  it('tells the stylesheet how many segments to wrap', async () => {
    // The phone layout redraws its hairlines for a 2x2 or a 2x3 grid,
    // and nth-child cannot count its own siblings.
    const four = await renderBar({ active: true, onRate: vi.fn(), scale: 'simple' })
    expect(four.container.querySelector('.rating-bar__buttons--4')).not.toBeNull()
    const six = await renderBar({ active: true, onRate: vi.fn(), scale: 'full' })
    expect(six.container.querySelector('.rating-bar__buttons--6')).not.toBeNull()
  })
})
