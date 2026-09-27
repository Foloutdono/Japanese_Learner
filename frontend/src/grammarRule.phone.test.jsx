import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import CardPrompt from './components/study/CardPrompt'
import { MCQGrid } from './components/study/QuizComponents'
import { GrammarChoice } from './components/study/GrammarPieces'
import './index.css'

// ── A grammar card's furigana, on a phone ──────────────────────
// 〜の中で asked a learner who cannot read 中 a kanji question. The
// card now carries the pattern's furigana (`grammar_furigana`, from the
// catalogue's own reading -- study/grammar_examples.pattern_furigana),
// always on: a reading names no rule. These pin that it is printed on
// every face the pattern is, that a pattern with no kanji is text as it
// always was, and -- the one thing a screenshot of a short rule cannot
// show -- that a long rule's wrapped second line keeps its readings off
// the line above. The formation line under the rule, an option that is
// a pattern and the contrast drill's answer are read the same way.

const t = {}

const card = over => ({
  card_id: 'grammar_N5_〜の中で', raw_id: 'grammar_N5_〜の中で', source: 'builtin_grammar',
  mode: 'grammar.flashcard.f2b', direction: 'f2b',
  grammar: '〜の中で', structure: 'group + の中で', meaning: 'among, in (a group)',
  grammar_furigana: [{ text: '〜の' }, { text: '中', reading: 'なか' }, { text: 'で' }],
  structure_furigana: [{ text: 'group + の' }, { text: '中', reading: 'なか' }, { text: 'で' }],
  hints: {}, stage: 'learning',
  ...over,
})

// 〜といっても過言ではない: twelve characters, and in a card this narrow
// its kanji land on the second of two lines.
const LONG = {
  grammar: '〜といっても過言ではない',
  grammar_furigana: [
    { text: '〜といっても' }, { text: '過', reading: 'か' }, { text: '言', reading: 'ごん' }, { text: 'ではない' },
  ],
}

const settle = (ms = 50) => new Promise(r => setTimeout(r, ms))

// Every character of an element's base text (never its readings), as a
// rect: what a reading must not be printed over.
function baseRects(rule) {
  const walker = document.createTreeWalker(rule, NodeFilter.SHOW_TEXT)
  const rects = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement.closest('rt')) continue
    for (let i = 0; i < node.length; i++) {
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      rects.push(range.getBoundingClientRect())
    }
  }
  return rects
}

describe('the grammar rule’s furigana', () => {
  it('prints the reading over the kanji on the front, inside the card', async () => {
    const screen = await render(<CardPrompt card={card()} t={t} session={{}} />)
    const rule = screen.container.querySelector('.grammar-rule')
    expect(rule.querySelectorAll('ruby')).toHaveLength(1)
    const rt = rule.querySelector('rt')
    expect(rt.textContent).toBe('なか')
    const reading = rt.getBoundingClientRect()
    const kanji = baseRects(rule)[2] // 〜, の, then 中
    expect(reading.bottom).toBeLessThanOrEqual(kanji.top + reading.height)
    expect(reading.left).toBeLessThan(kanji.right)
    expect(reading.right).toBeGreaterThan(kanji.left)
    expect(reading.top).toBeGreaterThanOrEqual(screen.container.querySelector('.prompt-card').getBoundingClientRect().top)
  })

  it('prints it on the answer too: the b2f back and the fill_in reveal', async () => {
    const back = await render(<CardPrompt card={card({ mode: 'grammar.flashcard.b2f', direction: 'b2f' })} t={t} session={{}} />)
    expect(back.container.querySelector('.grammar-rule')).toBeNull()
    back.container.querySelector('.flashcard').click()
    await settle()
    expect([...back.container.querySelectorAll('.grammar-rule rt')].map(rt => rt.textContent)).toEqual(['なか'])

    const fill = await render(
      <CardPrompt
        card={card({
          mode: 'grammar.fill_in', direction: null, hints: { indice_1: ['〜の中で', '〜で'] },
          fill_sentence: { jp: 'クラスの中で一番背が高い。', tr: 'The tallest in the class.', furigana: [{ text: 'クラスの中で一番背が高い。' }] },
        })}
        t={t} session={{}} answered activeHints={['indice_1']}
      />,
    )
    expect(fill.container.querySelector('.grammar-answer .grammar-rule rt').textContent).toBe('なか')
  })

  it('prints a pattern with no kanji as text, as it always was', async () => {
    const screen = await render(
      <CardPrompt card={card({ grammar: '〜てから', grammar_furigana: [{ text: '〜てから' }] })} t={t} session={{}} />,
    )
    const rule = screen.container.querySelector('.grammar-rule')
    expect(rule.querySelector('ruby')).toBeNull()
    expect(rule.textContent).toBe('〜てから')
    expect(rule.classList.contains('grammar-rule--ruby')).toBe(false)
  })

  it('keeps a wrapped line’s readings off the line above', async () => {
    const screen = await render(
      <div style={{ width: 240 }}><CardPrompt card={card(LONG)} t={t} session={{}} /></div>,
    )
    expectReadingsClearOfLineAbove(screen.container.querySelector('.grammar-rule'))
  })
})

