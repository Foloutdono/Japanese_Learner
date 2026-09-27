// ── 読速 — how long the reading exercises leave the text up ───────
// 読解 shows a sentence for a time that grows with its length
// (backend/routes/reading.py's _display_seconds) and then covers it, so
// recall keeps mattering; 理解 gives a text a reading window by level
// (READ_SECONDS_BY_LEVEL) and then turns to the questions. Both figures
// are set for a fluent reader, and for a slow one, a dyslexic one, or
// anyone the clock is the obstacle for rather than the exercise, the
// cover lands before the reading is done: the exercise measures the
// clock instead of the Japanese.
//
// So the learner chooses a pace, stored on the profile
// (user_profiles.reading_pace, routes/profile.py's READING_PACES) so it
// follows them between devices. The server's figures stay the standard
// pace's and the client scales them, because the clock runs here:
//
//   standard  x1    the time the server hands out   (the default)
//   relaxed   x1.5
//   slow      x2
//   untimed   --    no clock: the sentence stays up until the answer
//                   is checked, the text until "Done reading"
//
// Untimed gives up the cover, which is the exercise's recall half; that
// is the learner's trade to make, and the one a timer that cannot be
// beaten leaves them no other way round.

export const DEFAULT_READING_PACE = 'standard'

// Slowest last, so the settings page reads as one range.
export const READING_PACE_IDS = ['standard', 'relaxed', 'slow', 'untimed']

// How many times the standard pace's seconds; null is no clock at all.
const FACTOR = { standard: 1, relaxed: 1.5, slow: 2, untimed: null }

// The sentence Settings draws each pace's clock for: about a dozen
// characters, which routes/reading.py's _display_seconds (3 s, and
// 0.6 s a character) gives ten seconds at the standard pace.
export const SPECIMEN_SECONDS = 10

export const isReadingPace = id => typeof id === 'string' && Object.hasOwn(FACTOR, id)

/** The pace's factor on the server's seconds, or null for no clock. An
 *  unknown id reads as the standard pace, never as no clock. */
export function paceFactor(pace) {
  return isReadingPace(pace) ? FACTOR[pace] : 1
}

// The slowest timed pace's factor: what Settings draws the others
// against, so the four read as one range.
export const LONGEST_FACTOR = Math.max(...Object.values(FACTOR).filter(f => f != null))
