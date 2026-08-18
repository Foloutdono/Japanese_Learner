// ── The RETIRING mode registry ────────────────────────────────────────
// Superseded by domain/studyModes.js, which mirrors backend/study/modes.py
// and is held to it by a test. What survives here serves only the two
// screens not yet migrated:
//
//   GrammarScreen — waits on routes/grammar.py moving to the owned
//                   catalogue, which changes every grammar card id and so
//                   has to land with the SRS wipe.
//   StudyScreen   — deck study, its own piece of work (the personal card
//                   structures land there).
//
// Nothing else imports it. Delete the file once those two move; don't add
// anything to it.
//
// Removed as part of the migration, all verified zero-consumer:
// KANA_MODE_KEYS, VOCAB_MODE_KEYS, KANJI_MODE_KEYS, GRAMMAR_MODE_KEYS,
// kanaModes, kanaModePicker, vocabKanjiStatsLabels.

// ── Where the writing drill applies ───────────────────────────────
// After a bad rating, StudyScreen offers a quick handwriting drill — but
// only for meaning→kanji cards, where being asked to produce the
// character is the whole point (see `needTraining`). In every other mode
// the toggle that enables it did nothing at all, while still occupying
// the top bar: it showed up over "MCQ (kanji → meaning)", where no card
// can ever satisfy the condition. Recognition modes don't need it, and
// `write` mode always draws regardless, so it has no say there either.
//
// studyModes.js states the same rule structurally (source === 'kanji' &&
// direction === 'b2f') rather than by listing keys; this copy stays only
// while StudyScreen is still on the old key space.
export const WRITING_DRILL_MODES = ['qcm-m-kj', 'flashcard-m-kj']

export const usesWritingDrill = mode => WRITING_DRILL_MODES.includes(mode)

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
//
// The registry needs no such parameter: a key names its own source, so
// 'vocab.flashcard.b2f' and 'kanji.flashcard.b2f' are simply two entries
// with two labels, and neither can be mistaken for the other.
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

// "Review your cards" — a self-paced, ungraded browse over cards already
// studied in this deck (see the backend's *_review_cards endpoints), not
// one of the graded modes above. Screens append this entry to their own
// mode list right before handing it to ModeSelector, and special-case the
// 'review' key in onSelect instead of setting the normal `mode` state.
//
// In the registry this is `fast_review`, which carries graded:false so it
// needs no such note: every review endpoint rejects it structurally
// rather than by convention.
export function reviewMode(t) {
  return { key: 'review', label: t.modeReview, desc: t.modeReviewDesc }
}
