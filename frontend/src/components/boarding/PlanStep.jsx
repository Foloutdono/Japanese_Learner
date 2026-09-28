import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { Mark } from '../ui/Mark'
import { CHART_US, CHART_THEM, LINES, approx, axisLabel } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { BoardQuestion, Continue } from './BoardFrame'
import { CheckMark } from './icons'
import { PassError } from './PassStep'

// ── The plan (plan 075) ──────────────────────────────────────────
// The one screen that compares: the chart draws spaced reviews against
// cramming -- an illustration, and the card says so -- then the lead
// names the rhythm, the date and the motive, and four promises follow:
// the figures, two lines from the motive, the JLPT stop. Every figure
// comes from the learner's own answers (domain/boarding.js
// planFigures) and wears a ~.
//
// A ride to the novice's own stop is the exception, and the whole
// screen answers to it: three weeks of kana promise no word count and
// no JLPT stop, and the motive's two lines ("a drama without pausing")
// would be a lie told over signs. So the kana are what the chart
// climbs to and what the bullets promise -- the line beyond is named
// as what comes next, not as what this ride buys.

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

function Chart({ top, label, aria, from, to, minutes, lang, t }) {
  const us = points(CHART_US)
  const them = points(CHART_THEM)
  const [uxEnd, uyEnd] = us.split(' ').at(-1).split(',')
  const [txEnd, tyEnd] = them.split(' ').at(-1).split(',')
  return (
    <div className="brd-chart">
      <span className="brd-chart__title">{t.brdChartTitle}</span>
      <svg viewBox="0 0 326 150" role="img" aria-label={aria}>
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
        <text className="brd-chart__lbl" x={X1 - 52} y={Y1 + 14} textAnchor="end">{label}</text>
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

// `last` is the desk's (plan 140): there the pass is issued at the
// column's foot while the plan is read, so the pass's own screen folds
// away and the plan carries its button -- "Enter the station", with
// the office's answer over it (PassError) and no second press while it
// is being asked. On a phone the plan goes on to the pass, as it did.
//
// On the desk (plan 161) the plan is the owner's D08 instead: the ride
// drawn to scale (PlanRoute), `time` and `hour` the departure it leaves
// at every day.
export default function PlanStep({
  name, motive, rhythm, goal, lines = LINES, figures, now, onContinue, last = false, busy = false, error = null,
  time = null, hour = 'am',
}) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const dateLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(figures.date)
  const toNovice = goal === 'novice'
  const [line1, line2] = t.brdPromise[motive] ?? t.brdPromise.other
  // The figures promised are the chosen lines' and no other's: a
  // learner riding kanji alone is not promised words they will not be
  // shown. The words and the kanji are the headline figures, as they
  // always were; the grammar points are named only when they are all
  // the ticket holds -- seventy a level is not a figure to lead with,
  // and three figures no longer fit the bullet's one line on a short
  // phone. Each wears its ~ and its own rounding.
  const parts = [
    lines.includes('vocab') && t.brdFigWords(approx(figures.words, 100).toLocaleString(lang)),
    lines.includes('kanji') && t.brdFigKanji(approx(figures.kanji, 50).toLocaleString(lang)),
  ].filter(Boolean)
  if (parts.length === 0) parts.push(t.brdFigGrammar(approx(figures.grammar, 10).toLocaleString(lang)))
  const bullets = toNovice
    ? [t.brdBulletKana, t.brdBulletThenLine, t.brdOnTrackKana]
    : [
      t.brdBulletFigures(parts),
      line1,
      line2,
      goal ? t.brdOnTrack(goal) : t.brdOnTrackLine,
    ]
  // What the climbing line climbs to: the words when the words are on
  // the ticket, otherwise everything the chosen lines hold -- a chart
  // climbing to "~0 words" would promise a ride to nowhere. The floors
  // keep the axis honest on the beat before the volumes answer (and
  // if they never do).
  const inWords = lines.includes('vocab')
  const promised = inWords ? approx(figures.words, 100) : approx(figures.items - figures.kana, 100)
  const top = toNovice ? Math.max(50, figures.kana) : Math.max(300, promised)
  const topLabel = top.toLocaleString(lang)
  const chartLabel = toNovice ? t.brdChartLabelKana(topLabel) : inWords ? t.brdChartLabel(topLabel) : t.brdChartLabelItems(topLabel)
  const chartAria = toNovice ? t.brdChartAriaKana(topLabel) : inWords ? t.brdChartAria(topLabel) : t.brdChartAriaItems(topLabel)
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdPlanHint(rhythm, t.brdFor[motive] ?? t.brdFor.other) : null}>
          <Emphasized text={t.brdPlanQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        {desk ? (
          <div className="brd__stage">
            <PlanRoute motive={motive} rhythm={rhythm} goal={goal} lines={lines} figures={figures} now={now} time={time} hour={hour} />
          </div>
        ) : (
        <div className="brd__stage">
          <Chart
            top={top}
            label={chartLabel}
            aria={chartAria}
            from={now}
            to={figures.date}
            minutes={rhythm}
            lang={lang}
            t={t}
          />
          <p className="brd-lead">
            <Emphasized text={t.brdLead(rhythm, dateLabel, t.brdFor[motive] ?? t.brdFor.other)} strongClassName="brd-lead__em" />
          </p>
          <div className="brd-bullets">
            {bullets.map((b, i) => (
              <div className="brd-bullet" key={i}><CheckMark />{b}</div>
            ))}
          </div>
        </div>
        )}
      </div>
      <div className="brd__foot">
        {last && <PassError error={error} />}
        <Continue
          keys
          label={last ? t.brdEnter : t.onbContinue}
          onClick={onContinue}
          disabled={last && busy}
          data-action={last ? 'enter' : 'continue'}
        />
      </div>
    </>
  )
}

