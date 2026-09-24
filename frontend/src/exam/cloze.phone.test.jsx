import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../LangContext'
import QuestionRenderer from './QuestionRenderer'
import { flattenQuestions } from './examService'
import '../index.css'

// ── The blank being asked is the one lit ────────────────────────
// A cloze passage marks its blanks 【1】…【n】, numbered within the
// passage (backend study/exam_grammar_gen.py). The paper renumbers its
// questions through the whole section (examService.flattenQuestions),
// so a cloze after another mondai asks Q4 about 【1】. The highlight
// used to compare the marker with the section number, and lit nothing.

vi.mock('../lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn() }))

const choices = ids => ids.map(id => ({ id, textJp: id }))
const EXAM = {
  sections: [{
    id: 'grammar', label: 'Grammar',
    mondai: [
      { id: 'm1', number: 1, type: 'grammar-form', questions: [1, 2, 3].map(n => ({ id: `q${n}`, number: n, promptJp: `問${n}`, choices: choices(['c1', 'c2', 'c3', 'c4']), answer: 'c1' })) },
      {
        id: 'm3', number: 3, type: 'cloze-passage',
        passages: [{
          id: 'm3_p1', titleJp: 'ともだち', textTemplateJp: 'きのう【1】ともだちと【2】。',
          blanks: [1, 2].map(n => ({ id: `m3_b${n}`, number: n, choices: choices(['c1', 'c2', 'c3', 'c4']), answer: 'c1' })),
        }],
      },
    ],
  }],
}

describe('a cloze question on the paper', () => {
  it('lights its own blank, not the section number', async () => {
    const qs = flattenQuestions(EXAM)
    const cloze = qs.filter(q => q.type === 'cloze-passage')
    expect(cloze.map(q => q.number)).toEqual([4, 5])
    expect(cloze.map(q => q.blankNumber)).toEqual([1, 2])

    const screen = await render(<LangProvider><QuestionRenderer question={cloze[1]} selected={null} onSelect={() => {}} /></LangProvider>)
    const active = [...document.querySelectorAll('.exam-blank-pill--active')]
    expect(active.map(el => el.textContent)).toEqual(['2'])
    await screen.unmount()
  })
})
