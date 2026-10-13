import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the mock exam, sat and marked at a desk (plans 115, 200) ───
// The owner's mix of the canvas "Tsuji — the mock exam on the desk":
// the paper opens on its cover with the clock stopped and the blank
// answer sheet already in the side; a question is a page of the
// booklet, its answers printed under it in the sheet's ovals, the page
// turning in its foot; the sheet answers too (an oval marks its
// question and opens it), and the hand-in is asked in the sheet, not
// over the paper. A reading passage opens the booklet on two pages, the
// text standing while its questions turn. The result hands the sheet
// back marked beside the open question's page: the first miss open on
// arrival, ←/→ walking the misses. The phone's side is deskfree.phone.
//
// The open question is in the URL beside the attempt (?question=, plan
// 117), and each row of the marked sheet is a link to it: a question
// opens in a tab of its own, and the swap in place carries the paper it
// was handed.

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

// The cover's gate starts the clock (Enter too).
async function start(paper = PAPER) {
  await sit(paper)
  press('Enter')
  await settle(250)
}
const folio = () => $('.desk-folio b')?.textContent
const count = () => $('.desk-clock__count b').textContent

describe('the exam runner on the desk', () => {
  it('opens on its cover, the clock stopped, the blank sheet beside it', async () => {
    await sit()
    expect($('.desk-cover')).not.toBeNull()
    expect($('.desk-book')).toBeNull()
    expect($$('.desk-toc__n').map(n => n.textContent)).toEqual(['1', '2'])
    const side = $('.desk-run__side')
    expect(side.querySelector('[role="timer"]').textContent).toBe('25:00')
    expect(side.querySelectorAll('.desk-mark-row')).toHaveLength(3)
    // Nothing on the sheet to press before the clock.
    expect(side.querySelector('.desk-marksheet button')).toBeNull()
    expect($('button[aria-keyshortcuts="Enter"]')).not.toBeNull()
    await settle(1100)
    expect(side.querySelector('[role="timer"]').textContent).toBe('25:00')

    press('Enter')
    await settle(250)
    expect($('.desk-cover')).toBeNull()
    expect(folio()).toBe('1')
  })

  it('stands the answer sheet in the side: the clock, the count, a row of ovals a question, Finish', async () => {
    await start()
    const side = $('.desk-run__side')
    const exam = getComputedStyle(document.documentElement).getPropertyValue('--line-exam').trim()
    expect(getComputedStyle(side).getPropertyValue('--line-color').trim()).toBe(exam)
    expect($$('[role="timer"]')).toHaveLength(1)
    expect(side.querySelector('[role="timer"]')).not.toBeNull()
    const rows = () => $$('.desk-run__side .desk-mark-row')
    expect(rows().map(r => r.querySelectorAll('.desk-oval').length)).toEqual([4, 4, 4])
    expect(count()).toBe('0 / 3')
    expect(side.querySelector('.desk-exam__finish')).not.toBeNull()

    // An oval answers its question and opens it, no dialog on the way.
    rows()[2].querySelectorAll('.desk-oval')[1].click()
    await settle(250)
    expect(folio()).toBe('3')
    expect(rows()[2].querySelectorAll('.desk-oval')[1].getAttribute('aria-checked')).toBe('true')
    expect($$('.desk-choice')[1].getAttribute('aria-checked')).toBe('true')
    expect(count()).toBe('1 / 3')
    expect($('[role="dialog"]')).toBeNull()

    // Its number opens it; a key answers it, and the sheet fills.
    rows()[0].querySelector('.desk-mark-row__n').click()
    await settle(250)
    expect(folio()).toBe('1')
    press('1')
    await settle()
    expect(count()).toBe('2 / 3')
    expect(rows()[0].querySelector('.desk-oval--on').textContent).toBe('1')
  })

  it('asks its hand-in in the sheet, the way back first', async () => {
    submitAttempt.mockResolvedValue({ attemptId: 4 })
    await start()
    press('1')
    await settle()
    $('.desk-exam__finish').click()
    await settle()
    expect($('[role="dialog"], [aria-modal="true"]')).toBeNull()
    expect($('.desk-handin').getAttribute('role')).toBe('alertdialog')
    expect($$('.desk-handin__blank').map(b => b.textContent)).toEqual(['2', '3'])
    expect($$('.desk-mark-row--owe')).toHaveLength(2)
    // It opens on the way back, never the irreversible act.
    expect(document.activeElement.textContent).toBe('Aller à la 2')
    document.activeElement.click()
    await settle(250)
    expect($('.desk-handin')).toBeNull()
    expect(folio()).toBe('2')

    // Esc puts the question away, not the paper.
    $('.desk-exam__finish').click()
    await settle()
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    expect($('.desk-handin')).toBeNull()
    expect($('[aria-modal="true"]')).toBeNull()

    $('.desk-exam__finish').click()
    await settle()
    $$('.desk-handin button').find(b => b.textContent === 'Rendre quand même').click()
    await settle(250)
    expect(submitAttempt).toHaveBeenCalledTimes(1)
    expect($('.probe-result')).not.toBeNull()
  })

  it('turns a passage\'s questions on the right page, the text standing on the left', async () => {
    await start()
    $$('.desk-mark-row__n')[1].click()
    await settle(250)
    const text = $('.desk-spread__text')
    expect(text.textContent).toContain('七時に起きます')
    expect($('.desk-spread__ask .exam-passage__text')).toBeNull()
    const ask = $('.desk-spread__ask').getBoundingClientRect()
    const tr = text.getBoundingClientRect()
    expect(ask.left).toBeGreaterThanOrEqual(tr.right - 1)
    expect(Math.round(ask.top)).toBe(Math.round(tr.top))
    expect($$('.desk-serves__q').map(b => b.textContent)).toEqual(['2', '3'])

    press('ArrowRight')
    await settle(250)
    expect($('.desk-spread__ask .exam-ask__line').textContent).toBe('会社へ何で行きますか。')
    // The same text node: it neither re-mounts nor re-animates.
    expect($('.desk-spread__text')).toBe(text)
  })

  it('names the keys it answers to, and prints them', async () => {
    await start()
    expect($$('.desk-choice').map(r => r.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4'])
    expect($$('.desk-turn').map(b => b.getAttribute('aria-keyshortcuts'))).toEqual(['ArrowLeft', 'ArrowRight'])
    expect($('.desk-exam__flag').getAttribute('aria-keyshortcuts')).toBe('F')
    // Every cap is printed on what it presses (plan 123).
    expect($$('.desk-book__foot .desk-kbd').map(k => k.textContent)).toEqual(['←', '1', '4', '→'])
    expect($('.desk-exam__flag .desk-kbd').textContent).toBe('F')
    press('f')
    await settle()
    expect($('.desk-exam__flag').getAttribute('aria-pressed')).toBe('true')
    expect($('.desk-mark-row .desk-mark-row__flag')).not.toBeNull()
  })

  it('holds the page whole above the level bar on a short laptop window', async () => {
    await page.viewport(1100, 650)
    document.documentElement.dataset.chrome = 'stage'
    try {
      await start()
      const foot = $('.desk-book__foot').getBoundingClientRect()
      expect(foot.bottom).toBeLessThanOrEqual($('.lvlbar').getBoundingClientRect().top + 1)
      expect($('.desk-book__head').getBoundingClientRect().top).toBeGreaterThan(0)
    } finally {
      delete document.documentElement.dataset.chrome
      await page.viewport(1100, 800)
    }
  })

  it('plays a listening clip with Space', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    await start(LISTENING)
    await settle(200)
    expect($('.exam-ring .desk-kbd')).not.toBeNull()
    expect($('.exam-ring__play').getAttribute('aria-keyshortcuts')).toBe('Space')
    press(' ')
    await settle()
    expect(play).toHaveBeenCalledTimes(1)
    play.mockRestore()
  })

  it('gives Space back to the clip from an answer already checked (plan 123)', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    await start(LISTENING)
    await settle(200)
    // A click leaves the focus on the choice, as Chrome does.
    const choice = $$('.desk-choice')[1]
    choice.click()
    choice.focus()
    await settle()
    expect(choice.getAttribute('aria-checked')).toBe('true')
    choice.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
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
const openQ = () => $('.desk-mark-row[aria-current="page"] .desk-mark-row__n')?.textContent
const sheetRows = () => $$('.desk-marksheet--marked .desk-mark-row')

describe('the exam result on the desk', () => {
  it('hands the sheet back marked, the first miss open beside it, with no click', async () => {
    await mark(given)
    const rows = sheetRows()
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelector('.desk-oval--got').textContent).toBe('1')
    expect(rows[1].querySelector('.desk-oval--x').textContent).toBe('1')
    expect(rows[1].querySelector('.desk-oval--right').textContent).toBe('2')
    expect(openQ()).toBe('2')
    expect($('.desk-score__fig').textContent).toBe('1')
    expect($('.desk-book__walk').textContent).toContain('erreur 1 sur 2')
    const open = $('.desk-book--res')
    expect(open.querySelector('.desk-choice--right').textContent).toContain('七時')
    expect(open.querySelector('.desk-choice--wrong').textContent).toContain('六時')
    // No title drawn: the rail names the place.
    expect($('.bar')).toBeNull()
    expect($('h1.sr-only')).not.toBeNull()
  })

  it('walks the misses with ←/→ and a click, in place', async () => {
    getAttempt.mockClear()
    await mark(given)
    press('ArrowRight')
    await settle()
    expect(openQ()).toBe('3')
    expect(where.search).toBe('?attempt=9&question=r2')
    expect(where.type).toBe('REPLACE')
    expect($('.desk-book--res .exam-ask__line').textContent).toBe('会社へ何で行きますか。')
    press('ArrowRight')
    await settle()
    expect(openQ()).toBe('3')
    // A right answer opens from the sheet too, and walks on to the miss after it.
    sheetRows()[0].click()
    await settle()
    expect(openQ()).toBe('1')
    expect(where.search).toBe('?attempt=9&question=q1')
    expect($('.desk-book__walk')).toBeNull()
    press('ArrowRight')
    await settle()
    expect(openQ()).toBe('2')
    expect(where.type).toBe('REPLACE')
    // The paper and the attempt ride with the swap: nothing is fetched.
    expect(where.state?.exam).toBe(PAPER)
    expect(getAttempt).not.toHaveBeenCalled()
  })

  it('makes each row a link to its question, kept beside the attempt', async () => {
    await mark(given)
    const rows = sheetRows()
    expect(rows.every(r => r.tagName === 'A')).toBe(true)
    expect(rows.map(r => r.getAttribute('href'))).toEqual([
      '/practice/exam/e1/results?attempt=9&question=q1',
      '/practice/exam/e1/results?attempt=9&question=r1',
      '/practice/exam/e1/results?attempt=9&question=r2',
    ])
  })

  it('opens the question the URL names', async () => {
    await mark(given, '?attempt=9&question=r2')
    expect(openQ()).toBe('3')
    expect($('.desk-book--res .exam-ask__line').textContent).toBe('会社へ何で行きますか。')
  })

  // Plan 123: the question stands whole beside the sheet, so a listening
  // question's transcript stands open, and its clip still answers Space.
  it('opens a listening question\'s transcript, its clip on Space', async () => {
    const qs = flattenQuestions(LISTENING)
    const review = qs.map(q => ({ id: q.id, sectionId: 'listening', given: 'c2', answer: q.answer, isCorrect: false }))
    const summary = { attemptId: 9, revision: 1, startedAt: 0, finishedAt: 600000, review, perSection: { listening: { correct: 0, total: review.length, pct: 0 } } }
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[{ pathname: '/practice/exam/e2/results', search: '?attempt=9', state: { summary, exam: LISTENING } }]}>
          <Routes><Route path="/practice/exam/:examId/results" element={<ExamResult session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)
    const open = $('.desk-book--res')
    expect(open.querySelector('details.exam-transcript').open).toBe(true)
    expect(open.querySelector('.exam-ring__play').getAttribute('aria-keyshortcuts')).toBe('Space')
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    press(' ')
    await settle()
    expect(play).toHaveBeenCalledTimes(1)
    play.mockRestore()
  })

  // Plan 123, P15: the sheet is one tab stop, walked with ↑/↓ across its
  // parts, and ←/→ take the focus along with the open question.
  it('walks the sheet from one tab stop, the focus following ←/→', async () => {
    await mark(given)
    expect(sheetRows().filter(r => r.tabIndex === 0)).toEqual([sheetRows()[1]])
    sheetRows()[1].focus()
    sheetRows()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await settle()
    expect(openQ()).toBe('3')
    expect(document.activeElement).toBe(sheetRows()[2])
    sheetRows()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(sheetRows()[1])
  })

  it('opens the first question on a clean sheet, and keeps the way on under the page', async () => {
    await mark({ q1: 'c1', r1: 'c2', r2: 'c3' })
    expect(sheetRows()).toHaveLength(3)
    expect(openQ()).toBe('1')
    expect($('.desk-book__walk')).toBeNull()
    expect($$('.desk-res__acts button').map(b => b.className)).toEqual(['btn-secondary', 'btn-primary'])
  })
})
