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

// Kana mode toggle (label only — used by ModeToggle).
export function kanaModes(t) {
  return [
    ['qcm',       t.modeQCM       ?? 'QCM'],
    ['flashcard', t.modeFlashcard ?? 'Flashcard'],
    ['write',     t.modeWrite     ?? 'Écriture'],
  ]
}

// Kana mode picker (label + description — used by ModeSelector).
// Same keys/labels as kanaModes above, just shaped as {key,label,desc}
// instead of tuples — kanaModes stays tuple-shaped because StatsScreen
// depends on that exact shape (`Object.fromEntries(kanaModes(t))`).
export function kanaModePicker(t) {
  return [
    { key: 'qcm',       label: t.modeQCM       ?? 'QCM',       desc: t.modeQcmKanaDesc  ?? 'Choisissez la bonne romanisation' },
    { key: 'flashcard', label: t.modeFlashcard ?? 'Flashcard', desc: t.modeFcKanaDesc   ?? 'Révélez la romanisation' },
    { key: 'write',     label: t.modeWrite     ?? 'Écriture',  desc: t.modeWriteKanaDesc ?? 'Tapez la romanisation' },
  ]
}

// Vocab/kanji mode picker (label + description — used by ModeSelector).
// `noun` is what to call "the word/kanji itself" side — "mot" for vocab,
// "kanji" for kanji — so the two screens share one definition instead of
// two near-identical copies (which had actually drifted into a bug:
// both screens previously reused the same t.modeQcmKjM translation key
// for text that needs to say something different — "mot" vs "kanji" —
// so a real translation could only ever be right for one of them).
export function vocabKanjiModes(t, noun) {
  return [
    { key: 'qcm-kj-m',       label: t.modeQcmKjM ?? `QCM (${noun} → sens)`,   desc: t.modeQcmKjMDesc ?? `Le ${noun} est affiché, choisissez le sens` },
    { key: 'qcm-m-kj',       label: t.modeQcmMKj ?? `QCM (sens → ${noun})`,   desc: t.modeQcmMKjDesc ?? `Le sens est affiché, choisissez le ${noun}` },
    { key: 'flashcard-kj-m', label: t.modeFcKjM  ?? `Carte (${noun} → sens)`, desc: t.modeFcKjMDesc  ?? `Le ${noun} est affiché, révélez le sens` },
    { key: 'flashcard-m-kj', label: t.modeFcMKj  ?? `Carte (sens → ${noun})`, desc: t.modeFcMKjDesc  ?? `Le sens est affiché, révélez le ${noun}` },
  ]
}

export function kanjiModes(t) {
  return [
    ...vocabKanjiModes(t, t.kanjiNoun ?? 'kanji'),
    { key: 'write', label: t.modeWrite ?? 'Écriture', desc: t.modeWriteDesc ?? 'Voir le sens, écrire le kanji' },
  ]
}

// Short [key, label] pairs for the compact Stats grid — same keys as
// above, terser text to fit a small card.
export function vocabKanjiStatsLabels(noun) {
  return [
    ['qcm-kj-m',       'QCM →sens'],
    ['qcm-m-kj',       `QCM →${noun}`],
    ['flashcard-kj-m', 'Carte →sens'],
    ['flashcard-m-kj', `Carte →${noun}`],
  ]
}