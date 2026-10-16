import { apiJson } from '../../lib/api'
import { useDesk } from '../../hooks/useDesk'
import { GrammarLesson } from './GrammarLesson'
import { GrammarTour } from './GrammarTour'

// ── The gate before a never-met grammar card ──────────────────────
// What a run shows in the card's place the first time a point comes up
// (GrammarRun since plan 087, TodayRun since plan 186b): the tour where
// the point carries one (plan 187b, components/study/GrammarTour.jsx),
// else the lesson as it was -- a point the tour cannot be drawn on
// (study/grammar_tour.py says which). On the desk (plan 187f) the tour is
// the middle of the run's three panels, and `onView` tells the run where
// it stands, for the stops at the left and the plate at the right
// (TourPanels.jsx). `ask` is the run's useAsk, for the tour's 問
// (plan 204).
//
// The tour's terminus records how the point was met (POST
// /api/grammar/tour: the first tour only, never read by the scheduler)
// and boards like the lesson's button does. The record is a courtesy to
// the plate: a failed post never holds the run.
//
// Skipped (plan 222), the tour boards its card and records nothing: the
// point was not met by its tour, and once its card is rated it is
// studied, which is what stops the tour being asked again (routes/
// grammar.py's mark_tutorials). Left before the card is rated, the
// tour is offered again next time, with its skip.
export function GrammarGate({ point, session, onCompare, onBoard, onLesson, onView, ask = null }) {
  const desk = useDesk()
  if (point.tour) {
    const board = result => {
      apiJson('/api/grammar/tour', session, {
        method: 'POST',
        body: JSON.stringify({
          raw_id: point.raw_id, tries: result.tries, helped: result.helped,
          quiz_right: result.quizRight ?? null, quiz_total: result.quizTotal ?? null,
        }),
      }).catch(() => {})
      onBoard?.()
    }
    return <GrammarTour point={point} onBoard={board} onSkip={() => onBoard?.()} onLesson={onLesson} desk={desk} onView={onView} ask={ask} />
  }
  // A point no tour can be drawn on is met by its lesson; that is its
  // tutorial, recorded so that it is due once per point (plan 194).
  const boardLesson = () => {
    apiJson('/api/grammar/tour', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: point.raw_id, tries: 0, helped: false }),
    }).catch(() => {})
    onBoard?.()
  }
  return <GrammarLesson point={point} variant="gate" onCompare={onCompare} onBoard={boardLesson} />
}
