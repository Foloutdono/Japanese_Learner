import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the mock exam, sat and marked at a desk (plan 115) ─────────
// A phone keeps the answer sheet in a bar that opens it in a sheet, and
// scrolls a reading passage inside its question's card. On the desk the
// sheet stands in the run's side the whole time (the clock, the count,
// every chip, Finish), a reading passage stands flat beside its
// questions and stays put across them, and the keys the runner always
// had are named. The result's review is a list beside the open
// question's revealed card: the first miss open on arrival, ←/→ or a
// click to the next. The phone's side is deskfree.phone.
//
// The open question is in the URL beside the attempt (?question=, plan
// 117), and each row is a link to it: a question opens in a tab of its
// own, and the swap in place carries the paper it was handed.

const getExam = vi.fn()
const submitAttempt = vi.fn()
const getAttempt = vi.fn()
vi.mock('./exam/examService', async o => ({
  ...(await o()),
  getExam: (...a) => getExam(...a),
  submitAttempt: (...a) => submitAttempt(...a),
  getAttempt: (...a) => getAttempt(...a),
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: () => {}, playClick: () => {}, playCorrect: () => {} }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ExamRunner } = await import('./screens/ExamRunner')
const { default: ExamResult } = await import('./screens/ExamResult')
const { flattenQuestions } = await import('./exam/examService')

const choices = (...texts) => texts.map((textJp, i) => ({ id: `c${i + 1}`, textJp }))
const PASSAGE = { id: 'p1', textJp: 'わたしは毎朝七時に起きます。それから、駅まで歩きます。電車で会社へ行きます。', questions: [
  { id: 'r1', promptJp: '何時に起きますか。', answer: 'c2', choices: choices('六時', '七時', '八時', '九時') },
  { id: 'r2', promptJp: '会社へ何で行きますか。', answer: 'c3', choices: choices('バス', '車', '電車', '自転車') },
] }
const PAPER = {
  id: 'e1', level: 'N4', revision: 3, title: 'N4 Reading',
  sections: [{
    id: 'reading', label: 'Reading', labelJp: '読解', timeLimitMin: 25,
    mondai: [
      { id: 'm1', number: 1, type: 'mcq-text', instructionsJp: 'ただしいものをえらんでください。',
        questions: [{ id: 'q1', promptJp: '毎朝、駅まで＿＿＿歩きます。', answer: 'c1', choices: choices('ゆっくり', 'はやく', 'しずかに', 'よく') }] },
      { id: 'm2', number: 2, type: 'reading-passage', instructionsJp: 'つぎの文章を読んで、しつもんにこたえてください。', passages: [PASSAGE] },
    ],
  }],
}

// A tenth of a second of silence: a clip the browser can load, so the
// player stays a player rather than "audio unavailable".
function silentWav() {
  const n = 800
  const buf = new DataView(new ArrayBuffer(44 + n))
  const str = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); buf.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ')
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true)
  buf.setUint32(24, 8000, true); buf.setUint32(28, 8000, true); buf.setUint16(32, 1, true); buf.setUint16(34, 8, true)
  str(36, 'data'); buf.setUint32(40, n, true)
  for (let i = 0; i < n; i++) buf.setUint8(44 + i, 128)
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...new Uint8Array(buf.buffer)))
}
const LISTENING = {
  id: 'e2', level: 'N4', revision: 1, title: 'N4 Listening',
  sections: [{
    id: 'listening', label: 'Listening', labelJp: '聴解', timeLimitMin: 20,
    mondai: [{ id: 'l1', number: 1, type: 'listening-mcq', instructionsJp: 'きいてください。',
      questions: [{ id: 'a1', questionPromptJp: '男の人はどこへ行きますか。', audioSrc: silentWav(), scriptJp: '…', answer: 'c1', choices: choices('駅', '学校', '会社', '家') }] }],
  }],
}

const settle = (ms = 100) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

beforeEach(() => {
  localStorage.clear()
  getExam.mockReset()
  submitAttempt.mockReset()
})

