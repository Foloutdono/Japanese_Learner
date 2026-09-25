// ── 試乗 — the first ride's walks round a run on the desk (plan 132) ──
// The stops the guide (components/guide/Guide.jsx, handed them as
// `stops`) walks while the ride stands on a run's three panels. The
// anchors are the panels' own `data-guide` names (RunPanel, CardPanel,
// RunLines, StudyStage's RunSide) and the ride's (ride.card, ride.rate,
// ride.sentence, ride.answer); the keys name the locale's guide<Key>
// sentences. A phone never walks them: its ride has no panels.

// The card ride (screens/RideRun.jsx). Before the first card is turned,
// every part of the run, left to right; once it is, the two that only
// speak then -- the details, open now, and the tiles' forecast.
export const TOUR_FRONT = Object.freeze([
  { anchor: 'run.records',  key: 'RideRecords',  radius: 'card' },
  { anchor: 'run.state',    key: 'RideState',    radius: 'card' },
  { anchor: 'run.verdicts', key: 'RideVerdicts', radius: 'card' },
  { anchor: 'run.keys',     key: 'RideKeys',     radius: 'card' },
  { anchor: 'run.rhythm',   key: 'RideRhythm',   radius: 'card' },
  { anchor: 'ride.card',    key: 'RideCard',     radius: 'card' },
  { anchor: 'ride.rate',    key: 'RideRate',     radius: 'card' },
  { anchor: 'run.side',     key: 'RideSealed',   radius: 'card' },
])
export const TOUR_BACK = Object.freeze([
  { anchor: 'run.side',     key: 'RideEntry',    radius: 'card' },
  { anchor: 'run.verdicts', key: 'RideForecast', radius: 'card' },
])

// The reading ride (screens/RideReading.jsx). Before the clock starts,
// every part of a practice run; once graded, the breakdown that opened
// and the line the sentence became.
export const TOUR_READ = Object.freeze([
  { anchor: 'run.records',   key: 'RideReadRecords',  radius: 'card' },
  { anchor: 'run.lines',     key: 'RideReadLines',    radius: 'card' },
  { anchor: 'run.keys',      key: 'RideReadKeys',     radius: 'card' },
  { anchor: 'run.rhythm',    key: 'RideReadRhythm',   radius: 'card' },
  { anchor: 'ride.sentence', key: 'RideReadSentence', radius: 'card' },
  { anchor: 'ride.answer',   key: 'RideReadAnswer',   radius: 'card' },
  { anchor: 'run.side',      key: 'RideReadSealed',   radius: 'card' },
])
export const TOUR_GRADED = Object.freeze([
  { anchor: 'run.side',  key: 'RideReadBreakdown', radius: 'card' },
  { anchor: 'run.lines', key: 'RideReadLine',      radius: 'card' },
])
