// ── 札の中身 — what a flip card shows besides its answer (plan 326) ──
// The client's half of backend study/card_contents.py (the fields, held
// equal by cardContents.test.js) and the one rule the server leaves to
// it: what a card may show over its QUESTION. A field that would answer
// the card is never shown there, whatever the learner chose -- a
// sentence holds the word, so it is asked only where the word is the
// prompt (word → meaning), never on meaning → word or a reading card.

export const CARD_LINES = ['vocab', 'kanji']

export const CARD_FIELDS = {
  vocab: { question: ['furigana', 'sentence'], answer: ['example', 'kanji', 'meanings', 'pair', 'verb'] },
  kanji: { question: [], answer: ['words', 'radical', 'strokes'] },
}

// The modes whose card stands a strip under its answer: the flip cards
// of the two lines. A typed, drawn or chosen answer is another screen.
const STRIP_MODES = new Set([
  'vocab.flashcard.f2b', 'vocab.flashcard.b2f', 'vocab.word_reading',
  'kanji.flashcard.f2b', 'kanji.flashcard.b2f',
])

/** The line a built-in card belongs to, from its id; null for any other
 *  (a learner's deck card, a pool word, a grammar point). */
export function lineOf(card) {
  const id = card?.card_id
  if (typeof id !== 'string') return null
  if (id.startsWith('vocab_')) return 'vocab'
  if (id.startsWith('kanji_')) return 'kanji'
  return null
}

/** Whether this card, in this mode, stands a strip at all. */
export function hasStrip(card) {
  return Boolean(lineOf(card)) && STRIP_MODES.has(card?.mode)
}

/** Whether the learner chose anything for any line. */
export function choseAny(chosen) {
  return CARD_LINES.some(line => (chosen?.[line] ?? []).length > 0)
}

/** The fields of `side` ('question' | 'answer') this card shows. */
export function fieldsFor(card, chosen, side) {
  const line = lineOf(card)
  if (!line || !hasStrip(card)) return []
  const picked = new Set(chosen?.[line] ?? [])
  const offered = CARD_FIELDS[line][side]
  if (side === 'question') {
    // Only where the written word is the prompt: its furigana and its
    // sentence would answer a reading card, and a sentence would print
    // the word a meaning → word card asks for.
    if (card.mode !== 'vocab.flashcard.f2b') return []
  }
  return offered.filter(f => picked.has(f))
}
