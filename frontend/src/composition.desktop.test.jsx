import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — 作文's side (plan 125) ───────────────────────────────────
// On the desk a composition run stands a column beside its card
// (StudyStage's `side`, plan 114). While the learner writes it is the
// point's lesson — rule, use, careful, the examples, the rivals: the
// same body the grammar station stands beside its points — so the door
// a phone draws on the card is not drawn here. Once they have rated it
// is the sentence's own breakdown, its doors opening in the column, as
// on every graded practice run. The phone's side is deskfree.phone.

const apiFetch = vi.fn()
const apiJson = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: () => {}, playClick: () => {}, playSfx: () => {}, playCorrect: () => {}, playWrong: () => {},
  startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('./stores/stats', () => ({
  useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: CompositionRun } = await import('./screens/CompositionRun')

const POINTS = [
  { raw_id: 'grammar_N4_〜ながら', level: 'N4', pattern: '〜ながら', structure: 'V-ます + ながら', meaning: 'en faisant', register: null, stage: 'learning' },
  { raw_id: 'grammar_N4_〜てみる', level: 'N4', pattern: '〜てみる', structure: 'V-て + みる', meaning: 'essayer de', register: null, stage: 'new' },
]
const EXAMPLE = '音楽を聞きながら勉強します。'
const LESSON = {
  raw_id: POINTS[0].raw_id, level: 'N4', pattern: '〜ながら', structure: 'V-ます + ながら', meaning: 'en faisant',
  register: null, steps: [{ kind: 'rule', text: 'Deux actions en même temps.' }], compare: [],
  examples: [{ jp: EXAMPLE, tr: "J'étudie en écoutant de la musique.", furigana: [{ text: EXAMPLE }] }],
  status: { status: 'not_started', total_reviews: 0, correct_reviews: 0, accuracy: null, interval_days: null, next_review: null, due: false },
}
const SENTENCE = '音楽が聞きながら勉強します。'
const ANALYSIS = {
  text: SENTENCE, available: true, grammar: [],
  tokens: [
    { surface: '音楽', reading: 'おんがく', meaning: 'music', pos: 'noun', furigana: [{ text: '音楽', reading: 'おんがく' }], vocab_match: null, kanji_matches: [] },
    { surface: 'が', reading: 'が', meaning: 'subject marker', pos: 'particle', furigana: [{ text: 'が' }], vocab_match: null, kanji_matches: [] },
    { surface: '聞きながら勉強します', reading: 'ききながらべんきょうします', meaning: 'study while listening', pos: 'verb', furigana: [{ text: '聞きながら勉強します' }], vocab_match: null, kanji_matches: [] },
  ],
  explanation: '',
}
const TUTOR = {
  review: {
    verdict: 'acceptable', summary: 'Une particule à revoir.', meaning: "J'étudie en écoutant de la musique.",
    good: ['「ながら」 relie les deux actions'], fix: [{ issue: '「音楽が」 marque le sujet', fix: '「音楽を」' }],
    grammar_used: true, better: '音楽を聞きながら勉強します。', better_parts: [{ text: '音楽を聞きながら勉強します。' }], better_romaji: 'ongaku wo kikinagara benkyou shimasu',
  },
  analysis: 'Une particule à revoir.',
}
const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const lessonCalls = () => apiJson.mock.calls.filter(c => String(c[0]).startsWith('/api/grammar/point'))

beforeEach(() => {
  apiJson.mockReset()
  apiFetch.mockReset()
  apiJson.mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith('/api/composition/batch')) return { level: 'N4', points: POINTS }
    if (u === '/api/composition/check') return { found: true }
    if (u === '/api/composition/result') return { correct: true, xp_earned: 7, leveled_up: false, new_level: 3 }
    if (u.startsWith('/api/grammar/point')) return LESSON
    return {}
  })
  apiFetch.mockImplementation(async (url) => {
    const u = String(url)
    if (u === '/api/composition/review') return ok(TUTOR)
    if (u === '/api/phrase/analyze') return ok(ANALYSIS)
    return ok({})
  })
})

async function run() {
  document.body.innerHTML = ''
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/composition/N4']}>
        <Routes>
          <Route path="/practice/composition/:level" element={<CompositionRun session={null} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(240)
}

async function answered() {
  type($('.stage input'), SENTENCE)
  await settle(20)
  $('.stage form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(240)
}

describe('a composition run on the desk', () => {
  it('stands the point\'s lesson beside the field while the learner writes, and draws no door on the card', async () => {
    await run()
    const side = $('.desk-run__side')
    expect(side).not.toBeNull()
    expect(side.getAttribute('aria-label')).toBe('Leçon')
    expect(lessonCalls()).toHaveLength(1)
    // The lesson, examples included: the door standing open, beside a
    // card that still prints no example of its own.
    expect(side.textContent).toContain('Deux actions en même temps.')
    expect(side.textContent).toContain(EXAMPLE)
    expect($('.stage').textContent).not.toContain(EXAMPLE)
    expect($('.stage .prose__breakdown')).toBeNull()
    // The run's third column (plan 129), right of the stage, in the
    // run's own pigment: the lesson as its one panel.
    const box = side.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(300)
    expect(box.left).toBeGreaterThan($('.stage').getBoundingClientRect().right)
    expect(side.querySelector(':scope > .desk-pane .gl')).not.toBeNull()
    // Computed, so the var() is resolved: the side wears the run's pigment.
    const sakubun = getComputedStyle(document.documentElement).getPropertyValue('--line-sakubun').trim()
    expect(sakubun).not.toBe('')
    expect(getComputedStyle(side).getPropertyValue('--line-color').trim()).toBe(sakubun)
    expect($('.stage .prose__jp').getBoundingClientRect().right).toBeLessThanOrEqual(box.left)
  })

  it('keeps the lesson through the review, stands the breakdown once rated, and Enter takes the next point', async () => {
    await run()
    await answered()
    // The tutor's review is on the card; the side is still the lesson,
    // for the learner reading the one against the other before rating.
    expect($('.stage .rvw')).not.toBeNull()
    expect($('.desk-run__side').getAttribute('aria-label')).toBe('Leçon')
    expect($('.desk-run__side .bkd')).toBeNull()

    // The best tile, from its digit (1 is the best, plan 113): "correct",
    // q4 on the default four-tile scale.
    press('1')
    await settle(240)
    const result = apiJson.mock.calls.find(c => String(c[0]) === '/api/composition/result')
    expect(JSON.parse(result[2].body)).toMatchObject({ quality: 4, found: true, verdict: 'acceptable' })
    expect($('.desk-run__side').getAttribute('aria-label')).toBe('Décomposition')
    expect($('.desk-run__side .bkd')).not.toBeNull()
    expect($('.desk-run__side .bkd-row, .desk-run__side .bkd-line')).not.toBeNull()
    // No phone toggle on the desk: the column holds the breakdown, with
    // no button to show or hide it.
    expect($('.stage .prose__breakdown')).toBeNull()
    expect($('.stage .rating-bar')).toBeNull()

    press('Enter')
    await settle(240)
    expect($('.stage .prose__jp').textContent).toBe('〜てみる')
    expect($('.desk-run__side').getAttribute('aria-label')).toBe('Leçon')
    expect(lessonCalls()).toHaveLength(2)
  })
})
