// ── Single source of truth for quiz mode keys/labels ──────────────────
// KanaScreen, VocabScreen, KanjiScreen, and StatsScreen all import from
// here — add a mode, rename a key, or tweak a label once, and every
// screen that uses it picks it up automatically instead of needing to
// be kept in sync by hand across files.
//
// Mirrors the backend's quiz_modes.py — if you change a key here, change
// it there too.

export const KANA_MODE_KEYS  = ['qcm', 'flashcard', 'write']
export const VOCAB_MODE_KEYS = ['qcm-kj-m', 'qcm-m-kj', 'flashcard-kj-m', 'flashcard-m-kj']
export const KANJI_MODE_KEYS = [...VOCAB_MODE_KEYS, 'write']
export const GRAMMAR_MODE_KEYS = ['flashcard', 'mcq', 'fill']

// Kana mode toggle (label only — used by ModeToggle).
export function kanaModes(t) {
  return [
    ['qcm',       t.modeQCM],
    ['flashcard', t.modeFlashcard],
    ['write',     t.modeWrite],
  ]
}

// Kana mode picker (label + description — used by ModeSelector).
// Same keys/labels as kanaModes above, just shaped as {key,label,desc}
// instead of tuples — kanaModes stays tuple-shaped because StatsScreen
// depends on that exact shape (`Object.fromEntries(kanaModes(t))`).
export function kanaModePicker(t) {
  return [
    { key: 'qcm',       label: t.modeQCM,       desc: t.modeQcmKanaDesc },
    { key: 'flashcard', label: t.modeFlashcard, desc: t.modeFcKanaDesc },
    { key: 'write',     label: t.modeWrite,  desc: t.modeWriteKanaDesc },
  ]
}

// Vocab/kanji mode picker (label + description — used by ModeSelector).
// `noun` is what to call "the word/kanji itself" side — "mot" for vocab,
// "kanji" for kanji — so the two screens share one definition instead of
// two near-identical copies (which had actually drifted into a bug:
// both screens previously reused the same t.modeQcmKjM translation key
// for text that needs to say something different — "mot" vs "kanji" —
// so a real translation could only ever be right for one of them).
// `noun` defaults to the vocab wording so StudyScreen's own no-argument
// call (allModeMeta, which merges this with kanjiModes and lets the
// kanji entries win on the shared keys) still resolves to real text
// rather than "undefined".
export function vocabKanjiModes(t, noun = t.wordNoun) {
  return [
    { key: 'qcm-kj-m',       label: t.modeQcmKjM(noun), desc: t.modeQcmKjMDesc(noun) },
    { key: 'qcm-m-kj',       label: t.modeQcmMKj(noun), desc: t.modeQcmMKjDesc(noun) },
    { key: 'flashcard-kj-m', label: t.modeFcKjM(noun),  desc: t.modeFcKjMDesc(noun) },
    { key: 'flashcard-m-kj', label: t.modeFcMKj(noun),  desc: t.modeFcMKjDesc(noun) },
  ]
}

export function kanjiModes(t) {
  return [
    ...vocabKanjiModes(t, t.kanjiNoun),
    { key: 'write', label: t.modeWrite, desc: t.modeWriteDesc },
  ]
}

// Grammar mode picker (label + description — used by ModeSelector).
// Each mode gets its own accurate description now — GrammarScreen used
// to build the mcq one by stripping the substring 'ci-dessous' out of
// t.revealSentence, which only worked because that exact French phrase
// happened to appear there, and silently produced a mangled/unchanged
// description in any other language.
export function grammarModePicker(t) {
  return [
    { key: 'flashcard', label: t.modeFlashcard,    desc: t.modeFcGrammarDesc },
    { key: 'mcq',       label: t.modeQCM,          desc: t.modeQcmGrammarDesc },
    { key: 'fill',      label: t.modeFill, desc: t.modeFillGrammarDesc },
  ]
}

// "Review your cards" — a self-paced, ungraded browse over cards
// already studied in this deck (see the backend's *_review_cards
// endpoints — get_kana_review_cards etc.), not one of the graded
// modes above. Deliberately kept out of KANA_MODE_KEYS/VOCAB_MODE_KEYS/
// etc.: those feed format/direction lookups (QCM_FLASHCARD_MODES on
// the backend, allModeMeta on the frontend) that assume every mode key
// is a gradable quiz format, which "review" isn't. Screens append this
// entry to their own mode list right before handing it to
// ModeSelector, and special-case the 'review' key in onSelect instead
// of setting the normal `mode` state — see KanaScreen.jsx for the
// pattern.
export function reviewMode(t) {
  return { key: 'review', label: t.modeReview, desc: t.modeReviewDesc }
}

// Short [key, label] pairs for the compact Stats grid — same keys as
// above, terser text to fit a small card. Reuses modeQCM/modeFlashcard/
// meaning rather than its own hardcoded strings, so this stops being
// permanently French regardless of the active language.
export function vocabKanjiStatsLabels(t, noun) {
  return [
    ['qcm-kj-m',       `${t.modeQCM} → ${t.meaning}`],
    ['qcm-m-kj',       `${t.modeQCM} → ${noun}`],
    ['flashcard-kj-m', `${t.modeFlashcard} → ${t.meaning}`],
    ['flashcard-m-kj', `${t.modeFlashcard} → ${noun}`],
  ]
}