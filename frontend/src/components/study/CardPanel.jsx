import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { ratingButtons } from '../../domain/ratingScales'
import { useRatingScale } from '../../stores/ratingScale'
import { useRunTally } from '../../stores/runTally'
import { dueFigure, dueText } from '../../domain/forecast'
import { DeskFigure } from './RunRecords'
import { STAGES, cardProgress, stripFills } from '../../domain/cardProgress'

// ── 机 — the card panel, the second of a run's two left panels (plan 126) ──
// The run's instrument panel, under the session panel: what the card
// on the stage is and what each verdict would do to it, before the
// learner presses one.
//
//   - The card's state on a fare strip -- new, learning, learned --
//     filled to the stage it is in and how far through it (the card's
//     `stage` and `progress`, plan 147).
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
//     digits are on the tiles above. The readings drill (`keys="readings"`)
//     turns nothing: there, a comma or a space adds a reading to the box
//     and Enter checks (ReadingsInput). The first ride (`keys="ride"`,
//     plan 133) has no choices to show, so no C.
//   - The rhythm, on a sumi foot: minutes since the run started
//     (stores/runTally's startedAt), cards a minute, and an estimate of
//     what the remaining cards will take at that pace.
//
// Rendered by a run as StudyStage's `panel`, which draws it only on the
// desk's panels; a phone never mounts it.

function useClock(everyMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

export function CardPanel({ card, remaining = null, keys = 'card' }) {
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
      <StateLine stage={stage} progress={card?.progress} t={t} />
      <div className="desk-verdicts" role="list" aria-label={t.deskCardPanel} data-guide="run.verdicts">
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
      <div className="desk-keys" role="list" aria-label={t.deskKeysTitle} data-guide="run.keys">
        {keys === 'readings' ? (
          <>
            <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">,</kbd><kbd className="desk-kbd">{t.keySpace}</kbd>{t.deskKeyAddReading}</span>
            <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">{t.keyEnter}</kbd>{t.deskKeyCheck}</span>
          </>
        ) : (
          <>
            <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">{t.keySpace}</kbd>{t.deskKeyTurn}</span>
            {keys === 'card' && <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">C</kbd>{t.deskKeyChoices}</span>}
          </>
        )}
        <span role="listitem" className="desk-keys__item"><kbd className="desk-kbd">{t.keyEscape}</kbd>{t.deskKeyLeave}</span>
      </div>
      <div className="desk-rhythm" role="group" aria-label={t.deskRhythm} data-guide="run.rhythm">
        <DeskFigure label={t.deskElapsed} value={minutes} unit="min" />
        <DeskFigure label={t.deskPerMinute} value={perMinute == null ? '—' : decimal.format(perMinute)} />
        <DeskFigure label={t.deskToFinish} value={toFinish == null ? '—' : `≈ ${toFinish}`} unit={toFinish == null ? null : 'min'} />
      </div>
    </section>
  )
}

// The card's line as a fare strip (plan 147, the owner's pick D): three
// stretches, one a stage, the stages behind the card full, the one it
// stands at filled by how far it has come (domain/cardProgress's
// stripFills) -- a new card its first stretch, a card in learning the
// middle one to its progress, a mastered card the whole strip. Each
// stretch in its stage's pigment, the labels under them on the same
// three columns so they line up without measuring. Where plan 126's
// line put a train above the stop, this says how far along it is.
function StateLine({ stage, progress, t }) {
  const at = STAGES.indexOf(stage)
  const labels = [t.progressNew, t.progressLearning, t.progressMastered]
  const fills = stripFills(stage, progress)
  const percent = Math.round((cardProgress(stage, progress) ?? 0) * 100)
  const said = stage === 'learning' ? `${labels[at]} · ${percent} %` : labels[at]
  return (
    <div className="desk-stops" role="img" aria-label={`${t.deskCardPanel} · ${said}`} data-guide="run.state">
      <div className="desk-stops__strip" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s} className={`desk-stops__leg desk-stops__leg--${s}`}>
            <span className="desk-stops__fill" style={{ '--leg': fills[i] }} />
          </span>
        ))}
      </div>
      <div className="desk-stops__labels" aria-hidden="true">
        {labels.map((l, i) => <span key={l} className={i === at ? 'desk-stops__here' : undefined}>{l}</span>)}
      </div>
    </div>
  )
}
