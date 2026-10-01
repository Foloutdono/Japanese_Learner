import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 模試 — the papers, reached from the practice gate ──────────
// The gate's platform rows carry the five grades
// (screens/PracticeScreen.jsx): 模試's chips are the one pair that is
// not a run, so they open that grade's papers instead. This is the
// other half of that contract — without it the chip lands on the list
// of grades the learner just picked from.

vi.mock('../lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(),
  startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))
vi.mock('../stores/profileSummary', async (o) => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N5' }) }))
vi.mock('../exam/examService', () => ({
  listExams: async () => [
    { id: 'e-n3', level: 'N3', kind: 'vocab', title: 'N3 語彙', questionCount: 21, generated: true, revision: 1, minutes: 30, mondai: ['漢字読み'], last: null },
    { id: 'e-n5', level: 'N5', kind: 'vocab', title: 'N5 語彙', questionCount: 18, generated: true, revision: 1, minutes: 17, mondai: ['漢字読み', '表記'], last: { correct: 15, total: 18 } },
    { id: 'e-n5g', level: 'N5', kind: 'grammar', title: 'N5 文法', questionCount: 17, generated: false, revision: null, minutes: 26, mondai: ['文の文法1'], last: null },
  ],
}))

const { default: ExamScreen } = await import('./ExamScreen')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))

const here = { search: null, path: null, state: null }
function Probe() {
  const loc = useLocation()
  here.search = loc.search
  here.path = loc.pathname
  here.state = loc.state
  return null
}

async function open(entry) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <ExamScreen session={null} />
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

const grade = root => root.querySelector('.seg__opt[aria-checked="true"]')?.textContent
const hero = root => root.querySelector('.exam-st__title')?.textContent

// On a phone the grade and its papers are one screen (plan 171): the
// grade a band at the head, the paper to sit next a card holding its
// parts and Start, the others rows that swap into the card.
describe('the mock-exam station', () => {
  it('opens the grade the practice gate asked for', async () => {
    const screen = await open('/practice/exam?level=N3')
    expect(grade(screen.container)).toBe('N3')
    expect(hero(screen.container)).toBe('Vocabulaire')
    expect(screen.container.querySelector('.exam-st__facts').textContent).toContain('21')
    expect(screen.container.querySelectorAll('.exam-st__row')).toHaveLength(0)
  })

  it('opens on the learner\'s own grade when the gate named none, its next paper first', async () => {
    const screen = await open('/practice/exam')
    expect(grade(screen.container)).toBe('N5')
    // Vocabulary is sat; grammar is not, so grammar is the next paper.
    expect(hero(screen.container)).toBe('Grammaire')
    expect(screen.container.querySelector('.exam-st__note')).not.toBeNull()
    expect([...screen.container.querySelectorAll('.exam-st__part-jp')].map(p => p.textContent)).toEqual(['文の文法1'])
    expect(screen.container.querySelector('.exam-st__row .exam-st__fig').textContent).toContain('15')
  })

  it('ignores a grade that is not one', async () => {
    const screen = await open('/practice/exam?level=N9')
    expect(grade(screen.container)).toBe('N5')
  })

  it('swaps a row into the card, and Start opens that paper with its last sitting', async () => {
    const screen = await open('/practice/exam')
    screen.container.querySelector('.exam-st__row').click()
    await settle()
    expect(hero(screen.container)).toBe('Vocabulaire')
    expect(screen.container.querySelector('.exam-st__fresh')).not.toBeNull()
    screen.container.querySelector('.exam-st__go').click()
    await settle()
    expect(here.path).toBe('/practice/exam/e-n5')
    expect(here.state).toEqual({ last: { correct: 15, total: 18 } })
  })

  // The grade is the URL's (plan 114), replaced and never pushed.
  it('writes the grade into the URL', async () => {
    const screen = await open('/practice/exam')
    ;[...screen.container.querySelectorAll('.seg__opt')].find(s => s.textContent === 'N3').click()
    await settle()
    expect(here.search).toBe('?level=N3')
    expect(hero(screen.container)).toBe('Vocabulaire')
  })
})
