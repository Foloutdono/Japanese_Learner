import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import CardPrompt from './CardPrompt'
// Same stylesheet-import trick as RatingBar's neighbours
// (index.tokens.browser.test.jsx, AnalyzerHistory.browser.test.jsx): the
// rule this test is pinning only exists once the real sheet is loaded, so
// .char-display's computed font-size is meaningless without it.
import '../../index.css'

// Plan 048 — the study specimen's two rungs.
//
// CardPrompt.jsx used to pass 25 numeric `size` props straight to
// QuizComponents.jsx's CharDisplay, which turned each into a px string on
// `--char-size` from JavaScript. This pins the THREE sizes the card
// actually needs to show, in real px, so a future refactor cannot
// silently shrink one of them again the way one JSON mockup nearly did
// (see plan 046/048): a single kana or kanji is the "glyph" rung
// (--fs-specimen-glyph, 104px); a whole word is the "word" rung
// (--fs-specimen-word, 72px). Before this plan those were 110px (kana,
// CharDisplay's own default) and 100px (kanji, CardPrompt.jsx's explicit
// size={100}) -- two different numbers for the same kind of content, for
// no stated reason. This test intentionally asserts the INTENDED sizes,
// not today's, so it fails until CardPrompt/QuizComponents are migrated.
const t = {}

const kanaCard = {
  card_id: 'kana-1',
  source: 'builtin_kana',
  mode: 'kana.flashcard.f2b',
  direction: 'f2b',
  kana: 'あ',
  romaji: 'a',
  deck: 'hiragana_basic',
}

const kanjiCard = {
  card_id: 'kanji-1',
  source: 'builtin_kanji',
  mode: 'kanji.flashcard.f2b',
  direction: 'f2b',
  kanji: '渡',
  kana: 'わたる',
  meaning: 'to cross',
}

const vocabCard = {
  card_id: 'vocab-1',
  source: 'builtin_vocab',
  mode: 'vocab.flashcard.f2b',
  direction: 'f2b',
  kanji: '渡す',
  kana: 'わたす',
  meaning: 'to hand over',
}

async function charDisplayFontSize(card) {
  const screen = await render(<CardPrompt card={card} t={t} session={{}} />)
  const el = screen.container.querySelector('.char-display')
  return getComputedStyle(el).fontSize
}

describe('the study card specimen scale', () => {
  it('shows a single kana at the glyph rung (104px)', async () => {
    expect(await charDisplayFontSize(kanaCard)).toBe('104px')
  })

  it('shows a single kanji at the glyph rung (104px)', async () => {
    expect(await charDisplayFontSize(kanjiCard)).toBe('104px')
  })

  it('shows a vocabulary word at the word rung (72px)', async () => {
    expect(await charDisplayFontSize(vocabCard)).toBe('72px')
  })
})
