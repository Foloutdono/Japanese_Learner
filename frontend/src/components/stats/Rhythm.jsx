import { useLang } from '../../LangContext'
import { bucketIntervals, qualityRows } from '../../domain/statsModel'
import { useRatingScale } from '../../stores/ratingScale'

// ── 調子 — how you study, not how much ─────────────────────
// Three small charts that read the same review log the counters above
// read, but along axes the app has never shown: the clock, the rating
// button, and the interval the scheduler landed on.
//
// All three are optional by construction — the backend wraps them
// (see routes/stats.py's _rhythm) so a failure costs a chart and not
// the page. Each renders nothing rather than an empty frame when its
// data is missing or all-zero, which is also the honest state for a
// brand new account.

// ── The day ───────────────────────────────────────────────
// Night is shaded behind the bars, so "I revise at 23:00" is legible
// as a fact about you and not just a tall column at the right edge.
export function StudyClock({ hours }) {
  const { t } = useLang()
  if (!hours?.length) return null

  const max = Math.max(...hours)
  if (max === 0) return null

  const total = hours.reduce((a, b) => a + b, 0)
  const peak = hours.indexOf(max)

  return (
    <div className="rhythm-panel">
      <div className="rhythm-panel__head">
        <span className="rhythm-panel__title">{t.studyClock}</span>
        <span className="rhythm-panel__note">{t.peakHour(String(peak).padStart(2, '0'))}</span>
      </div>

      <div className="clock">
        {hours.map((count, hour) => (
          <span
            key={hour}
            className={`clock__slot${hour < 6 || hour >= 21 ? ' clock__slot--night' : ''}`}
            title={`${String(hour).padStart(2, '0')}:00 — ${count}`}
          >
            <span
              className={`clock__bar${hour === peak ? ' clock__bar--peak' : ''}`}
              style={{ height: `${Math.max(count > 0 ? 6 : 1.5, (count / max) * 100)}%` }}
            />
          </span>
        ))}
      </div>

      <div className="clock__axis">
        {[0, 6, 12, 18].map(h => (
          <span key={h} className="clock__tick">{String(h).padStart(2, '0')}</span>
        ))}
        <span className="clock__tick">24</span>
      </div>

      <div className="rhythm-panel__foot">{t.reviewsCount(total.toLocaleString())}</div>
    </div>
  )
}

// ── The rating mix ────────────────────────────────────────
// Which button you actually press. Same ratings, same colours and same
// words as the rating bar itself, so it reads as a record of your own
// taps rather than a new vocabulary to learn — including which bar you
// grade with, so the rows are the buttons you are actually offered
// (plus any you pressed before switching).
export function RatingMix({ quality }) {
  const { t } = useLang()
  const scale = useRatingScale()
  const rows = qualityRows(quality, t, scale)
  const total = rows.reduce((n, r) => n + r.count, 0)
  if (!total) return null

  return (
    <div className="rhythm-panel">
      <div className="rhythm-panel__head">
        <span className="rhythm-panel__title">{t.ratingMix}</span>
        <span className="rhythm-panel__note">
          {t.goodOrBetter(Math.round((rows.filter(r => r.q >= 4).reduce((n, r) => n + r.count, 0) / total) * 100))}
        </span>
      </div>

      <div className="rating-mix">
        {rows.map(r => (
          <div key={r.q} className={`rating-mix__row rating-mix__row--q${r.q}`}>
            <span className="rating-mix__label">{r.label}</span>
            <span className="rating-mix__track">
              <span className="rating-mix__fill" style={{ width: `${(r.count / total) * 100}%` }} />
            </span>
            <span className="rating-mix__pct">{Math.round((r.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── The interval ladder ───────────────────────────────────
// Where the scheduler has pushed each card. This is the only chart in
// the app that shows the SRS itself working: a healthy deck is a wave
// travelling right over months; one that never leaves the bottom two
// rungs is being relearned forever.
export function IntervalLadder({ intervals }) {
  const { t } = useLang()
  const buckets = bucketIntervals(intervals)
  const total = buckets.reduce((n, b) => n + b.count, 0)
  if (!total) return null

  const max = Math.max(...buckets.map(b => b.count))
  // Everything a month out or further — the part of the deck that has
  // genuinely gone quiet.
  const settled = buckets.filter(b => b.min >= 21).reduce((n, b) => n + b.count, 0)

  return (
    <div className="rhythm-panel">
      <div className="rhythm-panel__head">
        <span className="rhythm-panel__title">{t.intervalLadder}</span>
        <span className="rhythm-panel__note">{t.settledShare(Math.round((settled / total) * 100))}</span>
      </div>

      <div className="ladder">
        {buckets.map(b => (
          <div key={b.key} className="ladder__row">
            <span className="ladder__label">{t[b.labelKey]}</span>
            <span className="ladder__track">
              <span
                className={`ladder__fill${b.min >= 21 ? ' ladder__fill--settled' : ''}`}
                style={{ width: `${b.count === 0 ? 0 : Math.max(2, (b.count / max) * 100)}%` }}
              />
            </span>
            <span className="ladder__count">{b.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
