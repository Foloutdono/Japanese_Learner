import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a lesson's rival opens beside the run (plan 117) ──────────
// A grammar card the learner has never met shows its lesson first, and
// the lesson's compare rows are doors to the rival points. On a phone
// each opens the rival's lesson in a sheet over the run; on the desk the
// run already has a column, so the rival opens there (SideLookup, the
// same door a docked breakdown opens), the session panel stepping aside
// until ✕ or Esc gives it back — and that Esc never leaves the run. The
// phone's side is deskfree.phone. Fixtures: GrammarRun.gate.browser.

vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []) }))
const apiFetch = vi.hoisted(() => vi.fn())
const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson,
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error { constructor(status) { super(); this.status = status } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GrammarRun } = await import('./screens/GrammarRun')

const RIVAL = 'grammar_N5_〜ないでください'
const LESSON = {
  register: 'polite',
  steps: [{ kind: 'rule', text: 'A polite request.' }],
  compare: [{ pattern: '〜ないでください', raw_id: RIVAL, level: 'N5', meaning: 'please do not', text: 'the negative' }],
  examples: [{ jp: 'ここに名前を書いてください。', tr: 'Please write your name here.', furigana: [{ text: 'ここに名前を書いて' }, { text: 'ください', highlight: true }, { text: '。' }] }],
}
const CARD = {
  card_id: 'grammar_N5_〜てください', raw_id: 'grammar_N5_〜てください', mode: 'grammar.flashcard.f2b', direction: 'f2b',
  grammar: '〜てください', structure: 'verb て-form + ください', meaning: 'please do', register: 'polite',
  stage: 'new', review_preview: null, hints: {}, lesson: LESSON,
}
const ENTRY = {
  [RIVAL]: {
    type: 'grammar', raw_id: RIVAL, level: 'N5', pattern: '〜ないでください', structure: 'verb ない-form + でください',
    meaning: 'please do not', steps: [], compare: [], examples: [], status: null, app_card: null,
  },
}

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    if (String(url).startsWith('/api/dictionary')) {
      const id = new URL(String(url), 'http://x').searchParams.get('id')
      const entry = ENTRY[id]
      return { ok: true, status: 200, json: async () => ({ results: entry ? [entry] : [], total: entry ? 1 : 0 }) }
    }
    return { ok: true, status: 200, json: async () => ({ total: 1, new: 1, learning: 0, mastered: 0, due_now: 0 }) }
  })
  apiJson.mockReset()
  apiJson.mockImplementation(async url => (String(url).startsWith('/api/grammar/cards') ? { cards: [CARD], pace: null } : {}))
})
afterEach(() => { localStorage.removeItem('lang') })

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/grammar/N5/grammar.flashcard.f2b']}>
        <Routes>
          <Route path="/learn/grammar/:level" element={<div className="platforms-probe">platforms</div>} />
          <Route path="/learn/grammar/:level/:mode" element={<GrammarRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('a lesson\'s compare row on the desk', () => {
  it('opens the rival in the run\'s side, and Esc gives the side back without leaving', async () => {
    await mount()
    await settle(400)
    const side = $('.desk-run__side')
    expect(side).not.toBeNull()
    expect($('.gl--gate')).not.toBeNull()
    expect(side.querySelector('.desk-tally')).not.toBeNull()

    $('.gl--gate .gl-door').click()
    await settle(400)
    expect($('[role="dialog"]')).toBeNull()
    expect(side.querySelector('.desk-entry .dict-plate__word').textContent).toBe('〜ないでください')
    // The session panel steps aside, kept mounted for the way back.
    expect(side.querySelector('.desk-tally').closest('[hidden]')).not.toBeNull()
    // The lesson being read stays where it was.
    expect($('.gl--gate .dict-plate__word').textContent).toBe('〜てください')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    expect(side.querySelector('.desk-entry')).toBeNull()
    expect(side.querySelector('.desk-tally').closest('[hidden]')).toBeNull()
    expect($('.gl--gate')).not.toBeNull()
    expect($('.platforms-probe')).toBeNull()
  })

  it('closes the rival when the learner boards the card', async () => {
    await mount()
    await settle(400)
    $('.gl--gate .gl-door').click()
    await settle(400)
    expect($('.desk-run__side .desk-entry')).not.toBeNull()
    $('.gl-gate__board').click()
    await settle()
    expect($('.gl--gate')).toBeNull()
    expect($('.desk-run__side .desk-entry')).toBeNull()
  })
})
