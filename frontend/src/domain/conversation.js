// ── 会話 — the conversation platform, as the client reasons about it (plan 217) ──
// Someone speaks to the learner in a place and they answer. A scenario
// (backend/content/conversation, served by routes/conversation.py) is
// ridden three ways from the same turns: Choose among three replies,
// Translate what you are told to say, or Free talk with the other person
// played by the model. Pure: the paths, the modes and the shapes the two
// screens share, held to the server's own bounds.

export const BASE = '/practice/conversation'

export const MODES = ['choose', 'translate', 'free']

// The bank's id rule (study/conversation._ID): anything else in the URL
// is not a scenario, and the run sends it back to the station.
export const SCENARIO_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Learner lines in one free talk (study/conversation.MAX_TALK_TURNS):
// the server refuses the line past it.
export const MAX_TALK_TURNS = 8

/** The station, on a grade and a way of riding. Choose is its default,
 *  so it is left out of the address. */
export function stationPath(level, mode) {
  const params = new URLSearchParams()
  if (level) params.set('level', level)
  if (mode && mode !== MODES[0]) params.set('mode', mode)
  const query = params.toString()
  return query ? `${BASE}?${query}` : BASE
}

/** A scenario's run, ridden one way. */
export function runPath(id, mode) {
  return `${BASE}/${id}/${mode}`
}

/** A line of the talk as the scene draws it (GrammarTour's SceneLine):
 *  who says it, its Japanese, its furigana and its translation. `speak`
 *  voices a line the server's catalogue does not hold. */
export function sceneLine(key, who, line, speak = null) {
  return { key, who, jp: line.jp, furigana: line.parts ?? null, tr: line.translation ?? null, speak }
}

/** The talk so far as the server takes it back with each free line:
 *  who said what, nothing else. */
export function talkHistory(lines) {
  return lines.map(line => ({ who: line.who, jp: line.jp }))
}

/** How many lines the learner has said in a talk. */
export function linesSaid(lines) {
  return lines.filter(line => line.who === 'me').length
}
