import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a browse has a side too (plan 116) ────────────────────────
// The fast review (components/study/ReviewDeck.jsx) flips through cards
// already studied and rates none of them. On the desk it used to stand
// its card alone in the width a card run gives its session panel. It
// now stands the same column, holding the one thing a browse has to
// show there: the revealed card's dictionary entry, docked by the
// reveal and never before it, and taken down by the next card. No
// tally — nothing is rated. An empty browse stands no column: there is
// no card whose entry it could promise. The phone's side is
// deskfree.phone.
//
// The real runs, on their real routes: the side is each run's to pass.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playKana: vi.fn(), speakJapanese: vi.fn(),
  playCorrect: vi.fn(), playWrong: vi.fn(), playArrival: vi.fn(),
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabRun } = await import('./screens/VocabRun')
const { default: KanaRun } = await import('./screens/KanaRun')
const { default: KanjiRun } = await import('./screens/KanjiRun')

const SESSION = { access_token: 'tok' }
// Each browse's cards, and the dictionary's answer for each by term.
const CARDS = {
  vocab: [
    { card_id: 'vocab_N5_駅_えき', kanji: '駅', kana: 'えき', meaning: 'station', stage: 'mastered' },
    { card_id: 'vocab_N5_川_かわ', kanji: '川', kana: 'かわ', meaning: 'river', stage: 'learning' },
  ],
  kana: [
    { card_id: 'kana_a', kana: 'あ', romaji: 'a', stage: 'mastered' },
    { card_id: 'kana_i', kana: 'い', romaji: 'i', stage: 'learning' },
  ],
  kanji: [
    { card_id: 'kanji_N5_山', kanji: '山', kana: 'サン・やま', meaning: 'mountain', stage: 'mastered' },
    { card_id: 'kanji_N5_川', kanji: '川', kana: 'セン・かわ', meaning: 'river', stage: 'learning' },
  ],
}
const ENTRIES = {
  駅: { type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5' },
  川: { type: 'vocab', kanji: '川', kana: 'かわ', meaning: 'river', level: 'N5' },
  あ: { type: 'hiragana', kana: 'あ', romaji: 'a', meaning: 'a', level: 'Hiragana', group: 'vowels' },
  山: { type: 'kanji', kanji: '山', kana: 'サン・やま', meaning: 'mountain', level: 'N5' },
}
let cards = CARDS

beforeEach(() => {
  cards = CARDS
  localStorage.clear()
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const path = String(url)
    const source = path.match(/^\/api\/(vocab|kana|kanji)\/review-cards/)?.[1]
    let body = {}
    if (source) body = { cards: cards[source] }
    else if (path.startsWith('/api/dictionary?')) {
      const q = new URLSearchParams(path.split('?')[1]).get('q')
      body = { results: ENTRIES[q] ? [ENTRIES[q]] : [] }
    }
    return { ok: true, status: 200, json: async () => body }
  })
})

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const $ = s => document.querySelector(s)
const lookups = () => apiFetch.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/dictionary?'))

function Browse({ at }) {
  return (
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/learn/vocab/:level/:mode" element={<VocabRun session={SESSION} />} />
          <Route path="/learn/kana/:set/:mode" element={<KanaRun session={SESSION} />} />
          <Route path="/learn/kanji/:level/:mode" element={<KanjiRun session={SESSION} />} />
          <Route path="*" element={<p className="probe-away">away</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('a browse on the desk', () => {
  it('stands the entry\'s column on the right edge, the card centred beside it, and no tally', async () => {
    await render(<Browse at="/learn/vocab/N5/fast_review" />)
    await settle(300)
    expect($('.review-deck__counter')?.textContent, `no browse — page: ${document.body.textContent.slice(0, 200)}`).toBe('1 / 2')
    expect($('.screen').classList.contains('desk-run')).toBe(true)
    const side = $('.desk-run__side').getBoundingClientRect()
    expect(side.width).toBe(360)
    expect(Math.abs(side.right - $('.screen').getBoundingClientRect().right)).toBeLessThan(1)
    const card = $('.flashcard').getBoundingClientRect()
    expect(card.right).toBeLessThanOrEqual(side.left)
    expect(Math.abs((card.left + card.right) / 2 - side.left / 2)).toBeLessThan(12)
    // Named for what it holds: the dictionary, not "this run".
    expect(['Dictionary', 'Dictionnaire']).toContain($('.desk-run__side').getAttribute('aria-label'))
    // A browse rates nothing, so it counts nothing.
    expect($('.desk-tally')).toBeNull()
    expect($('.desk-run__side .record')).toBeNull()
  })

  it('docks the entry after the reveal, never before, and clears it with the next card', async () => {
    await render(<Browse at="/learn/vocab/N5/fast_review" />)
    await settle(300)
    expect($('.desk-entry')).toBeNull()
    expect($('.desk-run__side .desk-run__note')).not.toBeNull()
    expect(lookups()).toEqual([])

    press(' ')
    await settle(300)
    expect($('.desk-run__side .desk-run__note')).toBeNull()
    expect($('.desk-entry')).not.toBeNull()
    expect($('.desk-entry').textContent).toMatch(/station/i)
    // The card's reading travels with its surface: the lookup lands on
    // the word in hand, never a homograph.
    const [only] = lookups()
    const params = new URLSearchParams(only.split('?')[1])
    expect([params.get('q'), params.get('kana'), params.get('category')]).toEqual(['駅', 'えき', 'vocab'])
    // The 🔍 would open the same entry in a sheet; it is not offered.
    expect([...document.querySelectorAll('.reveal-action-btn')].some(b => /dictionnaire|dictionary/i.test(b.getAttribute('aria-label')))).toBe(false)

    $('.browse-nav .btn-primary').click()
    await settle(300)
    expect($('.review-deck__counter').textContent).toBe('2 / 2')
    expect($('.desk-entry')).toBeNull()
    expect($('.desk-run__side .desk-run__note')).not.toBeNull()
  })

  it.each([
    ['kana', '/learn/kana/hiragana_basic/fast_review', 'あ', 'hiragana'],
    ['kanji', '/learn/kanji/N5/fast_review', '山', 'kanji'],
  ])('docks a %s card\'s entry the same way', async (_, at, term, category) => {
    await render(<Browse at={at} />)
    await settle(300)
    expect($('.desk-run__side')).not.toBeNull()
    expect($('.desk-tally')).toBeNull()
    expect($('.desk-entry')).toBeNull()
    press(' ')
    await settle(300)
    expect($('.desk-entry')).not.toBeNull()
    const params = new URLSearchParams(lookups()[0].split('?')[1])
    expect([params.get('q'), params.get('category')]).toEqual([term, category])
  })

  it('stands no column over an empty browse', async () => {
    cards = { ...CARDS, vocab: [] }
    await render(<Browse at="/learn/vocab/N5/fast_review" />)
    await settle(300)
    expect($('main.stage')).not.toBeNull()
    expect($('.review-deck__counter')).toBeNull()
    expect($('.screen').className).toBe('screen')
    expect($('.desk-run__side')).toBeNull()
  })

  it('fits a laptop: the head at the top, the way through above the level bar', async () => {
    await render(<Browse at="/learn/kanji/N5/fast_review" />)
    await settle(300)
    expect($('.stage__head').getBoundingClientRect().top).toBeLessThan(80)
    const floor = $('.lvlbar').getBoundingClientRect().top
    expect($('.browse-nav').getBoundingClientRect().bottom).toBeLessThanOrEqual(floor)
  })
})
