import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
// The section rules asserted below only exist once the real sheet is loaded.
import '../../index.css'

// ── The lesson (plan 087) ─────────────────────────────────────
// One component in three dresses: the dictionary plate's body, the
// sheet behind every door, the gate before a new card. What is pinned
// is the shape a reader meets: sections under their heads (plan 235),
// the formation as a formula, a paradigm as a table, the table's one
// markup honoured, the trap a box, a compare row that is a door where
// a shell can open one and a fact where it cannot, the pattern picked
// out of each sentence, the translations' one switch, the gate's one
// button -- and that a point whose lesson is not written yet prints
// exactly what it has.
//
// Plan 089 moved two things: the plate variant no longer reprints the
// gloss the plate above it has already drawn, and the neighbours sit
// UNDER the sentences rather than between them and the lesson.

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

// A token's computed value, so an assertion compares two computed values.
function probe(prop, expr) {
  const el = document.createElement('div')
  el.style[prop] = expr
  document.body.appendChild(el)
  const v = getComputedStyle(el)[prop]
  el.remove()
  return v
}
const labels = root => [...root.querySelectorAll('.gl-sec')].map(sec => sec.getAttribute('aria-label'))

// The lane's files share one origin; this file reads the English table
// and hands the origin back as it found it (DictionaryDetail's own test
// does the same).
beforeEach(() => { localStorage.setItem('lang', 'en') })
afterEach(() => { localStorage.removeItem('lang') })
const mount = (ui) => render(<LangProvider>{ui}</LangProvider>)

