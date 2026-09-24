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
    { id: 'e-n3', level: 'N3', kind: 'vocab', title: 'N3 語彙', questionCount: 21, generated: true, revision: 1 },
    { id: 'e-n5', level: 'N5', kind: 'vocab', title: 'N5 語彙', questionCount: 18, generated: true, revision: 1 },
  ],
}))

const { default: ExamScreen } = await import('./ExamScreen')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))

const here = { search: null }
function Probe() {
  here.search = useLocation().search
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

describe('the mock-exam station', () => {
  it('opens the grade the practice gate asked for', async () => {
    const screen = await open('/practice/exam?level=N3')
    // Past the grades: the bar names N3 and the N3 paper is on offer.
    expect(screen.container.querySelector('.route-stop')).toBeNull()
    expect(screen.container.querySelector('.bar__sub').textContent).toBe('N3')
    const titles = [...screen.container.querySelectorAll('.platform-card__title')].map(e => e.textContent)
    expect(titles).toHaveLength(1)
    expect(screen.container.textContent).toContain('21')
  })

  it('asks for a grade when the practice gate did not name one', async () => {
    const screen = await open('/practice/exam')
    expect([...screen.container.querySelectorAll('.route-stop__code')].map(e => e.textContent))
      .toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
  })

  it('ignores a grade that is not one', async () => {
    const screen = await open('/practice/exam?level=N9')
    expect(screen.container.querySelectorAll('.route-stop')).toHaveLength(5)
  })

  // ── The grade is the URL's (plan 114) ──
  // It was component state, so a second visit to /practice/exam — the
  // desk rail's 模試 link, the browser's own history — landed on the
  // papers of whatever grade was last open, with the bar's ‹ the only
  // way back to the grades. Replaced, never pushed.
  it('writes the grade into the URL, and takes it out on the way back', async () => {
    const screen = await open('/practice/exam')
    ;[...screen.container.querySelectorAll('.route-stop')].find(s => s.textContent.includes('N3')).click()
    await settle()
    expect(here.search).toBe('?level=N3')
    expect(screen.container.querySelector('.bar__sub').textContent).toBe('N3')
    screen.container.querySelector('.stage__leave').click()
    await settle()
    expect(here.search).toBe('')
    expect(screen.container.querySelectorAll('.route-stop')).toHaveLength(5)
  })
})
