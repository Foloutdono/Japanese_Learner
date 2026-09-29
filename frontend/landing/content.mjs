// ── The figures the page prints, counted from the content itself ──
// Every number on the landing page is read here from the files the app
// serves, so a deck change moves the page at its next build rather than
// leaving it quoting last season's figures. Two cannot be read from
// node: the kana deck and the exam blueprint are Python modules, so
// their figures are written in config.mjs and here, each beside the
// file that holds the truth.
import { readFileSync } from 'node:fs'
import { KANA_COUNT } from './config.mjs'

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const backend = path => new URL(`../../backend/${path}`, import.meta.url)
const json = path => JSON.parse(readFileSync(backend(path), 'utf8'))

// The N5 mock exam: backend/study/exam_blueprint.py's LEVEL_BLUEPRINT,
// its mondai counts and section minutes summed.
export const EXAM_N5 = { questions: 67, minutes: 90 }

/** Everything the page counts: the three decks by level, the grammar
 *  lessons' example sentences, the radicals and the kana. */
export function readFacts() {
  // A vocab id is vocab_<level>_<kanji>_<kana>: the served snapshot is
  // the deck as the app hands it out (tests/test_vocab_deck.py).
  const served = json('datas/vocab/vocab_served.json')
  const kanjiDeck = json('datas/kanji/kanji_deck.json')
  const levels = {}
  let examples = 0
  for (const level of LEVELS) {
    const points = json(`content/grammar/${level}.json`)
    examples += points.reduce((n, p) => n + (p.examples?.length ?? 0), 0)
    levels[level] = {
      words: served.filter(id => id.split('_')[1] === level).length,
      kanji: kanjiDeck[level].length,
      grammar: points.length,
    }
  }
  const sum = key => LEVELS.reduce((n, l) => n + levels[l][key], 0)
  return {
    levels,
    words: sum('words'),
    kanji: sum('kanji'),
    grammar: sum('grammar'),
    examples,
    radicals: json('datas/kanji/radicals.json').length,
    kana: KANA_COUNT,
    exam: EXAM_N5,
  }
}

const DAYS_PER_MONTH = 30.4

/** Days to reach each level from zero at `perDay` new items a day, the
 *  kana first: the app's own projection (domain/goalMath.js's
 *  callingAt, domain/journeyProjection.js's levelItems). */
export function arrivals(facts, perDay) {
  let items = facts.kana
  return LEVELS.map(level => {
    const l = facts.levels[level]
    items += l.words + l.kanji + l.grammar
    return { level, days: items / perDay }
  })
}

/** A span in days as the page says it: months up to two years, then
 *  years to the half. `{ months }` or `{ years, half }`. */
export function spanOf(days) {
  const months = Math.max(1, Math.round(days / DAYS_PER_MONTH))
  if (months < 24) return { months }
  const halves = Math.round(days / 365 * 2)
  return { years: Math.floor(halves / 2), half: halves % 2 === 1 }
}