describe('the grammar lesson', () => {
  it('prints the plate body as sections under their heads, in order, the formula first', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="plate" onCompare={() => {}} />)
    // How it is built, the rule, its uses, the trap; then the sentences
    // and the neighbours. No meaning: the plate above this body has
    // already printed it, and this is the one variant with a plate above.
    expect(labels(screen.container)).toEqual(['Structure', 'Rule', 'Use', 'Careful', 'Examples', 'Compare'])
    // A head each, an h3 under the entry's h2, a glyph beside it that a
    // screen reader skips.
    expect([...screen.container.querySelectorAll('h3')].map(h => h.textContent))
      .toEqual(['Structure', 'Rule', 'Use', 'Careful', 'Examples', 'Not to be confused with'])
    for (const icon of screen.container.querySelectorAll('.gl-sec__icon')) expect(icon.getAttribute('aria-hidden')).toBe('true')
    // The lesson in one column, the sentences and the rivals in the
    // other: side by side where a page has the room, one after the other
    // on a phone.
    const cols = [...screen.container.querySelectorAll('.gl-col')]
    expect(cols.map(col => labels(col))).toEqual([['Structure', 'Rule', 'Use', 'Careful'], ['Examples', 'Compare']])
    // the plate variant draws no plate of its own: the shell already has one
    expect(screen.container.querySelector('.dict-plate')).toBeNull()
    expect(screen.container.querySelector('.dict-formation')).toBeNull()
  })

  it('degrades to the formula and the sentences for a point whose lesson is not written', async () => {
    const screen = await mount(<GrammarLesson point={PLAIN} variant="plate" />)
    expect(labels(screen.container)).toEqual(['Structure', 'Examples'])
  })

  it('puts the neighbours under the sentences in every dress', async () => {
    // A rival is what you reach for once you have read the rule and
    // seen it work. Above the sentences it stood between the reader and
    // what they came for, and read as the next lesson rather than as
    // the thing this one is confused with.
    for (const variant of ['plate', 'sheet', 'gate']) {
      const screen = await mount(<GrammarLesson point={RICH} variant={variant} onCompare={() => {}} />)
      const order = labels(screen.container)
      expect(order.indexOf('Compare')).toBeGreaterThan(order.indexOf('Examples'))
    }
  })

  // The marks were captions over one wall of prose (plan 146) until
  // the owner found the lesson hard to read: they are heads now, each
  // opening its own section (plan 235). The pair's Japanese half went
  // app-wide on 2026-09-21 and must not come back with them.
  it('sets each step under its head, honours **…** and "- " lines, and boxes the trap', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" />)
    expect(screen.container.querySelector('.dict-mark__jp')).toBeNull()
    const rule = screen.container.querySelector('.gl-sec--rule')
    const use = screen.container.querySelector('.gl-sec--use')
    const careful = screen.container.querySelector('.gl-sec--careful')
    expect(rule.querySelector('strong').textContent).toBe('polite request')
    // The rule is the lead, a rung over the rest of the prose.
    expect(getComputedStyle(rule.querySelector('.gl-sec__body')).fontSize).toBe(probe('fontSize', 'var(--fs-lead)'))
    // A use step's own line stays prose over its list.
    expect(use.querySelector('.gl-step__p').textContent).toBe('Reach for it when:')
    expect([...use.querySelectorAll('li')].map(li => li.textContent)).toEqual(['asking a favour', 'giving an instruction'])
    // The trap reads as a warning before it is read: a box whose leading
    // edge and head are the due ink, never a fill.
    const box = getComputedStyle(careful)
    expect(box.borderLeftWidth).toBe('3px')
    expect(box.borderLeftColor).toBe(probe('color', 'var(--state-due)'))
    expect(box.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(careful.querySelector('.gl-sec__name')).color)
      .toBe(probe('color', 'color-mix(in srgb, var(--state-due) 72%, var(--text-primary))'))
  })

  it('sets the formation as a formula: the slot in plain words, the pattern in the ink, a gloss in brackets after it', async () => {
    const screen = await mount(<GrammarLesson point={{ ...RICH, structure: 'period + に + number + 回 (how often)' }} variant="sheet" />)
    const formula = screen.container.querySelector('.gl-sec--structure .gl-formula')
    expect([...formula.children].map(el => [el.className, el.textContent])).toEqual([
      ['gl-formula__slot', 'period'], ['gl-formula__plus', '+'], ['gl-formula__pat', 'に'], ['gl-formula__plus', '+'],
      ['gl-formula__slot', 'number'], ['gl-formula__plus', '+'], ['gl-formula__pat', '回'], ['gl-formula__note', '(how often)'],
    ])
    expect(formula.querySelector('.gl-formula__pat').lang).toBe('ja')
    // The slot is a dashed blank, the pattern the gold's.
    expect(getComputedStyle(formula.querySelector('.gl-formula__slot')).borderTopStyle).toBe('dashed')
    // A slot in plain words keeps the Japanese in it, and its spaces.
    const mixed = await mount(<GrammarLesson point={{ ...RICH, structure: 'Noun/な-adj + です・だ' }} variant="sheet" />)
    expect(mixed.container.querySelector('.gl-formula__slot').textContent).toBe('Noun/な-adj')
    expect(mixed.container.querySelector('.gl-formula__pat').textContent).toBe('です・だ')
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

  it('draws the plate with the pattern over its gloss and the register word in the sheet and the gate', async () => {
    const screen = await mount(<GrammarLesson point={RICH} variant="sheet" onClose={() => {}} />)
    const plate = screen.container.querySelector('.dict-plate')
    // The pattern over its gloss: the formation opens the lesson instead.
    expect(plate.querySelector('.dict-plate__structure')).toBeNull()
    expect(screen.container.querySelector('.gl-formula').textContent).toBe('verb て-form+ください')
    expect(plate.querySelector('.dict-plate__word').textContent).toBe('〜てください')
    expect(plate.querySelector('.dict-plate__caption').textContent).toBe('please do')
    expect(plate.querySelector('.dict-plate__level').textContent).toBe('N5')
    expect(plate.querySelector('.gl-register').textContent).toBe('Polite')
    expect(plate.querySelector('[aria-label="Close"]')).toBeTruthy()
  })

  it('reads the pattern, its formation and a rival through their furigana', async () => {
    const point = {
      ...RICH, pattern: '〜の中で', structure: 'group + の中で',
      pattern_furigana: [{ text: '〜の' }, { text: '中', reading: 'なか' }, { text: 'で' }],
      structure_furigana: [{ text: 'group + の' }, { text: '中', reading: 'なか' }, { text: 'で' }],
      compare: [{
        pattern: '〜で一番', raw_id: 'grammar_N5_〜で一番', level: 'N5', meaning: 'the most in', text: 'A place.',
        furigana: [{ text: '〜で' }, { text: '一', reading: 'いち' }, { text: '番', reading: 'ばん' }],
      }],
    }
    const screen = await mount(<GrammarLesson point={point} variant="sheet" onClose={() => {}} onCompare={() => {}} />)
    const plate = screen.container.querySelector('.dict-plate')
    const read = el => [...el.querySelectorAll('rt')].map(rt => rt.textContent)
    expect(read(plate.querySelector('.dict-plate__word'))).toEqual(['なか'])
    expect(read(screen.container.querySelector('.gl-formula__pat'))).toEqual(['なか'])
    expect(read(screen.container.querySelector('.gl-door__pattern'))).toEqual(['いち', 'ばん'])
    // A point with no reading prints as it always did.
    const bare = await mount(<GrammarLesson point={RICH} variant="sheet" onClose={() => {}} />)
    expect(bare.container.querySelector('.dict-plate ruby')).toBeNull()
  })

  // Plan 146, the owner's pick B: the lesson read for its shape
  // (lessonText). A use that names its forms prints them under it, in
  // Japanese and whole; a paradigm is the point's forms, a table of its
  // own (plan 235); the sentences are numbered, and one in another
  // register than a register-bound point says so.
  const SHAPED = {
    ...RICH, pattern: 'です／だ', register: 'polite',
    steps: [
      { kind: 'rule', text: '**です** links a noun to what it is: A は B です. **だ** is the same word in plain speech.' },
      { kind: 'use', text: '- To say what something is: 学生です, しずかです.\n- Negative: ではありません (spoken: じゃありません). Past: でした.\n- Speeches.' },
      { kind: 'careful', text: 'Never « to exist ».' },
    ],
    examples: [
      { jp: 'わたしは学生です。', tr: 'I am a student.', register: 'polite',
        furigana: [{ text: 'わたしは' }, { text: '学', reading: 'がく', word: 1 }, { text: '生', reading: 'せい', word: 1 }, { text: 'です', highlight: true }, { text: '。' }] },
      { jp: 'この店はしずかだ。', tr: 'This shop is quiet.', register: 'casual',
        furigana: [{ text: 'この' }, { text: '店', reading: 'みせ' }, { text: 'はしずかだ。' }] },
    ],
  }

  it('sets a paradigm apart as the point\'s forms, a use as its saying over its forms, the rest as prose', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    // The forms before the uses: a paradigm is looked up, a use is read.
    expect(labels(screen.container)).toEqual(['Structure', 'Rule', 'Forms', 'Use', 'Careful', 'Examples', 'Compare'])
    const rows = [...screen.container.querySelectorAll('.gl-sec--forms .gl-table__row')]
    expect(rows.map(r => r.querySelector('dt').textContent)).toEqual(['Negative', 'Past'])
    expect(rows.map(r => r.querySelector('dd .gl-form__ja').textContent)).toEqual(['ではありません', 'でした'])
    expect(rows[0].querySelector('dd .gl-form__gloss').textContent).toBe('spoken: じゃありません')
    // A row is one line across the two columns, its label on the forms' line.
    const [label, forms] = [rows[0].querySelector('dt'), rows[0].querySelector('dd')].map(el => el.getBoundingClientRect())
    expect(label.right).toBeLessThanOrEqual(forms.left)
    expect(Math.abs(label.top - forms.top)).toBeLessThan(forms.height)
    const uses = [...screen.container.querySelectorAll('.gl-sec--use .gl-use')]
    expect(uses).toHaveLength(2)
    expect(uses[0].querySelector('.gl-use__say').textContent).toBe('To say what something is')
    expect([...uses[0].querySelectorAll('.gl-form__ja')].map(f => [f.textContent, f.lang])).toEqual([['学生です', 'ja'], ['しずかです', 'ja']])
    expect(uses[1].textContent).toBe('Speeches.')
    expect(uses[1].querySelector('.gl-forms, dl')).toBeNull()
  })

  it('sets the Japanese in the prose as Japanese, a formula whole', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const rule = screen.container.querySelector('.gl-sec--rule')
    const runs = [...rule.querySelectorAll('.gl-ja')]
    expect(runs.map(r => r.textContent)).toEqual(['です', 'A\u00A0は\u00A0B\u00A0です', 'だ'])
    expect(runs.every(r => r.lang === 'ja' && r.classList.contains('gl-ja--word'))).toBe(true)
    expect(rule.querySelector('strong .gl-ja').textContent).toBe('です')
  })

  it('numbers the sentences and tags the one in another register', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const exs = [...screen.container.querySelectorAll('.gl-sec--examples .dict-ex')]
    expect(exs.map(ex => ex.querySelector('.dict-ex__n').textContent)).toEqual(['1', '2'])
    expect(exs.map(ex => ex.querySelector('.dict-ex__tag')?.textContent ?? null)).toEqual([null, 'Casual'])
    // Under a neutral point every sentence is polite or casual by
    // nature; nothing is tagged.
    const neutral = await mount(<GrammarLesson point={{ ...SHAPED, register: 'neutral' }} variant="sheet" />)
    expect(neutral.container.querySelector('.dict-ex__tag')).toBeNull()
  })

  it('sets a word\'s kanji under one reading, never across a highlight', async () => {
    const screen = await mount(<GrammarLesson point={SHAPED} variant="sheet" />)
    const first = screen.container.querySelector('.gl-sec--examples .dict-ex')
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
