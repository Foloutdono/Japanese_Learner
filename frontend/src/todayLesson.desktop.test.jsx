import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 教順 — the lesson's rival beside the day's run (plan 186b) ────
// A grammar point never met in the day's queue opens on its lesson, as
// on its own run (grammar.desktop, plan 120), and on the desk its
// compare rows open the rival in the run's column, not in a dialog,
// until ✕, Esc or boarding gives the column back. Fixtures:
// grammar.desktop.

vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 1, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
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

const { default: TodayRun } = await import('./screens/TodayRun')

const LANE = { id: 's~grammar~N5~grammar.flashcard.f2b', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.flashcard.f2b' }

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
  stage: 'new', review_preview: null, hints: {}, lesson: LESSON, source: 'grammar', lane: LANE,
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
  let batch = 0
  apiJson.mockImplementation(async url => {
    if (!String(url).startsWith('/api/today/cards')) return {}
    batch += 1
    return { cards: batch === 1 ? [CARD] : [] }
  })
})
afterEach(() => { localStorage.removeItem('lang') })

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today/run']}>
        <Routes>
          <Route path="/today" element={<div className="platforms-probe">gate</div>} />
          <Route path="/today/run" element={<TodayRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('a lesson\'s compare row in the day\'s run on the desk', () => {
  it('opens the rival in the run\'s side, and Esc gives the side back without leaving', async () => {
    await mount()
    await settle(400)
    const side = $('.desk-run__side')
    expect(side).not.toBeNull()
    expect($('.gl--gate')).not.toBeNull()

    $('.gl--gate .gl-door').click()
    await settle(400)
    expect($('[role="dialog"]')).toBeNull()
    expect(side.querySelector('.desk-entry .dict-plate__word').textContent).toBe('〜ないでください')
    // The session panel steps aside, kept mounted for the way back.
    expect(side.querySelector('.desk-sealed').closest('[hidden]')).not.toBeNull()
    // The lesson being read stays where it was.
    expect($('.gl--gate .dict-plate__word').textContent).toBe('〜てください')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    expect(side.querySelector('.desk-entry')).toBeNull()
    expect(side.querySelector('.desk-sealed').closest('[hidden]')).toBeNull()
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
