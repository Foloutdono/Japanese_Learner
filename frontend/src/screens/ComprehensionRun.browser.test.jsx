import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { TrainDoor } from '../components/station/TrainDoor'

// ── Comprehension: the station, then the stage (plan 072) ───────
// The level list on the station page, then the whole exercise on the
// stage: the text under the timer, one question at a time with lettered
// rows and a Next that commits the pick, and the result as a lattice of
// records over a surface of rows that say what was picked and what was
// right. Two routes now, as the lines have had since plan 071 — the
// list is a station page under the chrome and the exercise is the run —
// so the flow is mounted through the router that joins them, with the
// API mocked at its boundary.

const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  playClick: () => {},
  startAmbiance: () => {},
  stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({ useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ComprehensionRun } = await import('./ComprehensionRun')
const { default: SentenceStation } = await import('./SentenceStation')

const EXERCISE = {
  text: '駅で友達を待ちました。',
  translation: 'I waited for a friend at the station.',
  read_seconds: 60,
  questions: [
    { type: 'comprehension', question: 'Where did they wait?', options: ['At home', 'At the station'], correct: 1 },
    { type: 'vocabulary', question: 'What does 友達 mean?', options: ['train', 'friend'], correct: 1 },
  ],
}
const RESULT = {
  score: 1, total: 2,
  results: [
    { question: EXERCISE.questions[0].question, options: EXERCISE.questions[0].options, correct: 1, user_answer: 1, is_correct: true },
    { question: EXERCISE.questions[1].question, options: EXERCISE.questions[1].options, correct: 1, user_answer: 0, is_correct: false },
  ],
}

const ok = body => ({ ok: true, status: 200, json: async () => body })
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

function clickText(root, text) {
  const btn = [...root.querySelectorAll('button')].find(b => b.textContent.includes(text))
  expect(btn, `${text} — page: ${root.textContent.slice(0, 300)}`).toBeTruthy()
  btn.click()
}

/** Past the TrainDoor, which any pointerdown skips. */
async function through() {
  await settle(700)
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await settle(300)
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    if (String(url).startsWith('/api/reading/comprehension/result')) return ok(RESULT)
    if (String(url).startsWith('/api/reading/comprehension')) return ok(EXERCISE)
    return ok({})
  })
})

describe('ComprehensionRun', () => {
  it('reads, answers with Next, and prints the result lattice and rows', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/comprehension']}>
          <Routes>
            <Route
              path="/practice/comprehension"
              element={<SentenceStation session={{ access_token: 'tok' }} base="/practice/comprehension" levelsOnly />}
            />
            <Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} />
          </Routes>
          <TrainDoor />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const root = screen.container

    // The station page: one bar, the route diagram.
    expect(root.querySelectorAll('.bar')).toHaveLength(1)
    expect(root.querySelectorAll('.route-stop')).toHaveLength(5)
    clickText(root, 'N4')
    await through()

    // The text on the stage, under the timer; both bars have left.
    expect(root.querySelector('.stage__head')).toBeTruthy()
    expect(root.querySelector('.bar')).toBeNull()
    expect(root.querySelector('.timer__label')).toBeTruthy()
    expect(root.querySelector('.prose__jp--passage').textContent).toBe(EXERCISE.text)
    expect(root.querySelector('.stage__foot .btn-secondary')).toBeTruthy()
    root.querySelector('.stage__foot .btn-primary').click()   // done reading
    await settle()

    // Question 1: lettered rows, Next waits for a pick.
    expect(root.querySelector('.today-remaining').textContent).toBe('1 / 2')
    const rows = root.querySelectorAll('.mcq-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.mcq-row__index').textContent).toBe('A')
    expect(rows[1].querySelector('.mcq-row__index').textContent).toBe('B')
    const next = root.querySelector('.stage__foot .btn-primary')
    expect(next.disabled).toBe(true)
    rows[1].click()
    await settle()
    expect(root.querySelectorAll('.mcq-row--selected')).toHaveLength(1)
    expect(next.disabled).toBe(false)
    next.click()
    await settle()

    // Question 2, then the submit.
    expect(root.querySelector('.today-remaining').textContent).toBe('2 / 2')
    root.querySelectorAll('.mcq-row')[0].click()
    await settle()
    root.querySelector('.stage__foot .btn-primary').click()
    await settle(150)

    const post = apiFetch.mock.calls.find(c => String(c[0]).startsWith('/api/reading/comprehension/result'))
    expect(post, 'the answers were posted').toBeTruthy()
    expect(JSON.parse(post[2].body).answers).toEqual([1, 0])

    // The result: the lattice, one row per question, the missed one noted.
    const values = root.querySelectorAll('.result-lattice .record__value')
    expect(values).toHaveLength(2)
    expect(values[0].textContent).toBe('1/ 2')
    expect(values[1].textContent).toBe('50%')
    expect(root.querySelectorAll('.qrow')).toHaveLength(2)
    expect(root.querySelectorAll('.qrow__note')).toHaveLength(1)
    expect(root.querySelector('.qrow__note').textContent).toContain('A')
    expect(root.querySelector('.qrow__note').textContent).toContain('B')
    // A row opens on its question with the options marked.
    root.querySelectorAll('.qrow')[1].click()
    await settle()
    expect(root.querySelector('.qrow__detail .mcq-row--wrong')).toBeTruthy()
    expect(root.querySelector('.qrow__detail .mcq-row--correct')).toBeTruthy()
    expect(root.querySelector('.stage__foot .btn-primary').textContent).toBeTruthy()
  })
})
