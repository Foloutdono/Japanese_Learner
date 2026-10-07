import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { EnterKey } from '../chrome/DeskKeys'
import { ClearHeader, Slot, GateButton, WEEK_TILTS, useBeats } from './kit'
import { dayName, weekParts } from './aria'
import { useReducedMotion } from './useReducedMotion'
import { LINE_COLOR } from '../../config/tabs'
import { laneCount, laneTypeOf } from '../../domain/lanes'

// ── 運休 — a rest day covered a missed one (plan 191) ─────────────────
// The canvas's RestDay board, shown once on Today the morning after: the
// week as seven stations on one line, the missed day covered by a 運休
// stub (pass ink, never stamp ink) and today waiting; "Ta série tient"
// and the streak kept, as large as the board draws it; the rest days
// left and when the next comes; today's ride (its count, its minutes and
// a stripe of each line's share) and the gate "Départ". TodayScreen
// shows it while `today.rest.unseen` names a day, and marks it seen
// (POST /api/today/rest/seen) the moment it leaves, by Départ or any
// other way out.
//
// The entrance tells it once, on the board's own clock: the stations
// arrive, the line runs to the day before the miss and stops there, the
// stub is laid over the missed day (from above, a turn, one settle, a
// breath of pass ink where it lands), the line goes on through it and
// dashes to today, then the streak, the reserve, today's card and the
// gate. A tap anywhere skips to the rest: what was on screen stays put,
// only what had not arrived yet fades in. Reduced motion: the scene
// fades in whole and nothing in it moves. Every animation is only the
// way in; the rest is each element's own style (the `restday` region
// of index.css, .rst-*).
//
// Props:
//   rest     Today's `rest`: { held, unseen: [YYYY-MM-DD], streak, next_at }
//   week     the 7 days ending today ({ day, kanji, state: studied |
//            rest | missed | today }) -- domain/dayClear's restWeek()
//   total    the day's cards (Today's `total`)
//   minutes  what they take (from the gate's pace), or null
//   lanes    Today's `lanes`, for the stripe of each line's share
//   desk     drawn beside the rail (Enter departs)
//   reduced  the rest state at once (default: prefers-reduced-motion)
//   onDepart()  "Départ": the day's run

// The board's clock, in ms after mount: the stations, the line to the
// day before the miss, the stub laid over it, the line on through it,
// then the streak and the day. FINAL is when the gate has landed.
const REST_BEATS = Object.freeze({
  st: 80, run: 260, miss: 230, drop: 800, land: 1125,
  over: 1120, next: 1300, streak: 1380, reserve: 1520, today: 1600, gate: 1680,
  FINAL: 2300,
})
const T = REST_BEATS

// Each stamp lands at its weekday's own angle (the kit's tilts, 水 → 火),
// so the rally here and the ceremony's week agree; the stub its own.
const TILT = Object.fromEntries([...'水木金土日月火'].map((k, i) => [k, WEEK_TILTS[i]]))
const STUB_TILT = -4

// The rally drawn at its own size: a station 40px, the stub a station
// wider (50px), the gaps equal -- 50px between two stations' centres,
// 56px beside the stub (the board's 39 … 239, 295, 351 on 390px).
const W_STATION = 40
const W_STUB = 50
const GAP = 10
const GAP_STUB = 11

function rallyLayout(states) {
  const width = s => (s === 'rest' ? W_STUB : W_STATION)
  const xs = [0]
  for (let i = 1; i < states.length; i++) {
    const stub = states[i] === 'rest' || states[i - 1] === 'rest'
    xs.push(xs[i - 1] + (width(states[i]) + width(states[i - 1])) / 2 + (stub ? GAP_STUB : GAP))
  }
  const mid = (xs.at(-1) ?? 0) / 2
  return xs.map(x => x - mid)
}

// The line from stamp to stamp: solid between two days kept (studied or
// covered), dashed into today while it waits, none beside a day missed.
// The solid runs before the first stub are drawn first ("run"); from the
// day before it on, after it lands ("over"); the dash last ("next").
function rallyLines(states, xs) {
  const kept = s => s === 'studied' || s === 'rest'
  const last = states.length - 1
  const firstStub = states.indexOf('rest')
  const segs = []
  for (let i = 0; i < last; i++) {
    const a = states[i]
    const b = states[i + 1]
    let kind = null
    if (kept(a) && i + 1 === last && b === 'today') kind = 'next'
    else if (kept(a) && kept(b)) kind = firstStub < 0 || i + 1 < firstStub ? 'run' : 'over'
    if (!kind) continue
    const prev = segs.at(-1)
    if (prev && prev.kind === kind && prev.to === i) prev.to = i + 1
    else segs.push({ kind, from: i, to: i + 1 })
  }
  return segs.map(s => ({ ...s, left: xs[s.from], width: xs[s.to] - xs[s.from] }))
}

// Each line's share of the day: its lanes' cards, the largest first.
function laneShares(lanes) {
  const by = new Map()
  for (const lane of lanes ?? []) {
    const type = laneTypeOf(lane)
    by.set(type, (by.get(type) ?? 0) + laneCount(lane))
  }
  return [...by].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
}

const cls = (...names) => names.filter(Boolean).join(' ')

