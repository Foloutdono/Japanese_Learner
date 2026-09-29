import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { Mark } from '../ui/Mark'
import { LINES, approx } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { BoardQuestion, Continue } from './BoardFrame'
import { CheckMark } from './icons'
import { PassError } from './PassStep'

// ── The plan (plan 075) ──────────────────────────────────────────
// The one screen that says where the ride arrives and when. Every figure
// comes from the learner's own answers (domain/boarding.js planFigures)
// and wears a ~. On a phone (plan 167, the owner's pick ② of A-Le plan)
// the arrival comes first -- the terminus and its date at the specimen
// rung -- then the ride as one line under it, what the terminus holds on
// each line taken, and what the ride is for. On the desk (plan 163) the
// ride is drawn to scale beside what it holds (PlanRoute).
//
// A ride to the novice's own stop is the exception, and both answer to
// it: three weeks of kana promise no word count and no JLPT stop, and
// the motive's lines ("a drama without pausing") would be a lie told
// over signs. So the kana are what the ride arrives at and what it
// holds -- the line beyond is named as what comes next, not as what this
// ride buys.

// `last` is the desk's (plan 140): there the pass is issued at the
// column's foot while the plan is read, so the pass's own screen folds
// away and the plan carries its button -- "Enter the station", with
// the office's answer over it (PassError) and no second press while it
// is being asked. On a phone the plan goes on to the pass, as it did.
//
// On the desk (plan 163) the plan is the owner's D08 instead: the ride
// drawn to scale (PlanRoute), `time` and `hour` the departure it leaves
// at every day.
export default function PlanStep({
  name, motive, rhythm, goal, lines = LINES, figures, now, onContinue, last = false, busy = false, error = null,
  time = null, hour = 'am',
}) {
  const { t } = useLang()
  const desk = useDesk()
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
            <Arrival motive={motive} rhythm={rhythm} goal={goal} lines={lines} figures={figures} now={now} time={time} hour={hour} />
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

// ── 辻 — the ride drawn to scale (plan 163) ──────────────────────
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

// ── 辻 on a phone — the arrival first (plan 167) ─────────────────
// The terminus and its day at the specimen rung, its year beside it,
// and when the ride takes to get there; the ride as one line under it --
// today, the kana read, two halts counting what is known by then, the
// terminus -- each halt named over or under the line in turn so no two
// meet; what the terminus holds on each line taken; and what the ride is
// for, the motive's first promise.
//
// On the canvas's 358px stage (brd-map): the line from today's hub to
// the terminus, every halt where its day falls on it.
const RIDE_X0 = 8
const RIDE_X1 = 344
const rideX = at => RIDE_X0 + at * (RIDE_X1 - RIDE_X0)

function Arrival({ motive, rhythm, goal, lines, figures, now, time, hour }) {
  const { t, lang } = useLang()
  const toNovice = goal === 'novice'
  const total = Math.max(1, figures.days)
  const kanaDays = figures.kana > 0 && !toNovice ? Math.min(total, Math.ceil(figures.kana / Math.max(1, rhythm))) : 0
  const dayOf = days => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const short = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const counted = LINES.find(line => lines.includes(line))
  const countOf = { vocab: figures.words, kanji: figures.kanji, grammar: figures.grammar }
  const figureOf = (line, n) => ({
    vocab: t.brdFigWords, kanji: t.brdFigKanji, grammar: t.brdFigGrammar,
  })[line](approx(n, line === 'grammar' ? 10 : 50).toLocaleString(lang))
  // The halts: the kana read, then a third and two thirds of the way on
  // to the terminus, each kept a fifth of the ride from the next.
  const halts = []
  if (kanaDays > 0) halts.push({ key: 'kana', at: kanaDays / total, label: `${t.kanaTitle} · ${short.format(dayOf(kanaDays))}` })
  if (!toNovice && counted) {
    for (const part of [1 / 3, 2 / 3]) {
      const days = Math.round(kanaDays + part * (total - kanaDays))
      const at = days / total
      if (at - kanaDays / total >= APART && 1 - at >= APART) {
        halts.push({ key: `by${days}`, at, label: `${figureOf(counted, countOf[counted] * part)} · ${short.format(dayOf(days))}` })
      }
    }
  }
  const end = toNovice ? t.kanaTitle : goal
  const [promise] = toNovice ? [t.brdBulletKana] : (t.brdPromise[motive] ?? t.brdPromise.other)
  const purpose = toNovice ? t.brdOnTrackKana : (t.brdFor[motive] ?? t.brdFor.other)
  const held = toNovice
    ? [{ key: 'kana', glyph: 'あ', n: approx(figures.kana, 10), unit: t.brdUnitKana }]
    : LINES.filter(line => lines.includes(line)).map(line => ({
      key: line, glyph: GLYPHS[line], n: approx(countOf[line], UNITS_ROUNDING[line]), unit: t.brdUnit[line],
    }))
  const long = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  const ride = [t.nudgeWhen.today, ...halts.map(h => h.label), `${end} · ${long.format(figures.date)}`]
  return (
    <div className="brd-plan">
      <div className="brd-plan__arrive">
        <p className="brd-plan__cap">{toNovice ? t.brdTerminus(t.kanaTitle) : t.brdTerminus(`JLPT ${goal ?? ''}`.trim())}</p>
        <p className="brd-plan__date">
          <span className="brd-plan__day">{short.format(figures.date)}</span>
          <span className="brd-plan__year">{figures.date.getFullYear()}</span>
        </p>
        <p className="brd-plan__sub"><Emphasized text={t.brdArriveIn(total, t.brdEvery[hour] ?? t.brdEvery.am, time)} /></p>
      </div>
      <div className="brd-map brd-ride" style={{ '--h': 76 }} role="img" aria-label={ride.join(' → ')}>
        <svg className="brd-map__lines" viewBox="0 0 358 76" preserveAspectRatio="none" aria-hidden="true">
          <path className="brd-ride__line" d={`M${RIDE_X0} 40H${RIDE_X1}`} />
        </svg>
        <span className="brd-ride__stop brd-ride__stop--today brd-map__at" style={{ '--x': RIDE_X0, '--y': 40 }} />
        {halts.map(h => (
          <span key={h.key} className={`brd-ride__stop brd-ride__stop--${h.key === 'kana' ? 'kana' : 'by'} brd-map__at`} style={{ '--x': rideX(h.at), '--y': 40 }} />
        ))}
        <span className="brd-ride__stop brd-ride__stop--end brd-map__at" style={{ '--x': RIDE_X1, '--y': 40 }} />
        <span className="brd-ride__lab brd-ride__lab--under brd-ride__lab--today" aria-hidden="true">{t.nudgeWhen.today}</span>
        {halts.map((h, i) => (
          <span
            key={h.key}
            className={`brd-ride__lab brd-ride__lab--${i % 2 ? 'under' : 'over'}`}
            // A plain number, placed by the sheet: the halt's place on the line.
            style={{ '--x': rideX(h.at) }}
            aria-hidden="true"
          >
            {h.label}
          </span>
        ))}
        <span className="brd-ride__lab brd-ride__lab--under brd-ride__lab--end" aria-hidden="true">{end}</span>
      </div>
      <ul className="brd-held">
        {held.map(h => (
          <li key={h.key} className="brd-held__cell" data-line={h.key}>
            <span className="brd-held__jp" lang="ja" aria-hidden="true">{h.glyph}</span>
            <b className="brd-held__fig">~{h.n.toLocaleString(lang)}</b>
            <span className="brd-held__unit">{h.unit}</span>
          </li>
        ))}
      </ul>
      <p className="brd-for">
        <CheckMark />
        <span><Emphasized text={t.brdForLine(purpose, promise)} /></span>
      </p>
    </div>
  )
}
