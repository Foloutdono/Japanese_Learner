import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the first ride at a desk (plan 122) ────────────────────────
// The two cards and the reading ride, from the keys alone: Space turns
// a card, a digit rates it, and Enter goes on from the ride's end --
// the key its Continue prints (P8). The phone's side is a block of
// deskfree.phone.test.jsx.

const apiJson = vi.hoisted(() => vi.fn())
const apiFetch = vi.hoisted(() => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
const summary = vi.hoisted(() => ({ current: { kanaKnown: 'both', dailyNewTarget: 10 } }))
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => summary.current,
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 200, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: RideRun } = await import('./screens/RideRun')
const { default: RideReading } = await import('./screens/RideReading')

const KNOWN = {
  card_id: 'vocab_N3__こんにちは', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
  kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N3', romaji: 'konnichiwa',
  stage: null, review_preview: null, hints: {},
}
const UNKNOWN = {
  card_id: 'vocab_N5_駅_えき', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
  kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', romaji: 'eki',
  stage: null, review_preview: null, hints: { indice_3: [{ text: '駅', reading: 'えき' }] },
}
const SENTENCE = {
  phrase: '駅で友だちに会います。', romaji: 'eki de tomodachi ni aimasu.',
  translation: 'I meet a friend at the station.', translation_lang: 'en',
  display_seconds: 0.4, grammar: 'で',
}

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
// After a rating: the next card up, turned face down (its Space hint
// printed), or the done room -- and the rated card gone with its docked
// entry. It comes after the ride's hold (420ms) and the old card's way
// out (220ms), so it is waited for, not guessed: a fixed 650ms left a
// loaded CI runner 10ms, and a Space pressed inside the hold is lost.
const nextCard = () => vi.waitFor(() => {
  expect($('.desk-run__side .desk-entry')).toBeNull()
  expect($('.ride__done') ?? $('.flashcard__hint .desk-kbd')).not.toBeNull()
}, { timeout: 3000 })
const posts = () => apiJson.mock.calls.filter(([, , init]) => init?.method === 'POST')

const ENTRIES = {
  こんにちは: { type: 'vocab', kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N5', senses: [], examples: [] },
  駅: { type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', senses: [], examples: [] },
}
beforeEach(() => {
  summary.current = { kanaKnown: 'both', dailyNewTarget: 10 }
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const q = new URLSearchParams(String(url).split('?')[1] ?? '').get('q')
    const e = String(url).startsWith('/api/dictionary') && ENTRIES[q]
    return { ok: true, status: 200, json: async () => ({ results: e ? [e] : [] }) }
  })
  apiJson.mockReset()
  apiJson.mockImplementation(async (url, _s, init) => {
    if (String(url).startsWith('/api/onboarding/ride?')) return { cards: [KNOWN, UNKNOWN], sentence: SENTENCE }
    if (String(url) === '/api/onboarding/ride/check') return { accuracy: 100, matched: 'romaji' }
    if (String(url) === '/api/onboarding/ride/done') return { tutorialAt: 'x', skipped: JSON.parse(init.body).skipped }
    return {}
  })
  localStorage.clear()
})

function mount(element, at) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">today</div>} />
          <Route path="/ride/reading" element={<div className="reading-probe">reading</div>} />
          <Route path={at} element={element} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

/** Both cards turned and rated from the keys: Space, then '1'. */
async function rideTheCards() {
  for (let i = 0; i < 2; i++) {
    await userEvent.keyboard(' ')
    await settle(120)
    await userEvent.keyboard('1')
    await nextCard()
  }
}

