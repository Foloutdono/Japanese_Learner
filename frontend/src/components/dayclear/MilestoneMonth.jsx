import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playMilestone, playPassClip } from '../../lib/audio'
import { daysBefore, kanjiNumber, ticketNumber, weekdayKanji } from '../../domain/dayClear'
import { EnterKey } from '../chrome/DeskKeys'
import { Mark } from '../ui/Mark'
import {
  Ticket, Clipper, ClipperChip, Seal, Bloom, Specks, Glint, QuietButton, GateButton,
  rng, BOARD_SEED, useXpFormat,
} from './kit'
import { longDate } from './aria'
import Fireworks from './Fireworks'
import { BOARD_W, airFor, clamp, columnFrame, useFareTick, useSkipKey, useStageBox } from './msStage'

// ── 一ヶ月 — the month, and every one after (plan 191) ─────────────────
// The canvas's Milestone-30 board, the showpiece, for the tier "month":
// a streak of 30, 50, 100, 200, 365 and every hundred after. It begins
// where the day's stamp ends:
//
//   0ms      dusk deepening to night, faint stars twinkling; the month's
//            スタンプ帳 rises: a paper sheet of the last thirty days, the
//            columns the weekdays with today in the corner
//   920      the 29 days before today are inked in an accelerating wave
//            (a missed day stays a printed slot, a rest day takes a 運休
//            stub), the counter rolling with them; today's slot waits,
//            dashed and pulsing
//   2650     the big stamp comes down: the milestone's number in kanji
//            (三十, 五十, 百 …, 一年); the hit at 3110 shakes the night,
//            flashes the paper, ripples the stamps, the counter lands on
//            the streak
//   4500     the sheet sinks and the station's roof rises; 4550 花火
//            (Fireworks), 5400 its windows light from the door outward
//   7450     the gold ticket flips in, its sheen and holo looping; the
//            clipper bites its notch at 8600
//   8800     the jackpot rolls up like an odometer ("Billet du mois"),
//            then 10600 the total with the breakdown, as the finale's
//            three 千輪 catch the foil; 11650 "Partager" and the gate
//
// The rest is each element's own style; skip and reduced take the
// classes off (a show already in the sky plays on after a skip, and a
// skip before it lights three small shells instead). On the desk the
// night, the station and the sky span the content area, the
// composition centred at the board's width.
//
// Props: as MilestoneTicket's (result, run, model, desk, reduced,
// onFareBeat, onKeep, onShare).

// The board's clock (ms from the hand-over).
const SEAL = 2650
const IMPACT = SEAL + 460          // the slam meets the paper at 62% of .74s
const SINK = 4500
const FX = 4550
const LIT = 5400
const TICKET = 7450
const PUNCH = TICKET + 1150
const CLIP = PUNCH - 340           // the clipper comes in; its bite is the punch
const UNCLIP = CLIP + 1120
const FARE = PUNCH + 200
const FINALE = 10600
const GATE = 11650
const FINAL = 12
const LANDS = TICKET + 945          // the flip faces us: the ticket has arrived

const EASE_Q = 'cubic-bezier(.2,.7,.3,1)'
const EASE_B = 'cubic-bezier(.25,1.45,.45,1)'

