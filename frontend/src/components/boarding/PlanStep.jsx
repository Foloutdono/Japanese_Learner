import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { CHART_US, CHART_THEM, approx, axisLabel } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'
import { CheckMark } from './icons'

// ── The plan (plan 075) ──────────────────────────────────────────
// The one screen that compares: the chart draws spaced reviews against
// cramming -- an illustration, and the card says so -- then the lead
// names the rhythm, the date and the motive, and four promises follow:
// the figures, two lines from the motive, the JLPT stop. Every figure
// comes from the learner's own answers (domain/boarding.js
// planFigures) and wears a ~.

// The chart's box, the canvas's own: 326×150, the plot from x 28..304
// and y 140 (nothing) to 10 (everything promised).
const X0 = 28, X1 = 304, Y0 = 140, Y1 = 10
const GRID = [0, 1 / 3, 2 / 3, 1]

function points(fractions) {
  const dx = (X1 - X0) / (fractions.length - 1)
  return fractions.map((f, i) => `${Math.round(X0 + i * dx)},${Math.round(Y0 - f * (Y0 - Y1))}`).join(' ')
}

function monthLabel(date, lang, withYear = false) {
  const opts = withYear ? { month: 'short', year: 'numeric' } : { month: 'short' }
  return new Intl.DateTimeFormat(lang, opts).format(date).replace('.', '').toUpperCase()
}

function Chart({ words, from, to, minutes, lang, t }) {
  const top = Math.max(300, approx(words, 100))
  const us = points(CHART_US)
  const them = points(CHART_THEM)
  const [uxEnd, uyEnd] = us.split(' ').at(-1).split(',')
  const [txEnd, tyEnd] = them.split(' ').at(-1).split(',')
  return (
    <div className="brd-chart">
      <span className="brd-chart__title">{t.brdChartTitle}</span>
      <svg viewBox="0 0 326 150" role="img" aria-label={t.brdChartAria(top.toLocaleString(lang))}>
        {GRID.map(g => {
          const y = Math.round(Y0 - g * (Y0 - Y1))
          return <line key={g} className="brd-chart__grid" x1={X0} y1={y} x2={X1} y2={y} />
        })}
        {GRID.slice(1).map(g => (
          <text key={g} className="brd-chart__axis" x={X0 - 4} y={Math.round(Y0 - g * (Y0 - Y1)) + 3} textAnchor="end">
            {axisLabel(Math.round(top * g))}
          </text>
        ))}
        <text className="brd-chart__axis" x={X0} y="150" textAnchor="start">{monthLabel(from, lang)}</text>
        <text className="brd-chart__axis" x={X1} y="150" textAnchor="end">{monthLabel(to, lang, true)}</text>
        <polyline className="brd-chart__line brd-chart__line--them" points={them} />
        <polyline className="brd-chart__line brd-chart__line--us" points={us} />
        <circle className="brd-chart__dot brd-chart__dot--them" cx={txEnd} cy={tyEnd} r="4" />
        <circle className="brd-chart__dot brd-chart__dot--us" cx={uxEnd} cy={uyEnd} r="4" />
        <text className="brd-chart__lbl" x={X1 - 52} y={Y1 + 14} textAnchor="end">{t.brdChartLabel(top.toLocaleString(lang))}</text>
        <text className="brd-chart__lbl brd-chart__lbl--soft" x={X1 - 6} y={Number(tyEnd) + 16} textAnchor="end">{t.brdChartCram}</text>
      </svg>
      <div className="brd-legend">
        <span className="brd-legend__key"><i className="brd-legend__swatch" />{t.brdLegendUs(minutes)}</span>
        <span className="brd-legend__key"><i className="brd-legend__swatch brd-legend__swatch--them" />{t.brdLegendThem}</span>
      </div>
      <span className="brd-chart__cap">{t.brdChartCap}</span>
    </div>
  )
}

export default function PlanStep({ name, motive, rhythm, goal, figures, now, onContinue }) {
  const { t, lang } = useLang()
  const dateLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(figures.date)
  const [line1, line2] = t.brdPromise[motive] ?? t.brdPromise.other
  const bullets = [
    t.brdBulletFigures(approx(figures.words, 100).toLocaleString(lang), approx(figures.kanji, 50).toLocaleString(lang)),
    line1,
    line2,
    goal ? t.brdOnTrack(goal) : t.brdOnTrackLine,
  ]
  return (
    <>
      <div className="brd__body brd__body--arrival">
        <BoardQuestion>
          <Emphasized text={t.brdPlanQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage">
          <Chart words={figures.words} from={now} to={figures.date} minutes={rhythm} lang={lang} t={t} />
          <p className="brd-lead">
            <Emphasized text={t.brdLead(rhythm, dateLabel, t.brdFor[motive] ?? t.brdFor.other)} strongClassName="brd-lead__em" />
          </p>
          <div className="brd-bullets">
            {bullets.map((b, i) => (
              <div className="brd-bullet" key={i}><CheckMark />{b}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}
