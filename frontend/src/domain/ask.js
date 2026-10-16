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

// ── 問 in the grammar tour (plan 204) ───────────────────────────────
// The tutorial a never-met point opens with (components/study/
// GrammarTour.jsx) asks through the same panel, mode "grammar". Each
// stop is a thread of its own, keyed by the point, so two points toured
// in one run never share one. Sealed while the stop's question is
// unanswered, for the practice runs' reason: before the guess, "what
// does it mean?" is the guess's answer key, and before a twist, the
// scene's reply or a quiz question is checked, the question's. Open on
// the rule once it is found, and on the results.

/** The lesson's markup (**strong**) taken off, for the model. */
const plain = s => (typeof s === 'string' ? s.replace(/\*\*/g, '') : '')
const lines = xs => xs.filter(Boolean).join('\n')

/** A quiz sentence as it reads answered: the blank filled with the right form. */
function filled(q, right) {
  if (!q.furigana?.length) return q.jp ?? ''
  const answer = q.kind === 'gap' ? String(right?.pattern ?? '').replace(/^[〜～]/, '') : right?.jp ?? ''
  return q.furigana.map(seg => (seg.blank ? answer : seg.text)).join('')
}

/** What a choice says, whichever kind of question offered it. */
const said = c => (c ? c.text ?? c.jp ?? c.pattern ?? '' : '')

/**
 * The thread, its context and whether it takes a question, for the stop
 * the tour stands on.
 *
 *   point  the gate's point, carrying `tour`
 *   at     { stop, twist, twistPick, twistDone, sceneDone, scenePick,
 *            qi, quizPick, quizDone }: the tour's own state at the stop
 */
export function tourAsk(point, at) {
  const tour = point?.tour ?? {}
  const stop = at?.stop ?? 'look'
  const key = `tour:${point?.raw_id ?? point?.pattern}:${stop === 'quiz' ? `quiz-${at.qi ?? 0}` : stop}`
  const base = {
    level: point?.level,
    point: `${point?.pattern ?? ''} — ${plain(point?.meaning)}`,
  }
  const examples = tour.look ?? []
  const shown = {
    ...base,
    sentence: lines(examples.map(ex => ex.jp)),
    translation: lines(examples.map(ex => ex.tr)),
    review: plain(tour.rule ?? point?.meaning),
  }
  let context = shown
  let open = false
  if (stop === 'found' || stop === 'terminus') {
    open = true
  } else if (stop.startsWith('twist-') && at.twist) {
    const tw = at.twist
    const right = tw.choices.find(c => c.correct)
    context = {
      ...base,
      sentence: tw.jp,
      translation: tw.tr,
      answer: said(tw.choices[at.twistPick]),
      review: lines([tw.ask, said(right), plain(tw.why)]),
    }
    open = Boolean(at.twistDone)
  } else if (stop === 'scene' && tour.scene) {
    const scene = tour.scene
    const right = scene.ask.choices.find(c => c.correct)
    const heard = [...scene.lines, scene.ask.cue, right && { jp: right.jp }].filter(Boolean)
    context = {
      ...base,
      sentence: lines(heard.map(l => l.jp)),
      translation: lines(heard.map(l => l.tr)),
      answer: said(scene.ask.choices[at.scenePick]),
      review: lines([scene.ask.task, plain(scene.ask.why), plain(scene.note)]),
    }
    open = Boolean(at.sceneDone)
  } else if (stop === 'quiz' && tour.quiz?.[at.qi ?? 0]) {
    const q = tour.quiz[at.qi ?? 0]
    const right = q.choices.find(c => c.correct)
    context = {
      ...base,
      sentence: q.kind === 'use' ? said(right) : filled(q, right),
      translation: q.tr,
      answer: said(q.choices[at.quizPick]),
      review: lines([q.ask, q.kind === 'meaning' ? said(right) : null, plain(q.why)]),
    }
    open = Boolean(at.quizDone)
  }
  return { key, context: askContext(context), open }
}

// ── 問 — the questions offered (recommended questions) ──────────────
// A thumb on a phone types a question slowly, and the questions a
// learner asks about a sentence are mostly the same few: why this
// particle and not its neighbour, how the point works, one more example
// of a word. So the panel offers up to SUGGESTIONS of them, written from
// what the question already carries -- the breakdown's words, the point
// -- and never from a model call: an offer costs nothing until it is
// tapped, and then it is one question like any typed one, under the
// same limits. Worded by the string table, so they are asked in the
// learner's language; one already asked is not offered again.

/** How many questions are offered at once. */
export const SUGGESTIONS = 3

// The particles a learner asks about, in the order they are offered, and
// the neighbour each is mistaken for (null: what does it mark here?).
const PARTICLES = [['は', 'が'], ['が', 'は'], ['へ', 'に'], ['に', null], ['で', null], ['を', null], ['も', null]]

/** A word entry's surface: "surface (reading): meaning" → "surface". */
const surfaceOf = w => (typeof w === 'string' ? w.split(/ \(|: /)[0].trim() : '')

// A content word worth another example: written in kanji, so not a
// particle, an ending or a kana-only filler.
const KANJI = /[一-龯㐀-䶿々]/

/**
 * The questions offered for a thread, in the order they are offered.
 *
 *   context  askContext's output (sentence, point, words …)
 *   t        the string table
 *   text     comprehension's wording: a text and its question
 *   asked    the questions the thread already holds
 */
export function askSuggestions(context, t, { text = false, asked = [] } = {}) {
  const out = []
  const words = (context?.words ?? []).map(surfaceOf).filter(Boolean)
  if (text) {
    out.push(t.askSugWhyRight, t.askSugWhere)
  } else {
    const present = new Set(words)
    const particle = PARTICLES.find(([p]) => present.has(p))
    if (particle) out.push(particle[1] ? t.askSugContrast(particle[0], particle[1]) : t.askSugMarks(particle[0]))
  }
  const point = (context?.point ?? '').split(' — ')[0].trim()
  if (point) out.push(t.askSugPoint(point))
  const word = words.find(w => KANJI.test(w))
  if (word) out.push(t.askSugExample(word))
  if (!text) out.push(t.askSugPolite, t.askSugCasual)
  // Typed or tapped, the same question: French copy welds its spaces
  // (locales/frenchSpacing), a typed one does not.
  const same = q => (q ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const seen = new Set(asked.map(same))
  return [...new Set(out)].filter(q => q && !seen.has(same(q))).slice(0, SUGGESTIONS)
}
