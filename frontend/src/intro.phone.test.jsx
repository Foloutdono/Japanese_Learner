import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 入門 at 390×844 (plan 170) ─────────────────────────────────────
// The six screens in the boarding's frame, held against the real
// cascade: nothing scrolls sideways, every screen's drawing stands
// between the head and the foot without pushing the gate off the
// phone, the way out over the gate is a 44 px target, and every sign,
// vowel and word the learner is asked to touch is one too.

vi.mock('./lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), preloadKana: vi.fn(), speakJapanese: vi.fn(), playClick: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => ({ kanaKnown: 'none', dailyNewTarget: 10, lines: null }),
}))

const { default: RideIntro } = await import('./screens/RideIntro')
const { INTRO_STEPS } = await import('./domain/nyumon')

const VOLUMES = {
  vocab: { N5: 678, N4: 643, N3: 1738, N2: 1767, N1: 3229 },
  kanji: { N5: 103, N4: 144, N3: 366, N2: 367, N1: 1232 },
  grammar: { N5: 93, N4: 110, N3: 110, N2: 115, N1: 117 },
  kana: 238,
}
const settle = (ms = 340) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()
const live = root => root.querySelector('.brd__car:not(.brd__car--out)')

describe('入門 at 390×844', () => {
  it('draws each of the six screens between the head and the gate', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/ride/intro']}>
          <RideIntro session={{ access_token: 'tok' }} volumes={VOLUMES} dryRun />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(120)
    const root = screen.container
    for (const step of INTRO_STEPS) {
      const car = live(root)
      expect(car.dataset.intro).toBe(step)
      const head = root.querySelector('.brd__head')
      const stage = car.querySelector('.nyu-stage')
      const foot = car.querySelector('.brd__foot')
      const gate = foot.querySelector('[data-action="continue"]')
      const skip = foot.querySelector('[data-action="skip"]')
      expect(document.documentElement.scrollWidth, step).toBeLessThanOrEqual(390)
      expect(rect(car).width, step).toBeLessThanOrEqual(390)
      expect(rect(stage).right, step).toBeLessThanOrEqual(390)
      expect(rect(stage).left, step).toBeGreaterThanOrEqual(0)
      expect(rect(stage).top, step).toBeGreaterThanOrEqual(rect(head).bottom)
      expect(rect(gate).bottom, step).toBeLessThanOrEqual(844)
      expect(rect(gate).height, step).toBeGreaterThanOrEqual(52)
      // The way out stands over the gate, never under it.
      expect(rect(skip).height, step).toBeGreaterThanOrEqual(44)
      expect(rect(skip).bottom, step).toBeLessThanOrEqual(rect(gate).top + 1)
      // What the screen asks to be touched is a thumb's target.
      for (const el of car.querySelectorAll('.nyu-script, .nyu-vowel__btn, .nyu-word, .nyu-swap__btn')) {
        expect(rect(el).height, `${step} ${el.className}`).toBeGreaterThanOrEqual(44)
      }
      if (step === 'table') {
        // 46 signs across five columns, each still a sign the thumb can find.
        const cell = car.querySelector('[data-kana="け"]')
        expect(rect(cell).width).toBeGreaterThanOrEqual(40)
        expect(rect(car.querySelector('.nyu-table')).right).toBeLessThanOrEqual(390)
      }
      gate.click()
      await settle()
    }
  })
})
