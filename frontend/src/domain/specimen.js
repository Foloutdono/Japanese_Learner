import { MODES } from './studyModes'

// ── 見本 — the card a platform asks (plans 137, 251) ─────────────────
// On the desk's line station every platform shows the card it will
// ask: since plan 251 (the owner's pick C of the canvas "Tsuji — the
// learning modes on the desk") each exercise is a car whose face is
// that card, drawn as the run draws it, so no two platforms of a line
// look alike -- a flashcard and its back, the field, the writing slab,
// the gap and its rivals, the hole and its translation, the sentence
// to name, the situation to say. The description says it in a
// sentence; the face shows it, which is what fills the room a car has.
//
// The card is the stop's own (/api/station/{source}/samples, one per
// stop), so N1's platforms show an N1 word and never N5's. This maps a
// mode onto it, by the mode's own shape in the registry rather than by
// a list of keys that could fall out of step with it:
//
//   pair      the prompt over a fold over the answer (with `tag`, a
//             string-table key, before it: the radical's label)
//   type      the prompt, and the answer typed in a field
//   readings  the kanji, and its on'yomi and kun'yomi typed in two fields
//   draw      the prompt, and the answer ghosted on the writing slab
//   sentence  a sentence with the rule at work marked, over the rule
//   blank     a sentence with a gap, and the rule's rivals as tiles
//             (the ladder's Choisir, which adds the ladder's walk)
//   build     Construire: the sentence, what is typed in its hole, and
//             the translation it is said from
//   write     Écrire: the situation to say, the point and two words to
//             say it with, and the sentence typed
//
// A field the card does not carry leaves no face (null), never a
// half-drawn one.

/** The first sense of a gloss: "chose, affaire, fait" -> "chose". */
export function firstSense(gloss) {
  return (gloss ?? '').split(/[;,]\s/)[0].trim()
}

/** A pattern as a sentence writes it: 〜たら is たら there. */
export const bare = jp => (jp ?? '').replace(/^〜/, '')

const jp = text => (text ? { text, jp: true } : null)
const latin = text => (text ? { text, jp: false } : null)
// An on'yomi is written in katakana, a kun'yomi in hiragana: the
// station's card joins the first of each with ・ (routes/station.py).
const KATAKANA = /[ァ-ヺ]/

export function specimenFor(modeKey, card) {
  const mode = MODES[modeKey]
  if (!mode || !mode.graded || !card?.jp) return null
  const front = jp(card.jp)
  const back = mode.source === 'kana' ? latin(card.romaji) : latin(firstSense(card.meaning))
  const pair = (q, a) => (q && a ? { kind: 'pair', q, a } : null)

  switch (mode.base) {
    case 'flashcard':
      return mode.direction === 'b2f' ? pair(back, front) : pair(front, back)
    case 'write_romaji':
      return back ? { kind: 'type', q: front, typed: back.text } : null
    case 'write_kana':
    case 'write_kanji':
      return back ? { kind: 'draw', q: back, ghost: card.jp } : null
    case 'word_reading':
      return pair(front, jp(card.reading))
    case 'readings': {
      const parts = (card.reading ?? '').split('・').filter(Boolean)
      if (!parts.length) return null
      return {
        kind: 'readings',
        q: front,
        on: parts.find(r => KATAKANA.test(r)) ?? null,
        kun: parts.find(r => !KATAKANA.test(r)) ?? null,
      }
    }
    // The radical, under the run's own label for it (RadicalPieces'
    // t.radicalNumber): a third of the deck is filed under itself, and
    // the label is what says which glyph is the answer.
    case 'radical': {
      const p = pair(front, jp(card.radical))
      return p && { ...p, tag: 'radicalNumber' }
    }
    case 'fill_in':
      return card.sentence ? { kind: 'sentence', sentence: card.sentence, point: bare(card.jp), a: front, gloss: card.meaning ?? '' } : null
    case 'contrast': {
      const b = card.blank
      return b?.choices?.length ? { kind: 'blank', before: b.before ?? '', after: b.after ?? '', choices: b.choices } : null
    }
    case 'build': {
      const b = card.build
      return b?.pieces?.some(p => p.gap) ? { kind: 'build', pieces: b.pieces, tr: b.tr ?? '' } : null
    }
    case 'write': {
      const w = card.write
      return w?.situation && w.model
        ? { kind: 'write', situation: w.situation, point: card.jp, helpers: w.helpers ?? [], typed: w.model }
        : null
    }
    // The ladder (plan 187e) shows the rung a card starts on, Choisir --
    // the point blanked among its rivals (srs/ladder.py) -- with the
    // walk it climbs; else the flashcard a point without a blank falls
    // back to.
    case 'ladder': {
      const choose = specimenFor(`${mode.source}.contrast`, card)
      return choose ? { ...choose, walk: true } : specimenFor(`${mode.source}.flashcard.f2b`, card)
    }
    default:
      return null
  }
}
