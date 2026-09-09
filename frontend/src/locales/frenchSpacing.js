// ── L'espace insécable — the space that must not break ───────────
// French sets a space before its "high" punctuation (: ; ! ?) and
// inside its guillemets (« … »), and that space is insécable: the
// glyph belongs to the word in front of it and a line may not be cut
// between the two. A plain U+0020 there is a wrapping opportunity, so
// the browser takes it whenever the line is tight — which on a 390 px
// phone is most of them. The arrival screen printed
//
//     À 10 min par jour, d'ici décembre 2026, pour vous
//     :
//
// with the colon alone on its own line, under a chart, above four
// promises. Nothing was wrong with the copy; the space was breakable.
//
// So the French table is welded on the way out (locales/fr/index.js):
// every space before : ; ! ? » and after « becomes U+00A0. NBSP and
// space are the same width in every font we ship, so nothing moves —
// the only thing that changes is where the line is allowed to end.
//
// Welding the TABLE rather than the 63 strings that needed it is the
// point. The sentence that broke is assembled at call time
//
//     brdLead: (min, date, purpose) => `… ${purpose} :`
//
// from a fragment held under another key, so a table full of
// hand-typed NBSPs would still have printed an orphan colon the day
// someone wrote a new one. Here the rule applies to the string the
// learner actually gets, whenever it is built, and locales.test.js
// holds the whole table to it.
//
// U+00A0 and not U+202F (the narrower fine française): the narrow one
// is the finer setting for ; ! ? but is missing from enough fallback
// faces to risk a tofu box in the middle of a sentence, and this is a
// wrapping fix, not a re-typesetting.

const NBSP = '\u00A0'
// A run of spaces, so " :" and "  :" both weld rather than leaving a
// breakable one behind.
const BEFORE = / +([:;!?»])/g
const AFTER = /(«) +/g

/** Weld French high punctuation to the word it belongs to. */
export function weld(text) {
  return text.replace(BEFORE, `${NBSP}$1`).replace(AFTER, `$1${NBSP}`)
}

/**
 * The same rule over a whole string table: strings are welded, copy
 * functions are wrapped so their RESULT is welded (that is where the
 * interpolated sentences are), and nested tables are walked. Anything
 * else — a number, a null — is handed back untouched.
 */
export function welded(value) {
  if (typeof value === 'string') return weld(value)
  if (typeof value === 'function') {
    return (...args) => {
      const out = value(...args)
      return typeof out === 'string' ? weld(out) : out
    }
  }
  if (Array.isArray(value)) return value.map(welded)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, welded(v)]))
  }
  return value
}
