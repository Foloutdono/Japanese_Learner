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

import { getAllSections } from './navLinks'
import { serviceKeyFor } from '../domain/studyModes'

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
  '/video':                 { code: 'DG', kana: 'どうが' },
  '/dictionary':            { code: 'JS', kana: 'じしょ' },
  '/decks':                 { code: 'KZ', kana: 'きょうざい' },
  '/exam':                  { code: 'MS', kana: 'もし' },

  // The halls. Not about Japanese, but still places you go to — the
  // storehouse holds things, the daruma hall holds goals, the stats
  // screen holds the record. They had no plate at all, which is why
  // they were among the screens that still looked like a different
  // app.
  //
  // /profile and /settings are deliberately NOT here. They are you,
  // not somewhere you travel, and they are modelled in
  // config/identity.js — see that file for why the distinction earns
  // its own registry.
  '/stats':                 { code: 'TO', kana: 'とうけい' },
  '/daruma':                { code: 'DR', kana: 'だるま' },
  '/storehouse':            { code: 'KR', kana: 'くら' },

  // 本日 — the daily queue. Not a board row (see navLinks.js's own
  // note on why /today is scope: 'today'), but every other screen it
  // opens through — the concourse strip, its own gate, its own top
  // bar — still needs a plate to name.
  '/today':                 { code: 'HN', kana: 'ほんじつ' },
}

const UNKNOWN = { code: '??', kana: '' }

// Falls back to the longest matching prefix, the same way sectionFor
// below does and for the same reason: a nested route (/decks/<id>,
// /decks/<id>/study) is still standing in that section's station, and
// returning UNKNOWN there printed a "??" roundel over an empty kana
// line — a plate that said nothing, on a screen that does have an
// answer. Exact match still wins, so nothing that had a plate changes.
export function stationFor(path) {
  const exact = STATIONS[path]
  if (exact) return exact

  const prefix = Object.keys(STATIONS)
    .filter(p => p !== '/' && path.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0]
  return prefix ? STATIONS[prefix] : UNKNOWN
}

/** The origin — the station the home screen itself is standing in. */
export const HOME_STATION = STATIONS['/']

// ── Which station am I standing in? ───────────────────────
// Two registries used to hold sections — the board's and the profile's
// halls — and every caller that wanted "the section for this path" was
// spreading both itself. StationHeader did it; the top bar needed the
// same answer to know what colour its line is. One lookup now, over
// getAllSections (every scope, not just the two that render a browsable
// list) — /today needed a third scope that is neither a board row nor
// a profile hall, and a lookup narrowed to the first two would silently
// have no answer for it. A new station is still added in one place and
// every masthead in the app finds it.
//
// Falls back to the longest matching prefix so a nested route
// (/decks/<id>) still knows which line it is on, and returns null —
// not a blank — for a path that has no station, so callers can render
// nothing rather than an empty plate. The identity routes fall
// through to that null by design: they are not stations, and asking
// this function for one is how a caller finds that out.
export function sectionFor(path, t) {
  // Every section regardless of scope -- getNavLinks/getProfileHalls
  // are deliberately narrower lists (what the board and the profile
  // screen each render), and /today belongs to neither, but it still
  // needs a colour and a title wherever this function is asked for one
  // (StationHeader, TopBar, the gate, the door).
  const all = getAllSections(t)
  const exact = all.find(s => s.path === path)
  if (exact) return exact

  return all
    .filter(s => s.path !== '/' && path.startsWith(`${s.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null
}

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

// The mode-key -> service mapping used to live here as its own SERVICE
// map, hand-synced with domain/quizModes.js. It was one of four places
// the mode key space was enumerated, and the quietest: an unmapped key
// made serviceFor() return null, and ModeSelector then fell back to a
// 番線 platform number — so a mode card silently rendered as if it were
// a source picker, with no error anywhere. The badge now comes from the
// one registry that defines the modes, and a test asserts every key
// names a rung (backend/tests/test_mode_parity.py).
//
// Anything that isn't a mode still returns null and keeps the numbered
// fallback, which is what the "by level" / "by theme" / "by frequency"
// source pickers rely on.
export function serviceFor(modeKey) {
  const key = serviceKeyFor(modeKey)
  return key ? { key, ...SERVICES[key] } : null
}
