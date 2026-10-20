// ── 巻物 — the text read as it rolls past (plan 258) ──────────────
// Comprehension shows a text whole for a window (domain/readingPace.js)
// and then turns to the questions. The learner can instead have it
// roll: the sentences pass up a card one line at a time, the one being
// read lit at its middle, at a speed they choose. The speed is the
// reader's own, in characters a second, not the pace's: the pace scales
// a window set for the whole text, and a roll's length is its text over
// its speed, so the roll sets the clock rather than the clock the roll.
//
//   whole    the text on the card, as it has always been  (the default)
//   rolling  one line at a time, over a hairline that is the roll
//
// A roll holds its first line a moment before it moves and its last one
// after, so neither is gone before it is read.

export const ROLL_MODES = ['whole', 'rolling']
export const DEFAULT_ROLL_MODE = 'whole'

// Characters a second, slowest first. A line a learner reads at the
// first is one an N5 text holds for a quarter of a minute.
export const ROLL_SPEEDS = [1, 2, 3, 4, 5, 6, 8, 10]
export const DEFAULT_ROLL_SPEED = 3

// Seconds the first line stands before the roll moves, and the last
// stands after it stops.
export const ROLL_LEAD = 1.5
export const ROLL_TAIL = 1.5

export const isRollMode = id => ROLL_MODES.includes(id)
export const isRollSpeed = n => ROLL_SPEEDS.includes(n)

/** The next speed up (dir 1) or down (dir -1); the end of the range stays put. */
export function stepSpeed(speed, dir) {
  const i = ROLL_SPEEDS.indexOf(isRollSpeed(speed) ? speed : DEFAULT_ROLL_SPEED)
  return ROLL_SPEEDS[Math.min(ROLL_SPEEDS.length - 1, Math.max(0, i + dir))]
}

/** What a roll passes, a line each: the breakdown's sentences as the
 *  exercise was served, or -- from a backend that sends none -- the text
 *  cut after its sentence ends. Each is { text, parts }, `parts` its
 *  furigana as the analysis gave it ({ text, reading? }, a reading on the
 *  kanji alone) or the line whole when there is none, or when the
 *  analysis does not spell the line it was made for. Never an empty line. */
export function rollEntries(exercise) {
  const given = exercise?.breakdown?.length
    ? exercise.breakdown.map(s => ({ jp: s.jp, analysis: s.analysis }))
    : String(exercise?.text ?? '').split(/(?<=[。！？!?])|\n+/).map(jp => ({ jp }))
  return given
    .map(({ jp, analysis }) => ({ text: String(jp ?? '').trim(), analysis }))
    .filter(e => e.text)
    .map(({ text, analysis }) => {
      const parts = (analysis?.tokens ?? []).flatMap(tok => tok.furigana ?? [{ text: tok.surface }])
      const spells = parts.length > 0 && parts.map(p => p.text).join('').trim() === text
      return { text, parts: spells ? parts : [{ text }] }
    })
}

/** The lines alone, for what only needs their text. */
export const rollLines = exercise => rollEntries(exercise).map(e => e.text)

/** Whether any line of a roll carries a reading: without one the
 *  furigana option has nothing to show and is not offered. */
export const hasReadings = entries => entries.some(e => e.parts.some(p => p.reading))

/** Seconds the roll itself takes between its first line and its last. */
export function rollSeconds(lines, speed) {
  const chars = lines.reduce((n, l) => n + [...l].length, 0)
  const cps = isRollSpeed(speed) ? speed : DEFAULT_ROLL_SPEED
  return Math.max(1, chars / cps)
}
