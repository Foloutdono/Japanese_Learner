import { MODES } from './studyModes'

// ── 見本 — the card a platform asks, drawn small (plan 137) ─────────
// On the desk's station split every platform prints, in a well beside
// its description, the card it will ask: 何 → quoi on Word → meaning,
// quoi → 何 on Meaning → word. The description says it in a sentence;
// the specimen shows it, which is what fills the room a platform row
// has on the desk (DESIGN.md, the density contract).
//
// The card is the stop's own (/api/station/{source}/samples, one per
// stop), so N1's platforms show an N1 word and never N5's. This maps a
// mode onto it, by the mode's own shape in the registry rather than by
// a list of keys that could fall out of step with it:
//
//   pair      the prompt, an arrow, the answer
//   type      the prompt, and the answer as typed
//   draw      the prompt, an arrow, the answer ghosted in a grid
//   sentence  a sentence, an arrow, the rule at work in it
//   blank     a sentence with a gap, and the rule's rivals to fill it
//
// A field the card does not carry leaves no specimen (null), never a
// half-drawn one.

/** The first sense of a gloss: "chose, affaire, fait" -> "chose". */
export function firstSense(gloss) {
  return (gloss ?? '').split(/[;,]\s/)[0].trim()
}

// How many characters a pair holds on one line of the well.
const PAIR_LINE = 12

const jp = text => (text ? { text, jp: true } : null)
const latin = text => (text ? { text, jp: false } : null)

export function specimenFor(modeKey, card) {
  const mode = MODES[modeKey]
  if (!mode || !mode.graded || !card?.jp) return null
  const front = jp(card.jp)
  const back = mode.source === 'kana' ? latin(card.romaji) : latin(firstSense(card.meaning))
  // A pair too long for one line of the well (a grammar pattern and its
  // gloss) stands the answer under the prompt instead of cutting both.
  const pair = (q, a) => (q && a ? { kind: 'pair', q, a, stack: q.text.length + a.text.length > PAIR_LINE } : null)

  switch (mode.base) {
    case 'flashcard':
      return mode.direction === 'b2f' ? pair(back, front) : pair(front, back)
    case 'write_romaji':
      return back ? { kind: 'type', q: front, typed: back.text } : null
    case 'write_kana':
    case 'write_kanji':
      return back ? { kind: 'draw', q: back, ghost: card.jp } : null
    case 'readings':
    case 'word_reading':
      return pair(front, jp(card.reading))
    case 'radical':
      return pair(front, jp(card.radical))
    case 'fill_in':
      return card.sentence ? { kind: 'sentence', sentence: card.sentence, a: front } : null
    // A build's gap among its pieces reads, in a well, as contrast's
    // blank among its rivals (plan 187e).
    case 'contrast':
    case 'build': {
      const b = card.blank
      return b?.choices?.length ? { kind: 'blank', before: b.before ?? '', after: b.after ?? '', choices: b.choices } : null
    }
    // Write: the point, and a sentence written with it.
    case 'write':
      return card.sentence ? { kind: 'type', q: front, typed: card.sentence } : null
    // The ladder (plan 187e) shows the rung a card starts on: the sentence
    // to name the rule in, else the flashcard it falls back to.
    case 'ladder':
      return specimenFor(`${mode.source}.fill_in`, card) ?? specimenFor(`${mode.source}.flashcard.f2b`, card)
    default:
      return null
  }
}
