import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { ratingButtons } from '../../domain/ratingScales'
import { useRatingScale } from '../../stores/ratingScale'
import { useRunTally } from '../../stores/runTally'
import { dueFigure, dueText } from '../../domain/forecast'
import { DeskFigure } from './RunRecords'

// ── 机 — the card panel, the second of a run's two left panels (plan 126) ──
// The run's instrument panel, under the session panel: what the card
// on the stage is and what each verdict would do to it, before the
// learner presses one.
//
//   - The card's state on a line with stops -- new, learning, learned
//     -- the train at the stage it is in (the card's `stage`).
//   - The verdicts as tiles, two by two, in the learner's own scale
//     (four or six, domain/ratingScales), worst to best as the rating
//     bar draws them, each a figure: when the card comes back as the
//     large numeral and its unit (`due_in`, by domain/forecast's
//     dueFigure), the verdict's word as its label beneath, the digit
//     that presses it in the corner -- off the card's own review_preview
//     (srs.py's preview_reviews_bulk), so nothing here waits on a round
//     trip. The tile says the wait in words to a screen reader.
//
// No caption on the panel or its parts and no line under an interval
// saying what the rating does to the card (owner's cut, for room and
// legibility): the stops, the tiles and the caps name themselves.
//   - The keys the elements no longer print on the desk (RunPanelsContext):
//     Space turns the card, C shows the choices, Esc leaves the run. The
//     digits are on the tiles above.
//   - The rhythm, on a sumi foot: minutes since the run started
//     (stores/runTally's startedAt), cards a minute, and an estimate of
//     what the remaining cards will take at that pace.
//
// Rendered by a run as StudyStage's `panel`, which draws it only on the
// desk's panels; a phone never mounts it.
const STAGES = ['new', 'learning', 'mastered']

function useClock(everyMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

export function CardPanel({ card, remaining = null }) {
  const { t, lang } = useLang()
  const scale = useRatingScale()
  const tally = useRunTally()
  const now = useClock(30000)

  const preview = card?.review_preview ?? null
  const stage = STAGES.includes(card?.stage) ? card.stage : 'new'
  // Best-first, as the bar's handler reads them, so the digit is the
  // button's position; drawn worst to best, as the bar draws them.
  const verdicts = ratingButtons(scale, t).map((b, i) => ({ ...b, digit: i + 1 })).reverse()

  const elapsed = tally.startedAt ? Math.max(0, now - tally.startedAt) : 0
  const minutes = Math.floor(elapsed / 60000)
  const perMinute = tally.reviewed > 0 && elapsed >= 60000 ? tally.reviewed / (elapsed / 60000) : null
  const toFinish = perMinute && remaining != null ? Math.ceil(remaining / perMinute) : null
  const decimal = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })

  return (
    <section className="desk-run__panel desk-card" aria-label={t.deskCardPanel}>
      <StateLine stage={stage} t={t} />
      <div className="desk-verdicts" role="list" aria-label={t.deskCardPanel}>
        {verdicts.map(({ q, label, digit }) => {
          const due = preview?.[String(q)]?.due_in
          const figure = dueFigure(due, t)
          return (
            <div key={q} role="listitem" className={`desk-verdict desk-verdict--q${q}`}>
              <kbd className="desk-kbd desk-verdict__key" aria-hidden="true">{digit}</kbd>
              <span className="desk-verdict__when" aria-hidden="true">
                <span className="desk-verdict__value">{figure ? figure.value : '—'}</span>
                {figure && <span className="desk-verdict__unit">{figure.unit}</span>}
              </span>
              <span className="desk-verdict__head">
                <span className="desk-verdict__dot" aria-hidden="true" />
                <span className="desk-verdict__word">{label}</span>
              </span>
              <span className="sr-only">{dueText(due, t)}</span>
            </div>
          )
        })}
      </div>
      <div className="desk-keys" role="list" aria-label={t.deskKeysTitle}>
        <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">{t.keySpace}</kbd>{t.deskKeyTurn}</span>
        <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">C</kbd>{t.deskKeyChoices}</span>
        <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">{t.keyEscape}</kbd>{t.deskKeyLeave}</span>
      </div>
      <div className="desk-rhythm" role="group" aria-label={t.deskRhythm}>
        <DeskFigure label={t.deskElapsed} value={minutes} unit="min" />
        <DeskFigure label={t.deskPerMinute} value={perMinute == null ? '—' : decimal.format(perMinute)} />
        <DeskFigure label={t.deskToFinish} value={toFinish == null ? '—' : `≈ ${toFinish}`} unit={toFinish == null ? null : 'min'} />
      </div>
    </section>
  )
}

// The card's line: three stops, the train above the one the card is
// at, the rail filled up to it -- the app's own drawing of distance
// (DESIGN.md, "A line with stops"), at the size of a caption. The
// stops stand at the centres of three equal columns so the labels
// under them line up without measuring.
function StateLine({ stage, t }) {
  const at = STAGES.indexOf(stage)
  const xs = [1 / 6, 1 / 2, 5 / 6].map(f => f * 300)
  const labels = [t.progressNew, t.progressLearning, t.progressMastered]
  return (
    <div className="desk-stops" role="img" aria-label={`${t.deskCardPanel} · ${labels[at]}`}>
      <svg className="desk-stops__line" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true">
        <line x1={xs[0]} y1="21" x2={xs[2]} y2="21" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <line x1={xs[0]} y1="21" x2={xs[at]} y2="21" stroke="var(--accent2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy="21" r="4" fill={i <= at ? 'var(--accent2)' : 'var(--bg-main)'} stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
        <rect x={xs[at] - 8} y="3" width="16" height="9" rx="2.5" fill="var(--accent2)" />
        <line x1={xs[at]} y1="12" x2={xs[at]} y2="17" stroke="var(--accent2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="desk-stops__labels" aria-hidden="true">
        {labels.map((l, i) => <span key={l} className={i === at ? 'desk-stops__here' : undefined}>{l}</span>)}
      </div>
    </div>
  )
}
