import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// The gate hall at 390px must never scroll sideways. The browser lane
// cannot say this (one default viewport, no layout assertions by
// policy); the phone lane can. Same mocks as HomeScreen.browser.test.jsx
// — the screen is mounted for real and the payloads are the ones the
// hall draws its map and its gate from.

const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playAnnouncement: vi.fn(),
  startAmbiance: vi.fn(),
  stopAmbiance: vi.fn(),
}))

vi.mock('../stores/departure', () => ({ beginDeparture: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: HomeScreen } = await import('./HomeScreen')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const TODAY = {
  total: 24,
  by_source: { kanji: 12, vocab: 8, kana: 4, personal: 3 },
  lanes: [
    { kind: 'section', source: 'kanji', deck: 'N4', mode: 'kanji.write_kanji', due: 12 },
    { kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 8 },
    { kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.mcq.reading', due: 4 },
  ],
  next_due: null,
  pace: null,
}

const STATS = {
  vocab: {
    N5: { 'vocab.flashcard.f2b': { total: 10, new: 0, learning: 0, mastered: 10 } },
    N4: { 'vocab.flashcard.f2b': { total: 10, new: 0, learning: 10, mastered: 0 } },
  },
  kana: {}, kanji: {}, grammar: {},
  items: {
    vocab: {
      N5: { total: 10, learned: 10, score: 1 },
      N4: { total: 10, learned: 0, score: 0.5 },
    },
    kana: {}, kanji: {}, grammar: {},
  },
}

// Names the culprits when it fails, so the message is the fix.
function overflowing() {
  const limit = window.innerWidth + 1
  return [...document.querySelectorAll('body *')]
    .filter(el => el.getBoundingClientRect().right > limit)
    .map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')}`)
    .slice(0, 8)
}

describe('HomeScreen on a phone', () => {
  it('fits 390px with no horizontal overflow', async () => {
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return TODAY
      if (url === '/api/stats') return STATS
      return {}
    })
    await render(
      <LangProvider>
        <MemoryRouter>
          <HomeScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(overflowing()).toEqual([])
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
