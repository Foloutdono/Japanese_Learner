import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playMilestone, playPassClip } from '../../lib/audio'
import { ticketName, ticketNumber } from '../../domain/dayClear'
import { EnterKey } from '../chrome/DeskKeys'
import { Mark } from '../ui/Mark'
import {
  ClearHeader, Slot, XpTotal, Ticket, Clipper, ClipperChip, GateButton,
  WEEK_TILTS, useBeats, useCountUp, CLIP_BITE_MS, CLIP_PART_MS,
} from './kit'
import { dayName, longDate, weekParts } from './aria'
import {
  BOARD_W, airFor, bezierTime, columnFrame, offsetIn, useFareTick, useSkipKey, useStageBox,
} from './msStage'

// ── 記念乗車券 — a streak's ticket: 3, 7 and 14 days (plan 191) ───────
// The canvas's Milestone-7 board (m7/build.py, its clock and geometry),
// the same ceremony for each of the three with that milestone's data.
// It begins where the day's stamp ends (ClearPhone / ClearDesk hand
// over after their stamp beat):
//
//   60ms     today's stamp is pressed into the week row, which opens
//            from the day's gap-8 row into a line
//   300      the streak's figure leaves its line for the stage
//   700      the line draws through the streak's stamps, each lighting
//            as its front passes, a gold ring each (the run: all seven
//            on a 7 or a 14, the last three on a 3)
//   1260     the figure rolls to the streak as today lights, and flies
//            home at 1860
//   2040     the ticket machine comes down; 2340 it feeds the 硬券 out
//            in three jerks, the print appearing at the slit
//   3070     the clipper (改札鋏) comes in along its axis, bites a true
//            notch at 3410 and parts at 3620 (the chip falls); the
//            machine lets go at 3770 and lifts away
//   4050     the jackpot rises off the ticket, hangs, and flies at 4630
//            into its slot of the fare (+run · +prime · +billet), which
//            counts from run + prime to the total at 5070
//   5270     on a 7 or a 14 (rest.earned), the 運休 stub slides out
//   5690     the gate, "Garder le billet"; 6330 the rest
//
// Every animation is only the way in: the rest is each element's own
// style, so a skip or reduced motion is simply the classes off. The
// board's keyframes are the `milestones` region of index.css (clr-ms-*),
// the board's numbers translated; the few positions that depend on the
// figures' widths (the streak's odometer, the jackpot's slot) are
// measured off the real type and handed to the keyframes as variables.
//
// Props:
//   result, run, model   as ClearPhone's (model.ticket = { days, date };
//                        model.rest.earned says whether a rest day came)
//   desk       drawn in the desk's content area, the column centred
//   reduced    the rest state at once, fades only
//   onFareBeat()  the fare has landed (DayClearView then plays a level-up)
//   onKeep()   "Garder le billet": back to the gate
//   onShare()  unused here (the month's ceremony shares)

// The board's clock (ms from the hand-over), m7/build.py's TIMES.
const T7 = Object.freeze({
  PRESS: 60, SPREAD: 300, LIFT: 300, LIFT_DUR: 520, CAP: 700, LINE: 700, LINE_DUR: 600,
  ROLL: 1260, RETURN: 1860, RET_DUR: 460, HOME: 2320, MACH: 2040, FEED: 2340,
  JAWS: 3070, BITE: 3410, OPEN: 3620, DROP: 3770, GONE: 4070, RISE: 4050, FARE: 4250,
  FLY: 4630, FLY_DUR: 440, LAND: 5070, COUNT: 520, STUB: 5270, STUBTXT: 5570,
  GATE: 5690, FINAL: 6330, LED: [2440, 2740, 3040],
})
// The clipper's own clock lands its bite and its parting on the board's.
if (T7.BITE - T7.JAWS !== CLIP_BITE_MS || T7.OPEN - T7.JAWS !== CLIP_PART_MS) {
  throw new Error('Milestone-7: the clipper bites on the board\'s clock')
}

// The phases the JavaScript waits on (the rest is CSS on the same clock).
const BITTEN = 1
const ISSUED = 2
const COUNTING = 3
const LANDED = 4
const FINAL = 5
const BEATS = [[T7.BITE, BITTEN], [T7.DROP + 170, ISSUED], [T7.LAND, COUNTING], [T7.LAND + T7.COUNT, LANDED], [T7.FINAL, FINAL]]