describe('the ride\'s ends on the desk (P8)', () => {
  it('goes on from the cards\' end on Enter, the key printed on Continue', async () => {
    const onNext = vi.fn()
    await mount(<RideRun session={{ access_token: 'tok' }} onNext={onNext} />, '/ride/cards')
    await settle(250)
    await rideTheCards()
    const go = $('.ride__done-foot .btn-depart')
    expect(go, 'the ride reached its end').toBeTruthy()
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    expect(go.querySelector('.desk-kbd')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('stamps the lesson from the plate on Enter', async () => {
    const onDone = vi.fn()
    await mount(<RideReading session={{ access_token: 'tok' }} onDone={onDone} />, '/ride/reading-run')
    await settle(900)
    $('form.stage__foot input').focus()
    await userEvent.keyboard('eki de tomodachi ni aimasu{Enter}')
    await settle(250)
    await userEvent.keyboard('1')
    await settle(250)
    const go = $('.ride__plate [data-action="enter"]')
    expect(go, 'the plate is up').toBeTruthy()
    expect(go.getAttribute('aria-keyshortcuts')).toBe('Enter')
    await userEvent.keyboard('{Enter}')
    await settle(250)
    const done = posts().find(([u]) => u === '/api/onboarding/ride/done')
    expect(JSON.parse(done[2].body)).toEqual({ skipped: false })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

// ── P11 — the ride's side ──
// The browse's side (plan 119): the flip docks the card's entry beside
// it, where a phone looks it up from 🔍. Nothing to rate, nothing
// beside the done room, and the ride's notes stand over the card.
const box = el => el.getBoundingClientRect()
const plate = () => $('.desk-run__side .desk-entry .dict-plate__word')?.textContent ?? null

describe('the ride\'s side on the desk (P11)', () => {
  it('docks each card\'s entry on the flip, and clears it with the next card', async () => {
    await mount(<RideRun session={{ access_token: 'tok' }} onNext={() => {}} />, '/ride/cards')
    await settle(250)
    const side = $('.desk-run__side')
    expect(side).not.toBeNull()
    expect(Math.round(box(side).width)).toBe(360)
    expect(side.querySelector('.desk-tally')).toBeNull()
    expect(side.querySelector('.desk-run__note')).not.toBeNull()
    await userEvent.keyboard(' ')
    await settle(400)
    expect(plate()).toBe('こんにちは')
    // No 🔍 on the card: the column is where the look-up goes.
    expect($('.reveal-actions')).not.toBeNull()
    expect([...document.querySelectorAll('.reveal-action-btn')].some(b => /dictionar|dictionnaire/i.test(b.title))).toBe(false)
    await userEvent.keyboard('1')
    await nextCard()
    expect(plate()).toBeNull()
    expect($('.desk-run__side .desk-run__note')).not.toBeNull()
    await userEvent.keyboard(' ')
    await settle(400)
    expect(plate()).toBe('駅')
    await userEvent.keyboard('1')
    await nextCard()
    expect($('.ride__done')).not.toBeNull()
    expect($('.desk-run__side')).toBeNull()
  })

  it('docks 駅 for a learner who reads no hiragana, its reading in Latin letters', async () => {
    summary.current = { kanaKnown: 'none', dailyNewTarget: 10 }
    await mount(<RideRun session={{ access_token: 'tok' }} onNext={() => {}} />, '/ride/cards')
    await settle(250)
    await userEvent.keyboard(' ')
    await settle(400)
    await userEvent.keyboard('1')
    await nextCard()
    await userEvent.keyboard(' ')
    await settle(400)
    expect(plate()).toBe('駅')
  })

  it('stands the ride\'s notes over the card, not over the window\'s middle', async () => {
    document.documentElement.dataset.chrome = 'stage'
    try {
      await mount(<RideRun session={{ access_token: 'tok' }} onNext={() => {}} />, '/ride/cards')
      await settle(300)
      const note = $('.guide-callout')
      expect(note).not.toBeNull()
      const mid = r => (r.left + r.right) / 2
      expect(Math.abs(mid(box(note)) - mid(box($('.flashcard'))))).toBeLessThan(1.5)
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  it('keeps no side on the reading ride', async () => {
    await mount(<RideReading session={{ access_token: 'tok' }} onDone={() => {}} />, '/ride/reading-run')
    await settle(300)
    expect($('.desk-run__side')).toBeNull()
  })
})