async function sit(paper = PAPER) {
  getExam.mockResolvedValue(paper)
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/practice/exam/${paper.id}`]}>
        <Routes>
          <Route path="/practice/exam/:examId" element={<ExamRunner session={{ access_token: 'tok' }} />} />
          <Route path="/practice/exam/:examId/results" element={<p className="probe-result">result</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(250)
}

describe('the exam runner on the desk', () => {
  it('stands the answer sheet in the side: the clock, the count, the grid, Finish', async () => {
    await sit()
    const side = $('.desk-run__side')
    expect(side).not.toBeNull()
    const exam = getComputedStyle(document.documentElement).getPropertyValue('--line-exam').trim()
    expect(getComputedStyle(side).getPropertyValue('--line-color').trim()).toBe(exam)
    expect($$('[role="timer"]')).toHaveLength(1)
    expect(side.querySelector('[role="timer"]')).not.toBeNull()
    expect(side.querySelectorAll('.exam-sheet__chip')).toHaveLength(3)
    expect(side.querySelector('.desk-answers__fig').textContent).toBe('0 / 3')
    expect($('.exam-sheetbar')).toBeNull()

    // One click to any question, and no dialog on the way.
    side.querySelectorAll('.exam-sheet__chip')[2].click()
    await settle(250)
    expect($('.exam-card .cap').textContent).toMatch(/3$/)
    expect($('[role="dialog"]')).toBeNull()

    press('2')
    await settle()
    expect(side.querySelector('.desk-answers__fig').textContent).toBe('1 / 3')
    side.querySelector('.desk-answers__finish').click()
    await settle()
    // Blanks left: it asks first, the way the phone's Finish does.
    expect($('[role="dialog"]')).not.toBeNull()
  })

  it('stands a reading passage flat beside its questions, where it stays', async () => {
    await sit()
    $$('.desk-run__side .exam-sheet__chip')[1].click()
    await settle(250)
    const text = $('.desk-paper__text')
    expect(text.textContent).toContain('七時に起きます')
    expect($('.exam-card .exam-passage')).toBeNull()
    const ask = $('.desk-paper__ask').getBoundingClientRect()
    const tr = text.getBoundingClientRect()
    expect(ask.left).toBeGreaterThanOrEqual(tr.right)
    expect(Math.round(ask.top)).toBe(Math.round(tr.top))
    // Whole, not the card's inner scroll.
    expect(text.scrollHeight).toBeLessThanOrEqual(text.clientHeight + 1)

    press('ArrowRight')
    await settle(250)
    expect($('.exam-card .exam-question__prompt').textContent).toBe('会社へ何で行きますか。')
    // The same passage node: it neither re-mounts nor re-animates.
    expect($('.desk-paper__text')).toBe(text)
  })

  it('names the keys it answers to', async () => {
    await sit()
    expect($$('.mcq-row').map(r => r.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4'])
    expect($('.exam-nav .btn-primary').getAttribute('aria-keyshortcuts')).toBe('ArrowRight')
    expect($('.exam-nav .btn-secondary').getAttribute('aria-keyshortcuts')).toBe('ArrowLeft')
    expect($('.exam-flag').getAttribute('aria-keyshortcuts')).toBe('F')
  })

  it('plays a listening clip with Space', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    await sit(LISTENING)
    await settle(200)
    expect($('.exam-audio-player .desk-kbd')).not.toBeNull()
    expect($('.exam-audio-player__play').getAttribute('aria-keyshortcuts')).toBe('Space')
    press(' ')
    await settle()
    expect(play).toHaveBeenCalledTimes(1)
    play.mockRestore()
  })
})

// ── The result ──
const questions = flattenQuestions(PAPER)
const given = { q1: 'c1', r1: 'c1', r2: 'c4' }
const summaryFor = answers => {
  const review = questions.map(q => ({ id: q.id, sectionId: 'reading', given: answers[q.id] ?? null, answer: q.answer, isCorrect: answers[q.id] === q.answer }))
  const correct = review.filter(r => r.isCorrect).length
  return { attemptId: 9, revision: 3, startedAt: 0, finishedAt: 600000, review, perSection: { reading: { correct, total: review.length, pct: Math.round((correct / review.length) * 100) } } }
}

const where = { search: null, type: null, state: null }
function Probe() {
  const loc = useLocation()
  where.search = loc.search
  where.state = loc.state
  where.type = useNavigationType()
  return null
}

async function mark(answers, search = '?attempt=9') {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[{ pathname: '/practice/exam/e1/results', search, state: { summary: summaryFor(answers), exam: PAPER } }]}>
        <Routes><Route path="/practice/exam/:examId/results" element={<ExamResult session={{}} />} /></Routes>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(200)
}
const openQ = () => $('.exam-review-row[aria-current="page"] .exam-review-row__q')?.textContent

describe('the exam result on the desk', () => {
  it('opens the first miss beside the list, with no click', async () => {
    await mark(given)
    expect($$('.desk-split__list .exam-review-row')).toHaveLength(2)
    expect(openQ()).toMatch(/2$/)
    const card = $('.desk-split__page .exam-card')
    expect(card.querySelector('.mcq-row--correct').textContent).toContain('七時')
    expect(card.querySelector('.mcq-row--wrong').textContent).toContain('六時')
    expect($('.exam-review-row[aria-expanded]')).toBeNull()
    expect($('.exam-review-row__detail')).toBeNull()
  })

  it('walks the list with ←/→ and a click, in place', async () => {
    getAttempt.mockClear()
    await mark(given)
    press('ArrowRight')
    await settle()
    expect(openQ()).toMatch(/3$/)
    expect(where.search).toBe('?attempt=9&question=r2')
    expect(where.type).toBe('REPLACE')
    expect($('.desk-split__page .exam-card .exam-question__prompt').textContent).toBe('会社へ何で行きますか。')
    press('ArrowRight')
    await settle()
    expect(openQ()).toMatch(/3$/)
    $$('.desk-split__list .exam-review-row')[0].click()
    await settle()
    expect(openQ()).toMatch(/2$/)
    expect(where.search).toBe('?attempt=9&question=r1')
    expect(where.type).toBe('REPLACE')
    // The paper and the attempt ride with the swap: nothing is fetched.
    expect(where.state?.exam).toBe(PAPER)
    expect(getAttempt).not.toHaveBeenCalled()
  })

  it('makes each row a link to its question, kept beside the attempt', async () => {
    await mark(given)
    const rows = $$('.desk-split__list .exam-review-row')
    expect(rows.every(r => r.tagName === 'A')).toBe(true)
    expect(rows.map(r => r.getAttribute('href'))).toEqual([
      '/practice/exam/e1/results?attempt=9&question=r1',
      '/practice/exam/e1/results?attempt=9&question=r2',
    ])
  })

  it('opens the question the URL names', async () => {
    await mark(given, '?attempt=9&question=r2')
    expect(openQ()).toMatch(/3$/)
    expect($('.desk-split__page .exam-card .exam-question__prompt').textContent).toBe('会社へ何で行きますか。')
  })

  it('lists every question on a clean sheet, and keeps one thing to do next', async () => {
    await mark({ q1: 'c1', r1: 'c2', r2: 'c3' })
    expect($$('.desk-split__list .exam-review-row')).toHaveLength(3)
    expect(openQ()).toMatch(/1$/)
    const buttons = $$('.btn-row button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].className).toBe('btn-primary')
  })
})
