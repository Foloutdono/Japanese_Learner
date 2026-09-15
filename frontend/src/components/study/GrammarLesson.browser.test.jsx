import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'

// ── The lesson (plan 087) ─────────────────────────────────────
// One component in three dresses: the dictionary plate's body, the
// sheet behind every door, the gate before a new card. What is pinned
// is the shape a reader meets: blocks that name themselves and no
// headings, the steps under their pair marks with the table's one
// markup honoured, a compare row that is a door where a shell can open
// one and a fact where it cannot, the pattern picked out of each
// sentence, the translations' one switch, the gate's one button — and
// that a point whose lesson is not written yet prints exactly the
// three blocks the plate always had.

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))

const { GrammarLesson } = await import('./GrammarLesson')

const RICH = {
  raw_id: 'grammar_N5_〜てください', level: 'N5', pattern: '〜てください',
  structure: 'verb て-form + ください', meaning: 'please do', register: 'polite',
  steps: [
    { kind: 'rule', text: 'A **polite request**: do this, please.' },
    { kind: 'use', text: 'Reach for it when:\n- asking a favour\n- giving an instruction' },
    { kind: 'careful', text: 'Not for a superior.' },
  ],
  compare: [
    { pattern: '〜ないでください', raw_id: 'grammar_N5_〜ないでください', level: 'N5', meaning: 'please do not', text: 'The **negative** request.' },
  ],
  examples: [
    { jp: 'ここに名前を書いてください。', tr: 'Please write your name here.',
      furigana: [{ text: 'ここに' }, { text: '名前', reading: 'なまえ' }, { text: 'を' }, { text: '書', reading: 'か' }, { text: 'いて' }, { text: 'ください', highlight: true }, { text: '。' }] },
  ],
  status: { status: 'not_started' },
}
const PLAIN = { ...RICH, steps: [], compare: [], register: undefined }

const settle = (ms = 40) => new Promise(r => setTimeout(r, ms))

// The lane's files share one origin; this file reads the English table
// and hands the origin back as it found it (DictionaryDetail's own test
// does the same).
beforeEach(() => { localStorage.setItem('lang', 'en') })
afterEach(() => { localStorage.removeItem('lang') })
const mount = (ui) => render(<LangProvider>{ui}</LangProvider>)

describe('the grammar lesson', () => {
  it('prints the plate body as blocks that name themselves, in order, with no headings', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="plate" onCompare={() => {}} />)
    const blocks = [...screen.container.querySelectorAll('.dict-block')]
    expect(blocks.map(b => b.getAttribute('aria-label'))).toEqual(['Formation', 'Meaning', 'Lesson', 'Compare', 'Examples'])
    expect(screen.container.querySelector('h3, h4, .section-header')).toBeNull()
    // the plate variant draws no plate of its own: the shell already has one
    expect(screen.container.querySelector('.dict-plate')).toBeNull()
  })

  it('degrades to formation, meaning and examples for a point whose lesson is not written', async () => {
    const screen = await mount(<GrammarLesson point={PLAIN} variant="plate" />)
    const blocks = [...screen.container.querySelectorAll('.dict-block')]
    expect(blocks.map(b => b.getAttribute('aria-label'))).toEqual(['Formation', 'Meaning', 'Examples'])
  })

  it('sets each step under its pair mark, honours **…** and "- " lines, and marks the trap', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" />)
    const steps = [...screen.container.querySelectorAll('.gl-step')]
    expect(steps.map(s => s.querySelector('.dict-mark__jp').textContent)).toEqual(['規則', '使い方', '注意'])
    expect(steps.map(s => s.querySelector('.dict-mark__name').textContent)).toEqual(['Rule', 'Use', 'Careful'])
    expect(steps[0].querySelector('strong').textContent).toBe('polite request')
    expect([...steps[1].querySelectorAll('li')].map(li => li.textContent)).toEqual(['asking a favour', 'giving an instruction'])
    expect(steps[2].classList.contains('gl-step--careful')).toBe(true)
  })

  it('makes a compare row a door where a shell can open one, and a fact where it cannot', async () => {
    const onCompare = vi.fn()
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" onCompare={onCompare} />)
    const door = screen.container.querySelector('.gl-door')
    expect(door.tagName).toBe('BUTTON')
    expect(door.querySelector('.gl-door__pattern').textContent).toBe('〜ないでください')
    expect(door.querySelector('.gl-door__note strong').textContent).toBe('negative')
    door.click()
    expect(onCompare).toHaveBeenCalledWith('grammar_N5_〜ないでください')

    const inert = await mount(<GrammarLesson point={RICH} variant="sheet" />)
    expect(inert.container.querySelector('.gl-door').tagName).toBe('DIV')
    expect(inert.container.querySelector('.gl-door__chev')).toBeNull()
  })

  it('picks the pattern out of its sentence and holds the translation behind one switch', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" />)
    const ex = screen.container.querySelector('.dict-ex')
    expect(ex.querySelector('.dict-ex__hl').textContent).toBe('ください')
    expect(ex.querySelector('rt').textContent).toBe('なまえ')
    expect(ex.querySelector('.dict-ex__tr').textContent).toBe('Please write your name here.')
    screen.container.querySelector('.gl-tr-toggle').click()
    await settle()
    expect(screen.container.querySelector('.dict-ex__tr')).toBeNull()
  })

  it('draws the plate with the three registers and the register word in the sheet and the gate', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" onClose={() => {}} />)
    const plate = screen.container.querySelector('.dict-plate')
    expect(plate.querySelector('.dict-plate__structure').textContent).toBe('verb て-form + ください')
    expect(plate.querySelector('.dict-plate__word').textContent).toBe('〜てください')
    expect(plate.querySelector('.dict-plate__caption').textContent).toBe('please do')
    expect(plate.querySelector('.dict-plate__level').textContent).toBe('N5')
    expect(plate.querySelector('.gl-register').textContent).toBe('Polite')
    expect(plate.querySelector('[aria-label="Close"]')).toBeTruthy()
  })

  it('ends the gate on one primary button that boards', async () => {
    const onBoard = vi.fn()
    const screen = await mount(<GrammarLesson point={RICH} variant="gate" onBoard={onBoard} />)
    const buttons = [...screen.container.querySelectorAll('.btn-primary')]
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('Understood — board')
    buttons[0].click()
    expect(onBoard).toHaveBeenCalled()
    // the sheet and the plate have no such button
    const sheet = await mount(<GrammarLesson point={RICH} variant="sheet" />)
    expect(sheet.container.querySelector('.btn-primary')).toBeNull()
  })
})
