import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── Browse's results are checkboxes (plan 123) ──────────────────────
// A deck's Browse lists up to sixty entries to tick and add. Each was a
// div that only a pointer could tick: no Tab stop, no key, and nothing
// for a screen reader to call a checkbox or report as ticked. Each row
// is now a checkbox to the keyboard and to assistive tech -- the same
// element, so nothing about how it looks moves.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const RESULTS = [
  { raw_id: 'vocab_N5_駅_えき', front: '駅', kana: 'えき', meaning: 'station', level: 'N5', in_deck: false },
  { raw_id: 'vocab_N5_川_かわ', front: '川', kana: 'かわ', meaning: 'river', level: 'N5', in_deck: true },
  { raw_id: 'vocab_N5_山_やま', front: '山', kana: 'やま', meaning: 'mountain', level: 'N5', in_deck: false },
]
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: RESULTS }) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { default: BrowseCardsMenu } = await import('./components/decks/BrowseCardsMenu')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

describe('Browse on a phone', () => {
  it('ticks a result from the keyboard, and says so', async () => {
    await render(<LangProvider><BrowseCardsMenu deckId={1} deckType="vocab" session={{}} onAdded={() => {}} onClose={() => {}} /></LangProvider>)
    await settle(400)
    const rows = [...document.querySelectorAll('.browse-result-row')]
    expect(rows).toHaveLength(3)
    expect(rows.every(r => r.getAttribute('role') === 'checkbox')).toBe(true)
    // The one already in the deck is ticked, disabled, and no Tab stop.
    expect(rows[1].getAttribute('aria-checked')).toBe('true')
    expect(rows[1].getAttribute('aria-disabled')).toBe('true')
    expect(rows[1].tabIndex).toBe(-1)

    rows[0].focus()
    expect(document.activeElement).toBe(rows[0])
    key(rows[0], ' ')
    await settle()
    expect(rows[0].getAttribute('aria-checked')).toBe('true')
    expect(rows[0].classList.contains('browse-result-row--selected')).toBe(true)
    key(rows[0], 'Enter')
    await settle()
    expect(rows[0].getAttribute('aria-checked')).toBe('false')

    key(rows[1], ' ')
    await settle()
    expect(rows[1].classList.contains('browse-result-row--selected')).toBe(false)
  })
})