// ── 辻 — the ride drawn to scale (plan 161) ──────────────────────
// The owner's D08 on the desk: the route from today's departure -- the
// crossroads, 辻 -- to the terminus, every stop where its day falls: the
// kana read, two stations of the ride after them with what is known by
// then, and the terminus with its date. Under a rule, what the terminus
// holds on each line taken, beside what the ride is for (the motive's
// two promises). A ride to the novice's own stop has no stations after
// the kana: the kana are its terminus, and the line beyond is what
// comes next.
const GLYPHS = { vocab: '語', kanji: '漢', grammar: '文' }
const UNITS_ROUNDING = { vocab: 100, kanji: 50, grammar: 10 }
// Two stops need a fifth of the route between them for their names to
// be read apart: a kana stop close to the departure stands a fifth on.
const APART = 0.2

function PlanRoute({ motive, rhythm, goal, lines, figures, now, time, hour }) {
  const { t, lang } = useLang()
  const toNovice = goal === 'novice'
  const total = figures.days
  const kanaDays = figures.kana > 0 ? Math.min(total, Math.ceil(figures.kana / Math.max(1, rhythm))) : 0
  const dayOf = days => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const short = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const long = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  // What the stations after the kana count: the words where they ride,
  // or the first line taken.
  const counted = ['vocab', 'kanji', 'grammar'].find(line => lines.includes(line))
  const countOf = { vocab: figures.words, kanji: figures.kanji, grammar: figures.grammar }
  const figureOf = (line, n) => ({
    vocab: t.brdFigWords, kanji: t.brdFigKanji, grammar: t.brdFigGrammar,
  })[line](approx(n, line === 'grammar' ? 10 : 50).toLocaleString(lang))
  // The stations between: a third and two thirds of the way from the
  // kana to the terminus, each where it can be read apart from the rest.
  const stops = []
  if (!toNovice && counted) {
    for (const part of [1 / 3, 2 / 3]) {
      const days = Math.round(kanaDays + part * (total - kanaDays))
      const at = days / total
      if (at - kanaDays / total >= APART && 1 - at >= APART) {
        stops.push({ days, at, count: figureOf(counted, countOf[counted] * part) })
      }
    }
  }
  const kanaAt = kanaDays > 0 && !toNovice ? Math.max(APART, kanaDays / total) : null
  const terminus = toNovice ? t.brdTerminus(t.kanaTitle) : t.brdTerminus(`JLPT ${goal ?? ''}`.trim())
  const [line1, line2] = toNovice ? [t.brdBulletKana, t.brdBulletThenLine] : (t.brdPromise[motive] ?? t.brdPromise.other)
  const held = toNovice
    ? [{ key: 'kana', glyph: 'あ', n: approx(figures.kana, 10), unit: t.brdUnitKana }]
    : ['vocab', 'kanji', 'grammar'].filter(line => lines.includes(line)).map(line => ({
      key: line, glyph: GLYPHS[line], n: approx(countOf[line], UNITS_ROUNDING[line]), unit: t.brdUnit[line],
    }))
  return (
    <div className="desk-brd__plan">
      <ol className="desk-brd__route">
        <li className="desk-brd__halt desk-brd__halt--start" style={{ '--at': 0 }}>
          <span className="desk-brd__halt-when">
            <span className="desk-brd__halt-cap">{t.nudgeWhen.today}</span>
            <span className="desk-brd__halt-date">{short.format(now)}</span>
          </span>
          <span className="desk-brd__halt-ring desk-brd__halt-ring--hub"><Mark /></span>
          <span className="desk-brd__halt-lab">
            <b className="desk-brd__halt-name">{t.brdStop.time}</b>
            {time && <span>{t.brdAtTime(t.brdEvery[hour] ?? t.brdEvery.am, time)}</span>}
          </span>
        </li>
        {kanaAt != null && (
          <li className="desk-brd__halt desk-brd__halt--kana" style={{ '--at': kanaAt }}>
            <span className="desk-brd__halt-when">
              <span className="desk-brd__halt-cap">{t.brdInDays(kanaDays)}</span>
              <span className="desk-brd__halt-date">{short.format(dayOf(kanaDays))}</span>
            </span>
            <span className="desk-brd__halt-ring desk-brd__halt-ring--kana" lang="ja">あ</span>
            <span className="desk-brd__halt-lab">
              <b className="desk-brd__halt-name">{t.brdKanaDone}</b>
              <span>{t.brdBothScripts}</span>
            </span>
          </li>
        )}
        {stops.map(stop => (
          <li key={stop.days} className="desk-brd__halt desk-brd__halt--by" style={{ '--at': stop.at }}>
            <span className="desk-brd__halt-when">
              <span className="desk-brd__halt-date">{short.format(dayOf(stop.days))}</span>
            </span>
            <span className="desk-brd__halt-ring desk-brd__halt-ring--by" aria-hidden="true" />
            <span className="desk-brd__halt-lab"><b className="desk-brd__halt-name">{stop.count}</b></span>
          </li>
        ))}
        <li className="desk-brd__halt desk-brd__halt--end" style={{ '--at': 1 }}>
          <span className="desk-brd__halt-when">
            <span className="desk-brd__halt-cap">{t.brdInDays(total)}</span>
            <span className="desk-brd__halt-date">{long.format(figures.date)}</span>
          </span>
          <span className={`desk-brd__halt-ring desk-brd__halt-ring--end${toNovice ? ' desk-brd__halt-ring--jp' : ''}`} lang={toNovice ? 'ja' : undefined}>
            {toNovice ? 'あ' : goal}
          </span>
          <span className="desk-brd__halt-lab"><b className="desk-brd__halt-name">{terminus}</b></span>
        </li>
      </ol>
      <div className="desk-brd__plan-foot">
        <section className="desk-brd__held">
          <h2 className="desk-brd__plan-cap">{t.brdAtTerminus}</h2>
          <ul className="desk-brd__held-list">
            {held.map(h => (
              <li key={h.key} className="desk-brd__held-item" data-line={h.key}>
                <span className="desk-brd__held-ring" lang="ja" aria-hidden="true">{h.glyph}</span>
                <span className="desk-brd__held-txt">
                  <b className="desk-brd__held-fig">~{h.n.toLocaleString(lang)}</b>
                  <span className="desk-brd__held-unit">{h.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="desk-brd__for">
          <h2 className="desk-brd__plan-cap">{toNovice ? t.brdOnTrackKana : (t.brdFor[motive] ?? t.brdFor.other)}</h2>
          <ul className="desk-brd__for-list">
            {[line1, line2].map(line => <li key={line} className="desk-brd__for-item"><CheckMark />{line}</li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}
