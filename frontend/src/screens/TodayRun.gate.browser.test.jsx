import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { sessionKey } from '../hooks/useCardSession'
import '../index.css'

// ── The lesson before the drill, in the day's queue (plan 186b) ─
// The day's ration hands a novice は and を in this queue, and the run
// served them as flashcards to rate before anyone had said what they
// do. A grammar point never met now opens on its lesson, as on its own
// run (GrammarRun's gate, plan 087); boarded once, it stays boarded
// across a reload; a point already met, and every other line, goes
// straight to the card.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 1, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
}))
vi.mock('../lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./TodayRun')

const LANE = { id: 's~grammar~N5~grammar.flashcard.f2b', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.flashcard.f2b' }
const LESSON = {
  register: 'neutral',
  steps: [{ kind: 'rule', text: 'は marks what the sentence is about.' }],
  compare: [],
  examples: [{ jp: '私は学生です。', tr: 'I am a student.', furigana: [{ text: '私' }, { text: 'は', highlight: true }, { text: '学生です。' }] }],
}
const grammar = (over) => ({
  card_id: 'grammar_N5_は', raw_id: 'grammar_N5_は', source: 'grammar', mode: 'grammar.flashcard.f2b',
  direction: 'f2b', grammar: 'は', structure: 'noun + は', meaning: 'marks the sentence topic',
  stage: 'new', hints: {}, review_preview: null, lesson: LESSON, lane: LANE, ...over,
})
const KANA = {
  card_id: 'kana_あ', kana: 'あ', romaji: 'a', source: 'kana', mode: 'kana.flashcard.f2b', direction: 'f2b',
  stage: 'new', hints: {}, review_preview: null,
  lane: { id: 's~kana~hiragana_basic~kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b' },
}

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

function mount(cards) {
  let batch = 0
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/today/cards')) {
      batch += 1
      return { cards: batch === 1 ? cards : [] }
    }
    return {}
  })
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today/run']}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">gate</div>} />
          <Route path="/today/run" element={<TodayRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('lang', 'en')
})
// The language is the lane's to keep: a file after this one in the same
// browser reads it, and every one of them pins French copy.
afterEach(() => { localStorage.removeItem('lang') })

describe('the lesson gate in the day’s queue', () => {
  it('opens a grammar point never met on its lesson, and on the card once boarded', async () => {
    const screen = await mount([grammar()])
    await settle()
    const stage = screen.container.querySelector('main.stage')
    expect(stage.querySelector('.gl--gate')).toBeTruthy()
    expect(stage.querySelector('.gl--gate .dict-plate__word').textContent).toBe('は')
    expect(stage.querySelector('.gl-step--rule')).toBeTruthy()
    // Nothing to rate and no help to reach for while the lesson is up.
    expect(stage.querySelector('.prompt-card')).toBeNull()
    expect(stage.querySelector('.rating-bar')).toBeNull()

    stage.querySelector('.gl-gate__board').click()
    await settle()
    expect(stage.querySelector('.gl--gate')).toBeNull()
    expect(stage.querySelector('.prompt-card')).toBeTruthy()
    // The mirror keeps the flag on the queued card, so a reload does not gate again.
    const cached = JSON.parse(localStorage.getItem(sessionKey('today', 'all')))
    expect(cached[0].lesson_seen).toBe(true)
  }, 20000)

  it('does not gate a point already boarded or already met', async () => {
    localStorage.setItem(sessionKey('today', 'all'), JSON.stringify([grammar({ lesson_seen: true })]))
    const boarded = await mount([])
    await settle()
    expect(boarded.container.querySelector('.gl--gate')).toBeNull()
    expect(boarded.container.querySelector('.prompt-card')).toBeTruthy()

    localStorage.clear()
    localStorage.setItem('lang', 'en')
    const met = await mount([grammar({ stage: 'learning', lesson: undefined })])
    await settle()
    expect(met.container.querySelector('.gl--gate')).toBeNull()
    expect(met.container.querySelector('.prompt-card')).toBeTruthy()
  }, 20000)

  it('goes straight to the card on every other line', async () => {
    const kana = await mount([KANA])
    await settle()
    expect(kana.container.querySelector('.gl--gate')).toBeNull()
    expect(kana.container.querySelector('.prompt-card')).toBeTruthy()
  }, 20000)
})
