import { coversToken } from './grammarSpans'

// The token's state and reading on a sentence line, shared by the
// breakdown's layouts and the desk's subtitle line (plan 134). A module
// of its own, like rows.js: a component file exports components only.

// Mirrors study/analysis.py's _CONTENT_POS + unknown_count predicate
// exactly, so "the single unknown Token" identified here for i+1
// emphasis is provably the same one the backend counted.
export const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])
export function isUnknownToken(tok) {
  const status = tok.vocab_match?.stats?.status
  return CONTENT_POS.has(tok.pos)
    && Boolean(tok.vocab_match)
    && ['not_started', 'new'].includes(status)
    // A JMdict pool word (plan 148) the learner never took up counts as
    // off-deck on the server, not unknown: the course does not teach it.
    && !(isPoolWord(tok) && status === 'not_started')
}

// A word past the course: the JMdict pool's card (plan 148), with no
// JLPT level. It has a meaning and can go in a deck, like a deck word.
export function isPoolWord(tok) {
  return Boolean(tok?.vocab_match?.pool)
}

// The token's state on the line (canvas AnalyzerResult): a word the
// SRS says the learner has mastered, one being learned (or due back),
// one never started, one the course has no card for (a proper noun,
// JMdict-only vocabulary), and a particle or a mark — which carries
// no rule at all. The state is a 2px rule under the word in the
// state's own ink, never an ink change on the word itself.
//
// A JMdict pool word (plan 148) keeps the off-deck rule until the
// learner takes it up, whatever its part of speech: 真っさら (a
// な-adjective's stem, which the tokenizer leaves unnamed) and さらば (an
// interjection) are words with a meaning and a card, not scaffolding.
const PARTICLE_POS = new Set(['particle', 'symbol', 'auxiliary', 'punctuation', 'conjunction', 'suffix', 'prefix', 'copula'])
const HAS_KANJI = /[一-龯々]/
export function tokState(tok) {
  const status = tok.vocab_match?.stats?.status
  if (status === 'mastered') return 'mastered'
  if (status === 'learning' || status === 'due') return 'learning'
  if (isPoolWord(tok) && (!status || status === 'not_started')) return 'offdeck'
  if (status) return 'unknown'
  if (!tok.pos || PARTICLE_POS.has(tok.pos) || !CONTENT_POS.has(tok.pos)) return 'particle'
  return 'offdeck'
}

// The reading printed over a token on the line: only over a word
// with a kanji in it (the rest already spells its own sound).
export function tokFurigana(tok) {
  if (!tok.reading || !HAS_KANJI.test(tok.surface ?? '')) return ''
  return tok.reading
}

// The state on a line that knows the sentence's grammar (plan 160): a
// word a construction is written on, with no card of its own, is the
// construction's -- 〜てはいけません's いけ, について's つい -- and reads
// as the rule's scaffolding, not as a word the course does not teach
// (the dashed off-deck rule it wore).
export function lineState(tok, grammar) {
  if (!tok.vocab_match && (grammar ?? []).some(p => p.kind !== 'marker' && coversToken(p, tok))) return 'particle'
  return tokState(tok)
}

// What a word means, in the learner's language (plan 160): the model's
// contextual gloss where it was bought (already in that language), else
// the card's own -- its French beside its English since the analysis
// carries both (study/analysis._deck_match), a pool word's where JMdict
// has one (plan 162) -- else the line the words list asked for
// (`glosses`, poolGlosses.js: a pool word's, by card id), else its
// English.
export function wordGloss(tok, lang, glosses = null) {
  if (tok?.meaning) return tok.meaning
  const match = tok?.vocab_match
  const entry = match?.entry
  if (!entry) return ''
  return (lang === 'fr' && entry.meaning_fr)
    || (lang !== 'en' && glosses?.[match.raw_id])
    || entry.meaning || ''
}