// The station's roof: one polyline for the silhouette (markup) and the
// rim light (canvas). Indices 0–12 are the left eave, 43–55 the right;
// on a wider sky the eaves reach the edges and the hall stays centred.
const ROOF = [[-6, 65], [1.7, 64.4], [9.4, 63.7], [17.3, 62.9], [25.1, 61.9], [33, 60.8], [41, 59.5], [49, 58.1], [57.1, 56.6], [65.3, 54.9], [73.4, 53.1], [81.7, 51.1], [90, 49], [88, 42], [80, 37], [87.9, 36.3], [95.6, 35.2], [103.1, 33.8], [110.4, 32.2], [117.5, 30.3], [124.4, 28], [131.1, 25.5], [137.6, 22.6], [143.9, 19.4], [150, 16], [146, 6], [151, 7], [157, 13], [233, 13], [239, 7], [244, 6], [240, 16], [246.1, 19.5], [252.4, 22.6], [258.9, 25.4], [265.6, 28], [272.5, 30.3], [279.6, 32.2], [286.9, 33.9], [294.4, 35.2], [302.1, 36.3], [310, 37], [302, 42], [300, 49], [308.3, 51.1], [316.6, 53.1], [324.8, 54.9], [332.9, 56.6], [341, 58.1], [349, 59.5], [357, 60.8], [364.9, 61.9], [372.8, 62.9], [380.6, 63.7], [388.3, 64.4], [396, 65]]
const UPPER = 'M80 37 L87.9 36.3 L95.6 35.2 L103.1 33.8 L110.4 32.2 L117.5 30.3 L124.4 28.0 L131.1 25.5 L137.6 22.6 L143.9 19.4 L150 16 L157 13 L233 13 L240 16 L246.1 19.5 L252.4 22.6 L258.9 25.4 L265.6 28.0 L272.5 30.3 L279.6 32.2 L286.9 33.9 L294.4 35.2 L302.1 36.3 L310 37 L302 42 L88 42 Z'
const WINDOWS = [26, 56, 86, 116, 146, 181, 232, 262, 292, 322, 352]

const r1 = v => Math.round(v * 10) / 10

