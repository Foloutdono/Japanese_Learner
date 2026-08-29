import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import RatingBar from './RatingBar'

// Plan 045 — the keyboard contract this whole plan exists to protect.
//
// QUALITY_BTNS is defined best-first (q5 Perfect ... q0 Blackout) and the
// keyboard handler indexes it POSITIONALLY: `QUALITY_BTNS[idx].q` where
// idx = parseInt(e.key) - 1. So "1" means Perfect and "6" means Blackout
// TODAY, regardless of what order the buttons are drawn in on screen.
//
// The plan reorders the bar's VISUAL order to worst-first without touching
// the array or the handler (reversing only the JSX render), so this test
// must keep passing, unchanged, through every later step. If it ever
// starts failing, the array got reversed instead of the rendering, and
// every learner's muscle memory for the digit keys now submits the
// opposite rating with nothing to tell them it happened.
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

function renderBar(props) {
  return render(
    <LangProvider>
      <RatingBar {...props} />
    </LangProvider>
  )
}

function press(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('RatingBar keyboard contract', () => {
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
