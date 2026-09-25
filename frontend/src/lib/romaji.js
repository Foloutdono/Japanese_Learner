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

// ── Kana, in the other script and in romaji ───────────────────
// A kanji's readings are stored in kana -- the on'yomi in katakana, the
// kun'yomi in hiragana -- and the readings drill takes them "in kana or
// romaji". Nothing turned a stored reading into romaji, though, so
// "shu" was compared with "シュ" as it stood and never matched, and an
// IME's default hiragana しゅ missed シュ too. These two put both sides in
// one script, and the stored side in Latin letters, so the comparison
// above can do the rest.
//
// A transliteration of READINGS, not of text: kana only, Hepburn as the
// deck writes it (し shi, つ tsu, じ ji), yōon, the small っ before a
// consonant, ー as its vowel again, ん as n. Anything else passes
// through, which for a reading is nothing -- its okurigana dot and
// markers are gone from the display form it is fed.

const KATAKANA = /[ァ-ヶ]/g

/** The string with its katakana written in hiragana (シュ → しゅ). */
export function toHiragana(s) {
  return String(s ?? '').replace(KATAKANA, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const KANA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
}
const SMALL_Y = new Set(['ゃ', 'ゅ', 'ょ'])
const SMALL_VOWEL = new Set(['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ'])

/** A kana reading in Hepburn: ジョウ → jou, がっこう → gakkou, きょう → kyou. */
export function kanaToRomaji(kana) {
  const chars = [...toHiragana(kana)]
  let out = ''
  let double = false
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (c === 'っ') { double = true; continue }
    if (c === 'ー') {
      const vowel = out.match(/[aeiou](?=[^aeiou]*$)/)
      if (vowel) out += vowel[0]
      continue
    }
    let r = KANA[c]
    if (r === undefined) { out += c; double = false; continue }
    const next = chars[i + 1]
    if (SMALL_Y.has(next) && r.endsWith('i') && r.length > 1) {
      // きゃ kya, しゃ sha, ちゃ cha, じゃ ja: the i gives way to the glide.
      const stem = r.slice(0, -1)
      const vowel = KANA[next].slice(1)
      r = /(sh|ch|j)$/.test(stem) ? stem + vowel : `${stem}y${vowel}`
      i++
    } else if (SMALL_VOWEL.has(next) && r.length > 1) {
      // ファ fa, ティ ti, ヴァ va: the small vowel takes the syllable's.
      r = r.replace(/[aeiou]+$/, '') + KANA[next]
      i++
    }
    if (double) {
      out += r.startsWith('ch') ? 't' : r[0]
      double = false
    }
    out += r
  }
  return out
}
