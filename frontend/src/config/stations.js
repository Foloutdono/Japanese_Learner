// ── 日本語駅 — the station ─────────────────────────────────
// The home screen is a railway platform, and every section of the app
// is a train leaving it. That isn't decoration for its own sake: the
// ambiance track playing behind this screen *is* a Japanese metro
// platform, and the app already announces each destination out loud
// when you pick it (playAnnouncement, see HomeScreen). The interface
// was the only part still pretending otherwise.
//
// Japanese railway signage is one of the most refined information
// systems anywhere — the station plate (駅名標), the departure board
// (発車標), the line colours, the two-letter station numbering. All of
// it exists to let somebody who cannot read the language find their
// train, which is a fairly exact description of what this app is for.
//
// This file is the part of that system the components can't derive:
// how each section's name is *read* (a station plate carries hiragana
// above the kanji), and its line code. Names of places aren't
// translated copy — 漢字 station is 漢字 station in every language —
// so they live here rather than in the locale files, the same call
// appTitle and 辞書 already make.
//
// There's deliberately no romaji field: a literal transliteration of
// 解析 ("KAISEKI") tells a non-reader nothing a real station name
// wouldn't either, and the app already has a plain-language name for
// every section — the one on the departure board. StationSign takes
// that string directly from its caller (see `latin` there) instead of
// this file inventing a second, less useful English label. The one
// exception is 日本語駅 itself, which has no board row to borrow a
// name from, so it keeps its own.

// path -> { code, kana }
//   code   two letters, the way a real line is coded (JY, G, T…). It
//          rides in the coloured roundel on the board and the plate.
//   kana   the reading, set above the name on a station plate.
const STATIONS = {
  '/':                      { code: 'JP', kana: 'にほんご',   latin: 'NIHONGO' },
  '/kana':                  { code: 'KN', kana: 'かな' },
  '/vocab':                 { code: 'TG', kana: 'たんご' },
  '/kanji':                 { code: 'KJ', kana: 'かんじ' },
  '/grammar':               { code: 'BP', kana: 'ぶんぽう' },
  '/reading':               { code: 'DS', kana: 'どくしょ' },
  '/reading-comprehension': { code: 'RK', kana: 'りかい' },
  '/translation':           { code: 'HY', kana: 'ほんやく' },
  '/phrase-analyzer':       { code: 'KS', kana: 'かいせき' },
  '/dictionary':            { code: 'JS', kana: 'じしょ' },
  '/decks':                 { code: 'KZ', kana: 'きょうざい' },
  '/exam':                  { code: 'MS', kana: 'もし' },
}

const UNKNOWN = { code: '??', kana: '' }

export function stationFor(path) {
  return STATIONS[path] ?? UNKNOWN
}

/** The origin — the station the home screen itself is standing in. */
export const HOME_STATION = STATIONS['/']

// ── 種別 — service types ──────────────────────────────────
// On a Japanese line the service type says one thing: how often the
// train stops for you. 各駅停車 halts at every station; 特急 runs
// past nearly all of them. Studying has exactly that axis — how much
// the mode holds your hand — so the badge is real information.
//
// The first version of this table got it wrong in a way worth
// recording, because the result *looked* arbitrary and was: it keyed
// off the question's **format** alone. Every multiple-choice mode was
// 各駅停車 and every flashcard was 快速. So "MCQ → meaning" (the
// easiest mode in the app: the character is in front of you and the
// answer is one of four on screen) carried the same badge as
// "MCQ → kanji" (you must retrieve the character, the choices only
// confirm it), while "Flashcard → meaning" carried a *different*
// badge despite being about as hard as the latter. Two rows that
// differ got the same mark, two rows that match got different ones.
// Nothing about the ladder was legible, so it read as decoration.
//
// What actually sets the difficulty is **how many supports are left
// standing**, and format is only one of them. Direction is the other:
// being shown a character and asked what it means (recognition) is a
// different task from being shown a meaning and asked for the
// character (recall). Counting both gives a real four-rung ladder,
// and each rung is one support removed from the one before it:
//
//   4 stops  各駅停車  the prompt is the form, and the answer is on
//                      screen. Recognition, multiple choice.
//   3 stops  快速      one support gone — either you must retrieve
//                      the form (recall + choices) or you get no
//                      choices (recognition + flashcard). Two roads
//                      to the same rung, which is why they share it.
//   2 stops  急行      retrieve it from memory and grade yourself,
//                      with nothing on screen to check against.
//   1 stop   特急      produce it by hand, stroke by stroke. No
//                      prompt, no choices, no reveal.
//
// `stops` is rendered as pips on the badge (see ModeSelector), which
// is the part that makes the ladder visible without the reader having
// to know what 快速 means — the old English gloss ("RAPID") never
// managed that, because it is railway vocabulary, not study
// vocabulary.
const SERVICES = {
  local:   { jp: '各駅停車', stops: 4 },
  rapid:   { jp: '快速',     stops: 3 },
  express: { jp: '急行',     stops: 2 },
  ltd:     { jp: '特急',     stops: 1 },
  // 復習 is not a service at all: it's an ungraded browse through
  // cards you've already met (see reviewMode in quizModes.js), so it
  // has no rung on the ladder and deliberately shows no pips. It
  // keeps the badge frame purely so the titles beside it stay in one
  // column.
  review:  { jp: '復習',     stops: 0 },
}

// Keyed by the mode keys in domain/quizModes.js. Anything not in the
// table (the study-source pickers reuse this same list component for
// "by level" / "by theme", which aren't services at all) simply gets
// no badge, rather than a wrong one.
const SERVICE = {
  // Recognition + choices: the form is shown, the answer is on screen.
  'qcm':             'local',
  'mcq':             'local',
  'qcm-kj-m':        'local',

  // One support removed, from either direction.
  'qcm-m-kj':        'rapid',   // recall, but the choices confirm it
  'flashcard':       'rapid',   // recognition, but nothing to pick from
  'flashcard-kj-m':  'rapid',

  // Retrieved from memory and self-graded.
  'flashcard-m-kj':  'express',
  'fill':            'express',

  // Produced by hand.
  'write':           'ltd',

  'review':          'review',
}

export function serviceFor(modeKey) {
  const key = SERVICE[modeKey]
  return key ? { key, ...SERVICES[key] } : null
}
