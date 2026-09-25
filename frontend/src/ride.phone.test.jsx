import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 試乗 at phone width (plan 098) ───────────────────────────────
// The ride is a run: at 390×844 the rating bar docks on the bottom
// edge, the note sits inside the viewport above it and never covers
// the card's face, ‹ Skip is a 44 px target, and nothing scrolls
// sideways.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./stores/profileSummary', async (o) => ({
  ...(await o()),
  useProfileSummary: () => ({ kanaKnown: 'both', dailyNewTarget: 10 }),
}))
vi.mock('./lib/audio', async (o) => ({
  ...(await o()), playCorrect: vi.fn(), playWrong: vi.fn(), playClick: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: RideRun } = await import('./screens/RideRun')

const CARDS = [
  { card_id: 'vocab_N3__こんにちは', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b', kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N3', romaji: 'konnichiwa', stage: null, review_preview: null, hints: {} },
  { card_id: 'vocab_N5_駅_えき', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', romaji: 'eki', stage: null, review_preview: null, hints: {} },
]
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()

describe('the test ride at 390×844', () => {
  it('docks the bar, keeps the note in the viewport, and sizes Skip for a thumb', async () => {
    expect(window.innerWidth).toBe(390)
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/ride/cards']}>
          <Routes>
            <Route path="/ride/cards" element={<RideRun session={{ access_token: 'tok' }} dryRun cards={CARDS} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)
    const root = screen.container
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect(rect(root.querySelector('.stage__leave')).height).toBeGreaterThanOrEqual(44)

    // The first note: over the card's top edge, inside the viewport,
    // and letting taps through to the card under it.
    const card = root.querySelector('[data-guide="ride.card"]')
    let note = document.querySelector('.guide-callout')
    expect(note.dataset.place).toBe('top')
    expect(rect(note).top).toBeGreaterThanOrEqual(rect(card).top)
    expect(rect(note).right).toBeLessThanOrEqual(window.innerWidth)
    expect(rect(note).left).toBeGreaterThanOrEqual(0)
    expect(getComputedStyle(note).pointerEvents).toBe('none')

    root.querySelector('.flashcard').click()
    await settle(120)
    // Plan 132: turned, the note hangs under the card's 🔍, inside the
    // viewport, and the 🔍 is a thumb's target. Opening the entry and
    // closing it again is what lets the grade through.
    const lookup = root.querySelector('[data-guide="card.lookup"]')
    note = document.querySelector('.guide-callout')
    expect(note.dataset.place).toBe('below')
    expect(rect(note).top).toBeGreaterThanOrEqual(rect(lookup).bottom)
    expect(rect(note).bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(rect(note).left).toBeGreaterThanOrEqual(0)
    expect(rect(note).right).toBeLessThanOrEqual(window.innerWidth)
    lookup.click()
    await settle(150)
    expect(document.querySelector('.dict-sheet')).toBeTruthy()
    document.querySelector('.dict-sheet__scrim').click()
    await settle(150)
    // The bar docks (sticky, on the panel ink) and the next note
    // rests on its top edge, above it, still inside the viewport.
    const bar = root.querySelector('.rating-bar')
    expect(getComputedStyle(bar).position).toBe('sticky')
    note = document.querySelector('.guide-callout')
    expect(note.dataset.place).toBe('above')
    expect(rect(note).bottom).toBeLessThanOrEqual(rect(bar).top + 1)
    expect(rect(note).top).toBeGreaterThanOrEqual(0)
    for (const btn of root.querySelectorAll('.rating-bar__btn')) {
      expect(rect(btn).height).toBeGreaterThanOrEqual(44)
    }
  })

  // Plan 122: the desk docks the card's entry in a side column; a phone
  // has no side, and looks the word up from the card's own 🔍.
  it('draws no side, and keeps the look-up on the card', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/ride/cards']}>
          <Routes>
            <Route path="/ride/cards" element={<RideRun session={{ access_token: 'tok' }} dryRun cards={CARDS} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)
    const root = screen.container
    expect(root.querySelector('.desk-run')).toBeNull()
    expect(document.querySelector('.desk-run__side')).toBeNull()
    root.querySelector('.flashcard').click()
    await settle(120)
    expect([...root.querySelectorAll('.reveal-action-btn')].some(b => /dictionar|dictionnaire/i.test(b.title))).toBe(true)
  })
})
