import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 低 — 入門 on a laptop's short window (plan 170, plan 169) ───────
// Drawn at 1440×900, four of the six screens ran past their body at
// 1280×600: the scripts' cards, the table by 208px, the sentence's line
// and the ride. The room gives way first and the drawings draw closer
// (the short desk block of 入門's desk rules), so each holds whole in
// its body down to this window -- the table's 46 signs with け found.

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
const settle = (ms = 900) => new Promise(r => setTimeout(r, ms))
const live = root => root.querySelector('.brd__car:not(.brd__car--out)')

describe('入門 at 1280×600', () => {
  it('holds every screen whole in its body', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/ride/intro']}>
          <RideIntro session={{ access_token: 'tok' }} volumes={VOLUMES} dryRun />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)
    const root = screen.container
    for (const step of INTRO_STEPS) {
      const car = live(root)
      expect(car.dataset.intro).toBe(step)
      if (step === 'table') {
        car.querySelector('[data-kana="け"]').click()
        await settle(60)
      }
      const body = car.querySelector('.brd__body')
      expect(body.scrollHeight - body.clientHeight, step).toBeLessThanOrEqual(1)
      expect(document.documentElement.scrollWidth, step).toBeLessThanOrEqual(1280)
      car.querySelector('[data-action="continue"]').click()
      await settle()
    }
  })
})
