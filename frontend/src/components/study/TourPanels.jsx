import { useLang } from '../../LangContext'
import { CheckIcon, CrossIcon } from '../ui/Icons'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { LessonInline } from './GrammarLesson'
import { FuriganaParts } from './Readings'
import { stopsOf } from '../../domain/tourStops'

// ── 発見 on the desk: the tour's two side panels (plan 187f) ───────
// The owner's pick F of the canvas "Tsuji — grammar, learned by doing",
// drawn on the page "The process" (boards 11 and 12): the tour stands on
// the runs' three panels (plans 126, 129). The stop is the middle
// (GrammarTour with `desk`); at the left, the point over its stops as a
// line, each saying how it went; at the right, the plate, which fills in
// as each stop is passed -- the lines found, numbered, the ones not yet
// found sealed, the examples and the neighbour at the terminus. Both
// read the tour's own view (GrammarTour's `onView`): where it is, the
// misses, whether the rule was given, the twist's and the scene's
// answers. No key is printed on either (the owner's word).

/** How a stop went, as the line prints it beside the stop's name. */
function result(t, stop, i, view) {
  const passed = i < view.at
  const here = i === view.at
  if (stop === 'guess' && (passed || (here && view.misses > 0))) {
    if (passed && view.helped) return { text: t.tourRuleGiven }
    if (passed && view.misses === 0) return { ok: true }
    return { text: t.tourTries(view.misses), no: here }
  }
  if ((stop === 'twist' || stop === 'scene') && view[stop] != null) {
    return view[stop] ? { ok: true } : { no: true, text: t.tourMissed }
  }
  return passed ? { ok: true } : null
}

/** The left panel: the point, then its stops as one line. */
export function TourRoute({ point, view }) {
  const { t } = useLang()
  const tour = point.tour
  const stops = stopsOf(tour)
  const at = view?.at ?? 0
  return (
    <section className="tour-route" aria-label={t.tourRouteAria}>
      <div className="tour-route__head">
        <span className="tour-route__pattern" lang="ja">
          {point.pattern_furigana?.length ? <FuriganaParts parts={point.pattern_furigana} /> : point.pattern}
        </span>
        {point.structure && <span className="tour-route__structure">{point.structure}</span>}
      </div>
      <ol className="tour-route__stops">
        {stops.map((stop, i) => {
          const state = i < at ? 'done' : i === at ? 'here' : 'ahead'
          const res = view ? result(t, stop, i, { ...view, at }) : null
          return (
            <li key={stop} className={`tour-route__stop tour-route__stop--${state}`}
                aria-current={state === 'here' ? 'step' : undefined} data-stop={stop}>
              <span className="tour-route__dot" aria-hidden="true" />
              <span className="tour-route__name">{stop === 'scene' ? tour.scene.place_caption : t.tourStops[stop]}</span>
              {res && (
                <span className={`tour-route__res${res.no ? ' tour-route__res--no' : ''}${res.ok ? ' tour-route__res--ok' : ''}`}>
                  {res.ok ? <CheckIcon size={16} /> : res.no && !res.text ? <CrossIcon size={16} /> : res.text}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** The right panel: the plate, its lines found so far. */
export function TourLedger({ point, view }) {
  const { t } = useLang()
  const tour = point.tour
  const stops = stopsOf(tour)
  const at = view?.at ?? 0
  const found = stops.indexOf('found')
  const terminus = stops[at] === 'terminus'
  const first = tour.look[0]

  // The rule once it is found; the twist once it is answered; the
  // neighbour once the stop that met it is behind (the twist where there
  // is one, else the found).
  const lines = [{ open: at >= found, say: <LessonInline text={tour.rule ?? point.meaning} />, ex: first }]
  if (tour.twist) lines.push({ open: view?.twist != null || terminus, say: <LessonInline text={tour.twist.why} /> })
  if (tour.rival) {
    const met = tour.twist ? view?.twist != null : at > found
    lines.push({
      open: met || terminus,
      say: <span lang="ja">{t.tourNotLike(tour.rival.pattern)}</span>,
      note: <LessonInline text={tour.rival.text} />,
    })
  }

  return (
    <section className="tour-ledger" aria-label={t.tourLedgerAria}>
      <header className="tour-ledger__head">
        {point.structure && <p className="tour-ledger__structure">{point.structure}</p>}
        <p className="tour-ledger__pattern" lang="ja">
          {point.pattern_furigana?.length ? <FuriganaParts parts={point.pattern_furigana} /> : point.pattern}
        </p>
      </header>
      <div className="tour-ledger__edge" aria-hidden="true" />
      <ol className="tour-ledger__lines">
        {lines.map((line, i) => (
          <li key={i} className={`tour-ledger__line${line.open ? '' : ' tour-ledger__line--sealed'}`}>
            <span className="tour-ledger__n">{i + 1}</span>
            {line.open ? (
              <div className="tour-ledger__body">
                <p className="tour-ledger__say">{line.say}</p>
                {line.note && <p className="tour-ledger__note">{line.note}</p>}
                {line.ex && <ExampleSentence ex={{ ...line.ex, segments: line.ex.furigana }} showTr={false} />}
              </div>
            ) : (
              <span className="tour-ledger__sealed">{t.tourToFind}</span>
            )}
          </li>
        ))}
      </ol>
      {terminus ? (
        <div className="tour-ledger__examples">
          {tour.look.slice(1).map(ex => (
            <ExampleSentence key={ex.jp} ex={{ ...ex, segments: ex.furigana }} />
          ))}
        </div>
      ) : (
        <p className="tour-ledger__later">{t.tourLedgerLater}</p>
      )}
    </section>
  )
}
