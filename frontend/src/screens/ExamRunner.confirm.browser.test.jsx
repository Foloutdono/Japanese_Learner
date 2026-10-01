import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The runner on the stage (plans 072, 171) ──────────────────
// The phone's paper opens on its cover and the clock waits for Start;
// a question is a page over a dock of answer tiles; the answer sheet is
// a sheet of the parts, and the confirm sheet stands between a blank
// paper and the server: it names the blanks, walks to the first one, or
// finishes anyway. Pinned on the real runner with the service mocked at
// its boundary (the same seam ExamResult.generating mocks) -- the
// paper's shape is examService's.

const getExam = vi.fn()
const submitAttempt = vi.fn()

vi.mock('../exam/examService', async importOriginal => ({
  ...(await importOriginal()),
  getExam: (...a) => getExam(...a),
  submitAttempt: (...a) => submitAttempt(...a),
}))

vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  playClick: () => {},
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ExamRunner } = await import('./ExamRunner')

const PAPER = {
  id: 'e1', level: 'N4', revision: 3, title: 'N4 Vocabulary',
  sections: [{
    id: 'vocabulary', label: 'Vocabulary', labelJp: '語彙', timeLimitMin: 25,
    mondai: [{
      id: 'm1', number: 1, nameJp: '文脈規定', type: 'mcq-text', instructionsJp: 'ただしいものをえらんでください。',
      questions: [
        { id: 'q1', promptJp: '毎朝、駅まで＿＿＿歩きます。', underlineJp: '＿＿＿', answer: 'c1', choices: [{ id: 'c1', textJp: 'ゆっくり' }, { id: 'c2', textJp: 'はやく' }] },
        { id: 'q2', promptJp: 'この本はとても＿＿＿です。', answer: 'c3', choices: [{ id: 'c3', textJp: 'おもしろい' }, { id: 'c4', textJp: 'たかい' }] },
      ],
    }],
  }],
}

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/exam/e1']}>
        <Routes>
          <Route path="/practice/exam/:examId" element={<ExamRunner session={{ access_token: 'tok' }} />} />
          <Route path="/practice/exam/:examId/results" element={<p className="probe">results</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

const sheet = () => document.querySelector('.sheet')

beforeEach(() => {
  getExam.mockReset()
  submitAttempt.mockReset()
  localStorage.clear()
  getExam.mockResolvedValue(PAPER)
  submitAttempt.mockResolvedValue({ attemptId: 7 })
})

const page = root => root.querySelector('.exam-page__fig')?.textContent
const draft = () => JSON.parse(localStorage.getItem('jp-exam-draft:e1:3') ?? 'null')

async function begin(root) {
  root.querySelector('.exam-cover__go').click()
  await settle()
}

describe('ExamRunner on the stage', () => {
  it('waits on its cover, the clock stopped, until Start', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container

    // The stage, not the shell: the cover names the paper and its parts.
    expect(root.querySelector('.tabbar')).toBeNull()
    expect(root.querySelector('.stage__where-jp').textContent).toContain('N4 · ')
    expect(root.querySelector('.exam-cover__jp').textContent).toBe('語彙')
    expect(root.querySelector('.exam-cover__part-jp').textContent).toBe('文脈規定')
    expect(root.querySelector('.exam-cover__count').textContent).toBe('2')
    expect(root.querySelector('[role="timer"]')).toBeNull()
    expect(draft(), 'nothing saved before Start').toBeNull()

    await begin(root)
    expect(root.querySelector('.exam-cover')).toBeNull()
    expect(root.querySelector('.exam-timer').textContent).toBe('25:00')
    expect(typeof draft().startedAt).toBe('number')
  })

  it('answers on the dock, counts on the sheet, and the confirm sheet walks to the first blank, then finishes', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    await begin(root)

    // The page: its number at the head, the part beside it, the
    // question alone; the answers are the dock's tiles.
    expect(page(root)).toBe('1')
    expect(root.querySelector('.exam-page__part').textContent).toBe('問題1文脈規定')
    expect(root.querySelector('.exam-page .mcq-row')).toBeNull()
    const tiles = root.querySelectorAll('.exam-dock .exam-tile')
    expect(tiles).toHaveLength(2)
    tiles[0].click()
    await settle()
    expect(root.querySelector('.exam-tile--on').getAttribute('aria-checked')).toBe('true')

    // The sheet counts it, part by part.
    root.querySelector('.exam-run__sheet').click()
    await settle()
    expect(sheet().querySelector('.exam-parts__sum').textContent).toContain('1 / 2')
    expect(sheet().querySelector('.exam-parts__jp').textContent).toBe('文脈規定')
    expect(sheet().querySelectorAll('.exam-sheet__chip--answered')).toHaveLength(1)

    // Finish with a blank: the sheet asks first, and names the count.
    sheet().querySelector('.exam-parts__finish').click()
    await settle()
    expect(sheet(), 'the confirm sheet').toBeTruthy()
    expect(sheet().querySelector('.hint').textContent).toContain('1')
    expect(submitAttempt).not.toHaveBeenCalled()

    // "Go to first blank" lands on Q2 and closes the sheet.
    sheet().querySelector('.btn-secondary:not(.btn-secondary--danger)').click()
    await settle()
    expect(sheet()).toBeNull()
    expect(page(root)).toBe('2')

    // On the last question the way on is the sheet; finish anyway sends
    // the answers as they stand, on the paper's revision.
    root.querySelector('.exam-dock__go--next').click()
    await settle()
    sheet().querySelector('.exam-parts__finish').click()
    await settle()
    sheet().querySelector('.btn-secondary--danger').click()
    await settle(120)
    expect(submitAttempt).toHaveBeenCalledTimes(1)
    const [examId, payload] = submitAttempt.mock.calls[0]
    expect(examId).toBe('e1')
    expect(payload.revision).toBe(3)
    expect(payload.answers).toEqual({ q1: 'c1' })
    expect(root.querySelector('.probe')?.textContent).toBe('results')
  })

  it('the leave sheet keeps the exam; a chip on the sheet jumps', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    await begin(root)

    // ‹ asks before walking out of a timed paper.
    root.querySelector('.exam-run__leave').click()
    await settle()
    expect(sheet(), 'the leave sheet').toBeTruthy()
    sheet().querySelector('.btn-primary').click()
    await settle()
    expect(sheet()).toBeNull()
    expect(root.querySelector('.exam-page')).toBeTruthy()

    // The parts, in a sheet: jumping to Q2 closes it and moves the paper.
    root.querySelector('.exam-run__sheet').click()
    await settle()
    expect(sheet().querySelectorAll('.exam-sheet__chip')).toHaveLength(2)
    sheet().querySelectorAll('.exam-sheet__chip')[1].click()
    await settle()
    expect(sheet()).toBeNull()
    expect(page(root)).toBe('2')
  })
})
