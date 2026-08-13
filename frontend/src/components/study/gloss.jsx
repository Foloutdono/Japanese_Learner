// ── Glosses ────────────────────────────────────────────────
// A "meaning" reaching the UI is really a list of synonymous glosses
// packed into one string, and the app's two decks disagree about how:
// kanji_deck.json separates them with "; " ("soil; earth; ground;
// Turkey"), vocab_deck.json with "," — and in ~2600 of its ~8400
// entries with no space at all ("to appear,to leave"), which is what
// made a run of glosses read as one mangled phrase. Everything here
// exists so that difference never reaches the screen: the parts are
// split apart and re-rendered, so the data's own punctuation is never
// displayed.
//
// Split into its own module (rather than living in DictionaryDetail,
// where it started) for the same reason Readings.jsx was: the quiz
// components need it too, and pulling a whole detail-panel component
// in for a pure text helper is backwards.

// JMdict part-of-speech / usage codes that leak into some deck glosses
// as a leading "(n)" or "(v5r,vi)" group. The dictionary's senses list
// already renders these properly as tag chips (see TagChip), so inside
// a gloss they're duplicated noise. Matched against an explicit list
// rather than a "short lowercase word" shape test, because the same
// decks also open glosses with real prose in parentheses — "(the)",
// "(not)", "(humble)", "(respectful)", "(fr:)" — which has to survive.
const GLOSS_TAG_CODES = new Set([
  'n', 'pn', 'n-suf', 'n-pref', 'num', 'ctr', 'pref', 'suf', 'prt', 'conj',
  'cop', 'exp', 'int', 'adv', 'adv-to', 'aux', 'aux-v', 'aux-adj',
  'adj-i', 'adj-ix', 'adj-na', 'adj-no', 'adj-t', 'adj-f',
  'v1', 'v1-s', 'v5aru', 'v5b', 'v5g', 'v5k', 'v5k-s', 'v5m', 'v5n',
  'v5r', 'v5r-i', 'v5s', 'v5t', 'v5u', 'v5u-s', 'v5uru',
  'vk', 'vn', 'vr', 'vs', 'vs-c', 'vs-i', 'vs-s', 'vz', 'vt', 'vi',
  'uk', 'abbr', 'col', 'hon', 'hum', 'pol', 'arch', 'obs', 'dated',
  'rare', 'on-mim', 'id', 'proverb', 'derog', 'sl', 'ateji', 'gikun',
  'ik', 'io', 'iK', 'oK', 'ok', 'rK', 'sK',
])

// Splits on `sep`, but only where it sits outside parentheses — a
// gloss can legitimately contain the separator inside a qualifier
// ("to take (seat, position)", "band (e.g. conduction, valence)"), and
// a plain .split() would shatter those into fragments.
function splitOutsideParens(text, sep) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

function cleanGloss(gloss) {
  let out = gloss.trim()
  // "(1) to serve" -> "to serve": some deck entries number their own
  // glosses inline, which is redundant once they're rendered as a list.
  out = out.replace(/^\(\d+\)\s*/, '')
  const lead = out.match(/^\(([^)]*)\)\s*/)
  if (lead) {
    const tokens = lead[1].split(',').map(s => s.trim())
    if (tokens.length > 0 && tokens.every(tk => GLOSS_TAG_CODES.has(tk))) {
      out = out.slice(lead[0].length)
    }
  }
  return out.trim()
}

// Only the FIRST gloss is ever re-cased, and only its first character.
// A definition should open with a capital, but normalising the rest
// would be wrong in both directions: lowercasing turns the genuine
// proper nouns this data carries ("Turkey", "Japan", "Miss", "Asie")
// into different words, and capitalising every item makes a verb list
// read as "To appear · To leave".
function capitalizeFirst(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

// One raw meaning string -> its individual glosses, untouched.
// Semicolons win when present (the kanji convention); otherwise commas
// separate (the vocab convention). Never both: no entry in either deck
// mixes the two as separators, so whichever is in use is unambiguous.
export function splitGlosses(meaning) {
  if (!meaning) return []
  const sep = meaning.includes(';') ? ';' : ','
  return splitOutsideParens(meaning, sep).map(cleanGloss).filter(Boolean)
}

// The glosses with the leading one sentence-cased — the array form,
// for callers that lay the parts out themselves rather than taking a
// ready-made line (MeaningDisplay's big primary + muted rest).
export function glossParts(meaning) {
  const parts = splitGlosses(meaning)
  return parts.length > 0 ? [capitalizeFirst(parts[0]), ...parts.slice(1)] : parts
}

// The single most representative gloss, for places with room for only
// one line — a dictionary result card, a vocab-example row.
export function firstGloss(meaning) {
  return glossParts(meaning)[0] ?? ''
}

// The whole list as one normalised plain string. For contexts that need
// a real string rather than elements — an MCQ answer row, a stroke
// reference's subtitle — where GlossList's markup can't go.
export function formatGlossLine(meaning) {
  return glossParts(meaning).join(' · ')
}

// A full gloss list as elements, with a dimmed middot between them
// instead of whatever punctuation the deck happened to use — so a
// kanji's "; " list and a vocab word's "," list are indistinguishable
// on screen.
export function GlossList({ meaning }) {
  const parts = glossParts(meaning)
  if (parts.length === 0) return null
  return (
    <>
      {parts.map((gloss, i) => (
        <span key={i} className="gloss__item">
          {i > 0 && <span className="gloss__sep" aria-hidden="true">·</span>}
          {gloss}
        </span>
      ))}
    </>
  )
}
