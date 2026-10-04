import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'

// The study under a reviewed question: nothing is fetched until it is
// asked for, then the choices come back translated beside their words
// and the sentence -- the answer in its gap -- with its translation and
// its breakdown.
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {},
}))

const STUDY = {
  questionId: 'fill',
  sentence: '駅へ行きます。',
  translation: 'I go to the station.',
  choices: [
    { id: 'c1', translation: 'to (direction)' },
    { id: 'c2', translation: '' },
    { id: 'c3', translation: 'subject marker' },
    { id: 'c4', translation: 'of' },
  ],
  context: '',
  contextTranslation: '',
}

const QUESTION = {
  id: 'fill',
  promptJp: '駅＿＿＿＿行きます。',
  choices: [
    { id: 'c1', textJp: 'へ' }, { id: 'c2', textJp: 'を' },
    { id: 'c3', textJp: 'が' }, { id: 'c4', textJp: 'の' },
  ],
  answer: 'c1',
}

function respond(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => body, text: async () => JSON.stringify(body) })
}

let calls
beforeEach(() => {
  calls = []
  globalThis.fetch = vi.fn((url, opts) => {
    const path = String(url)
    calls.push(path)
    if (path.includes('/study')) return respond(STUDY)
    if (path.includes('/api/phrase/analyze')) {
      return respond({ tokens: [], grammar: [], available: false, text: JSON.parse(opts.body).phrase })
    }
    return respond({})
  })
})

const { default: ExamStudy } = await import('./ExamStudy')

async function settle() {
  for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 0))
}

describe('ExamStudy', () => {
  it('fetches nothing until asked, then shows the translations', async () => {
    const screen = await render(
      <LangProvider>
        <ExamStudy session={{}} examId="n5-grammar-01" revision={2} question={QUESTION} />
      </LangProvider>,
    )
    await settle()
    expect(calls.some(c => c.includes('/study'))).toBe(false)

    screen.container.querySelector('.exam-study__toggle').click()
    await settle()

    const studyCall = calls.find(c => c.includes('/study'))
    expect(studyCall).toContain('/api/exams/n5-grammar-01/revisions/2/questions/fill/study')
    expect(calls.some(c => c.includes('/api/phrase/analyze'))).toBe(true)

    const rows = [...screen.container.querySelectorAll('.exam-study__choice')]
    expect(rows).toHaveLength(4)
    expect(rows[0].textContent).toContain('to (direction)')
    expect(rows[0].classList.contains('exam-study__choice--right')).toBe(true)
    // An empty translation is a choice that is not a word.
    expect(rows[1].querySelector('.exam-study__en').textContent).not.toBe('')
    expect(screen.container.textContent).toContain('I go to the station.')
    expect(screen.container.textContent).toContain('駅へ行きます。')
  })
})
