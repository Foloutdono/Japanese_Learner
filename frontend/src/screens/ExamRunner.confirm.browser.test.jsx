import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The runner on the stage (plan 072) ──────────────────────────
// The docked sheet bar counts what is answered and opens the grid; the
// confirm sheet stands between a blank paper and the server: it names
// the blanks, walks to the first one, or finishes anyway. Pinned on the
// real runner with the service mocked at its boundary (the same seam
// ExamResult.generating mocks) — the paper's shape is examService's.

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
      id: 'm1', number: 1, type: 'mcq-text', instructionsJp: 'ただしいものをえらんでください。',
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

describe('ExamRunner on the stage', () => {
  it('counts answers on the sheet bar, and the confirm sheet walks to the first blank, then finishes', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container

    // The stage, not the shell: the exam's own head row names the paper.
    expect(root.querySelector('.tabbar')).toBeNull()
    expect(root.querySelector('.exam-meta__jp').textContent).toContain('N4 · ')
    expect(root.querySelector('.exam-timer')).toBeTruthy()
    expect(root.querySelector('.exam-sheetbar__fig').textContent).toBe('0 / 2')
    expect(root.querySelector('.cap').textContent).toBe('Q1')

    // Answering the first question fills one chip and the count.
    root.querySelector('.mcq-row').click()
    await settle()
    expect(root.querySelector('.exam-sheetbar__fig').textContent).toBe('1 / 2')
    expect(root.querySelectorAll('.exam-sheetbar__chip--done')).toHaveLength(1)

    // Finish with a blank: the sheet asks first, and names the count.
    root.querySelector('.exam-finish').click()
    await settle()
    expect(sheet(), 'the confirm sheet').toBeTruthy()
    expect(sheet().querySelector('.hint').textContent).toContain('1')
    expect(submitAttempt).not.toHaveBeenCalled()

    // "Go to first blank" lands on Q2 and closes the sheet.
    const blanks = sheet().querySelector('.btn-secondary:not(.btn-secondary--danger)')
    blanks.click()
    await settle()
    expect(sheet()).toBeNull()
    expect(root.querySelector('.cap').textContent).toBe('Q2')

    // Finish anyway sends the answers as they stand, on the paper's revision.
    root.querySelector('.exam-finish').click()
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

  it('the leave sheet keeps the exam; the sheet bar opens the grid and a chip jumps', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container

    // ‹ Exam asks before walking out of a timed paper.
    root.querySelector('.stage__leave').click()
    await settle()
    expect(sheet(), 'the leave sheet').toBeTruthy()
    sheet().querySelector('.btn-primary').click()
    await settle()
    expect(sheet()).toBeNull()
    expect(root.querySelector('.exam-meta')).toBeTruthy()

    // The grid, in a sheet: jumping to Q2 closes it and moves the paper.
    root.querySelector('.exam-sheetbar__open').click()
    await settle()
    expect(sheet().querySelectorAll('.exam-sheet__chip')).toHaveLength(2)
    sheet().querySelectorAll('.exam-sheet__chip')[1].click()
    await settle()
    expect(sheet()).toBeNull()
    expect(root.querySelector('.cap').textContent).toBe('Q2')
  })
})
