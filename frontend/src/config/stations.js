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
// (発車標), the line colours, the two-letter station numbering, the
// yellow tactile paving at the platform edge. All of it exists to let
// somebody who cannot read the language find their train, which is a
// fairly exact description of what this app is for.
//
// This file is the part of that system the components can't derive:
// how each section's name is *said* (a station plate carries hiragana
// above the kanji and romaji below), and its line code. Names of
// places aren't translated copy — 漢字 station is 漢字 station in
// every language — so they live here rather than in the locale files,
// the same call appTitle and 辞書 already make.

// path -> { code, kana, romaji }
//   code   two letters, the way a real line is coded (JY, G, T…). It
//          rides in the coloured roundel on the board and the plate.
//   kana   the reading, set above the name on a station plate.
//   romaji set below it, for exactly the reason it is on the real ones.
const STATIONS = {
  '/':                      { code: 'JP', kana: 'にほんご',   romaji: 'NIHONGO' },
  '/kana':                  { code: 'KN', kana: 'かな',       romaji: 'KANA' },
  '/vocab':                 { code: 'TG', kana: 'たんご',     romaji: 'TANGO' },
  '/kanji':                 { code: 'KJ', kana: 'かんじ',     romaji: 'KANJI' },
  '/grammar':               { code: 'BP', kana: 'ぶんぽう',   romaji: 'BUNPOU' },
  '/reading':               { code: 'DS', kana: 'どくしょ',   romaji: 'DOKUSHO' },
  '/reading-comprehension': { code: 'RK', kana: 'りかい',     romaji: 'RIKAI' },
  '/translation':           { code: 'HY', kana: 'ほんやく',   romaji: 'HON-YAKU' },
  '/phrase-analyzer':       { code: 'KS', kana: 'かいせき',   romaji: 'KAISEKI' },
  '/dictionary':            { code: 'JS', kana: 'じしょ',     romaji: 'JISHO' },
  '/decks':                 { code: 'KZ', kana: 'きょうざい', romaji: 'KYOUZAI' },
  '/exam':                  { code: 'MS', kana: 'もし',       romaji: 'MOSHI' },
}

const UNKNOWN = { code: '??', kana: '', romaji: '' }

export function stationFor(path) {
  return STATIONS[path] ?? UNKNOWN
}

/** The origin — the station the home screen itself is standing in. */
export const HOME_STATION = STATIONS['/']

// ── 種別 — train types ────────────────────────────────────
// On a Japanese line the service type tells you how much the train
// stops for you: 各駅停車 halts at every station, 特急 blows through
// almost all of them. That is *exactly* the ladder the quiz modes
// form, so the mapping is real information rather than a costume:
//
//   各駅停車  local          multiple choice — every prompt comes with
//                            the answer somewhere in front of you
//   快速      rapid          flashcard — you self-assess, unaided
//   急行      express        fill in the blank — produce it, in context
//   特急      limited exp.   writing — produce it from nothing, stroke
//                            by stroke
//
// Keyed by the mode keys in domain/quizModes.js. Anything not in the
// table (the study-source pickers reuse this same list component for
// "by level" / "by theme", which aren't services at all) simply gets
// no badge, rather than a wrong one.
const SERVICE = {
  'qcm':             'local',
  'mcq':             'local',
  'qcm-kj-m':        'local',
  'qcm-m-kj':        'local',
  'flashcard':       'rapid',
  'flashcard-kj-m':  'rapid',
  'flashcard-m-kj':  'rapid',
  'fill':            'express',
  'write':           'ltd',
  'review':          'local',
}

export const SERVICE_JP = {
  local:   '各駅停車',
  rapid:   '快速',
  express: '急行',
  ltd:     '特急',
}

export function serviceFor(modeKey) {
  return SERVICE[modeKey] ?? null
}