// Two lines, a reading on the second, and each such reading under every
// character of the first line.
function expectReadingsClearOfLineAbove(el) {
  const bases = baseRects(el)
  const lines = [...new Set(bases.map(r => Math.round(r.top)))].sort((a, b) => a - b)
  // It wraps, with a reading on the second line, or this proves nothing.
  expect(lines).toHaveLength(2)
  const below = [...el.querySelectorAll('rt')].map(rt => rt.getBoundingClientRect()).filter(r => r.top > lines[0])
  expect(below.length).toBeGreaterThan(0)
  const above = Math.max(...bases.filter(r => Math.round(r.top) === lines[0]).map(r => r.bottom))
  for (const reading of below) expect(reading.top).toBeGreaterThanOrEqual(above - 1)
}

describe('the formation line’s furigana', () => {
  it('prints the reading over the formation’s kanji, at the size a reading is read at', async () => {
    const screen = await render(<CardPrompt card={card()} t={t} session={{}} />)
    const line = screen.container.querySelector('.grammar-structure')
    expect([...line.querySelectorAll('rt')].map(rt => rt.textContent)).toEqual(['なか'])
    expect(line.textContent).toBe('group + の中なかで')
    // --fs-caption, as every reading in running text is (it was ~10px,
    // under the size a dakuten survives at), under a line still larger.
    const probe = document.createElement('div')
    probe.style.fontSize = 'var(--fs-caption)'
    document.body.appendChild(probe)
    const caption = getComputedStyle(probe).fontSize
    probe.remove()
    const rt = line.querySelector('rt')
    expect(getComputedStyle(rt).fontSize).toBe(caption)
    expect(parseFloat(getComputedStyle(line).fontSize)).toBeGreaterThan(parseFloat(caption))
    // and under the rule, never over it
    const rule = screen.container.querySelector('.grammar-rule')
    expect(line.querySelector('rt').getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(Math.max(...baseRects(rule).map(r => r.bottom)) - 1)
  })

  it('leaves a formation with no kanji as it always was', async () => {
    const screen = await render(
      <CardPrompt card={card({ structure: 'verb て-form + から', structure_furigana: [{ text: 'verb て-form + から' }] })} t={t} session={{}} />,
    )
    const line = screen.container.querySelector('.grammar-structure')
    expect(line.querySelector('ruby')).toBeNull()
    expect(line.textContent).toBe('verb て-form + から')
  })

  it('keeps a wrapped formation’s readings off the line above', async () => {
    const structure = 'verb dictionary form ／ noun + の + 予定だ'
    const screen = await render(
      <div style={{ width: 240 }}>
        <CardPrompt
          card={card({
            structure,
            structure_furigana: [
              { text: 'verb dictionary form ／ noun + の + ' }, { text: '予', reading: 'よ' }, { text: '定', reading: 'てい' }, { text: 'だ' },
            ],
          })}
          t={t} session={{}}
        />
      </div>,
    )
    expectReadingsClearOfLineAbove(screen.container.querySelector('.grammar-structure'))
  })
})

const choices = ['〜の中で', '〜で', '〜にかわって', '〜と同じ']
const readings = {
  '〜の中で': [{ text: '〜の' }, { text: '中', reading: 'なか' }, { text: 'で' }],
  '〜と同じ': [{ text: '〜と' }, { text: '同', reading: 'おな' }, { text: 'じ' }],
}

describe('an option that is a pattern', () => {

  it('is read like the rule, and every row of the question stays one height', async () => {
    const screen = await render(
      <MCQGrid
        choices={choices} correct="〜の中で" answered={false} onAnswer={() => {}}
        formatChoice={c => <GrammarChoice text={c} readings={readings} />}
      />,
    )
    const rows = [...screen.container.querySelectorAll('.mcq-row')]
    expect(rows.map(r => [...r.querySelectorAll('rt')].map(rt => rt.textContent))).toEqual([['なか'], [], [], ['おな']])
    const heights = new Set(rows.map(r => Math.round(r.getBoundingClientRect().height)))
    expect(heights.size).toBe(1)
    // the reading inside its row, where the row's overflow cannot cut it
    for (const rt of screen.container.querySelectorAll('rt')) {
      const row = rt.closest('.mcq-row').getBoundingClientRect()
      expect(rt.getBoundingClientRect().top).toBeGreaterThanOrEqual(row.top)
    }
  })

  it('keeps a wrapped option whole, and a filler still collapses', async () => {
    const long = '何でも／誰でも／いつでも／どこでも'
    const screen = await render(
      <div style={{ width: 300 }}>
        <MCQGrid
          choices={[long, '〜で']} correct="〜で" answered={false} onAnswer={() => {}}
          formatChoice={c => <GrammarChoice text={c} readings={{
            [long]: [
              { text: '何', reading: 'なん' }, { text: 'でも／' }, { text: '誰', reading: 'だれ' },
              { text: 'でも／いつでも／どこでも' },
            ],
          }} />}
        />
      </div>,
    )
    const row = screen.container.querySelector('.mcq-row')
    // nothing cut by the row's ceiling
    expect(row.scrollHeight).toBeLessThanOrEqual(row.clientHeight)
    const text = row.querySelector('.grammar-choice')
    const lines = new Set(baseRects(text).map(r => Math.round(r.top)))
    expect(lines.size).toBe(2)
    // and a filler still collapses once the question is answered
    const done = await render(
      <MCQGrid choices={choices} correct="〜の中で" selected="〜で" answered onAnswer={() => {}}
        formatChoice={c => <GrammarChoice text={c} readings={readings} />} />,
    )
    await settle(400)
    const fillers = [...done.container.querySelectorAll('.mcq-row--filler')]
    expect(fillers.length).toBe(2)
    for (const f of fillers) expect(f.getBoundingClientRect().height).toBe(0)
  })
})

describe('the contrast drill’s answer', () => {
  it('prints the rule back into its gap with its reading', async () => {
    const contrast = card({
      mode: 'grammar.contrast', direction: null,
      contrast: {
        jp: 'クラスの中で一番背が高い。', tr: 'The tallest in the class.',
        furigana: [{ text: 'クラスの' }, { text: '＿＿＿', blank: true }, { text: '一番背が高い。' }],
        choices, answer: '〜の中で',
      },
    })
    const before = await render(<CardPrompt card={contrast} t={t} session={{}} answered={false} />)
    expect(before.container.querySelector('.gl-blank rt')).toBeNull()
    const after = await render(<CardPrompt card={contrast} t={t} session={{}} answered />)
    expect(after.container.querySelector('.gl-blank--revealed rt').textContent).toBe('なか')
  })
})
