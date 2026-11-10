import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import en from '../../locales/en'
import '../../index.css'
import { ExplainSheet } from './ExplainPanel'

// ── 骨組み — the explanation as the line's frame, on a phone (plan 311) ──
// The owner's pick C of the canvas "Tsuji — Explain, made clear", built
// as its board "C · as built" draws it: the sentence and its translation
// at the sheet's head, then the line's parts in order, each named by its
// role, its grammar lit from the local tier and a door to the point,
// what the line leaves unsaid in a dashed outline, and Explain again a
// quiet word under them. The fixtures are the two lines of the owner's
// screenshots, as routes/phrase.py returns them once study/frame.py has
// held the model's frame to the line.

vi.mock('../../lib/track', () => ({ track: vi.fn() }))

const REASON_LINE = {
  text: 'それらしくするのでかかりきりになるんだ',
  tokens: [
    { surface: 'それらしく', start: 0, end: 5 },
    { surface: 'する', start: 5, end: 7 },
    { surface: 'ので', start: 7, end: 9 },
    { surface: 'かかりきり', start: 9, end: 14 },
    { surface: 'に', start: 14, end: 15 },
    { surface: 'なる', start: 15, end: 17 },
    { surface: 'ん', start: 17, end: 18 },
    { surface: 'だ', start: 18, end: 19 },
  ],
  grammar: [
    { pattern: '〜ので', raw_id: 'grammar_N4_node', start: 7, end: 9, segments: [[7, 9]] },
    { pattern: '〜になる', raw_id: 'grammar_N5_ninaru', start: 14, end: 17, segments: [[14, 17]] },
    { pattern: '〜んだ', raw_id: 'grammar_N4_nda', start: 17, end: 19, segments: [[17, 19]] },
  ],
  frame: [
    { jp: '大人は', role: 'topic', say: '', from: 'before' },
    { jp: 'それらしくするので', start: 0, end: 9, role: 'reason', say: 'それらしい in its く form describes する; ので makes it the cause.' },
    { jp: 'かかりきりになるんだ', start: 9, end: 19, role: 'predicate', say: 'かかりきり, wholly taken up, with になる; んだ explains.' },
  ],
}
REASON_LINE.explanation = 'それらしくするので — …\nかかりきりになるんだ — …'

const VERBLESS_LINE = {
  text: '関心はまだ僕ら',
  tokens: [
    { surface: '関心', start: 0, end: 2 },
    { surface: 'は', start: 2, end: 3 },
    { surface: 'まだ', start: 3, end: 5 },
    { surface: '僕ら', start: 5, end: 7 },
  ],
  grammar: [{ pattern: 'は', raw_id: 'grammar_N5_wa', kind: 'marker', start: 2, end: 3, segments: [[2, 3]] }],
  frame: [
    { jp: '関心は', start: 0, end: 3, role: 'topic', say: 'は makes 関心 what the line is about.' },
    { jp: 'まだ', start: 3, end: 5, role: 'modifier', say: 'Still.' },
    { jp: '僕ら', start: 5, end: 7, role: 'predicate', say: 'A noun predicate.', dropped: 'だ' },
  ],
  explanation: '関心は — …',
}

// The sheet is read in English; the language is given back after each
// case, since the files of a lane share the page's storage, and a file
// run after this one would otherwise open in English too.
afterEach(() => { localStorage.removeItem('lang') })

async function sheet(line, props = {}) {
  localStorage.setItem('lang', 'en')
  const onPoint = vi.fn()
  const onExplain = vi.fn()
  await render(
    <LangProvider>
      <ExplainSheet
        sentence={line.text} translation="They act the part, so they end up wholly absorbed in it."
        explanation={line.explanation} frame={line.frame} analysis={line}
        explaining={false} error={null} onExplain={onExplain} onPoint={onPoint} onClose={() => {}}
        t={en} {...props}
      />
    </LangProvider>,
  )
  await vi.waitFor(() => expect(document.querySelector('.anl-explainsheet')).not.toBeNull())
  const all = document.querySelectorAll('.anl-explainsheet')
  return { root: all[all.length - 1], onPoint, onExplain }
}

const parts = root => [...root.querySelectorAll('.anl-frame__part')]

describe('the explanation as the line\'s frame, on a phone', () => {
  it('names each part of the line in order, the predicate as its core', async () => {
    const { root } = await sheet(REASON_LINE)
    expect(parts(root).map(p => p.querySelector('.anl-frame__role').textContent))
      .toEqual(['Topic · from the line before', 'Reason', 'Predicate'])
    expect(parts(root).map(p => p.querySelector('.anl-frame__jp').textContent))
      .toEqual(['大人は', 'それらしくするので', 'かかりきりになるんだ'])
    expect(parts(root)[2].classList.contains('anl-frame__part--core')).toBe(true)
    // The Japanese a part's line names, in the line's face.
    expect([...parts(root)[1].querySelectorAll('.anl-frame__say .anl-named')].map(n => n.textContent))
      .toEqual(['それらしい', 'く', 'する', 'ので'])
    // No paragraph beside it.
    expect(root.querySelector('.anl-explainpanel__body')).toBeNull()
  })

  it('lights the grammar the local tier found, and opens its point', async () => {
    const { root, onPoint } = await sheet(REASON_LINE)
    const lit = [...root.querySelectorAll('button.anl-frame__pt')]
    expect(lit.map(b => b.textContent)).toEqual(['ので', 'になる', 'んだ'])
    lit[1].click()
    expect(onPoint).toHaveBeenCalledWith(REASON_LINE.grammar[1])
  })

  it('draws what the line leaves unsaid, and never writes it in', async () => {
    const { root } = await sheet(REASON_LINE)
    expect(parts(root)[0].querySelector('.anl-frame__gone').textContent).toBe('大人は')
    const verbless = await sheet(VERBLESS_LINE, { translation: 'The concern is still us.' })
    const left = verbless.root.querySelector('.anl-frame__gone--word')
    expect(left.textContent).toBe('だ')
    expect(left.getAttribute('aria-label')).toBe('だ, left out')
  })

  it('heads the sheet with the sentence and its meaning, Explain again a quiet word under the frame', async () => {
    const { root, onExplain } = await sheet(REASON_LINE)
    expect(root.querySelector('.anl-explainsheet__head .anl-explainsheet__tr').textContent)
      .toBe('They act the part, so they end up wholly absorbed in it.')
    const again = root.querySelector('.anl-explainsheet__body .anl-explainpanel__again')
    expect(again.textContent).toBe(en.explainAgain)
    expect(root.querySelector('.anl-explainsheet__body .anl-ghost')).toBeNull()
    expect(again.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    again.click()
    expect(onExplain).toHaveBeenCalledTimes(1)
  })

  it('fits a phone: no part reaches past the sheet', async () => {
    const { root } = await sheet(REASON_LINE)
    const body = root.querySelector('.anl-explainsheet__body').getBoundingClientRect()
    for (const part of parts(root)) expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(body.right + 0.5)
  })

  it('prints the prose of an answer bought before the frame', async () => {
    const { root } = await sheet({ ...REASON_LINE, frame: [], explanation: 'An older paragraph about かかりきり.' })
    expect(root.querySelector('.anl-frame')).toBeNull()
    expect(root.querySelector('.anl-explainpanel__body').textContent).toBe('An older paragraph about かかりきり.')
    expect(root.querySelector('.anl-explainpanel__body .anl-named').textContent).toBe('かかりきり')
  })
})
