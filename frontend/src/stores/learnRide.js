import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { applyLearnRide } from './profileSummary'
import { KANA_STOPS, LEVEL_STOPS } from '../domain/lineProgress'
import { MODES } from '../domain/studyModes'

// ── 前回 — the last ride a Learn station boarded (plan 291) ──────────
// The phone's Learn gate offers the last run boarded from a line's stop
// again, in one tap (screens/LearnScreen.jsx, Resume). It is kept on the
// account (user_profiles.learn_ride, POST /api/profile/ride) and read
// back with the profile (`learnRide`), so a second device and a purged
// browser offer the same ride.
//
// A ride is a line's stop -- a JLPT level, or a kana set -- in one of
// that line's graded modes: the path a station boards,
// /learn/vocab/N4/vocab.flashcard.f2b. The browse (fast review) rates
// nothing and is no ride; a tier, a theme or a radical is not a stop of
// the line, and the row names a stop as a plate does. The server holds
// the same rule (routes/profile.py clean_ride) and refuses the rest.
const RIDE = /^\/learn\/(kana|vocab|kanji|grammar)\/([A-Za-z0-9_]+)\/([a-z0-9_.]+)$/
const STOPS = {
  kana: KANA_STOPS.map(s => s.key),
  vocab: LEVEL_STOPS,
  kanji: LEVEL_STOPS,
  grammar: LEVEL_STOPS,
}

/** {line, stop, mode, path} for a path that is a ride, else null. */
export function rideOf(path) {
  const match = RIDE.exec(path ?? '')
  if (!match) return null
  const [, line, stop, mode] = match
  const def = MODES[mode]
  if (!STOPS[line].includes(stop) || !def?.graded || def.source !== line) return null
  return { line, stop, mode, path }
}

/** A station boarded `path`: kept as the last ride if it is one. Set in
 *  the profile summary at once, so the gate offers it on the way back;
 *  written to the account behind it, quietly -- a ride not kept is a
 *  row not offered, never a reason to hold the run. */
export function noteRide(path) {
  if (!rideOf(path)) return
  applyLearnRide({ path, at: new Date().toISOString() })
  supabase.auth.getSession()
    .then(({ data }) => (data?.session
      ? apiFetch('/api/profile/ride', data.session, { method: 'POST', body: JSON.stringify({ path }) })
      : null))
    .catch(() => {})
}
