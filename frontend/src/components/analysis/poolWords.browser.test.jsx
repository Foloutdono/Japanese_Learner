import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { WordsList } from './WordsList'
import { FocusCard } from './FocusCard'

// ── Every word the app holds a card for (plan 148) ───────────────
// さらば桃源郷真っさらになったんだ: three words the JLPT deck does not
// teach, which the breakdown used to show with no meaning and no way
// into a deck -- 真っさら and さらば not even listed. The JMdict pool
// answers for them now, as study/analysis.py serves it: a vocab_match
// with no level and `pool`.
const poolMatch = (kanji, kana, meaning, id) => ({
  level: null, raw_id: `vocab_jmdict_${id}`, pool: true,
  entry: { kanji, kana, meaning }, stats: { status: 'not_started' },
})
const TOKENS = [
  { surface: 'さらば', pos: 'interjection', start: 0, end: 3, vocab_match: poolMatch('', 'さらば', 'farewell', 1) },
  { surface: '桃源郷', pos: 'noun', start: 3, end: 6, vocab_match: poolMatch('桃源郷', 'とうげんきょう', 'earthly paradise', 2) },
  { surface: '真っさら', pos: 'other', start: 6, end: 10, vocab_match: poolMatch('真っさら', 'まっさら', 'brand new', 3) },
  { surface: 'に', pos: 'auxiliary', start: 10, end: 11, vocab_match: null },
  {
    surface: 'なっ', pos: 'verb', start: 11, end: 13,
    vocab_match: { level: 'N5', raw_id: 'vocab_N5__なる', entry: { kanji: '', kana: 'なる', meaning: 'to become' }, stats: { status: 'learning' } },
  },
  { surface: 'た', pos: 'auxiliary', start: 13, end: 14, vocab_match: null },
]
const ANALYSIS = { text: 'さらば桃源郷真っさらになった', tokens: TOKENS, grammar: [] }
const T = {
  addToDeck: 'Add to deck', inDeck: 'In deck',
  jumpToTokenNamed: s => `Go to ${s}`, writtenHere: s => `Written ${s} here`,
}

describe('a word past the course in the analyser', () => {
  it('is listed with its reading and meaning, and no level', async () => {
    const screen = await render(<WordsList analysis={ANALYSIS} current={null} onSelect={() => {}} t={T} />)
    const rows = [...screen.container.querySelectorAll('.anl-words__row')]
    expect(rows.map(r => r.querySelector('.anl-words__word').textContent))
      .toEqual(['さらば', '桃源郷', '真っさら', 'なる'])
    const byWord = Object.fromEntries(rows.map(r => [r.querySelector('.anl-words__word').textContent, r]))
    expect(byWord['真っさら'].querySelector('.anl-words__gloss').textContent).toBe('brand new')
    expect(byWord['桃源郷'].querySelector('.anl-words__reading').textContent).toBe('とうげんきょう')
    expect(byWord['さらば'].querySelector('.anl-words__lvl')).toBeNull()
    // Off-deck until taken up: the same rule a word the course lacks
    // has always had under it.
    expect(byWord['真っさら'].querySelector('.anl-words__word--offdeck')).toBeTruthy()
    // なった is named as the dictionary names it (plan 158).
    expect(byWord['なる'].querySelector('.anl-words__lvl').textContent).toBe('N5')
  })

  it('goes into a vocab deck from the card in focus', async () => {
    const mineApp = vi.fn(async () => 1)
    const mining = {
      targetFor: () => ({ id: 7, type: 'vocab' }), decksFor: () => [{ id: 7, type: 'vocab', name: 'Anime' }],
      ensureDeck: vi.fn(), mineApp,
    }
    const screen = await render(<FocusCard analysis={ANALYSIS} token={TOKENS[1]} mining={mining} t={T} />)
    const card = screen.container.querySelector('.anl-focus')
    expect(card.querySelector('.anl-focus__word').textContent).toBe('桃源郷')
    expect(card.querySelector('.anl-focus__gloss').textContent).toBe('earthly paradise')
    expect(card.querySelector('.anl-focus__lvl')).toBeNull()
    card.querySelector('.anl-focus__add').click()
    await vi.waitFor(() => expect(mineApp).toHaveBeenCalled())
    expect(mineApp).toHaveBeenCalledWith({ deckId: 7, source: 'vocab', level: null, rawId: 'vocab_jmdict_2', kind: 'vocab' })
  })
})