/** The station for a sky `w` wide: its roof's paths and its windows. */
function stationFor(w) {
  const off = (w - BOARD_W) / 2
  const f = (off + 96) / 96
  const left = x => -6 + (x + 6) * f
  const right = x => off + 300 + (x - 300) * f
  const pts = ROOF.map(([x, y], i) => [i <= 12 ? left(x) : i >= 43 ? right(x) : x + off, y])
  const edge = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${y}`).join(' ')
  const upper = UPPER.replace(/([ML])([\d.]+) /g, (_, c, x) => `${c}${r1(Number(x) + off)} `)
  const wins = WINDOWS.map((x, i) => ({ x: x + off, door: i === 5 }))
  for (let j = 1; 26 - 30 * j + off >= 4; j++) wins.unshift({ x: 26 - 30 * j + off, door: false })
  for (let j = 1; 352 + 30 * j + off <= w - 16; j++) wins.push({ x: 352 + 30 * j + off, door: false })
  return {
    off,
    pts,
    silhouette: `${edge} L${r1(w + 6)} 82 L-6 82 Z`,
    upper,
    eave: `M${r1(88 + off)} 42 L${r1(302 + off)} 42`,
    curves: `M-6 66 Q${r1(left(40))} 63 ${r1(off + 90)} 50 M${r1(off + 300)} 50 Q${r1(right(350))} 63 ${r1(w + 6)} 66`,
    wins: wins.map(win => ({ ...win, d: Math.round(Math.abs(win.x + (win.door ? 14 : 6) - w / 2) * 1.5) })),
  }
}

/**
 * The board's geometry for a stage `h` tall: the actions on the floor,
 * the fare, the ticket and the station's top stacked up from it, the
 * sky taking what is left (the air gives way first: the gaps, then most
 * of it the sky, 266 → 137 at 667); the sheet centred while it is
 * stamped, and at rest (reduced) over the ticket, scaled to fit.
 */
function geometry30(h) {
  const [dPad, dAct, dFare, dTk] = airFor(h, [12, 6, 10, 20, 129], [0, 0, 0, 0, 1])
  const pad = 28 + dPad
  const actions = h - pad - 104
  const fare = actions - (78 + dAct)
  const ticket = fare - (236 + dFare)
  const station = ticket - (132 + dTk)
  const room = ticket - 36
  const restTop = room - 258 >= 16 ? room - 258 : 16
  return {
    pad, actions, fare, ticket, station,
    sheetIn: Math.round(h / 2 - 140),
    sheetRest: restTop,
    sheetK: room - 258 >= 16 ? 1 : clamp((room - 16) / 258, 0.4, 1),
  }
}

/** The thirty days the sheet holds, ending today, in its 7-column grid. */
function sheetDays(day, week, r) {
  const known = new Map((week ?? []).map(w => [w.day, w.state]))
  const cells = []
  for (let d = 1; d <= 29; d++) {
    const date = daysBefore(day, 30 - d)
    const k = d + 4
    const row = Math.floor(k / 7)
    const col = k % 7
    const state = known.get(date) ?? 'studied'
    cells.push({
      d, date, g: weekdayKanji(date), state: state === 'today' ? 'studied' : state,
      tilt: `${(r() * 16 - 8).toFixed(1)}deg`,
      ox: Number((r() * 2.4 - 1.2).toFixed(1)),
      oy: Number((r() * 2.4 - 1.2).toFixed(1)),
      pd: 120 + (row + col) * 22,
      rd: Math.round(Math.hypot(4 - row, 6 - col) * 40),
    })
  }
  return cells
}

/** The big stamp's face: the milestone in kanji (三十, 百 …), a year as 一年. */
function sealGlyphs(days) {
  return days === 365 ? '一年' : kanjiNumber(days)
}

// A roller column: the old digit leaves upward as the new one rolls in.
const col = d => ({ a: d, b: d, k: 0, dur: 100, dl: 0, e: EASE_Q })
const digitsOf = (v, n, pad) => String(Math.max(0, Math.round(v))).padStart(n, pad).split('')

// ── the pieces, each memoized: a roll of the fare re-renders the fare
// alone, a press of the wave the sheet alone ──

const Night = memo(function Night({ stars, shake }) {
  return (
    <div className={['ms-m-night', shake && 'ms-m-night--shake'].filter(Boolean).join(' ')} aria-hidden="true">
      <div className="ms-m-dusk">
        {stars.map((st, i) => (
          <i key={i} className="ms-m-star" style={{ left: st.x, top: st.y, width: st.s, height: st.s, '--o': st.o, '--tw': `${st.tw}ms`, '--td': `${st.td}ms` }} />
        ))}
      </div>
    </div>
  )
})

const MemoFireworks = memo(Fireworks)

const StationView = memo(function StationView({ station, width, height, rise, top, up, lit, rimRef }) {
  return (
    <div className="ms-m-stationclip" style={{ top }} aria-hidden="true">
      <div className={['ms-m-station', up && 'is-up', lit && 'is-lit'].filter(Boolean).join(' ')} style={{ width, height, '--ms-rise': rise }}>
        <svg className="ms-m-roof" viewBox={`0 0 ${width} 112`} width={width} height="112" focusable="false">
          <defs>
            <linearGradient id="ms-m-roofg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1b1724" />
              <stop offset=".6" stopColor="#121019" />
              <stop offset="1" stopColor="#0d0b12" />
            </linearGradient>
          </defs>
          <path d={station.silhouette} fill="url(#ms-m-roofg)" />
          <path d={station.upper} fill="#1f1b29" />
          <path d={station.eave} stroke="#2e2938" strokeWidth="1" fill="none" />
          <path d={station.curves} stroke="#26222f" strokeWidth="1" fill="none" />
          <rect x="-6" y="74" width={width + 12} height="6" fill="#07060b" opacity=".5" />
        </svg>
        <div className="ms-m-wall" />
        <i className="ms-m-clere" style={{ left: 94 + station.off }} />
        <div className="ms-m-windows" style={{ width }}>
          {station.wins.map(win => (
            <i key={win.x} className={win.door ? 'ms-m-win ms-m-win--door' : 'ms-m-win'} style={{ left: win.x, '--d': `${win.d}ms` }} />
          ))}
        </div>
        <span className="ms-m-plaque" lang="ja">辻駅</span>
        <canvas ref={rimRef} className="ms-m-rim" style={{ width, height: 160 }} />
      </div>
    </div>
  )
})

/** A roller column: the old digit and the new, remounted per roll. */
function Roll({ c, lead = false, shineCls = '', o }) {
  const style = o == null ? undefined : { '--o': o }
  return (
    <span
      className={['ms-m-roll', c.k && 'ms-m-roll--go', lead && 'ms-m-roll--lead'].filter(Boolean).join(' ')}
      style={{ '--rd': `${c.dur}ms`, '--rdl': `${c.dl}ms`, '--re': c.e }}
    >
      <span className={`clrk-odo__d${shineCls}`} style={style}>{c.a}</span>
      <span className={`clrk-odo__d${shineCls}`} style={style}>{c.b}</span>
    </span>
  )
}

const SheetView = memo(function SheetView({ cells, specks, countCols, word, label, glyphs, inked, p, skipped, reduced, top, sheetK }) {
  const impact = p >= 5
  const cls = reduced ? 'is-rest' : p >= 6 ? 'is-sunk' : `is-in${p === 5 ? ' is-pressed' : ''}`
  const flashGo = p === 5 && !skipped ? ' is-go' : ''
  return (
    <div className={`ms-m-sheetwrap ${cls}`} style={{ top, '--ms-sheet-k': sheetK }}>
      <div className={`ms-m-backlight${flashGo}`} />
      <figure className="ms-m-sheet" role="img" aria-label={label}>
        <i className={`ms-m-flash${flashGo}`} />
        <div className="ms-m-grid" aria-hidden="true">
          <div className="ms-m-title">
            <span className="clrk-odo ms-m-count">
              {countCols.map((c, i) => <Roll key={`${i}-${c.k}`} c={c} />)}
            </span>
            <span className="ms-m-countcap">{word}</span>
          </div>
          {cells.map(c => {
            const on = c.state !== 'missed' && (reduced || inked >= c.d)
            return (
              <div
                key={c.d}
                className={['ms-m-cell', on && 'is-on', impact && !skipped && !reduced && 'is-ripple'].filter(Boolean).join(' ')}
                style={{ '--tilt': c.tilt, '--ox': c.ox, '--oy': c.oy, '--pd': `${c.pd}ms`, '--rd': `${c.rd}ms` }}
              >
                {c.state !== 'missed' && (
                  <span className={c.state === 'rest' ? 'ms-m-stamp ms-m-stamp--rest' : 'ms-m-stamp'} lang="ja">
                    {c.state === 'rest' ? '運休' : c.g}
                  </span>
                )}
              </div>
            )
          })}
          <div className={['ms-m-goal', p >= 3 && 'is-hot', impact && 'is-done'].filter(Boolean).join(' ')} style={{ '--pd': `${120 + 10 * 22}ms` }}>
            <i className="ms-m-goal__ring" /><i className="ms-m-goal__pulse" /><i className="ms-m-goal__pulse" />
            {p === 4 && !skipped && <i className="ms-m-sealshadow" />}
            {p >= 4 && (
              <div className="ms-m-sealpos">
                <Seal day={glyphs} size={44} tilt={-9} paper pair className={['ms-m-seal', glyphs.length > 2 && 'ms-m-seal--long'].filter(Boolean).join(' ')} />
              </div>
            )}
            {p === 5 && !skipped && (
              <>
                <Bloom left={-18} top={-18} size={70} className="ms-m-bloom" />
                <Bloom left={-18} top={-18} size={70} className="ms-m-bloom" style={{ animationDelay: '110ms', animationDuration: '1.1s' }} />
                <Specks specks={specks} />
              </>
            )}
          </div>
        </div>
      </figure>
    </div>
  )
})

const TicketView = memo(function TicketView({ ticket, caption, label, top, notch, hidden, flipIn, skipFade, glint, gx, glintGo, clip }) {
  return (
    <div className={['ms-m-ticket', hidden && 'is-hidden', clip && 'is-bit'].filter(Boolean).join(' ')} style={{ top }}>
      <i className="ms-m-aura" aria-hidden="true" />
      <div className="clrk-tk-hang ms-m-hang">
        <div className={['ms-m-flip', flipIn && 'is-in', skipFade && 'is-skipfade'].filter(Boolean).join(' ')}>
          <div className="ms-m-back" aria-hidden="true">
            <Mark className="ms-m-backmark" />
          </div>
          <div className="ms-m-faceside">
            {ticket && (
              <Ticket
                material="gold" days={ticket.days} date={ticket.date} caption={caption} label={label}
                notch={notch} punchDelay={340} hang={false} className="ms-m-face"
              >
                <i className="ms-m-holo" aria-hidden="true" />
                <i key={glint} className={['ms-m-glint', glintGo && 'ms-m-glint--go'].filter(Boolean).join(' ')} style={{ '--gx': `${gx}%` }} aria-hidden="true" />
              </Ticket>
            )}
          </div>
        </div>
      </div>
      {clip && (
        <>
          <Clipper x={302} y="50%" angle={58} delay={0} className="ms-m-clp" />
          <ClipperChip gold delay={550} style={{ right: 0, top: '50%', marginTop: -11.5, zIndex: 9 }} />
        </>
      )}
    </div>
  )
})

// the figure in em: the plus, the digits (.62) and the thin spaces (.28)
const PLUS_EM = 0.66

const FareView = memo(function FareView({ top, p, cols, shine, fare, days }) {
  const { t } = useLang()
  const fmt = useXpFormat()
  const n = cols.length
  const shineCls = shine ? ' clrk-xp-shine clrk-xp-shine--part' : ''
  const now = Number(cols.map(c => c.b).join('')) || 0
  const lead = i => i < n - 1 && cols.slice(0, i + 1).every(c => c.b === '0')
  const parts = []
  let o = PLUS_EM
  cols.forEach((c, i) => {
    const rank = n - 1 - i
    if (i > 0 && (rank + 1) % 3 === 0) { parts.push({ sep: true }); o += 0.28 }
    parts.push({ c, i, o })
    o += 0.62
  })
  const figPx = o * 40
  const glints = [
    { x: figPx + 1.5, y: 6, size: 12, delay: 900 },
    { x: 3, y: 38, size: 9, delay: 2100 },
    { x: figPx * 0.41, y: 6, size: 9, delay: 3300 },
  ]
  return (
    <div className="ms-m-fare" style={{ top }}>
      {p >= 10 && (
        <p
          className="ms-m-total clrk-fade"
          role="img"
          aria-label={p >= 11 ? t.msTotalAria(fmt(fare.total), fmt(fare.run), fmt(fare.bonus), fmt(fare.jackpot), days) : t.msFareAria(fmt(now), days)}
        >
          <span className="ms-m-fig" style={{ '--fig-w': o }} aria-hidden="true">
            <span className={`ms-m-plus${shineCls}`} style={{ '--o': 0 }}>+</span>
            <span className="clrk-odo">
              {parts.map((part, j) => (part.sep
                ? <span key={`s${j}`} className="clrk-odo__sep" />
                : <Roll key={`${part.i}-${part.c.k}`} c={part.c} lead={lead(part.i)} shineCls={shineCls} o={part.o} />))}
            </span>
            {shine && glints.map((g, i) => <Glint key={i} {...g} />)}
          </span>
          <span className="clrk-xp__unit" aria-hidden="true">{t.clrXpUnit}</span>
        </p>
      )}
      {p === 10 && <p className="ms-m-lbl clrk-fade">{t.msTicketLabel(days)}</p>}
      {p >= 11 && (
        <p className="ms-m-lbl ms-m-break clrk-fade" aria-hidden="true">
          <span><b>+{fmt(fare.run)}</b> {t.clrFareRun}</span><span>·</span>
          <span><b>+{fmt(fare.bonus)}</b> {t.clrFarePrime}</span><span>·</span>
          <span><b>+{fmt(fare.jackpot)}</b> {t.clrFareTicket}</span>
        </p>
      )}
    </div>
  )
})

export default function MilestoneMonth({ result, model, desk, reduced, onFareBeat, onKeep, onShare }) {
  const { t, lang } = useLang()
  const rootRef = useRef(null)
  const rimRef = useRef(null)
  const box = useStageBox(rootRef)
  const { scale, colH, inset } = columnFrame(box)
  const stageW = box.w / scale
  const geo = useMemo(() => geometry30(colH), [colH])
  const station = useMemo(() => stationFor(stageW), [stageW])

  const { fare, ticket } = model
  const days = ticket?.days ?? model.milestone ?? model.streak
  const streak = model.streak
  const fareN = String(fare.total).length
  const countN = String(streak).length

  // The board's die: the stars, then the cells' tilts, then the specks.
  const art = useMemo(() => {
    const r = rng(BOARD_SEED)
    const stars = []
    for (let i = 0; i < 46; i++) {
      const b = r()
      stars.push({
        x: Number((6 + r() * 376).toFixed(1)),
        py: Math.pow(r(), 1.35),
        s: b < 0.12 ? 2 : b < 0.45 ? 1.5 : 1,
        o: (0.28 + r() * 0.5).toFixed(2),
        tw: Math.round(1800 + r() * 2600),
        td: -Math.round(r() * 4000),
      })
    }
    const cells = sheetDays(result.day, model.week, r)
    const specks = []
    for (let i = 0; i < 8; i++) {
      const a = (162 + i * 15 + (r() - 0.5) * 8) * Math.PI / 180
      const d0 = 27
      const d1 = 10 + r() * 14
      specks.push({
        x: Number((17 + Math.cos(a) * d0 - 2).toFixed(1)), y: Number((17 + Math.sin(a) * d0 - 2).toFixed(1)),
        dx: Number((Math.cos(a) * d1).toFixed(1)), dy: Number((Math.sin(a) * d1).toFixed(1)), d: 20 + i * 14,
      })
    }
    // the stamping wave: 29 presses, accelerating, about one second
    const wave = []
    let w = 0
    for (let i = 0; i < 29; i++) { wave.push(Math.round(w)); w += 26 + 46 * Math.exp(-i / 5.5) }
    return { stars, cells, specks, wave }
  }, [result.day, model.week])

  // A wider sky (the desk) has more stars, from a die of its own, so the
  // board's forty-six stay where the board put them.
  const sky = geo.station
  const stars = useMemo(() => {
    const off = (stageW - BOARD_W) / 2
    const out = art.stars.map(s => ({ ...s, x: s.x + off, y: Number((6 + s.py * (sky - 4)).toFixed(1)) }))
    if (off > 0) {
      const r = rng(BOARD_SEED + 1)
      const extra = Math.round(46 * (stageW - BOARD_W) / BOARD_W)
      for (let i = 0; i < extra; i++) {
        const b = r()
        let x = 6 + r() * (stageW - 14)
        if (x > off && x < off + BOARD_W) x = x < off + BOARD_W / 2 ? x - BOARD_W / 2 : x + BOARD_W / 2
        out.push({
          x: Number(clamp(x, 6, stageW - 8).toFixed(1)),
          y: Number((6 + Math.pow(r(), 1.35) * (sky - 4)).toFixed(1)),
          s: b < 0.12 ? 2 : b < 0.45 ? 1.5 : 1,
          o: (0.28 + r() * 0.5).toFixed(2),
          tw: Math.round(1800 + r() * 2600),
          td: -Math.round(r() * 4000),
        })
      }
    }
    return out
  }, [art.stars, stageW, sky])

  const studied = art.cells.filter(c => c.state === 'studied').length
  const base = Math.max(0, streak - studied - 1)
  // the counter after each press: rest and missed days do not count
  const counts = useMemo(() => {
    let n = base
    return art.cells.map(c => (c.state === 'studied' ? ++n : n))
  }, [art.cells, base])

  // ── the clock ──
  const [s, setS] = useState(() => ({
    phase: reduced ? FINAL : 2, inked: reduced ? 29 : 0, skipped: false, skipFrom: 0,
    shake: false, glint: 0, gx: 50, clip: false, fx: null,
  }))
  const [rollers, setRollers] = useState(() => ({
    count: digitsOf(reduced ? streak : base, countN, ' ').map(d => col(d === ' ' ? '' : d)),
    fare: digitsOf(reduced ? fare.total : 0, fareN, '0').map(col),
  }))
  const timers = useRef([])
  const tick = useFareTick()
  const fared = useRef(false)
  const sounded = useRef(false)
  const fareBeat = useCallback(() => {
    if (fared.current) return
    fared.current = true
    onFareBeat?.()
  }, [onFareBeat])
  const announce = useCallback(() => {
    if (sounded.current) return
    sounded.current = true
    playMilestone()
  }, [])

  const roll = useCallback((key, digits, dur, opt = {}) => {
    setRollers(r => ({
      ...r,
      [key]: r[key].map((c, i) => {
        const d = digits[i] === ' ' ? '' : digits[i]
        return d === c.b ? c : { a: c.b, b: d, k: c.k + 1, dur, dl: opt.dl ? opt.dl[i] : 0, e: opt.bounce ? EASE_B : EASE_Q }
      }),
    }))
    if (key === 'fare') tick()
  }, [tick])
  const settle = useCallback((key, digits) => {
    setRollers(r => ({
      ...r,
      [key]: r[key].map((c, i) => {
        const d = digits[i] === ' ' ? '' : digits[i]
        return { ...c, a: d, b: d, dl: 0 }
      }),
    }))
  }, [])

  useEffect(() => {
    if (reduced) {
      announce()
      fareBeat()
      return undefined
    }
    const list = timers.current
    const at = (ms, fn) => list.push(setTimeout(fn, ms))
    const set = patch => setS(p => ({ ...p, ...patch }))
    art.wave.forEach((w, i) => at(920 + w, () => {
      const next = i + 1 < art.wave.length ? art.wave[i + 1] - w : 90
      set({ inked: i + 1 })
      roll('count', digitsOf(counts[i], countN, ' '), Math.max(70, Math.min(150, next * 1.4)))
    }))
    at(2000, () => set({ phase: 3 }))                       // the last slot, empty and hot
    at(SEAL, () => set({ phase: 4 }))                       // the stamp comes down
    at(IMPACT, () => {                                       // the hit: the counter lands on the streak
      set({ phase: 5, inked: 29, shake: true })
      roll('count', digitsOf(streak, countN, ' '), 420, { bounce: true })
    })
    at(IMPACT + 340, () => set({ shake: false }))
    at(SINK, () => set({ phase: 6 }))                       // the sheet sinks, the station rises
    at(FX, () => set({ fx: 'show' }))                       // 花火
    at(LIT, () => set({ phase: 7 }))                        // the windows light
    at(TICKET, () => set({ phase: 8 }))                     // the ticket flips in
    at(LANDS, announce)
    at(CLIP, () => set({ clip: true }))                     // the clipper, whose bite is the punch
    at(PUNCH, () => { set({ phase: 9 }); playPassClip() })
    at(UNCLIP, () => set({ clip: false }))
    at(FARE, () => set({ phase: 10 }))
    // the jackpot, as a counter's carry; then the total with the finale
    const countUp = (t0, from, to, T, n, lastDur, lastDl) => {
      const first = Math.round(from + (to - from) * (1 - Math.pow(1 - 1 / n, 3)))
      if (from === 0) at(t0 - 60, () => settle('fare', digitsOf(first, fareN, '0')))
      for (let j = from === 0 ? 2 : 1; j <= n; j++) {
        const u = j / n
        const v = Math.round(from + (to - from) * (1 - Math.pow(1 - u, 3)))
        const last = j === n
        at(t0 + Math.round(T * (j - 1) / (n - 1)), () => {
          if (last) roll('fare', digitsOf(v, fareN, '0'), lastDur, { bounce: true, dl: lastDl })
          else roll('fare', digitsOf(v, fareN, '0'), Math.round(T / n * 1.25))
        })
      }
    }
    const carry = Array.from({ length: fareN }, (_, i) => (fareN - 1 - i) * 60)
    countUp(FARE + 50, 0, fare.jackpot, 1000, 22, 560, carry)
    at(FINALE, () => set({ phase: 11 }))
    countUp(FINALE + 10, fare.jackpot, fare.total, 600, 14, 380, carry.map(() => 0))
    at(FINALE + 990, fareBeat)
    at(GATE, () => set({ phase: FINAL }))
    // the finale's bursts catch the foil
    ;[[FINALE, 195], [FINALE + 150, 92], [FINALE + 300, 300]].forEach(([ms, x], i) =>
      at(ms, () => set({ glint: i + 1, gx: Math.round((x - 44) / 302 * 100) })))
    return () => {
      list.forEach(clearTimeout)
      list.length = 0
    }
    // One run per mount: the board's clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = useCallback(() => {
    if (reduced || s.phase >= FINAL) return
    timers.current.forEach(clearTimeout)
    timers.current.length = 0
    settle('count', digitsOf(streak, countN, ' '))
    settle('fare', digitsOf(fare.total, fareN, '0'))
    setS(p => ({ ...p, phase: FINAL, inked: 29, skipped: true, skipFrom: p.phase, shake: false, clip: false, fx: p.fx ?? 'idle' }))
    announce()
    fareBeat()
  }, [reduced, s.phase, settle, streak, countN, fare.total, fareN, announce, fareBeat])
  const live = !reduced && s.phase < FINAL
  useSkipKey(skip, live)

  // ── what the phase draws ──
  const p = reduced ? FINAL : s.phase
  const skipped = s.skipped && !reduced
  const shine = !reduced && p >= FINAL
  const no = ticketNumber(days)
  const glyphs = sealGlyphs(days)
  const first = art.cells[0]?.date ?? result.day
  const sheetLabel = t.msSheetAria(streak, longDate(first, lang), longDate(result.day, lang))
  const notch = reduced || skipped ? 'cut' : (p >= 9 || s.clip ? 'punch' : 'none')
  const showClip = s.clip && !skipped && !reduced
  const fxK = clamp(sky / 266, 0.5, 1)
  const fxDx = stageW / 2 - 195 * fxK
  const fxSky = useMemo(() => ({
    w: stageW,
    h: sky + 154,
    k: fxK,
    dx: fxDx,
    dy: sky - 266 * fxK,
    spread: clamp(stageW / BOARD_W * 0.8 / fxK, 1, 2),
  }), [stageW, sky, fxK, fxDx])
  const rim = useMemo(() => {
    if (typeof Path2D === 'undefined') return null
    const edge = new Path2D()
    station.pts.forEach(([x, y], i) => (i ? edge.lineTo(x, y) : edge.moveTo(x, y)))
    const fill = new Path2D()
    station.pts.forEach(([x, y], i) => (i ? fill.lineTo(x, y) : fill.moveTo(x, y)))
    fill.lineTo(stageW + 6, 82)
    fill.lineTo(-6, 82)
    fill.closePath()
    return { ref: rimRef, edge, fill, w: stageW, x: bx => fxDx + bx * fxK }
  }, [station, stageW, fxK, fxDx])
  const ticketLabel = ticket
    ? (ticket.days === 30 ? t.msTicketMonthAria(no, longDate(result.day, lang)) : t.clrTicketAria(ticket.days, no, longDate(result.day, lang)))
    : null

  return (
    <main
      id="main-content"
      ref={rootRef}
      className={['ms-month', desk && 'ms-month--desk', skipped && 'clrk--skip', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}
      onClick={skip}
    >
      <svg className="clrk-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="ms-m-ink" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="1" seed="5" result="grain" />
            <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -10 0 0 0 6.6" result="voids" />
            <feComposite in="SourceGraphic" in2="voids" operator="in" />
          </filter>
        </defs>
      </svg>
      <div
        className={['ms-stage', reduced && 'clrk-fade'].filter(Boolean).join(' ')}
        style={{ width: stageW, height: colH, transform: scale < 1 ? `scale(${scale})` : undefined, '--ms-sky': sky + 4 }}
      >
        <Night stars={stars} shake={s.shake && !reduced} />
        {!reduced && <MemoFireworks mode={s.fx} sky={fxSky} rim={rim} scale={scale} />}
        {!reduced && (
          <StationView station={station} width={stageW} height={colH - sky - 22} rise={colH - sky + 22} top={sky - 4} up={p >= 6} lit={p >= 7} rimRef={rimRef} />
        )}
        <div className="ms-col" style={{ height: colH }}>
          <SheetView
            cells={art.cells} specks={art.specks} countCols={rollers.count} word={t.clrStreakWord} label={sheetLabel} glyphs={glyphs}
            inked={s.inked} p={Math.min(p, 7)} skipped={skipped} reduced={reduced}
            top={reduced ? geo.sheetRest : geo.sheetIn} sheetK={geo.sheetK}
          />
          <TicketView
            ticket={ticket} caption={ticket ? t.clrTicketCaption(ticket.days) : null} label={ticketLabel}
            top={geo.ticket} notch={notch} hidden={p < 8} flipIn={p >= 8} skipFade={skipped && s.skipFrom < 9}
            glint={s.glint} gx={s.gx} glintGo={Boolean(s.glint) && !reduced} clip={showClip}
          />
          <FareView top={geo.fare} p={p} cols={rollers.fare} shine={shine} fare={fare} days={days} />
          {p >= FINAL && (
            <div className="ms-m-actions" style={{ left: inset, right: inset, bottom: geo.pad }}>
              <QuietButton className="clrk-fade" style={{ '--d': '160ms' }} onClick={onShare}>{t.clrShare}</QuietButton>
              <GateButton compact arrive={!reduced} keys={desk} label={t.clrKeep} onClick={onKeep} />
            </div>
          )}
        </div>
      </div>
      <EnterKey onEnter={onKeep} disabled={live} />
    </main>
  )
}
