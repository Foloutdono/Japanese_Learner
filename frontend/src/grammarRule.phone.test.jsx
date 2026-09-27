import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import CardPrompt from './components/study/CardPrompt'
import './index.css'

// ── A grammar card's furigana, on a phone ──────────────────────
// 〜の中で asked a learner who cannot read 中 a kanji question. The
// card now carries the pattern's furigana (`grammar_furigana`, from the
// catalogue's own reading -- study/grammar_examples.pattern_furigana),
// always on: a reading names no rule. These pin that it is printed on
// every face the pattern is, that a pattern with no kanji is text as it
// always was, and -- the one thing a screenshot of a short rule cannot
// show -- that a long rule's wrapped second line keeps its readings off
// the line above.

const t = {}

const card = over => ({
  card_id: 'grammar_N5_〜の中で', raw_id: 'grammar_N5_〜の中で', source: 'builtin_grammar',
  mode: 'grammar.flashcard.f2b', direction: 'f2b',
  grammar: '〜の中で', structure: 'group + の中で', meaning: 'among, in (a group)',
  grammar_furigana: [{ text: '〜の' }, { text: '中', reading: 'なか' }, { text: 'で' }],
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

// Every character of the rule's base text (never its readings), as a
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
    const rule = screen.container.querySelector('.grammar-rule')
    const bases = baseRects(rule)
    const lines = [...new Set(bases.map(r => Math.round(r.top)))].sort((a, b) => a - b)
    // It wraps, with a reading on the second line, or this proves nothing.
    expect(lines).toHaveLength(2)
    const below = [...rule.querySelectorAll('rt')].map(rt => rt.getBoundingClientRect()).filter(r => r.top > lines[0])
    expect(below.length).toBeGreaterThan(0)
    // Each of them sits under every character of the line above it.
    const above = Math.max(...bases.filter(r => Math.round(r.top) === lines[0]).map(r => r.bottom))
    for (const reading of below) expect(reading.top).toBeGreaterThanOrEqual(above - 1)
  })
})
