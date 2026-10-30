import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 予熱 — the cards below the fold stand in until near (plan 291) ──
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

const WORDS = [['電車', 'でんしゃ', 'electric train'], ['駅', 'えき', 'station'], ['テープレコーダー', '', 'tape recorder, with a long gloss'], ['日曜日', 'にちようび', 'Sunday']]
const ROWS = Array.from({ length: 48 }, (_, i) => {
  const [kanji, kana, meaning] = WORDS[i % WORDS.length]
  return { type: 'vocab', kanji: `${kanji}${i}`, kana: kana || kanji, meaning, level: 'N5', status: { status: 'new' }, furigana: kana ? [{ text: kanji, reading: kana }] : undefined }
})

describe('the catalogue at 390×844', () => {
  it('stands the cards below the fold in at a card\'s own height', async () => {
    apiFetch.mockImplementation(async path => ({
      ok: true,
      json: async () => (String(path).startsWith('/api/dictionary/radicals') ? { groups: [] } : { results: ROWS, total: 48, has_more: false }),
    }))
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dictionary?category=vocab']}>
          <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await vi.waitFor(() => expect(document.querySelectorAll('.dict-entry-card')).toHaveLength(48), { timeout: 5000 })
    await new Promise(r => setTimeout(r, 300))
    const cards = [...document.querySelectorAll('.dict-entry-card')]
    // Some are skipped: the last is far below a phone's fold.
    const inside = card => card.querySelector('.dict-entry-card__meaning').checkVisibility({ contentVisibilityAuto: true })
    expect(inside(cards.at(-1))).toBe(false)
    expect(inside(cards[0])).toBe(true)
    const drawn = cards[0].getBoundingClientRect().height
    expect(drawn).toBeGreaterThan(100)
    for (const card of cards) expect(card.getBoundingClientRect().height).toBeCloseTo(drawn, 0)
  })

  // 予熱 (plan 291): a screenful drawn first, the rest a frame later,
  // in the meantime a card's empty place: the page is its full length
  // from the first frame, and the walk and the sentinel find it so.
  it('draws a screenful first and the rest a frame later, the page its length throughout', async () => {
    apiFetch.mockImplementation(async path => ({
      ok: true,
      json: async () => (String(path).startsWith('/api/dictionary/radicals') ? { groups: [] } : { results: ROWS, total: 48, has_more: false }),
    }))
    const snap = () => ({
      cards: document.querySelectorAll('.dict-grid > button.dict-entry-card').length,
      places: document.querySelectorAll('.dict-grid > .dict-entry-card--pending').length,
      length: document.querySelector('.dict-grid').getBoundingClientRect().height,
      // No place is ever seen.
      unseen: [...document.querySelectorAll('.dict-entry-card--pending')].every(el => getComputedStyle(el).visibility === 'hidden'),
    })
    const first = new Promise(resolve => {
      const mo = new MutationObserver(() => {
        if (!document.querySelector('.dict-grid')) return
        mo.disconnect()
        resolve(snap())
      })
      mo.observe(document.body, { childList: true, subtree: true })
    })
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dictionary?category=vocab']}>
          <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    const at = await first
    expect(at.cards).toBeGreaterThanOrEqual(10)
    expect(at.cards).toBeLessThan(48)
    expect(at.cards + at.places).toBe(48)
    expect(at.unseen).toBe(true)
    await vi.waitFor(() => expect(snap().cards).toBe(48), { timeout: 3000 })
    const whole = snap()
    expect(whole.places).toBe(0)
    expect(whole.length).toBeCloseTo(at.length, 0)
  })
})
