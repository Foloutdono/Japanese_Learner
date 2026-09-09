import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The fast review keeps the pass ────────────────────────────
// A browse rates nothing and is charged nothing, and it used to drop
// the pocket pass for that reason — which left the one screen where a
// learner is deciding what to study next as the one screen that would
// not tell them what is left to spend on it. The stage frame takes the
// HUD away, so this row is the only place inside a run the balance can
// be read and the sheet reached (StageHead's `pass`).
//
// Pinned on kana because it is the shortest of the four browses; vocab,
// kanji and grammar hand StudyStage the same head.

const apiFetch = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(async () => ({ cards: [] })),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanaRun } = await import('./KanaRun')

const CARDS = [
  { card_id: 'kana_a', kana: 'あ', romaji: 'a', stage: 'mastered' },
  { card_id: 'kana_i', kana: 'い', romaji: 'i', stage: 'learning' },
]

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async (url) => ({
    ok: true, status: 200,
    json: async () => (String(url).startsWith('/api/kana/review-cards') ? { cards: CARDS } : {}),
  }))
  localStorage.clear()
})

describe('the kana fast review', () => {
  it('browses on the stage with the pocket pass in the head', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/kana/hiragana_basic/fast_review']}>
          <Routes>
            <Route path="/learn/kana/:set" element={<div className="platforms-probe">platforms</div>} />
            <Route path="/learn/kana/:set/:mode" element={<KanaRun session={{ access_token: 'tok' }} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)

    const stage = screen.container.querySelector('main.stage')
    expect(stage, `no stage — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()

    // The browse itself: the way out, the counter, the card.
    expect(stage.querySelector('.stage__leave')).toBeTruthy()
    expect(stage.querySelector('.review-deck__counter').textContent).toBe('1 / 2')
    expect(stage.querySelector('.prompt-card')).toBeTruthy()

    // Ungraded, still: no rating bar, so nothing can be charged.
    expect(stage.querySelector('.rating-bar')).toBeNull()

    // And the pass, with the balance on it — the whole point of this
    // file.
    const pass = stage.querySelector('.hud__pass')
    expect(pass, 'the fast review dropped the pocket pass').toBeTruthy()
    expect(pass.querySelector('.hud__pass-fig').textContent).toContain('24')
  })
})
