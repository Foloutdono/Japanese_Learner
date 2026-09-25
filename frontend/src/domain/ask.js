// ── 問 — what a question about an exercise carries (plan 131) ──────────
// The asking (components/study/AskPanel.jsx) sends the model what is on
// the learner's three panels, and nothing else: the sentence (or the
// text), its translation, the learner's answer, the point, the tutor's
// review, the breakdown's words. Pure, so it is held in the node lane
// (domain/ask.test.js); the server bounds every field again
// (backend/routes/ask.py) and fences it.

/** The field's own bound, the server's MAX_QUESTION. */
export const MAX_QUESTION = 200
/** Earlier exchanges sent back with a question (the server's MAX_HISTORY). */
export const MAX_HISTORY = 4
/** Questions a sentence keeps: the history plus the one being asked. */
export const MAX_TURNS = MAX_HISTORY + 1
/** Words from the breakdown, at most, and each at most this long. */
const MAX_WORDS = 40
const MAX_WORD = 120

const clip = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

/**
 * The breakdown's words as the model reads them: "surface (reading):
 * meaning", the reading only where it differs from the surface, a word
 * with no meaning left out (a particle's row says what it marks, so it
 * stays).
 */
export function askWords(analysis) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const out = []
  for (const tok of tokens) {
    const surface = tok?.surface?.trim()
    const meaning = (tok?.meaning ?? tok?.vocab_match?.entry?.meaning ?? '').trim()
    if (!surface || !meaning) continue
    const reading = tok.reading && tok.reading !== surface ? ` (${tok.reading})` : ''
    out.push(clip(`${surface}${reading}: ${meaning}`, MAX_WORD))
    if (out.length === MAX_WORDS) break
  }
  return out
}

/**
 * What one question carries about its exercise, each field bounded to
 * the server's own limits so a long passage or review is cut rather
 * than refused.
 */
export function askContext({ sentence, level, translation, answer, point, review, analysis } = {}) {
  return {
    sentence: clip(sentence, 1200),
    level: clip(level, 4),
    translation: clip(translation, 600),
    answer: clip(answer, 300),
    point: clip(point, 200),
    review: clip(review, 1500),
    words: askWords(analysis),
  }
}

/** The thread's answered exchanges, the last MAX_HISTORY, as the server takes them. */
export function askHistory(thread = []) {
  return thread
    .filter(x => x.state === 'done' && x.answer)
    .slice(-MAX_HISTORY)
    .map(x => ({ question: clip(x.question, MAX_QUESTION), answer: clip(x.answer, 800) }))
}

/** When a spent day's questions come back, from the 429's detail ("… resets 2026-09-26T22:00Z"). */
export function askResetsAt(detail) {
  const m = typeof detail === 'string' ? detail.match(/resets (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/) : null
  return m ? m[1] : null
}

/**
 * Which thread the panel shows, about what, and whether it takes a
 * question: the line reopened from the run's list when there is one
 * (graded by definition, its context as it was committed, its words
 * from its breakdown as it stands now), else the exercise on the stage,
 * open once graded.
 *
 *   opened  the run's opened line (hooks/useRunLines), or null
 *   now     { key, base, analysis, open } for the exercise on the stage;
 *           `base` is askContext's input less the breakdown
 */
export function askTarget(opened, now) {
  if (opened) {
    const base = opened.ask ?? { sentence: opened.jp, translation: opened.translation }
    return { key: opened.key, context: askContext({ ...base, analysis: opened.analysis }), open: true }
  }
  return { key: now?.key ?? null, context: askContext({ ...(now?.base ?? {}), analysis: now?.analysis }), open: Boolean(now?.open) }
}
