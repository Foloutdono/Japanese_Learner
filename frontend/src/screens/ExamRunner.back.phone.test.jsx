import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── Back from the result never re-sits the paper ──────────────────
// The runner's route asks the server for the lowest revision this
// learner has not sat, and claims a fresh generation when none is left
// (routes/exams.py). Finishing used to PUSH the result, so Back landed
// on the runner and could start a paid generation. Finishing replaces
// the runner now: Back from the result is the page before the paper.

const getExam = vi.fn()
const submitAttempt = vi.fn()
vi.mock('../exam/examService', async o => ({
  ...(await o()),
  getExam: (...a) => getExam(...a),
  submitAttempt: (...a) => submitAttempt(...a),
}))
vi.mock('../lib/audio', async o => ({ ...(await o()), playUi: () => {}, playClick: () => {} }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ExamRunner } = await import('./ExamRunner')

const PAPER = {
  id: 'e1', level: 'N4', revision: 3, title: 'N4 Vocabulary',
  sections: [{
    id: 'vocabulary', label: 'Vocabulary', labelJp: '語彙', timeLimitMin: 25,
    mondai: [{
      id: 'm1', number: 1, type: 'mcq-text', instructionsJp: 'ただしいものをえらんでください。',
      questions: [{ id: 'q1', promptJp: '毎朝、駅まで＿＿＿歩きます。', answer: 'c1', choices: [{ id: 'c1', textJp: 'ゆっくり' }, { id: 'c2', textJp: 'はやく' }] }],
    }],
  }],
}

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

function Result() {
  const navigate = useNavigate()
  return <button type="button" className="probe-back" onClick={() => navigate(-1)}>back</button>
}

describe('the exam runner, finished', () => {
  it('leaves no runner behind it in the history', async () => {
    localStorage.clear()
    getExam.mockResolvedValue(PAPER)
    submitAttempt.mockResolvedValue({ attemptId: 7 })
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/exam', '/practice/exam/e1']} initialIndex={1}>
          <Routes>
            <Route path="/practice/exam" element={<p className="probe-papers">papers</p>} />
            <Route path="/practice/exam/:examId" element={<ExamRunner session={{ access_token: 'tok' }} />} />
            <Route path="/practice/exam/:examId/results" element={<Result />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const root = screen.container
    root.querySelector('.mcq-row').click()
    await settle()
    root.querySelector('.exam-finish').click()
    await settle(150)
    expect(submitAttempt).toHaveBeenCalledTimes(1)

    root.querySelector('.probe-back').click()
    await settle()
    expect(root.querySelector('.probe-papers')).not.toBeNull()
    expect(getExam).toHaveBeenCalledTimes(1)
  })
})