// The ticket: Collection's hero box, 300×221; the machine's slit sits
// 14px over its resting top (it falls that far when let go).
const TK_H = 221
const DROP_PX = 14

/** The board's geometry for a column `h` tall (m7/build.py at 844). */
function geometry7(h) {
  // The air: the header's top (44 → 20), streak → fare (60 → 20),
  // fare → ticket (134 → 124: the jackpot's hang), ticket → gate (169 → 66).
  const [a0, a1, a2] = airFor(h, [24, 40, 10, 103])
  const tk = 374 + a0 + a1 + a2
  const mouth = tk - DROP_PX
  const gate = h - 28 - 52
  const rest = Math.round((tk + TK_H + gate) / 2 - 20)
  const bigCy = tk - 44
  return {
    hdr: 44 + a0,
    rally: 117 + a0,
    streak: 155 + a0,
    fare: 240 + a0 + a1,
    tk,
    mouth,
    mach: mouth - 56,
    notch: mouth + TK_H / 2,
    spot: tk + TK_H / 2 - 180,
    riser: tk - 54,
    bigCy,
    bigTop: bigCy - 43.2,
    bigCap: bigCy - 43.2 + 86.4 - 4,
    rest,
    stubFrom: -((rest + 2 + 36) - (tk + TK_H) + 3),
  }
}

// The line draws with --ease-io; each stamp lights as its front arrives.
const reach = bezierTime(0.6, 0, 0.3, 1)

/** The week's stations: where each stands, whether the line passes it, when it lights; `first` the run's first. */
function stations(week) {
  const last = week.length - 1
  // The run the line rallies: the trailing days the streak holds (a
  // missed day breaks it; a rest day carries it).
  let first = last
  while (first > 0 && week[first - 1].state !== 'missed') first -= 1
  const span = Math.max(1, last - first)
  const list = week.map((entry, i) => {
    const today = i === last
    const state = today ? 'now' : entry.state === 'today' ? 'studied' : entry.state
    const run = i >= first
    return {
      day: entry.day,
      glyph: entry.kanji,
      state,
      x: 45 + 50 * i,
      sx: -(i - 3) * 14,
      tilt: WEEK_TILTS[i % WEEK_TILTS.length],
      run,
      gold: run && state !== 'rest',
      today,
      d: run ? Math.round(T7.LINE + reach((i - first) / span) * T7.LINE_DUR - 40) : 0,
    }
  })
  return { list, first }
}

/** An odometer's columns rolling `from` → `to`: [{ a, b, roll }], left to right. */
function rollColumns(from, to) {
  const b = String(to)
  const a = String(Math.max(0, from)).padStart(b.length, ' ')
  return b.split('').map((d, i) => ({ a: a[i] === ' ' ? '' : a[i], b: d, roll: a[i] !== d }))
}

function Odo({ cols, className = '', colClass = '', go = false, refEl, style }) {
  return (
    <span ref={refEl} className={['clrk-odo', className].filter(Boolean).join(' ')} style={style} aria-hidden="true">
      {cols.map((c, i) => (
        <span key={i} className={['clrk-odo__col', 'ms-t-col', go && c.roll && colClass].filter(Boolean).join(' ')}>
          <span className="clrk-odo__d">{c.a}</span>
          <span className="clrk-odo__d">{c.b}</span>
        </span>
      ))}
    </span>
  )
}

