// ── Study modes, frontend side ─────────────────────────────────
// Mirrors backend/study/modes.py. If you change a key here, change it
// there — and the reverse. That pairing is enforced by a test rather
// than trusted: see domain/studyModes.test.js.
//
// This file replaces FOUR separate enumerations of the mode key space,
// each of which failed silently in its own way when it fell out of step:
//
//   - domain/quizModes.js       the pickers' labels
//   - domain/statsModel.js      FORMAT/DIRECTION maps; an unknown key
//                               became its own format bucket and was
//                               mislabelled "recognition"
//   - config/stations.js        the SERVICE ladder; an unmapped key
//                               silently rendered a 番線 platform number
//                               instead of a service badge
//   - screens/StudyScreen.jsx   MERGED_MODES, which existed only to undo
//                               the qcm/flashcard split at runtime
//
// One entry per key, carrying every field those four needed.
//
// ── Hints are not modes ───────────────────────────────────────
// indice_1 (choices), indice_2 (example sentences) and indice_3
// (furigana) are opt-in per card and never appear in a key. A hint must
// not fork the SRS: what a review consumes is the learner's own 1-4
// self-rating, which means the same thing whether or not four options
// were on screen. See components/study/HintBar.jsx.

export const SOURCES = ['kana', 'kanji', 'vocab', 'grammar', 'standard']

export const HINTS = { CHOICES: 'indice_1', SENTENCES: 'indice_2', FURIGANA: 'indice_3' }

// Renderers — what UI a mode needs. `browse` is the ungraded review deck.
export const RENDER = {
  FLASHCARD: 'flashcard',
  TYPE: 'type',
  DRAW: 'draw',
  FILL: 'fill',
  BROWSE: 'browse',
}

// 種別 rungs, unchanged from config/stations.js — how much the mode holds
// your hand, which is the axis the pips on a mode card encode. Assigned
// per mode below rather than in a second map that could disagree.
//   rapid   (3 pips) the form is shown, one support removed
//   express (2)      retrieved from memory, self-graded
//   ltd     (1)      produced by hand, nothing given
//   review  (0)      not a service at all — an ungraded browse
const SERVICE = { RAPID: 'rapid', EXPRESS: 'express', LTD: 'ltd', REVIEW: 'review' }

// statsModel's old FORMAT axis. Note `choice` is gone: multiple choice is
// a hint now, not a format, so a flashcard is a flashcard whether or not
// the learner asked for the options.
export const FORMATS = ['flashcard', 'typing', 'writing', 'fill']
export const DIRECTIONS = ['recognition', 'recall', 'production']

/** Locale key for a mode, e.g. 'kana.flashcard.f2b' -> 'mode_kana_flashcard_f2b'. */
function localeKey(key) {
  return `mode_${key.replace(/\./g, '_')}`
}

function mode(key, source, base, {
  direction = null, hints = [], graded = true,
  renderer = RENDER.FLASHCARD, service, format, statsDirection,
  implemented = true,
} = {}) {
  return {
    key, source, base, direction, hints, graded, renderer, service,
    format, statsDirection,
    labelKey: localeKey(key),
    descKey: `${localeKey(key)}_desc`,
    // Whether the UI for this mode exists yet. The picker filters on it,
    // so a mode can be registered (and validated, and namespaced) before
    // its renderer is written, instead of being offered and then failing.
    // Remove the flag entirely once every mode is built.
    implemented,
  }
}

const C = [HINTS.CHOICES]
const CF = [HINTS.CHOICES, HINTS.FURIGANA]
const CS = [HINTS.CHOICES, HINTS.SENTENCES]

