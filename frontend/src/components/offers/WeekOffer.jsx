import { useLang } from '../../LangContext'
import { PLANS, perMonth, yearlySaving, formatPrice, formatPercent } from '../../domain/paywall'
import { OfferFrame } from './OfferFrame'
import { OfferTicket } from './OfferTicket'
import { clockTime, dayLetter, weekDays } from './format'

// ── 2 · The week the credits stopped (plan 171) ────────────────────
// A free learner's run stopped at zero (the run-out sheet's door).
// The stage is their own last seven days (GET /api/credits/week): each
// day's paid reviews in the context gray, the reviews that waited for
// the balance hatched in --danger with a ✕ over the day (status never
// by colour alone), the free refill as a dashed ceiling. Then the
// ceiling lifts and what waited is reviewed, in white: what Pro would
// have done that week. A 7s loop; at rest, the week with the ceiling
// lifted. The words count the stops and the cards, and the ticket is
// Pro yearly at its month.

// The ceiling stands this many px over the plot's floor at a day's
// refill, and no bar grows past PLOT: a heavier week is scaled down.
const CEILING = 120
const PLOT = 190

export function WeekOffer({ week, waiting, credits, onTake, taken }) {
  const { t, lang } = useLang()
  const money = v => formatPrice(v, lang)
  const days = weekDays(week, waiting)
  const stops = Math.max(1, days.filter(d => d.waited > 0).length)
  const waited = days.reduce((n, d) => n + d.waited, 0)
  return (
    <OfferFrame
      kind="week"
      taken={taken}
      hero={<WeekStage days={days} cap={week?.cap ?? 30} stops={stops} waited={waited} />}
      quiet={t.ofrWeekLater(clockTime(credits?.nextCreditAt, lang))}
      clock
      cta={t.ofrWeekCta}
      onTake={onTake}
      fine={t.ofrWeekFine(money(PLANS.pro.monthly))}
    >
      <p className="ofr__eyebrow">{t.ofrWeekEyebrow}</p>
      <h1 className="ofr__title">{t.ofrWeekTitle(stops)}</h1>
      {waited > 0 && <p className="ofr__lede">{t.ofrWeekLede(waited)}</p>}
      <OfferTicket
        kind={t.ofrProYearKind}
        price={money(perMonth('pro', 'yearly'))}
        unit={t.ofrPerMonth}
        bill={t.ofrBilledYearly(money(PLANS.pro.yearly))}
        save={t.ofrSave(formatPercent(yearlySaving('pro'), lang))}
        cap={t.ofrSaveCap}
      />
    </OfferFrame>
  )
}

function WeekStage({ days, cap, stops, waited }) {
  const { t, lang } = useLang()
  const heaviest = Math.max(cap, ...days.map(d => d.reviewed + d.waited))
  // Px per card: the ceiling at CEILING, unless a day would overrun.
  const unit = Math.min(CEILING / cap, PLOT / heaviest)
  const px = n => Math.round(n * unit)
  return (
    <div className="ofr-week" role="img" aria-label={t.ofrWeekChart(stops, waited)}>
      <div className="ofr-week__head" aria-hidden="true">
        <span className="ofr-week__cap">{t.ofrWeekCap}</span>
        <span className="ofr-week__legend">
          <span><i className="ofr-week__key ofr-week__key--done" />{t.ofrWeekDone}</span>
          <span><i className="ofr-week__key ofr-week__key--wait" />{t.ofrWeekWaiting}</span>
          <span><i className="ofr-week__key ofr-week__key--cap" />{t.ofrWeekCeiling(cap)}</span>
        </span>
      </div>
      <div className="ofr-week__plot" aria-hidden="true">
        <div className="ofr-week__ceiling" style={{ '--ofr-h': px(cap) }} />
        {days.map((d, i) => (
          <div key={d.date} className="ofr-week__col" style={{ '--ofr-d': `${i * 60}ms` }}>
            <div className="ofr-week__stack">
              {d.waited > 0 && (
                <span className="ofr-week__wait" style={{ '--ofr-h': Math.max(6, px(d.waited)) }}>
                  <span className="ofr-week__x">
                    <svg viewBox="0 0 24 24" focusable="false"><path d="M7 7l10 10M17 7L7 17" /></svg>
                  </span>
                </span>
              )}
              {d.reviewed > 0 && <span className="ofr-week__done" style={{ '--ofr-h': px(d.reviewed) }} />}
            </div>
            <span className="ofr-week__day">{dayLetter(d.date, lang)}</span>
          </div>
        ))}
      </div>
      {waited > 0 && <p className="ofr-week__gain" aria-hidden="true">{t.ofrWeekGain(waited)}</p>}
    </div>
  )
}
