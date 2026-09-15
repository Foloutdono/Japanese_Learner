import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The gate, the door and the contrast drill (plan 087) ──────
// A card the learner has never met shows its lesson first, with one
// button to board; a reload does not re-gate (the flag rides on the
// queued card, in the session mirror); a card already met never gates
// and keeps the door in the head; the contrast drill blanks the
// pattern, offers the rivals always, and rates once one is picked.

const apiFetch = vi.fn()
const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error { constructor(status) { super(); this.status = status } },
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
}))
vi.mock('../lib/reviews', () => ({ postReview: vi.fn(async () => ({})) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GrammarRun } = await import('./GrammarRun')

const LESSON = {
  register: 'polite',
  steps: [{ kind: 'rule', text: 'A polite request.' }],
  compare: [{ pattern: '〜ないでください', raw_id: 'grammar_N5_〜ないでください', level: 'N5', meaning: 'please do not', text: 'the negative' }],
  examples: [{ jp: 'ここに名前を書いてください。', tr: 'Please write your name here.', furigana: [{ text: 'ここに名前を書いて' }, { text: 'ください', highlight: true }, { text: '。' }] }],
}
const base = (over) => ({
  card_id: 'grammar_N5_〜てください', raw_id: 'grammar_N5_〜てください', mode: 'grammar.flashcard.f2b', direction: 'f2b',
  grammar: '〜てください', structure: 'verb て-form + ください', meaning: 'please do', register: 'polite',
  stage: 'new', review_preview: null, hints: {}, lesson: LESSON, ...over,
})

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))

function mount(mode, cards) {
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/grammar/cards')) return { cards, pace: null }
    if (String(url).startsWith('/api/grammar/point')) return { raw_id: 'grammar_N5_〜ないでください', level: 'N5', pattern: '〜ないでください', structure: 'x', meaning: 'please do not', steps: [], compare: [], examples: [] }
    return {}
  })
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/learn/grammar/N5/${mode}`]}>
        <Routes>
          <Route path="/learn/grammar/:level" element={<div>platforms</div>} />
          <Route path="/learn/grammar/:level/:mode" element={<GrammarRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ total: 1, new: 1, learning: 0, mastered: 0, due_now: 0 }) }))
  apiJson.mockReset()
  localStorage.clear()
  localStorage.setItem('lang', 'en')
})
afterEach(() => { localStorage.removeItem('lang') })

describe('the lesson gate', () => {
  it('shows a new card its lesson first, and the card only once boarded', async () => {
    const screen = await mount('grammar.flashcard.f2b', [base()])
    await settle(300)
    const stage = screen.container.querySelector('main.stage')
    expect(stage.querySelector('.gl--gate')).toBeTruthy()
    expect(stage.querySelector('.prompt-card')).toBeNull()
    expect(stage.querySelector('.rating-bar')).toBeNull()
    // the lesson is the card's own: its pattern, its rule
    expect(stage.querySelector('.gl--gate .dict-plate__word').textContent).toBe('〜てください')
    expect(stage.querySelector('.gl-step--rule')).toBeTruthy()

    stage.querySelector('.gl-gate__board').click()
    await settle()
    expect(stage.querySelector('.gl--gate')).toBeNull()
    expect(stage.querySelector('.prompt-card')).toBeTruthy()
    // and the mirror remembers: the queued card carries the flag
    const cached = JSON.parse(localStorage.getItem('jp-session:v6:grammar:N5:grammar.flashcard.f2b:en'))
    expect(cached[0].lesson_seen).toBe(true)
  })

  it('does not re-gate after a reload, and never gates a card already met', async () => {
    localStorage.setItem('jp-session:v6:grammar:N5:grammar.flashcard.f2b:en', JSON.stringify([base({ lesson_seen: true })]))
    const screen = await mount('grammar.flashcard.f2b', [])
    await settle(300)
    expect(screen.container.querySelector('.gl--gate')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeTruthy()

    localStorage.clear()
    localStorage.setItem('lang', 'en')
    const met = await mount('grammar.flashcard.f2b', [base({ stage: 'learning', lesson: undefined })])
    await settle(300)
    expect(met.container.querySelector('.gl--gate')).toBeNull()
    expect(met.container.querySelector('.prompt-card')).toBeTruthy()
  })

  it('keeps the lesson one tap away in the head, as a sheet with a way back through its rivals', async () => {
    const screen = await mount('grammar.flashcard.f2b', [base({ stage: 'learning' })])
    await settle(300)
    const door = screen.container.querySelector('.stage__head .gl-door--ghost')
    expect(door.textContent).toContain('Lesson')
    door.click()
    await settle()
    const sheet = document.querySelector('.gl-sheet')
    expect(sheet).toBeTruthy()
    expect(sheet.querySelector('.dict-plate__word').textContent).toBe('〜てください')
    // a compare row pushes the rival; ‹ pops it
    sheet.querySelector('.gl-door').click()
    await settle(300)
    expect(document.querySelector('.gl-sheet .dict-plate__word').textContent).toBe('〜ないでください')
    document.querySelector('.gl-sheet .dict-plate__back').click()
    await settle()
    expect(document.querySelector('.gl-sheet .dict-plate__word').textContent).toBe('〜てください')
    document.querySelector('.gl-sheet [aria-label="Close"]').click()
    await settle()
    expect(document.querySelector('.gl-sheet')).toBeNull()
  })
})

describe('the contrast drill', () => {
  it('blanks the pattern, offers the rivals always, and rates once one is picked', async () => {
    const card = base({
      mode: 'grammar.contrast', direction: null, stage: 'learning', lesson: undefined,
      contrast: {
        jp: 'ここに名前を書いてください。', tr: 'Please write your name here.',
        furigana: [{ text: 'ここに名前を書いて' }, { text: '＿＿＿', blank: true }, { text: '。' }],
        choices: ['〜ないでください', '〜てください', '〜てもいいです', '〜てはいけません'], answer: '〜てください',
      },
    })
    const screen = await mount('grammar.contrast', [card])
    await settle(300)
    const stage = screen.container.querySelector('main.stage')
    expect(stage.querySelector('.gl-blank').textContent).toBe('＿＿＿')
    expect(stage.querySelector('.dict-ex__tr')).toBeNull()
    expect(stage.querySelector('.study-assist')).toBeNull()
    const rows = [...stage.querySelectorAll('.mcq-grid button, .mcq-row')]
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(stage.querySelector('.rating-bar.rating-bar--active, .rating-bar--active')).toBeNull()

    const right = rows.find(r => r.textContent.includes('〜てください') && !r.textContent.includes('ない'))
    right.click()
    await settle()
    expect(stage.querySelector('.gl-blank--revealed').textContent).toBe('〜てください')
    expect(stage.querySelector('.dict-ex__tr').textContent).toBe('Please write your name here.')
    expect(stage.querySelector('.grammar-answer')).toBeTruthy()
    expect(stage.querySelector('.rating-bar')).toBeTruthy()
  })
})