const LIST = [
  // ── kana ──
  mode('kana.flashcard.f2b', 'kana', 'flashcard', {
    direction: 'f2b', hints: C, service: SERVICE.RAPID,
    format: 'flashcard', statsDirection: 'recognition',
  }),
  mode('kana.flashcard.b2f', 'kana', 'flashcard', {
    direction: 'b2f', hints: C, service: SERVICE.EXPRESS,
    format: 'flashcard', statsDirection: 'recall',
  }),
  mode('kana.write_romaji', 'kana', 'write_romaji', {
    renderer: RENDER.TYPE, service: SERVICE.EXPRESS,
    format: 'typing', statsDirection: 'production',
  }),
  mode('kana.write_kana', 'kana', 'write_kana', {
    renderer: RENDER.DRAW, service: SERVICE.LTD,
    format: 'writing', statsDirection: 'production',
  }),

  // ── kanji ──
  mode('kanji.flashcard.f2b', 'kanji', 'flashcard', {
    direction: 'f2b', hints: C, service: SERVICE.RAPID,
    format: 'flashcard', statsDirection: 'recognition',
  }),
  mode('kanji.flashcard.b2f', 'kanji', 'flashcard', {
    direction: 'b2f', hints: C, service: SERVICE.EXPRESS,
    format: 'flashcard', statsDirection: 'recall',
  }),
  mode('kanji.write_kanji', 'kanji', 'write_kanji', {
    renderer: RENDER.DRAW, service: SERVICE.LTD,
    format: 'writing', statsDirection: 'production',
  }),
  // The deck packs every reading into one string; the payload splits
  // them by script into readings.on / readings.kun (see
  // content/kanji_readings.py) and the input takes them as two groups.
  mode('kanji.readings', 'kanji', 'readings', {
    renderer: RENDER.TYPE, service: SERVICE.EXPRESS,
    format: 'typing', statsDirection: 'production',
  }),
  // Choices come from the same stroke-count bucket, so the answer can't
  // be picked out by shape alone.
  mode('kanji.radical', 'kanji', 'radical', {
    hints: C, service: SERVICE.RAPID, format: 'flashcard',
    statsDirection: 'recognition',
  }),

  // ── vocab ──
  mode('vocab.flashcard.f2b', 'vocab', 'flashcard', {
    direction: 'f2b', hints: CF, service: SERVICE.RAPID,
    format: 'flashcard', statsDirection: 'recognition',
  }),
  mode('vocab.flashcard.b2f', 'vocab', 'flashcard', {
    direction: 'b2f', hints: CF, service: SERVICE.EXPRESS,
    format: 'flashcard', statsDirection: 'recall',
  }),
  // Kana-only entries are filtered out of the pool on the backend --
  // the prompt would otherwise print the answer.
  mode('vocab.word_reading', 'vocab', 'word_reading', {
    service: SERVICE.EXPRESS, format: 'flashcard',
    statsDirection: 'recall',
  }),

  // ── grammar ──
  // Registered but not yet offered: grammar still runs on its legacy keys
  // until content/grammar_points.json is expanded to the full catalogue,
  // because switching it now would cut the section from 205 points to 96.
  mode('grammar.flashcard.f2b', 'grammar', 'flashcard', {
    direction: 'f2b', hints: CS, service: SERVICE.RAPID,
    format: 'flashcard', statsDirection: 'recognition', implemented: false,
  }),
  mode('grammar.flashcard.b2f', 'grammar', 'flashcard', {
    direction: 'b2f', hints: CS, service: SERVICE.EXPRESS,
    format: 'flashcard', statsDirection: 'recall', implemented: false,
  }),
  // The sentence is shown INTACT and the learner names the rule at work.
  // Blanking the rule out has no unique answer — 食べて＿＿＿ takes いる,
  // から, もいい and はいけない alike — so it could not be graded fairly.
  // Needs generated sentences.
  mode('grammar.fill_in', 'grammar', 'fill_in', {
    hints: C, renderer: RENDER.FILL, service: SERVICE.EXPRESS,
    format: 'fill', statsDirection: 'recall', implemented: false,
  }),

  // ── standard (a hand-authored front/back card) ──
  mode('standard.flashcard.f2b', 'standard', 'flashcard', {
    direction: 'f2b', hints: C, service: SERVICE.RAPID,
    format: 'flashcard', statsDirection: 'recognition',
  }),
  mode('standard.flashcard.b2f', 'standard', 'flashcard', {
    direction: 'b2f', hints: C, service: SERVICE.EXPRESS,
    format: 'flashcard', statsDirection: 'recall',
  }),

  // ── the ungraded browse ──
  // Sourceless and graded:false — it writes no SRS row, so it has no key
  // in the backend's SRS_MODES and every review endpoint rejects it. Its
  // f2b/b2f invertibility is runtime state in the component, not a second
  // key. Offered by every source.
  mode('fast_review', '', 'fast_review', {
    graded: false, renderer: RENDER.BROWSE, service: SERVICE.REVIEW,
    hints: [HINTS.FURIGANA],
    format: 'flashcard', statsDirection: 'recognition',
  }),
]

