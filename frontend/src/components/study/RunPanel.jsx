import { useLang } from '../../LangContext'
import { LevelBar } from '../chrome/LevelBar'
import { RunRecords } from './RunRecords'
import { DeckLegend } from './QuizComponents'

// ── 机 — the session panel, the first of a run's two left panels (plan 126) ──
// What the desk's width buys at the left of a card run: this run in
// figures (RunRecords, the remaining count among them, which leaves the
// head's pill for the panel), the level bar as a row of the panel rather
// than a strip on the floor -- the same LevelBar, so the fare still
// rises off its figure and the pass's gold still climbs -- and the
// deck's composition as the legend the hairline no longer prints on the
// desk. No caption: the figures name themselves (owner's cut).
//
// Rendered by StudyStage only where the desk lays a run out on panels;
// a phone never mounts it. `remaining` is what the run knows of its
// queue (Today's due count), null where a run counts nothing. A
// practice run (plan 128) has no deck to draw the legend of, and names
// what it rates (`label`: sentences, questions).
export function RunPanel({ remaining = null, progress = null, done = false, label = null }) {
  const { t } = useLang()
  return (
    <section className="desk-run__panel desk-session" aria-label={t.deskRunLabel}>
      <RunRecords done={done} remaining={remaining} label={label} />
      <LevelBar />
      <DeckLegend stats={progress} />
    </section>
  )
}