export default function RestDayNotice({ rest, week, total, minutes, lanes, desk, reduced: reducedProp, onDepart }) {
  const { t, lang } = useLang()
  const reduced = useReducedMotion(reducedProp)
  const { skipped, skip, at } = useBeats([[T.FINAL, 1]], { final: 1, reduced })
  // When the tap came, on the board's clock: what had arrived by then
  // stays put, the rest fades in.
  const t0 = useRef(0)
  const [skipT, setSkipT] = useState(0)
  useEffect(() => { t0.current = performance.now() }, [])
  const onSkip = () => {
    if (reduced || at(1)) return
    setSkipT(performance.now() - t0.current)
    skip()
  }

  const go = !reduced && !skipped
  const play = name => (go ? name : null)
  const late = when => (skipped && skipT < when ? 'clrk-fade' : null)
  const stT = i => T.st + Math.min(i, 7) * 30

  const days = week ?? []
  const states = days.map((d, i) => (i === days.length - 1 && d.state !== 'studied' ? 'today' : d.state))
  const xs = rallyLayout(states)
  const lines = rallyLines(states, xs)
  const unseen = rest?.unseen ?? []
  const usedNames = unseen.map(day => dayName(day, lang))
  const shares = laneShares(lanes)
  const streak = rest?.streak ?? 0
  let stub = 0

  return (
    <section
      className={cls('rst', skipped && 'clrk--skip', reduced && 'clrk--reduced')}
      aria-labelledby="rst-title"
      onClick={onSkip}
    >
      <div className={cls('rst__world', reduced && 'clrk-fade')}>
        <ClearHeader center cap="連続乗車 継続" title={t.rstTitle} titleId="rst-title" as="h2" className={cls('rst-head', play('clrk-arrive'))} />

        <span className="rst-air rst-air--top" aria-hidden="true" />
        <div className="rst-hero">
          <div className="rst-rally" role="img" aria-label={t.rstWeekAria(weekParts(days, t, lang))}>
            {lines.map(line => {
              const when = T[line.kind]
              const dur = line.kind === 'run' ? 0.6 : line.kind === 'over' ? 0.22 * (line.to - line.from) : 0.3
              return (
                <span
                  key={`${line.kind}-${line.from}`}
                  className={cls('rst-line', `rst-line--${line.kind}`, play('rst-draw'), late(when))}
                  style={{ left: `calc(50% + ${line.left}px)`, width: line.width, '--d': `${when}ms`, '--t': `${dur}s` }}
                  aria-hidden="true"
                />
              )
            })}
            <ol className="rst-week" aria-hidden="true">
              {days.map((d, i) => {
                const left = `calc(50% + ${xs[i]}px)`
                if (states[i] === 'rest') {
                  const k = stub++
                  const drop = T.drop + k * 120
                  return (
                    <li key={d.day} className="rst-stn rst-stn--rest" style={{ left }}>
                      <span className="rst-sc rst-sc--bare">
                        <Slot state="missed" glyph={d.kanji} tilt={TILT[d.kanji] ?? 0} className={cls('rst-miss', play('rst-miss--go'))} style={{ '--d': `${T.miss}ms` }} />
                        <span className={cls('rst-puff', play('rst-puff--go'))} style={{ '--d': `${T.land + k * 120}ms` }} />
                        <span className={cls('rst-drop', play('rst-drop--go'), late(drop))} style={{ '--d': `${drop}ms` }}>
                          <Slot state="rest" tilt={STUB_TILT} />
                        </span>
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={d.day} className={cls('rst-stn', play('clrk-arrive'), late(stT(i)))} style={{ left, '--d': `${stT(i)}ms` }}>
                    <span className="rst-sc">
                      <Slot state={states[i] === 'today' ? 'wait' : i === days.length - 1 ? 'now' : states[i]} glyph={d.kanji} tilt={TILT[d.kanji] ?? 0} />
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          <p className={cls('rst-streak', play('clrk-arrive'), late(T.streak))} style={{ '--d': `${T.streak}ms` }}>
            <span className="rst-streak__n">{streak}</span>
            <span className="rst-streak__w">{t.rstStreakWord(streak)}</span>
          </p>

          <div className={cls('clrk-dash', 'rst-reserve', play('clrk-arrive'), late(T.reserve))} style={{ '--d': `${T.reserve}ms` }}>
            <span className="rst-stub" lang="ja" aria-hidden="true">運休</span>
            <p className="rst-reserve__txt">
              {usedNames.length > 0 && <span className="rst-reserve__t">{t.rstUsed(usedNames)}</span>}
              <span className="rst-reserve__s">
                <span className="rst-num">{rest?.held ?? 0}</span> {t.rstHeld}
                {rest?.next_at != null && (
                  <> · {t.rstNextPre} <span className="rst-num">{rest.next_at}</span>{t.rstNextPost}</>
                )}
              </span>
            </p>
          </div>
        </div>

        <span className="rst-air" aria-hidden="true" />
        <div className="rst-low">
          <div
            className={cls('clrk-card', 'rst-today', play('clrk-arrive'), late(T.today))}
            style={{ '--d': `${T.today}ms` }}
            role="group"
            aria-label={t.rstTodayAria(total ?? 0, minutes)}
          >
            {shares.length > 0 && (
              <span className="rst-edge" aria-hidden="true">
                {shares.map(([type, n]) => (
                  <i key={type} style={{ flexGrow: n, background: LINE_COLOR[type] ?? 'var(--surface-line)' }} />
                ))}
              </span>
            )}
            <p className="rst-today__head" aria-hidden="true">
              <span className="rst-today__count">
                <span className="rst-today__n">{total ?? 0}</span>
                <span className="rst-today__unit">{t.rstCards(total ?? 0)}</span>
              </span>
              {minutes != null && (
                <span className="rst-today__min"><span className="rst-num">~{minutes}</span> {t.rstMin}</span>
              )}
            </p>
          </div>

          <div className={cls('rst-gatewrap', late(T.gate))}>
            <GateButton compact arrive={go} arriveDelay={T.gate} keys={desk} label={t.rstDepart} onClick={onDepart} />
          </div>
        </div>
      </div>
      <EnterKey onEnter={onDepart} />
    </section>
  )
}