export const MODES = Object.fromEntries(LIST.map(m => [m.key, m]))

export const FAST_REVIEW = 'fast_review'

/** Every graded key, in registry order. */
export const GRADED_KEYS = LIST.filter(m => m.graded).map(m => m.key)

/** Keys a source offers, in picker order, with the browse last. */
export const MODES_FOR_SOURCE = Object.fromEntries(
  SOURCES.map(source => [
    source,
    [...LIST.filter(m => m.source === source).map(m => m.key), FAST_REVIEW],
  ]),
)

/** As above, but only modes whose UI exists — what a picker should show. */
export function offeredModes(source) {
  return (MODES_FOR_SOURCE[source] ?? []).filter(key => MODES[key]?.implemented)
}

export function modeLabel(t, key) {
  return t[MODES[key]?.labelKey] ?? key
}

export function modeDesc(t, key) {
  return t[MODES[key]?.descKey] ?? ''
}

/** {key,label,desc} entries for ModeSelector. */
export function modePickerEntries(t, source) {
  return offeredModes(source).map(key => ({
    key,
    label: modeLabel(t, key),
    desc: modeDesc(t, key),
  }))
}

// ── Legacy keys, for the badge only ───────────────────────────
// The pickers still emit the old key space: switching them over requires
// each screen's render branches (and kana.py's card builder) to move in
// the same step, which is its own piece of work. Until then serviceFor()
// has to recognise both, or every mode card falls through to
// ModeSelector's 番線 platform-number fallback — silently, which is
// exactly the failure this registry exists to end.
//
// Unlike the backend's LEGACY_ALIASES this needs no source to
// disambiguate, because it only decides which of four badges to draw:
// kana's `flashcard` and grammar's `flashcard` are different exercises
// but sit on the same rung, so collapsing them here is harmless.
// DELETE together with the pickers' migration.
const LEGACY_SERVICE = {
  qcm: SERVICE.RAPID,
  mcq: SERVICE.RAPID,
  'qcm-kj-m': SERVICE.RAPID,
  'qcm-m-kj': SERVICE.EXPRESS,
  flashcard: SERVICE.RAPID,
  'flashcard-kj-m': SERVICE.RAPID,
  'flashcard-m-kj': SERVICE.EXPRESS,
  fill: SERVICE.EXPRESS,
  write: SERVICE.LTD,
  review: SERVICE.REVIEW,
}

/** The 種別 badge for a mode — replaces stations.js's own SERVICE map. */
export function serviceKeyFor(key) {
  return MODES[key]?.service ?? LEGACY_SERVICE[key] ?? null
}

export const usesDrawing = key => MODES[key]?.renderer === RENDER.DRAW
export const usesTyping = key => MODES[key]?.renderer === RENDER.TYPE
export const isGraded = key => MODES[key]?.graded ?? false
export const hintsFor = key => MODES[key]?.hints ?? []

/**
 * Where the handwriting drill after a bad rating applies: being asked to
 * produce the character is the whole point there. This replaces
 * quizModes.js's WRITING_DRILL_MODES, which listed the two meaning→form
 * recall keys by hand.
 */
export function usesWritingDrill(key) {
  const m = MODES[key]
  if (!m) return false
  return m.source === 'kanji' && m.direction === 'b2f'
}
