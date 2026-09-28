// ── 試乗 — the first ride's stops on the desk (plan 133) ──
// The stops the guide (components/guide/Guide.jsx, handed them as
// `stops`) shows while the ride stands on a run's three panels. The
// anchors are the panels' own `data-guide` names (StudyStage's
// RunSide); the keys name the locale's guide<Key> sentences. A phone
// never walks them: its ride has no panels.
//
// One stop a ride, on the one feature the ride's own notes cannot
// point at, at the moment it first opens. The ride once walked every
// part of both runs (nineteen stops: the figures, the card's state,
// the keys, the rhythm, the lines, the forecast); that was more than a
// learner on their first card can hold, and the notes already teach
// the card, the grade and the sentence. The rest is found by using it.

// The card ride (screens/RideRun.jsx): the known card, once turned --
// its dictionary entry, docked beside it, where a phone opens it from 🔍.
export const TOUR_BACK = Object.freeze([
  { anchor: 'run.side', key: 'RideEntry', radius: 'card' },
])

// The reading ride (screens/RideReading.jsx): the sentence, once
// graded -- its breakdown, opened beside it.
export const TOUR_GRADED = Object.freeze([
  { anchor: 'run.side', key: 'RideReadBreakdown', radius: 'card' },
])
