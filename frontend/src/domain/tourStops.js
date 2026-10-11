// ── 発見 — a tour's stops (plan 187) ─────────────────────────────
// Look, guess and found are every tour's; the scene, the twists and the
// quiz join before the terminus where the point's tour carries them
// (plans 187c, 194).
// A twist per notion the point has beyond the meaning the guess asks
// (plan 189), each a stop of its own: `twist-0`, `twist-1`… Read by the
// tour itself (components/study/GrammarTour.jsx) and, on the desk, by
// its two side panels (components/study/TourPanels.jsx).

/** The tour's twists, one per notion. A payload from before plan 189
    carried one `twist`, which is a list of one. */
export function twistsOf(tour) {
  return tour.twists ?? (tour.twist ? [tour.twist] : [])
}

/** The order the owner set (plan 194): analyse, guess, the rule, the
    point in context, then « C'est pas tout ! » -- each usage in turn --
    the quiz, and the results. */
export function stopsOf(tour) {
  return [
    'look', 'guess', 'found',
    tour.scene && 'scene',
    ...twistsOf(tour).map((_, i) => `twist-${i}`),
    tour.quiz?.length && 'quiz',
    'terminus',
  ].filter(Boolean)
}

/** How the quiz went: the questions answered right, of how many. */
export function quizScore(tour, picks) {
  const quiz = tour.quiz ?? []
  const right = quiz.filter((q, i) => picks?.[i] != null && q.choices[picks[i]]?.correct).length
  return { right, total: quiz.length }
}

/** What kind of stop it is: a twist's stop is `twist` whichever notion
    it holds, the others are their own name. */
export function stopKind(stop) {
  return stop.startsWith('twist-') ? 'twist' : stop
}

/** The twist a stop holds, by its place in the list, or -1. */
export function twistIndex(stop) {
  return stop.startsWith('twist-') ? Number(stop.slice(6)) : -1
}
