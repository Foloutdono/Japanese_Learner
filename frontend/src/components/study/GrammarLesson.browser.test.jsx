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
// that a point whose lesson is not written yet prints exactly what it
// has.
//
// Plan 089 moved two things: the plate variant no longer reprints the
// formation and the gloss the plate above it has already drawn, and
// the neighbours sit UNDER the sentences rather than between them and
// the lesson.

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
    // The lesson, the sentences, then the neighbours. No formation and
    // no meaning: the plate above this body has already printed both,
    // and this is the one variant where there IS a plate above it.
    expect(blocks.map(b => b.getAttribute('aria-label'))).toEqual(['Lesson', 'Examples', 'Compare'])
    expect(screen.container.querySelector('h3, h4, .section-header')).toBeNull()
    // the plate variant draws no plate of its own: the shell already has one
    expect(screen.container.querySelector('.dict-plate')).toBeNull()
    expect(screen.container.querySelector('.dict-formation')).toBeNull()
  })

  it('degrades to the sentences alone for a point whose lesson is not written', async () => {
    const screen = await mount(<GrammarLesson point={PLAIN} variant="plate" />)
    const blocks = [...screen.container.querySelectorAll('.dict-block')]
    expect(blocks.map(b => b.getAttribute('aria-label'))).toEqual(['Examples'])
  })

  it('puts the neighbours under the sentences in every dress', async () => {
    // A rival is what you reach for once you have read the rule and
    // seen it work. Above the sentences it stood between the reader and
    // what they came for, and read as the next lesson rather than as
    // the thing this one is confused with.
    for (const variant of ['plate', 'sheet', 'gate']) {
      const screen = await mount(<GrammarLesson point={RICH} variant={variant} onCompare={() => {}} />)
      const labels = [...screen.container.querySelectorAll('.dict-block')]
        .map(b => b.getAttribute('aria-label'))
      expect(labels.indexOf('Compare')).toBeGreaterThan(labels.indexOf('Examples'))
    }
  })

  // The mark was a pair -- 規則 RULE -- until 2026-09-21: the Japanese
  // half captioned a part of a lesson rather than naming a place, so
  // it went, app-wide, and the name took the rung and the ink it wore
  // (index.css, .dict-mark__name). A leftover Japanese half here is a
  // regression, so this asserts there is none.
  it('sets each step under its mark, honours **…** and "- " lines, and marks the trap', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" />)
    const steps = [...screen.container.querySelectorAll('.gl-step')]
    expect(steps.map(s => s.querySelector('.dict-mark__jp'))).toEqual([null, null, null])
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

  // Plan 144, the owner's pick B: the lesson read for its shape
  // (lessonText). A use that names its forms prints them under it, in
  // Japanese and whole; a paradigm is its labels beside its forms; the
  // sentences are numbered, and one in another register than a
  // register-bound point says so.
  const SHAPED = {
    ...RICH, pattern: 'です／だ', register: 'polite',
    steps: [
      { kind: 'rule', text: '**です** links a noun to what it is: A は B です. **だ** is the same word in plain speech.' },
      { kind: 'use', text: '- To say what something is: 学生です, しずかです.\n- Negative: ではありません (spoken: じゃありません). Past: でした.\n- Speeches.' },
      { kind: 'careful', text: 'Never « to exist ».' },
    ],
    examples: [
      { jp: 'わたしは学生です。', tr: 'I am a student.', register: 'polite',
        furigana: [{ text: 'わたしは' }, { text: '学', reading: 'がく' }, { text: '生', reading: 'せい' }, { text: 'です', highlight: true }, { text: '。' }] },
      { jp: 'この店はしずかだ。', tr: 'This shop is quiet.', register: 'casual',
        furigana: [{ text: 'この' }, { text: '店', reading: 'みせ' }, { text: 'はしずかだ。' }] },
    ],
  }

  it('prints a use as its saying over its forms, a paradigm as labels beside forms, the rest as prose', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const uses = [...screen.container.querySelectorAll('.gl-use')]
    expect(uses).toHaveLength(3)
    expect(uses[0].querySelector('.gl-use__say').textContent).toBe('To say what something is')
    expect([...uses[0].querySelectorAll('.gl-form__ja')].map(f => [f.textContent, f.lang])).toEqual([['学生です', 'ja'], ['しずかです', 'ja']])
    const labels = [...uses[1].querySelectorAll('dt')].map(d => d.textContent)
    expect(labels).toEqual(['Negative', 'Past'])
    expect(uses[1].querySelector('dd .gl-form__gloss').textContent).toBe('spoken: じゃありません')
    expect(uses[2].textContent).toBe('Speeches.')
    expect(uses[2].querySelector('.gl-forms, dl')).toBeNull()
  })

  it('sets the Japanese in the prose as Japanese, a formula whole', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const rule = screen.container.querySelector('.gl-step--rule')
    const runs = [...rule.querySelectorAll('.gl-ja')]
    expect(runs.map(r => r.textContent)).toEqual(['です', 'A\u00A0は\u00A0B\u00A0です', 'だ'])
    expect(runs.every(r => r.lang === 'ja' && r.classList.contains('gl-ja--word'))).toBe(true)
    expect(rule.querySelector('strong .gl-ja').textContent).toBe('です')
  })

  it('numbers the sentences and tags the one in another register', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const exs = [...screen.container.querySelectorAll('.gl-block--examples .dict-ex')]
    expect(exs.map(ex => ex.querySelector('.dict-ex__n').textContent)).toEqual(['1', '2'])
    expect(exs.map(ex => ex.querySelector('.dict-ex__tag')?.textContent ?? null)).toEqual([null, 'Casual'])
    // Under a neutral point every sentence is polite or casual by
    // nature; nothing is tagged.
    const neutral = await mount(<GrammarLesson point={{ ...SHAPED, register: 'neutral' }} variant="sheet" />)
    expect(neutral.container.querySelector('.dict-ex__tag')).toBeNull()
  })

  it('sets a word\'s kanji under one reading, never across a highlight', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const first = screen.container.querySelector('.gl-block--examples .dict-ex')
    expect([...first.querySelectorAll('rt')].map(rt => rt.textContent)).toEqual(['がくせい'])
    expect(first.querySelector('ruby').firstChild.nodeValue).toBe('学生')
    expect(first.querySelector('.dict-ex__hl').textContent).toBe('です')
    // The full stop the highlight cut off rides on it: a line never
    // opens on 。.
    const segs = [...first.querySelector('.dict-ex__jp').children]
    expect(segs.at(-1).textContent).toBe('です。')
    expect(segs.at(-1).querySelector('.dict-ex__hl').textContent).toBe('です')
  })

  it('keeps a use that is prose on its line', async () => {
    const screen = await mount(<GrammarLesson point={{ ...SHAPED, steps: [{ kind: 'use', text: '- Written は, read « wa » here.' }] }} variant="sheet" />)
    const use = screen.container.querySelector('.gl-use')
    expect(use.children).toHaveLength(1)
    expect(use.textContent).toBe('Written は, read «\u00A0wa\u00A0» here.')
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
