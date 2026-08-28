import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { TrainDoor } from '../components/station/TrainDoor'

// ── The daily pace, at the screen level ────────────────────────
// A session that ends because today's new-item target is spent must
// say so (the paced terminus), and the 臨時列車 button must refetch
// with beyond_target=true and seat the extra cards. Pinned on
// KanaScreen, but the machinery under test (usePace + DoneMessage +
// useCardSession.retry) is the same five screens share.

const apiJson = vi.fn()
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// LangContext pulls the content-translation maps over the network on
// mount — same stub the other browser tests use.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanaScreen } = await import('./KanaScreen')

const PACE_SPENT = { target: 5, newToday: 5, remaining: 0 }
const CARD = {
  card_id: 'kana_xx',
  kana: 'ヴァ', romaji: 'va',
  mode: 'kana.flashcard.f2b', stage: 'new',
  hints: {}, review_preview: {},
}

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

function clickText(screen, text) {
  const btn = [...screen.container.querySelectorAll('button')].find(b => b.textContent.includes(text))
  expect(btn, text).toBeTruthy()
  btn.click()
}

beforeEach(() => {
  apiJson.mockReset()
  // The cached-session sweep must never seed a queue from another test.
  localStorage.clear()
})

describe('KanaScreen pace', () => {
  it('shows the paced terminus, and the extra train refetches beyond the target', async () => {
    // Every batch fetch: paced out (no cards, target spent) unless the
    // 臨時列車 flag rides on the URL — then cards flow again.
    apiJson.mockImplementation(async url => {
      if (url.startsWith('/api/kana/cards')) {
        if (url.includes('beyond_target=true')) return { cards: [CARD], pace: PACE_SPENT }
        return { cards: [], pace: PACE_SPENT }
      }
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <KanaScreen session={{ access_token: 'tok' }} />
          <TrainDoor />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()

    // Set, then mode — the two selection layers over the quiz.
    clickText(screen, 'Katakana (combinaisons)')
    await settle(1000)  // TrainDoor: any pointerdown skips it
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(300)
    clickText(screen, 'Kana → romaji')
    await settle(1000)
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(400)

    // Empty response + spent pace = the paced terminus, not the plain
    // "deck finished" — and the extra-train button is offered.
    const done = screen.container.querySelector('.quiz-done--pace')
    expect(done, `paced terminus panel — page: ${screen.container.textContent.slice(0, 400)}`).toBeTruthy()
    expect(done.textContent).toContain('臨時列車')

    clickText(screen, '臨時列車')
    await settle(400)

    // The refetch carried the flag and the extra card is on screen.
    const beyondCalls = apiJson.mock.calls.filter(c => String(c[0]).includes('beyond_target=true'))
    expect(beyondCalls.length).toBeGreaterThan(0)
    expect(screen.container.querySelector('.quiz-done--pace')).toBeNull()
    expect(screen.container.textContent).toContain('ヴァ')
  })

  it('a genuinely finished deck keeps the plain message when the pace is not spent', async () => {
    apiJson.mockImplementation(async url => {
      if (url.startsWith('/api/kana/cards')) {
        return { cards: [], pace: { target: 5, newToday: 2, remaining: 3 } }
      }
      return {}
    })

    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <KanaScreen session={{ access_token: 'tok' }} />
          <TrainDoor />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    clickText(screen, 'Katakana (combinaisons)')
    await settle(1000)
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(300)
    clickText(screen, 'Kana → romaji')
    await settle(1000)
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle(400)

    expect(screen.container.querySelector('.quiz-done')).toBeTruthy()
    expect(screen.container.querySelector('.quiz-done--pace')).toBeNull()
  })
})
