// ── What a breakdown's door opens (plan 096) ──────────────────
// A word in a breakdown -- the ruby line, one of the rows, the
// analyser's own card -- opens the DICTIONARY entry for it: the same
// plate the catalogue opens, the same one a quiz card opens
// (DictionaryLookupSheet).
//
// It used to open WordDetail, a sheet that printed the deck row's two
// or three fields ("kanji 六 / kana ろく / meaning six") over the
// card's SRS record and stopped there: no readings, no examples, no
// kanji the word is built from, no ★, and no door onward. The
// dictionary plate carries all of that AND the same record, so the
// sheet it replaces has nothing left that is only its own. The
// question a learner is asking when they tap a word in a sentence is
// the question the dictionary answers.
//
// A lookup is what the sheet is opened on:
//   {category: 'vocab',   term, kana}  -- a word, disambiguated by its
//                                         reading (routes/dictionary's
//                                         `kana` parameter)
//   {category: 'kanji',   term}        -- one character
//   {category: 'grammar', id}          -- a rule, by its card id
// `lookupKey` is the React key the sheet is mounted under: a new entry
// starts a new ‹ stack rather than pushing onto the last one's.
//
// A module of its own rather than an export of a component file:
// react-refresh wants components-only there, and five screens read
// this.

// The deck entry is matched on the LEMMA (study/card_lookup's
// resolve_lemma), so its own kanji/kana are what the dictionary is
// asked for -- not the token's inflected surface, which 出ました would
// send to a word that does not exist. A kana-only entry has no kanji
// half and is looked up by its reading.
export function vocabLookup(word) {
  const entry = word?.vocab_match?.entry
  if (!entry) return null
  const term = entry.kanji || entry.kana || word.surface
  if (!term) return null
  return { category: 'vocab', term, kana: entry.kana || undefined }
}

// A kanji chip on a token card (TokenCard): one character,
// which needs no second key -- a kanji entry is unique on it.
export function kanjiLookup(match) {
  if (!match?.kanji) return null
  return { category: 'kanji', term: match.kanji }
}

// A grammar point, from a chip, a row or a marker: by its card id,
// never by its pattern (a pattern embeds ／ and 〜 -- see
// routes/dictionary's note on why the id travels as a query
// parameter).
export function grammarLookup(point) {
  if (!point?.raw_id) return null
  return { category: 'grammar', id: point.raw_id }
}

export function lookupKey(lookup) {
  if (!lookup) return null
  return [lookup.category, lookup.id ?? '', lookup.term ?? '', lookup.kana ?? ''].join(':')
}

// ── 机 — the entry the analyser's dock follows (plan 115) ──
// On the desk the analyser's second column is the dictionary, open on
// the token the stage is showing: ←/→ walk the sentence and the entry
// walks with it. A word opens as it would from a tap; a token that is
// no deck word but is one kanji opens that kanji; anything else — a
// particle the deck does not carry, punctuation — has no entry, and the
// dock says so rather than holding the last one.
export function tokenLookup(token) {
  if (!token) return null
  const word = vocabLookup(token)
  if (word) return word
  const kanji = token.kanji_matches ?? []
  return kanji.length === 1 ? kanjiLookup(kanji[0]) : null
}
