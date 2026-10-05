import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── 作文 — a sentence written from a grammar point (plan 125) ──
// The learner is handed a point and writes; three opinions come back
// and are kept apart: the detector's (a hint on the answer's label,
// only where the detector is trusted), the tutor's (the shared review
// shape, bought from the model and rationed by the day) and the
// learner's own rating, which is the grade. The rules worth pinning:
// the card never prints an example, the three calls go out together,
// a spent day loses the tutor and nothing else, and a late review for
// a point the learner has left is dropped. French copy: the lane's.

const apiFetch = vi.fn()
const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  playClick: () => {},
  playSfx: () => {},
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({
  useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: CompositionRun } = await import('./CompositionRun')

const POINTS = [
  { raw_id: 'grammar_N4_〜ながら', level: 'N4', pattern: '〜ながら', structure: 'V-ます + ながら', meaning: 'en faisant', register: null, stage: 'learning' },
  { raw_id: 'grammar_N4_〜てみる', level: 'N4', pattern: '〜てみる', structure: 'V-て + みる', meaning: 'essayer de', register: null, stage: 'new' },
]
// The lesson's own sentence: behind the door, never on the card.
const EXAMPLE = '音楽を聞きながら勉強します。'
const LESSON = {
  raw_id: POINTS[0].raw_id, level: 'N4', pattern: '〜ながら', structure: 'V-ます + ながら', meaning: 'en faisant',
  register: null, steps: [{ kind: 'rule', text: 'Deux actions en même temps.' }], compare: [],
  examples: [{ jp: EXAMPLE, tr: "J'étudie en écoutant de la musique.", furigana: [{ text: EXAMPLE }] }],
  status: { status: 'not_started', total_reviews: 0, correct_reviews: 0, accuracy: null, interval_days: null, next_review: null, due: false },
}
const SENTENCE = '音楽が聞きながら勉強します。'
const ANALYSIS = {
  text: SENTENCE,
  available: true,
  grammar: [],
  tokens: [
    { surface: '音楽', reading: 'おんがく', meaning: 'music', pos: 'noun', furigana: [{ text: '音楽', reading: 'おんがく' }], vocab_match: null, kanji_matches: [] },
    { surface: 'が', reading: 'が', meaning: 'subject marker', pos: 'particle', furigana: [{ text: 'が' }], vocab_match: null, kanji_matches: [] },
    { surface: '聞きながら勉強します', reading: 'ききながらべんきょうします', meaning: 'study while listening', pos: 'verb', furigana: [{ text: '聞きながら勉強します' }], vocab_match: null, kanji_matches: [] },
  ],
  explanation: '',
}
const REVIEW = {
  verdict: 'acceptable',
  summary: 'Une particule à revoir.',
  meaning: "J'étudie en écoutant de la musique.",
  good: ['「ながら」 relie les deux actions'],
  fix: [{ issue: '「音楽が」 marque le sujet', fix: '「音楽を」' }],
  grammar_used: true,
  better: '音楽を聞きながら勉強します。',
  better_parts: [{ text: '音楽を聞きながら勉強します。' }],
  better_romaji: 'ongaku wo kikinagara benkyou shimasu',
}
const TUTOR = { review: REVIEW, analysis: 'Une particule à revoir.' }

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
function type(el, value) {
  setValue.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const jsonCalls = url => apiJson.mock.calls.filter(c => String(c[0]).startsWith(url))
const fetchCalls = url => apiFetch.mock.calls.filter(c => String(c[0]) === url)
const body = call => JSON.parse(call[2].body)

// What each stub answers; a test bends one of these before mounting.
let found = true
let review = () => ok(TUTOR)

async function run() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/composition/N4']}>
        <Routes>
          <Route path="/practice/composition/:level" element={<CompositionRun session={null} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(120)
  return screen.container
}

async function answered(root, text = SENTENCE) {
  type(root.querySelector('input'), text)
  await settle(20)
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle(140)
  return root
}

async function graded(root, at = -1) {
  ;[...root.querySelectorAll('.rating-bar button')].at(at).click()
  await settle(140)
  return root
}

// The detector's word, on the point's tag (plan 184): a check where it
// found the point, a cross where it did not, nothing where it has none.
const measure = root => {
  const mark = root.querySelector('.pcard-tag .pcard-tag__used')
  if (!mark) return null
  return mark.classList.contains('pcard-tag__used--x') ? 'missed' : 'found'
}

beforeEach(() => {
  found = true
  review = () => ok(TUTOR)
  apiJson.mockReset()
  apiFetch.mockReset()
  apiJson.mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith('/api/composition/batch')) return { level: 'N4', points: POINTS }
    if (u === '/api/composition/check') return { found }
    if (u === '/api/composition/result') return { correct: true, xp_earned: 7, leveled_up: false, new_level: 3 }
    if (u.startsWith('/api/grammar/point')) return LESSON
    return {}
  })
  apiFetch.mockImplementation(async (url) => {
    const u = String(url)
    if (u === '/api/composition/review') return review()
    if (u === '/api/phrase/analyze') return ok(ANALYSIS)
    return ok({})
  })
})

