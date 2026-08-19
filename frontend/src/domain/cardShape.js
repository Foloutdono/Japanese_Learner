// ── What a card IS, independently of how it looks ──────────────
// Pulled out of the renderer so both live where they belong: these are
// facts about the payload (which structure, which direction, which
// hints are actually present), and components/study/CardPrompt.jsx is
// the one that draws them.
//
// Everything here reads the CARD's own mode rather than a session-level
// one. A section or deck session is unaffected -- every card in it
// carries that session's mode -- but the daily queue holds a different
// mode per card, which a session-level variable cannot describe.
import { MODES as STUDY_MODES, RENDER } from './studyModes'

/**
 * The written form to quiz/display on — some vocab entries are kana-only
 * (no kanji), and this doubles as "the kanji itself" for kanji entries.
 */
export function wordForm(entry) {
  return entry?.kanji || entry?.kana || ''
}

// A kanji-range test, not a script one — used only to tell a personal
// vocab card's kana-only word ("ねこ") apart from one with kanji in it
// ("猫"), the same distinction eligible_for()/wordForm() make for the
// app's own deck.
const KANJI_RANGE = /[㐀-鿿]/

/**
 * Which structure a card is actually studying as.
 *
 * A browsed-in app card carries it as its source ('builtin_kanji' →
 * 'kanji'); a personal card carries it directly as `structure` (see
 * study/structures.py — a deck has ONE structure, and every personal
 * card in it takes that shape).
 */
export function structureKeyOf(card) {
  if (!card) return null
  return card.source === 'custom' ? card.structure : card.source?.replace('builtin_', '')
}

/**
 * Field-name adapter.
 *
 * A browsed-in app card already has kanji/kana/meaning (or grammar/
 * structure) at the top level; a personal card of the matching
 * structure carries the same information under `card.fields`, keyed by
 * THAT structure's own field names (a kanji card calls them
 * kanji/meaning, a grammar card calls them rule/meaning — see
 * study/structures.py). This projects a personal card onto the exact
 * shape its app-sourced counterpart has, so every renderer reads
 * `card.kanji`/`card.meaning`/`card.grammar` regardless of where the
 * card came from, instead of branching on card.source at every field
 * access — which is what let a direction bug hide here once: the custom
 * path read `front`/`back` UNCONDITIONALLY, so a "meaning → word"
 * session always showed the word first no matter what the mode asked.
 *
 * readings/radical/furigana/hints/kana — the mode-specific extras — are
 * attached at the top level for BOTH sources by the backend (see
 * decks.py's _custom_card_extras), so nothing here touches those.
 */
export function normalizeCard(card) {
  if (!card || card.source !== 'custom') return card
  const f = card.fields || {}
  if (card.structure === 'kanji') {
    return { ...card, kanji: f.kanji ?? '', meaning: f.meaning ?? '' }
  }
  if (card.structure === 'vocab') {
    const word = f.word ?? ''
    const hasKanji = KANJI_RANGE.test(word)
    return {
      ...card,
      kanji: hasKanji ? word : '',
      // decks.py sets `kana` from the optional `reading` field when one
      // was given; a kana-only word is already its own reading.
      kana: card.kana || (hasKanji ? '' : word),
      meaning: f.meaning ?? '',
    }
  }
  if (card.structure === 'grammar') {
    // `structure` on the raw payload is the DECK's structure key
    // ('grammar') — GrammarAnswer wants the explanation TEXT there
    // instead (a personal card has none to give), so it is overwritten
    // rather than read.
    return { ...card, grammar: f.rule ?? '', structure: '', meaning: f.meaning ?? '' }
  }
  return card // 'standard' needs no projection — front/back already are its own fields
}

/** Everything the renderers below derive from the card's own mode. */
export function cardShape(card) {
  const mode = card?.mode
  const spec = STUDY_MODES[mode]
  return {
    structureKey: structureKeyOf(card),
    // f2b shows the Japanese/rule side and asks for the other; b2f is
    // the reverse. One name for every source: kanji/vocab called this
    // isKjToM, grammar called it !isB2F — same boolean.
    isF2B: card?.direction === 'f2b',
    renderer: spec?.renderer ?? RENDER.FLASHCARD,
    isFill: (spec?.renderer ?? RENDER.FLASHCARD) === RENDER.FILL,
    isRadical: spec?.base === 'radical',
    isWordReading: spec?.base === 'word_reading',
  }
}

/**
 * Which hints this CARD can actually offer, not the ones its mode
 * declares. A hand-written card without a matching extra (no
 * distractors to build, no cached sentences) has no entry for that
 * hint, so a control for it would do nothing.
 */
export function availableHintsFor(card) {
  const hints = card?.hints ?? {}
  return Object.keys(hints).filter(k => Array.isArray(hints[k]) && hints[k].length > 0)
}
