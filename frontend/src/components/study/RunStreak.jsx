import { useLang } from '../../LangContext'
import { useRunTally } from '../../stores/runTally'

// ── 連 — the run's streak, as a stamp (plan 178) ──────────────────
// The answers in a row rated good or better, in the head of a practice
// run (reading, translation, dictation, composition, comprehension).
// DESIGN.md, Motion: the streak is a stamp rally, not a flame -- so the
// run's is the rally's mark, the lacquer roundel an eki stamp is inked
// in, holding the count where the day's holds a weekday. It is pressed
// afresh on every answer that lengthens the run (keyed on the count, so
// the press replays) and gone the moment one breaks it: a streak of one
// is just an answer, and shows nothing.
//
// Read off this run's tally (stores/runTally) rather than kept by each
// screen: two of the five runs used to keep their own copy off a flag,
// as a flame, and the other three had none. The best of the run rides
// in the title and the accessible name.
const SHOWN_FROM = 2
const HOT_FROM = 5

export function RunStreak() {
  const { t } = useLang()
  const { streak, best } = useRunTally()
  if (streak < SHOWN_FROM) return null
  const name = `${t.streak}: ${t.runStreak(streak, best)}`
  return (
    <span
      key={streak}
      className={`run-streak${streak >= HOT_FROM ? ' run-streak--hot' : ''}`}
      style={{ '--stamp-tilt': `${((streak * 37) % 13) - 6}deg` }}
      role="img"
      aria-label={name}
      title={name}
    >
      <span className="run-streak__count" aria-hidden="true">{streak}</span>
    </span>
  )
}
