import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 予熱 — the cards below the fold stand in until near (plan 292) ──
// A page is fifty cards and a phone shows ten: the rest are not laid
// out until they near the screen (content-visibility), each standing in
// at a card's height. The stand-in is the card's own height, so the
// page is as long as it was and nothing moves when one is drawn.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({ decks: [] })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
const { apiFetch } = await import('./lib/api')

// The desk lays grammar out as a list (DictionaryScreen's DeskColumns
// `page`), a row each: the rows stand in at a row's height.
const PATTERNS = ['〜てから', '〜ました／〜ませんでした', 'は', '〜なければならない']
const WORDS = [['電車', 'でんしゃ', 'electric train'], ['駅', 'えき', 'station'], ['テープレコーダー', '', 'tape recorder, with a long gloss'], ['日曜日', 'にちようび', 'Sunday']]
const ROWS = Array.from({ length: 48 }, (_, i) => {
  const pattern = `${PATTERNS[i % PATTERNS.length]}${i}`
  return { type: 'grammar', raw_id: `grammar_N5_${pattern}`, level: 'N5', pattern, meaning: WORDS[i % WORDS.length][2], status: { status: 'not_started' } }
})

describe('the catalogue on the desk, as rows', () => {
  it('stands the rows below the fold in at a row\'s own height', async () => {
    apiFetch.mockImplementation(async path => ({
      ok: true,
      json: async () => (String(path).startsWith('/api/dictionary/radicals') ? { groups: [] } : { results: ROWS, total: 48, has_more: false }),
    }))
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dictionary?category=grammar']}>
          <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await vi.waitFor(() => expect(document.querySelectorAll('.dict-entry-card')).toHaveLength(48), { timeout: 5000 })
    await new Promise(r => setTimeout(r, 300))
    const cards = [...document.querySelectorAll('.dict-entry-card')]
    // Some are skipped: the last is far below the desk's fold.
    const inside = card => card.querySelector('.dict-entry-card__meaning').checkVisibility({ contentVisibilityAuto: true })
    expect(inside(cards.at(-1))).toBe(false)
    expect(inside(cards[0])).toBe(true)
    const drawn = cards[0].getBoundingClientRect().height
    expect(document.querySelector('.desk-dict--page')).not.toBeNull()
    expect(drawn).toBeGreaterThan(40)
    // The last row has no rule under it (its own 1px less, drawn or not).
    for (const card of cards.slice(0, -1)) expect(card.getBoundingClientRect().height).toBeCloseTo(drawn, 0)
  })
})
