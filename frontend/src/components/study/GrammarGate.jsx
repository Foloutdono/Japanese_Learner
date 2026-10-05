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
// (TourPanels.jsx).
//
// The tour's terminus records how the point was met (POST
// /api/grammar/tour: the first tour only, never read by the scheduler)
// and boards like the lesson's button does. The record is a courtesy to
// the plate: a failed post never holds the run.
export function GrammarGate({ point, session, onCompare, onBoard, onLesson, onView }) {
  const desk = useDesk()
  if (point.tour) {
    const board = result => {
      apiJson('/api/grammar/tour', session, {
        method: 'POST',
        body: JSON.stringify({ raw_id: point.raw_id, tries: result.tries, helped: result.helped }),
      }).catch(() => {})
      onBoard?.()
    }
    return <GrammarTour point={point} onBoard={board} onLesson={onLesson} desk={desk} onView={onView} />
  }
  return <GrammarLesson point={point} variant="gate" onCompare={onCompare} onBoard={onBoard} />
}
