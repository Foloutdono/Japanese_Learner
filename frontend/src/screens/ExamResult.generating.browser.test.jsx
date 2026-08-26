import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// getExam returns TWO shapes: a real paper, or `{generating: true}` on a
// 202. The second is truthy and has no `sections`, so a caller reading
// `exam?.sections[0]` throws -- the `?.` guards `exam`, never the index
// step. That white-screened this screen in production with
// "Cannot read properties of undefined (reading '0')".
//
// Mocking the SERVICE rather than fetch is deliberate: this is about the
// shape getExam resolves to, and stubbing fetch would only re-test
// getExam's own status->shape mapping instead of the caller's handling.
const getExam = vi.fn()
const getAttempt = vi.fn()

vi.mock('../exam/examService', () => ({
  getExam: (...a) => getExam(...a),
  getAttempt: (...a) => getAttempt(...a),
  flattenQuestions: () => [],
  ExamGenerationError: class ExamGenerationError extends Error {},
}))

// The screen plays a chime when the practice target is met; keep the
// suite silent and free of autoplay warnings. Spread the real module
// rather than replacing it -- other modules in this import graph pull
// further names (playClick, ...) out of lib/audio, and a bare factory
// would break their imports.
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
  playCorrect: () => {},
}))

// LangProvider fetches /api/translations/* on mount. Stub it so these
// tests stay offline -- same pattern as
// components/analysis/SentenceBreakdown.browser.test.jsx.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
})

const { default: ExamResult } = await import('./ExamResult')

function renderResult() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/exam/e1/results?attempt=7']}>
        <Routes>
          <Route path="/exam/:examId/results" element={<ExamResult session={{}} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

async function settle() {
  // Two microtask flushes: getAttempt resolves, then the chained getExam.
  await new Promise(r => setTimeout(r, 0))
  await new Promise(r => setTimeout(r, 0))
}

describe('ExamResult with getExam\'s two shapes', () => {
  it('does not crash when the paper is still generating', async () => {
    getAttempt.mockResolvedValue({ revision: 1, perSection: {} })
    getExam.mockResolvedValue({ generating: true })

    const screen = await renderResult()
    await settle()

    // The real assertion is that rendering completed at all -- before the
    // fix this threw during render and React unmounted the tree.
    expect(screen.container.querySelector('.empty-state')).not.toBeNull()
    expect(screen.container.querySelector('.exam-result-header')).toBeNull()
  })

  it('renders the result when a real paper comes back', async () => {
    getAttempt.mockResolvedValue({
      revision: 1,
      perSection: { s1: { pct: 80, correct: 8, total: 10 } },
      review: [],
      startedAt: 1000,
      finishedAt: 2000,
    })
    getExam.mockResolvedValue({
      revision: 1, level: 'N5', kind: 'vocab',
      sections: [{ id: 's1', timeLimitMin: 30, mondai: [] }],
    })

    const screen = await renderResult()
    await settle()

    expect(screen.container.querySelector('.exam-result-header')).not.toBeNull()
  })
})