export default function MilestoneTicket({ result, model, desk, reduced, onFareBeat, onKeep }) {
  const { t, lang } = useLang()
  const rootRef = useRef(null)
  const colRef = useRef(null)
  const smallRef = useRef(null)
  const landRef = useRef(null)
  const figRef = useRef(null)
  const box = useStageBox(rootRef)
  const { scale, colH, inset } = columnFrame(box)
  const geo = useMemo(() => geometry7(colH), [colH])

  // ── the clock ──
  const t0 = useRef(0)
  const [skipT, setSkipT] = useState(Infinity)
  const fared = useRef(false)
  const fareBeat = useCallback(() => {
    if (fared.current) return
    fared.current = true
    onFareBeat?.()
  }, [onFareBeat])
  // The milestone's phrase once, when the ticket is issued (or at once:
  // a skip before it, reduced motion).
  const sounded = useRef(false)
  const announce = useCallback(() => {
    if (sounded.current) return
    sounded.current = true
    playMilestone()
  }, [])
  const onBeat = useCallback(p => {
    if (p === BITTEN) playPassClip()
    else if (p === ISSUED) announce()
    else if (p === LANDED) fareBeat()
  }, [announce, fareBeat])
  const { phase, skipped, skip } = useBeats(BEATS, { final: FINAL, reduced, onBeat })
  useEffect(() => {
    t0.current = performance.now()
    if (!reduced) return undefined
    announce()
    fareBeat()
    return undefined
    // Once per mount: reduced is the rest at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const atRest = reduced || skipped
  const go = !atRest
  const live = go && phase < FINAL
  const doSkip = useCallback(() => {
    if (reduced || phase >= FINAL || skipped) return
    setSkipT(performance.now() - t0.current)
    announce()
    skip()
    fareBeat()
  }, [reduced, phase, skipped, skip, announce, fareBeat])
  useSkipKey(doSkip, live)
  const late = at => (skipped && skipT < at ? ' clrk-fade' : '')

  // ── the figures ──
  const { fare, ticket, rest } = model
  const start = fare.total - fare.jackpot
  const tick = useFareTick()
  const counted = useCountUp(fare.total, { from: start, duration: T7.COUNT, run: go && phase >= COUNTING, onTick: tick })
  const xp = go ? (phase >= COUNTING ? counted : start) : fare.total
  const shine = !reduced && (skipped || phase >= LANDED)
  const { list: stns, first: runFirst } = useMemo(() => stations(model.week ?? []), [model.week])
  const full = stns.length === 7 && stns.every(s => s.state !== 'missed')
  const streakCols = rollColumns(model.streak - 1, model.streak)
  const no = ticketNumber(ticket?.days ?? model.streak)

  // ── what the type decides: measured before the first paint, and again
  // once the fonts have come in ──
  const [measured, setMeasured] = useState({ dx: -44.65, dy: -163, lx: 90.9, ly: -43.5, figW: 99 })
  useLayoutEffect(() => {
    const col = colRef.current
    if (!col) return undefined
    const measure = () => {
      const s = smallRef.current ? offsetIn(smallRef.current, col) : null
      const l = landRef.current ? offsetIn(landRef.current, col) : null
      const f = figRef.current?.querySelector('.clrk-xp')
      const next = {
        dx: s ? s.x + s.w / 2 - BOARD_W / 2 : -44.65,
        dy: s ? s.y + s.h / 2 - geo.bigCy : -163,
        lx: l ? l.x + l.w / 2 - BOARD_W / 2 : 90.9,
        ly: l ? l.y + l.h / 2 - (geo.riser + 20) : -43.5,
        figW: f?.offsetWidth ?? 99,
      }
      setMeasured(m => (Object.keys(next).every(k => Math.abs(m[k] - next[k]) < 0.05) ? m : next))
    }
    measure()
    let live2 = true
    document.fonts?.ready?.then(() => { if (live2) measure() })
    return () => { live2 = false }
  }, [geo, shine])

  const vars = {
    '--ms-dx': measured.dx,
    '--ms-dy': measured.dy,
    '--ms-lx': measured.lx,
    '--ms-ly': measured.ly,
    '--ms-stub': geo.stubFrom,
    height: colH,
    transform: scale < 1 ? `scale(${scale})` : undefined,
  }
  // The shimmer's stars, placed on the measured figure as the board
  // placed them on +514: the last digit's shoulder, under the +, over
  // the second figure.
  const glints = [
    { x: measured.figW + 10, y: 1, size: 12, delay: 900 },
    { x: -2, y: 33, size: 9, delay: 2100 },
    { x: measured.figW * 0.43, y: -2, size: 9, delay: 3300 },
  ]

  const weekLabel = full
    ? t.msWeekFullAria(dayName(stns[0].day, lang), dayName(stns[6].day, lang))
    : t.clrWeekAria(weekParts(model.week, t, lang))

  const cls = (base, goCls) => (go ? `${base} ${goCls}` : base)

  return (
    <main
      id="main-content"
      ref={rootRef}
      className={['ms-ticket', desk && 'ms-ticket--desk', skipped && 'clrk--skip', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}
      onClick={doSkip}
    >
      <div ref={colRef} className={['ms-col', reduced && 'clrk-fade'].filter(Boolean).join(' ')} style={vars}>
        <ClearHeader center cap="本日の運行 終了" title={t.clrTitle} className="ms-t-hdr" style={{ top: geo.hdr }} />

        {/* ── the rally: the week's stamps on one line ── */}
        <div className="ms-t-rally" style={{ top: geo.rally }}>
          {runFirst < 6 && (
            <span
              className={cls('ms-t-line', 'ms-t-line--go')}
              style={{ left: 45 + 50 * runFirst, width: 50 * (6 - runFirst), '--d': `${T7.LINE}ms` }}
              aria-hidden="true"
            />
          )}
          <ol className="ms-t-week" aria-label={weekLabel}>
            {stns.map((s, i) => (
              <li
                key={s.day ?? i}
                className={cls('ms-t-stn', 'ms-t-stn--go')}
                style={{ left: s.x, '--sx': s.sx, '--d': `${T7.SPREAD}ms` }}
              >
                {s.run && <span className={cls('ms-t-glow', 'ms-t-glow--go')} style={{ '--d': `${s.d}ms` }} aria-hidden="true" />}
                {s.today && <span className={cls('ms-t-bloom', 'ms-t-bloom--go')} style={{ '--d': `${T7.PRESS + 200}ms` }} aria-hidden="true" />}
                <Slot
                  glyph={s.glyph}
                  state={s.state}
                  tilt={s.tilt}
                  gold={s.gold}
                  className={[
                    go && s.run && 'ms-t-lit',
                    go && s.gold && 'ms-t-ring',
                    go && s.today && 'ms-t-press',
                  ].filter(Boolean).join(' ')}
                  style={{ '--d': `${s.d}ms`, '--pd': `${T7.PRESS}ms` }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ol>
        </div>

        {/* ── the streak's line: its figure leaves for the stage and comes home ── */}
        <p className={`ms-t-streak${late(T7.HOME)}`} style={{ top: geo.streak }} role="img" aria-label={t.clrStreakDays(model.streak)}>
          <Odo refEl={smallRef} cols={streakCols} className={cls('ms-t-odo', 'ms-t-away--go')} colClass="ms-t-six--go" go={go} />
          <span className={go ? 'ms-t-lbl--go' : undefined} aria-hidden="true">{t.clrStreakWord}</span>
        </p>

        <span className={cls('ms-t-spot', 'ms-t-spot--go') + late(T7.FEED)} style={{ top: geo.spot, '--d': `${T7.FEED}ms` }} aria-hidden="true" />

        {/* ── the fare: the run and the prime, then the ticket's jackpot ── */}
        <div className={cls('ms-t-fare', 'ms-t-fare--go') + late(T7.FARE)} style={{ top: geo.fare, '--d': `${T7.FARE}ms` }}>
          <p ref={figRef} className={cls('ms-t-total', 'ms-t-total--go')} style={{ '--d': `${T7.LAND}ms` }}>
            <XpTotal value={xp} shine={shine} glints={glints} unit={t.clrXpUnit} figureClass="ms-t-fig" />
          </p>
          <p className="ms-t-break">
            <span className={cls('ms-t-item', 'ms-t-item--go')} style={{ '--d': `${T7.FARE + 60}ms` }}>
              <span><b>+{fare.run}</b> {t.clrFareRun}</span>
            </span>
            <span className={cls('ms-t-item', 'ms-t-item--go')} style={{ '--d': `${T7.FARE + 140}ms` }}>
              <i aria-hidden="true">·</i><span><b>+{fare.bonus}</b> {t.clrFarePrime}</span>
            </span>
            <span
              className={cls('ms-t-item', 'ms-t-item--land') + (skipT >= T7.FARE ? late(T7.LAND) : '')}
              style={{ '--d': `${T7.LAND}ms` }}
            >
              <i aria-hidden="true">·</i><span><b ref={landRef}>+{fare.jackpot}</b> {t.clrFareTicket}</span>
            </span>
          </p>
        </div>

        {/* ── the rest day: a 運休 stub out from under the ticket ── */}
        {rest?.earned && (
          <div className={`ms-t-rest${late(T7.STUB)}`} style={{ top: geo.rest }}>
            <span className={cls('ms-t-stub', 'ms-t-stub--go')} style={{ '--d': `${T7.STUB}ms` }} lang="ja" aria-hidden="true">運休</span>
            <p className={cls('ms-t-resttxt', 'ms-t-resttxt--go') + (skipT >= T7.STUB ? late(T7.STUBTXT) : '')} style={{ '--d': `${T7.STUBTXT}ms` }}>
              <span className="ms-t-rest__t"><span className="ms-t-num">+1</span> {t.msRestEarned}</span>
              <span className="ms-t-rest__s">{t.msRestNote}</span>
            </p>
          </div>
        )}

        {/* ── the feed: the ticket under the slit, whose edge is the print's reveal ── */}
        <div className={['ms-t-feed', !live && 'ms-t-feed--open'].filter(Boolean).join(' ') + late(T7.FEED)} style={{ top: geo.mouth }}>
          <div className={cls('ms-t-move', 'ms-t-move--go')} style={{ '--d': `${T7.FEED}ms` }}>
            <div className={go ? 'ms-t-jolt--go' : undefined} style={{ '--d': `${T7.BITE}ms` }}>
              <div className={cls('clrk-tk-hang', 'ms-t-settle--go')} style={{ '--d': `${T7.DROP + 120}ms` }}>
                {ticket && (
                  <Ticket
                    days={ticket.days}
                    date={ticket.date}
                    caption={t.clrTicketCaption(ticket.days)}
                    label={t.clrTicketAria(ticket.days, no, longDate(result.day, lang))}
                    notch={go ? 'punch' : 'cut'}
                    punchDelay={T7.BITE}
                    hang={false}
                    className={['ms-t-tk', ticketName(ticket.days).length > 3 && 'ms-t-tk--long'].filter(Boolean).join(' ')}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {live && (
          <>
            <span className="ms-t-bigglow ms-t-bigglow--go" style={{ top: geo.bigCy - 120 }} aria-hidden="true" />
            <span className="ms-t-bigring ms-t-bigring--go" style={{ top: geo.bigCy - 55, '--d': `${T7.ROLL}ms` }} aria-hidden="true" />
            <div className="ms-t-big" style={{ top: geo.bigTop }} aria-hidden="true">
              <div className="ms-t-bigx ms-t-bigx--go">
                <div className="ms-t-bigy ms-t-bigy--go">
                  <Odo cols={streakCols} className="ms-t-bigodo" colClass="ms-t-roll--go" go style={{ '--d': `${T7.ROLL}ms` }} />
                </div>
              </div>
            </div>
            <p className="ms-t-bigcap ms-t-bigcap--go" style={{ top: geo.bigCap }} aria-hidden="true">{t.clrStreakWord}</p>

            <div className="ms-t-riser ms-t-rx--go" style={{ top: geo.riser }} aria-hidden="true">
              <p className="ms-t-riser__y ms-t-ry--go"><span className="clrk-xp ms-t-riserfig">+{fare.jackpot}</span></p>
            </div>

            <Clipper x={345} y={geo.notch} angle={58} delay={T7.JAWS} />
            <span className="ms-t-chipx" style={{ top: geo.notch - 11.5 }} aria-hidden="true">
              <ClipperChip delay={T7.OPEN} />
            </span>
            <div className="ms-t-mach ms-t-mach--go" style={{ top: geo.mach, '--d': `${T7.MACH}ms` }} aria-hidden="true">
              <Mark className="ms-t-mark" />
              <span className="ms-t-leds">
                {T7.LED.map(d => <span key={d} className="ms-t-led ms-t-led--go" style={{ '--d': `${d}ms` }} />)}
              </span>
              <span className="ms-t-mouth" />
            </div>
          </>
        )}

        <div className={`ms-t-gate${late(T7.GATE)}`} style={{ left: inset, right: inset }}>
          <GateButton compact arrive={go} arriveDelay={T7.GATE} keys={desk} label={t.clrKeep} onClick={onKeep} />
        </div>
      </div>
      <EnterKey onEnter={onKeep} disabled={!atRest && phase < FINAL} />
    </main>
  )
}
