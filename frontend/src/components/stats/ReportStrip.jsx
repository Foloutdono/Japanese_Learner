import { useLang } from '../../LangContext'
import { RetentionLine } from './RetentionLine'
import { StrengthLadder } from './StrengthLadder'

// ── 実績 — the record's strip (plan 138) ──────────────────
// The four figures over the lines, as a hairline lattice: retention
// with its line beside it, the reviews behind the stop the line is
// asked about, the misses of the last MISS window, and the strength
// ladder. The first two are one question — the line is their door: a
// press, a sweep or a mouse over it asks another day or week, and both
// figures and the caption naming the stop follow it. The misses and
// the ladder are the whole record and do not move.
//
// The line is drawn low (STRIP_H) at its cell's own width, strokes 1:1
// on the phone as on the desk, with no axis under it: the caption says
// which stop is asked, and the stop in lacquer is the last one ridden.
const STRIP_H = 64

export function ReportStrip({ series, asked, askedLabel, describe, selected, onSelect, onPreview, misses, missWindow, strength }) {
  const { t } = useLang()
  const pct = asked?.pct ?? null
  return (
    <section className="rep-strip" aria-label={t.reportRetention}>
      <div className="rep-strip__cell rep-strip__cell--line">
        <div className="rep-strip__figs">
          <span className="rep-head">
            <span className="rep-fig rep-fig--heading">
              {pct === null ? '—' : pct}
              {pct !== null && <span className="rep-fig__u">%</span>}
            </span>
            {series.delta !== null && (
              <span className="rep-delta">
                {/* Over the span the line draws — the first ridden week
                    to this one — never the twelve the payload holds. */}
                {t.reportDelta(series.delta, series.points.length - series.firstIndex - 1)}
              </span>
            )}
          </span>
          <span className="rep-cap">{t.reportRetention}</span>
          <span className="rep-cap rep-strip__when">{askedLabel}</span>
        </div>
        <RetentionLine
          points={series.points}
          currentIndex={series.currentIndex}
          firstIndex={series.firstIndex}
          selected={selected}
          onSelect={onSelect}
          onPreview={onPreview}
          describe={describe}
          fit
          height={STRIP_H}
          axis={false}
        />
      </div>
      <div className="rep-strip__cell">
        <span className="rep-fig rep-fig--heading">{(asked?.reviews ?? 0).toLocaleString()}</span>
        <span className="rep-cap">{t.reportReviewsCap}</span>
      </div>
      <div className="rep-strip__cell">
        <span className="rep-fig rep-fig--heading">{misses.toLocaleString()}</span>
        <span className="rep-cap">{t.reportMisses(misses, missWindow)}</span>
      </div>
      <div className="rep-strip__cell rep-strip__cell--ladder">
        <StrengthLadder rungs={strength.rungs} total={strength.total} />
      </div>
    </section>
  )
}
