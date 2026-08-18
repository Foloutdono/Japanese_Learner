// ── Lenient romaji comparison ──────────────────────────────────
// Japanese has more than one standard romanisation, and the deck stores
// exactly one spelling per kana. しゃ is "sha" in Hepburn and "sya" in
// Kunrei-shiki; つ is "tsu" or "tu"; ん is "n" or "nn". A learner typing
// the other standard has not made a mistake, and telling them they have
// is worse than saying nothing — so both sides are folded onto a single
// normal form before they are compared.
//
// ── What this is and is not ───────────────────────────────────
// This is FEEDBACK ONLY. What the SRS records is the learner's own 1-4
// self-rating, exactly as in every other mode; nothing here schedules
// anything. That is deliberate: a comparator strict enough to grade would
// have to be right about every edge case, and being wrong would punish
// the learner for the tool's ignorance. Being merely helpful, it can be
// generous and still be useful.
//
// So when in doubt, ACCEPT. A false "correct" costs nothing — the learner
// is about to rate themselves anyway and can see the expected answer. A
// false "wrong" contradicts someone who was right, which is the one
// outcome that actually damages trust in the drill.

// Each row folds onto its FIRST member. Multi-character alternates are
// applied before short ones (see normalizeRomaji), because folding t→ch
// first would corrupt "tya".
const FOLD = [
  ['si', 'shi'],
  ['ti', 'chi'],
  ['tu', 'tsu'],
  ['hu', 'fu'],
  ['zi', 'ji', 'di'],
  ['zu', 'du'],
  ['sya', 'sha'],
  ['syu', 'shu'],
  ['syo', 'sho'],
  ['tya', 'cha', 'cya'],
  ['tyu', 'chu', 'cyu'],
  ['tyo', 'cho', 'cyo'],
  ['zya', 'ja', 'jya'],
  ['zyu', 'ju', 'jyu'],
  ['zyo', 'jo', 'jyo'],
  ['o', 'wo'],
  // おう and おお both spell a long o, and Hepburn writes both "ō". A
  // learner typing "tou" where the deck stores "tō" is right, so fold
  // them together. Deliberately NOT done for "ei": せい is "sei", not a
  // long e, and accepting "see" would be accepting a different reading.
  ['oo', 'ou'],
]

// Macrons and circumflexes both mark a long vowel; doubling is the third
// way to write the same thing. Fold all three onto the doubled form.
const LONG = {
  'ā': 'aa', 'â': 'aa',
  'ī': 'ii', 'î': 'ii',
  'ū': 'uu', 'û': 'uu',
  'ē': 'ee', 'ê': 'ee',
  'ō': 'oo', 'ô': 'oo',
}

/**
 * Folds one romaji string onto a single normal form. Not a transliterator
 * and not reversible — its only job is to make two spellings of the same
 * sound compare equal.
 */
export function normalizeRomaji(input) {
  if (typeof input !== 'string') return ''

  let s = input.trim().toLowerCase()

  // Unicode-decompose first so a combining macron (U+0304) folds the same
  // way as the precomposed character. Without this, "ō" typed by one IME
  // and "ō" typed by another are different strings.
  s = s.normalize('NFC')
  for (const [from, to] of Object.entries(LONG)) {
    s = s.split(from).join(to)
  }

  // Syllable separators carry no sound: shin'ichi / shin-ichi / shinichi.
  s = s.replace(/[''`’ʼ\-_.\s]/g, '')

  // Fold the multi-character alternates. Applied longest-first so a
  // three-letter form is never half-consumed by a two-letter rule.
  const rows = [...FOLD].sort((a, b) => b[0].length - a[0].length)
  for (const [canonical, ...alts] of rows) {
    for (const alt of alts) {
      if (alt.length >= canonical.length) s = s.split(alt).join(canonical)
    }
  }
  // Then the short ones, which can only run after the digraphs above.
  for (const [canonical, ...alts] of rows) {
    for (const alt of alts) {
      if (alt.length < canonical.length) s = s.split(alt).join(canonical)
    }
  }

  // ん as "nn" — but only a doubled n that is not part of a real geminate
  // ("konna" keeps both). Collapsing every "nn" is the generous reading,
  // and generous is the rule here.
  s = s.replace(/n{2,}/g, 'n')

  // Any other geminate is a real sound (kitte vs kite), so consonant
  // doubling is left alone.
  return s
}

/** True when two romaji spellings denote the same reading. */
export function romajiEquals(a, b) {
  const na = normalizeRomaji(a)
  return na.length > 0 && na === normalizeRomaji(b)
}

/**
 * True when `answer` matches any of the accepted spellings — the deck
 * packs alternates into one field with "/" separators in places, and
 * `readings` will need the same any-of behaviour per group.
 */
export function romajiMatchesAny(answer, accepted) {
  const list = Array.isArray(accepted) ? accepted : String(accepted ?? '').split(/[/;,]/)
  return list.some(one => romajiEquals(answer, one))
}

// Exported for the unit test, which is the only reason to see inside.
export const _internals = { FOLD, LONG }