describe('CompositionRun', () => {
  it('asks the level for its points in the learner\'s language, and prints the point, not an example', async () => {
    const root = await run()
    const [batch] = jsonCalls('/api/composition/batch')
    const params = new URL(String(batch[0]), 'http://x').searchParams
    expect(params.get('level')).toBe('N4')
    expect(params.get('lang')).toBe('fr')
    expect(params.get('count')).toBe('5')

    expect(root.querySelector('.stage__where, .stage__head').textContent).toContain('Rédaction')
    // The point the one thing on the card (plan 184), its form as its
    // pieces under it, its meaning under that.
    expect(root.querySelector('.pcard-lead__jp--point').textContent).toBe('〜ながら')
    expect([...root.querySelectorAll('.pcard-form__piece')].map(p => p.textContent)).toEqual(['V-ます', 'ながら'])
    expect(root.querySelector('.pcard-lead__en').textContent).toBe('en faisant')
    expect(root.querySelector('input').getAttribute('aria-label')).toBe('Écris une phrase avec')
    expect(root.textContent).not.toContain(EXAMPLE)
    // The field takes Japanese, from an IME nothing may second-guess.
    const field = root.querySelector('input')
    expect(field.getAttribute('lang')).toBe('ja')
    expect(field.getAttribute('autocomplete')).toBe('off')
    // Nothing has been asked of the detector or the tutor yet.
    expect(jsonCalls('/api/composition/check')).toHaveLength(0)
    expect(fetchCalls('/api/composition/review')).toHaveLength(0)
    expect(jsonCalls('/api/grammar/point')).toHaveLength(0)
  })

  it('opens the lesson behind the point from the card\'s door, examples included', async () => {
    const root = await run()
    const door = root.querySelector('.prose__breakdown button')
    expect(door.textContent).toBe('Leçon')
    door.click()
    await settle(140)
    const sheet = document.querySelector('.dict-sheet')
    expect(sheet).not.toBeNull()
    expect(jsonCalls('/api/grammar/point')).toHaveLength(1)
    expect(sheet.textContent).toContain(EXAMPLE)
    expect(sheet.textContent).toContain('Deux actions en même temps.')
  })

  it('asks the detector, the tutor and the breakdown together, and draws all three', async () => {
    const root = await answered(await run())
    const [check] = jsonCalls('/api/composition/check')
    expect(body(check)).toEqual({ raw_id: POINTS[0].raw_id, sentence: SENTENCE })
    const [tutor] = fetchCalls('/api/composition/review')
    expect(body(tutor)).toEqual({ raw_id: POINTS[0].raw_id, sentence: SENTENCE, lang: 'fr' })
    const [breakdown] = fetchCalls('/api/phrase/analyze')
    expect(body(breakdown)).toMatchObject({ phrase: SENTENCE, save: false, deep: false, whole: true })

    // The point's tag with the detector's word on it; the sentence
    // leading, corrected in place -- the tutor's change struck and
    // given -- its romaji and what it says under it (plan 184).
    expect(root.querySelector('.pcard-tag__jp').textContent).toBe('〜ながら')
    expect(measure(root)).toBe('found')
    const lead = root.querySelector('.pcard-lead__jp')
    expect(lead.querySelector('.pcard-del').textContent).toBe('が')
    expect(lead.querySelector('.pcard-ins').textContent).toBe('を')
    expect(lead.textContent).toBe('音楽がを聞きながら勉強します。')
    expect(root.querySelector('.pcard-lead__ro').textContent).toBe(REVIEW.better_romaji)
    expect(root.querySelector('.pcard-lead__en').textContent).toBe("J'étudie en écoutant de la musique.")
    // The notes, led by the tutor's verdict.
    expect(root.querySelector('.rvw__head .rvw__verdict').textContent).toBe('Acceptable')
    expect(root.querySelector('.rvw__to').textContent).toBe('「音楽を」')
    // The rating bar is up; the breakdown waits for the grade.
    expect(root.querySelector('.rating-bar')).not.toBeNull()
    expect(root.querySelector('.prose__breakdown')).toBeNull()
  })

  it('prints the detector\'s word only where it has one', async () => {
    found = false
    const missed = await answered(await run())
    expect(measure(missed)).toBe('missed')

    found = null
    const unsaid = await answered(await run())
    expect(measure(unsaid)).toBeNull()
    expect(unsaid.querySelector('.pcard-tag__jp').textContent).toBe('〜ながら')
  })

  it('rates on the bar, posts the grade beside the two other opinions, and moves on', async () => {
    // The best tile is drawn last (RatingBar renders best-first tiles
    // reversed); on the default four-tile scale it is "correct", q4.
    const root = await graded(await answered(await run()))
    const [result] = jsonCalls('/api/composition/result')
    expect(body(result)).toEqual({
      raw_id: POINTS[0].raw_id, sentence: SENTENCE, quality: 4,
      found: true, verdict: 'acceptable', grammar_used: true,
    })
    // (The fare rides the response onto the level bar through
    // usePracticeXp; the bar draws nothing under an unseeded summary,
    // so that is LevelBar.browser.test's to hold, not this file's.)
    // Rated: the bar gives way to Next, and the breakdown's toggle appears.
    expect(root.querySelector('.rating-bar')).toBeNull()
    const nextButton = root.querySelector('.stage__foot .btn-primary')
    expect(nextButton.textContent).toContain('Phrase suivante')
    const toggle = root.querySelector('.prose__breakdown button')
    expect(toggle.textContent).toBe('Voir la décomposition')
    toggle.click()
    await settle(60)
    expect(root.querySelector('.bkd')).not.toBeNull()
    expect(root.querySelector('.rvw')).not.toBeNull()
  })

  it('keeps the run when the day\'s reviews are spent', async () => {
    review = () => ({ ok: false, status: 429, json: async () => ({ detail: 'Daily limit of 30 composition reviews reached' }) })
    const root = await answered(await run())
    expect(root.textContent).toContain('Le tuteur a fini sa journée')
    expect(root.querySelector('.rvw')).toBeNull()
    // The detector still spoke, and the bar still grades.
    expect(measure(root)).toBe('found')
    await graded(root, 0)
    const [result] = jsonCalls('/api/composition/result')
    expect(body(result)).toMatchObject({ found: true, verdict: null, grammar_used: null })
    // The worst tile, drawn first: a fail, rated all the same.
    expect(body(result).quality).toBeLessThan(3)
    // And the next point asks no tutor: the day is spent, and a refused
    // call would still cost a slot.
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(60)
    await answered(root, '本を読んでみます。')
    expect(fetchCalls('/api/composition/review')).toHaveLength(1)
    expect(root.textContent).toContain('Le tuteur a fini sa journée')
  })

  it('serves the queue, tells the next batch what it has seen, and drops a late review', async () => {
    // The first point's tutor answers late, after the learner has moved on.
    let late
    review = () => new Promise(resolve => { late = () => resolve(ok({ review: { ...REVIEW, summary: 'STALE' }, analysis: 'STALE' })) })
    const root = await answered(await run())
    await graded(root)
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(60)
    expect(root.querySelector('.pcard-lead__jp--point').textContent).toBe('〜てみる')
    // The queue ran to its last point, so the next batch was asked
    // for, naming everything this session has been handed.
    const batches = jsonCalls('/api/composition/batch')
    expect(batches).toHaveLength(2)
    const exclude = new URL(String(batches[1][0]), 'http://x').searchParams.get('exclude')
    expect(exclude.split('|')).toEqual(POINTS.map(p => p.raw_id))

    review = () => ok(TUTOR)
    await answered(root, '本を読んでみます。')
    late()
    await settle(60)
    expect(root.textContent).not.toContain('STALE')
    expect(root.querySelector('.rvw__summary').textContent).toBe('Une particule à revoir.')
  })

  it('sends a hand-typed grade back to the list', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/composition/N9']}>
          <Routes>
            <Route path="/practice/composition/:level" element={<CompositionRun session={null} />} />
            <Route path="/practice/composition" element={<p>the list</p>} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(40)
    expect(screen.container.textContent).toContain('the list')
    expect(jsonCalls('/api/composition/batch')).toHaveLength(0)
  })
})
