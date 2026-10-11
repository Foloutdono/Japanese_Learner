import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playDayClear, playFareTick, playStamp } from '../../lib/audio'
import { currentSession } from '../../lib/session'
import { DESK_SHORT_QUERY } from '../../hooks/useDesk'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { useRatingScale } from '../../stores/ratingScale'
import { EnterKey } from '../chrome/DeskKeys'
import { SideLookup } from '../analysis/SideLookup'
import {
  ClearHeader, WeekStamps, Slot, XpTotal, LevelBar, Odometer, XpChip, Reader, Seal, Specks,
  GateButton, VERDICT_INK, lineInk,
} from './kit'
import { dayName, longDate, weekParts } from './aria'
import { daysBefore, ticketName, weekdayKanji } from '../../domain/dayClear'
import { beatAt, countsAt, deskGeometry, deskPlan, faceLookup } from './deskPlan'

// ── 終着 — the everyday clear on the desk (plan 191) ──────────────────
// The canvas's Desk board ("Tsuji — the day cleared", 1440×900), less
// its drawn rail: in the app the real DeskRail stands at the left (the
// route's Shell), so this draws the centre and side columns in the
// space the Shell gives, at the board's own sizes where they fit (they
// do at 1440×900) and laid out again where they do not (deskPlan.js):
//
//   the sweep   the run's cards on a deck over a gate reader at the top
//               of the centre column, each diving through its slot --
//               the lamp flashing its verdict -- and thrown into its
//               place in the grid, sorted by verdict as it fills (eight
//               columns, as many rows as the run needs; a big run's
//               middle lands in bulk). The counter, the tally under the
//               grid and the fare at the side count the cards landed.
//   the stamp   the reader and the counter leave, a wave runs back
//               through the grid, the day's seal slams in the reader's
//               place, the name and the week row come in beside it, the
//               streak rolls, and the impression flies off the seal into
//               today's slot.
//   the fare    the streak's prime leaves the streak as a chip and lands
//               in the total, which counts on to its figure and shines.
//   the rest    tomorrow (the day, the ticket to come, the 運休 note) as
//               tall as the grid, and the gate, "Retour à la gare", with
//               its Entrée.
//
// A milestone day hands over after the stamp (`onHandover`): the
// milestone's own ceremony replaces the fare and the rest. A click or
// Enter skips to the rest; reduced motion is the rest at once, fades
// only. At rest a tile opens its card's dictionary entry in the side
// column (SideLookup, as a run's side does), a verdict in the tally
// lights its own tiles, and Enter is the gate. The third verdict
// (Parfaites) is a zone of its own only where the learner's rating bar
// offers Perfect; otherwise the grid sorts two.
//
// Props: as ClearPhone's (result, run, model, reduced, handover,
// onHandover, onFareBeat, onLeave).

const FAN = ['none', 'translate(9px,-7px) rotate(4.5deg)', 'translate(-10px,-11px) rotate(-5deg)']
const TICK_MS = 90
const SEAL_TILT = -8

// The type rungs a tile's words step down through (rem), largest first.
const TERM_RUNGS = [['title', 1.25], ['lead', 1.12], ['body', 0.95], ['sm', 0.82], ['cap', 0.72]]
const READ_RUNGS = [['cap', 0.72], ['xs', 0.62]]
// The largest rung each density starts from, and the room its padding leaves.
const DENSITY = {
  full: { term: 0, read: 0, pad: 18 },
  mid: { term: 1, read: 1, pad: 18 },
  small: { term: 3, read: 1, pad: 12 },
  chip: { term: 3, read: -1, pad: 26 },
}

// A character a full em wide: the CJK blocks and the full-width forms.
const wide = ch => {
  const c = ch.codePointAt(0)
  return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)
}
function widthEm(text) {
  let em = 0
  for (const ch of String(text ?? '')) em += wide(ch) ? 1.06 : 0.62
  return em
}
/** The largest rung, from `from`, at which `text` fits `room` px; the
 *  smallest, marked cut (an ellipsis), when none does. */
function fitRung(text, rungs, from, room, rem) {
  const em = widthEm(text)
  for (let i = from; i < rungs.length; i++) if (em * rungs[i][1] * rem <= room) return rungs[i][0]
  const last = rungs[rungs.length - 1]
  return em * last[1] * rem <= room + 3 ? last[0] : `${last[0]} clr-desk-cut`
}

const sum = a => a.reduce((x, y) => x + y, 0)

// ── a tile: the card thrown into its place, then a door to its entry ──
// Placed on the deck card's spot, dived and thrown by its own transforms:
// at rest (no animation) those transforms are the landing, so the rest
// state is the element's own style.
const Tile = memo(function Tile({ cd, x, y, w, h, z, termRung, readRung, label, dim, onOpen }) {
  const { face } = cd
  const latin = face.line === 'grammar' || face.line === 'kana'
  const mark = face.mastered ? '◆' : face.up ? '↑' : ''
  const style = {
    left: x, top: y, width: w, height: h, zIndex: z,
    '--d': `${cd.d}ms`, '--fd': `${cd.fd}ms`, '--ad': `${cd.ad}ms`, '--fa': `${cd.fa}ms`,
    '--la': `${cd.land - 30}ms`, '--fl': `${cd.land - cd.d}ms`, '--wd': `${cd.wd}ms`,
    '--tx': cd.tx, '--ty': cd.ty, '--lean': cd.lean,
  }
  return (
    <li className={['clr-desk-b', cd.streak && 'clr-desk-b--streak', dim && 'clr-desk-b--dim'].filter(Boolean).join(' ')} style={style}>
      <div className="clr-desk-ax"><div className="clr-desk-ay"><div className="clr-desk-lean"><div className="clr-desk-dv">
        <div className={cd.last ? 'clr-desk-land clr-desk-land--last' : 'clr-desk-land'}><div className="clr-desk-wv">
          <button
            type="button"
            className="clrk-tcard clr-desk-card clr-desk-tile"
            style={{ '--rail': VERDICT_INK[face.verdict] }}
            aria-label={label}
            onClick={onOpen ? e => onOpen(e, face) : undefined}
          >
            <span className={`clrk-tcard__term clr-desk-fs-${termRung}`} lang="ja">{face.term}</span>
            {face.kana && readRung ? (
              <span className={`clrk-tcard__read clr-desk-fs-${readRung}${latin ? ' clrk-tcard__read--latin' : ''}`} lang={latin ? undefined : 'ja'}>{face.kana}</span>
            ) : null}
            {mark && <span className={face.mastered ? 'clr-desk-mark clr-desk-mark--m' : 'clr-desk-mark'} aria-hidden="true">{mark}</span>}
          </button>
        </div></div>
      </div></div></div></div>
    </li>
  )
})

// ── the deck: the run's cards waiting over the reader, top one first ──
function DeckCard({ cd, x, y, w, h, k, lift, termRung, readRung, n }) {
  const { face } = cd
  const latin = face.line === 'grammar' || face.line === 'kana'
  const cls = ['clr-desk-a', k === 0 && 'clr-desk-a--top', k !== 0 && lift && 'clr-desk-a--lift'].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ left: x, top: y, width: w, height: h, zIndex: n - cd.i, '--ha': `${cd.ad}ms`, '--d': `${cd.d}ms`, '--fd': `${cd.fd}ms` }}>
      <div className="clr-desk-fan" style={{ transform: k >= 1 ? FAN[Math.min(k, 2)] : 'none', opacity: k >= 3 ? 0 : 1 }}>
        <div className="clr-desk-dv">
          <div className="clrk-tcard clr-desk-card" style={{ '--rail': lineInk(face.line) }}>
            <span className={`clrk-tcard__term clr-desk-fs-${termRung}`} lang="ja">{face.term}</span>
            {face.kana && readRung ? (
              <span className={`clrk-tcard__read clr-desk-fs-${readRung}${latin ? ' clrk-tcard__read--latin' : ''}`} lang={latin ? undefined : 'ja'}>{face.kana}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClearDesk({ result, model, reduced = false, handover = false, onHandover, onFareBeat, onLeave }) {
  const { t, lang } = useLang()
  const scale = useRatingScale()
  const compact = useMediaQuery(DESK_SHORT_QUERY)
  const [sizer, box] = useBoxSize(true)
  const { fare, level, tomorrow, next, rest, marks } = model
  const faces = model.cards
  const n = faces.length
  // The third verdict is a zone of its own only where the learner's bar
  // offers Perfect (or this run somehow got one).
  const perfect = scale === 'full' || model.piles[2] > 0

  // What the header's row needs beside the seal: the week (244), the
  // streak's figure (a 2.5rem tabular digit each) and its word, with room.
  const streakWord = t.clrDeskStreakWord(model.streak)
  const headW = Math.round((244 + 22 + String(model.streak).length * 25 + 8 + streakWord.length * 8.2) * 1.06)
  const geo = useMemo(
    () => (box ? deskGeometry({ width: box.width, height: box.height, count: n, compact, headW }) : null),
    [box, n, compact, headW],
  )
  const plan = useMemo(() => (geo ? deskPlan(faces, geo, { perfect }) : null), [faces, geo, perfect])
  const END = plan?.order.length ?? 16
  const IDX = useMemo(() => Object.fromEntries((plan?.order ?? []).map((k, i) => [k, i])), [plan])

  // ── the clock: the board's, read off the CSS animations' own start ──
  const INITIAL = { beat: 0, live: false, launched: 0, read: 0, landed: [0, 0, 0], xp: 0, skipped: false, skipFrom: 0, skipLanded: 0 }
  const [st, setSt] = useState(INITIAL)
  const timers = useRef([])
  const raf = useRef(0)
  const t0 = useRef(0)
  const synced = useRef(false)
  const clockEl = useRef(null)
  const fired = useRef({ tick: -1e9, landed: 0, xp: 0 })
  const planRef = useRef(plan)
  const cb = useRef({ onHandover, onFareBeat })
  useEffect(() => { planRef.current = plan; cb.current = { onHandover, onFareBeat } })

  const once = useCallback((key, fn) => {
    if (fired.current[key]) return
    fired.current[key] = true
    fn()
  }, [])
  const hand = useCallback(() => once('hand', () => cb.current.onHandover?.()), [once])
  const fareBeat = useCallback(() => once('fare', () => cb.current.onFareBeat?.()), [once])

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  // Reduced motion: the rest at once, and what the rest owes.
  useEffect(() => {
    if (!reduced) return
    once('settle', playDayClear)
    if (handover) hand()
    else fareBeat()
  }, [reduced, handover, hand, fareBeat, once])

  // The scene mounts still (the deck shown, the tiles unseen), then goes live.
  useEffect(() => {
    if (reduced || !geo) return undefined
    const id = setTimeout(() => setSt(s => (s.beat === 0 && !s.skipped ? { ...s, beat: 1 } : s)), 40)
    timers.current.push(id)
    return () => clearTimeout(id)
  }, [reduced, geo])
  useEffect(() => {
    if (reduced || st.beat < 1 || st.live || st.skipped || st.beat >= END) return undefined
    // Live on the next frame, once the mount's long task is behind it.
    const id = requestAnimationFrame(() => setSt(s => (s.skipped ? s : { ...s, live: true })))
    return () => cancelAnimationFrame(id)
  }, [reduced, st.beat, st.live, st.skipped, END])

  // The frame loop calls the latest step through a ref, so a step that
  // changes (a new fare, a handover) is the one the next frame runs.
  const stepRef = useRef(null)
  const tick = useCallback(now => stepRef.current?.(now), [])
  const step = useCallback(now => {
    const p = planRef.current
    if (!p) return
    if (!synced.current) {
      // The beats' origin is the CSS animations' own start time (the
      // frame they were first drawn in), read off the clock once set.
      const a = clockEl.current?.getAnimations ? clockEl.current.getAnimations()[0] : null
      if (a && a.startTime != null) { t0.current = a.startTime; synced.current = true }
      else if (now - t0.current < 400) { raf.current = requestAnimationFrame(tick); return }
      else synced.current = true
    }
    const tm = now - t0.current
    const beat = beatAt(p, tm)
    const { launched, read, landed } = countsAt(p, tm)
    const down = sum(landed)
    const total = p.cards.length
    let xp = total ? Math.round(fare.run * down / total) : fare.run
    if (fare.bonus > 0 && tm >= p.B.MERGE) {
      const k = Math.min(1, (tm - p.B.MERGE) / 560)
      xp = fare.run + Math.round(fare.bonus * (1 - (1 - k) ** 3))
    }
    // The sounds: a fare tick as cards land and as the prime counts in,
    // the stamp's hit, the day-clear voice as it settles.
    const f = fired.current
    if ((down > f.landed || xp > f.xp) && tm - f.tick >= TICK_MS) { playFareTick(); f.tick = tm }
    f.landed = down
    f.xp = xp
    if (tm >= p.B.IMPACT) once('impact', playStamp)
    if (tm >= p.B.IMPACT + 290) once('settle', playDayClear)
    setSt(s => {
      if (s.skipped || !s.live) return s
      if (beat === s.beat && launched === s.launched && read === s.read && xp === s.xp
        && landed.every((x, i) => x === s.landed[i])) return s
      return { ...s, beat, launched, read, landed, xp }
    })
    if (handover && tm >= p.B.HAND) { raf.current = 0; hand(); return }
    if (!handover && tm >= p.B.LANDED) fareBeat()
    raf.current = beat < p.order.length ? requestAnimationFrame(tick) : 0
  }, [fare.run, fare.bonus, handover, hand, fareBeat, once, tick])
  useEffect(() => { stepRef.current = step })

  useEffect(() => {
    if (!st.live || st.skipped) return undefined
    raf.current = requestAnimationFrame(now => { t0.current = now; synced.current = false; step(now) })
    return () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0 }
  }, [st.live, st.skipped, step])
  useEffect(() => stop, [stop])

  const done = reduced || st.skipped || st.beat >= END
  const skip = useCallback(() => {
    if (reduced || st.skipped || st.beat >= END) return
    if (handover) { stop(); hand(); return }
    stop()
    setSt(s => ({
      ...s, beat: END, live: false, skipped: true,
      skipFrom: s.live ? s.beat : (s.beat >= 1 ? 1 : 0),
      skipLanded: s.live ? sum(s.landed) : 0,
    }))
    once('settle', playDayClear)
    fareBeat()
  }, [reduced, st.skipped, st.beat, END, handover, stop, hand, fareBeat, once])

  // ── the entry a tile opens, in the side column ──
  const [entry, setEntry] = useState(null)
  const [session, setSession] = useState(null)
  const opener = useRef(null)
  useEffect(() => {
    let live = true
    currentSession().then(s => { if (live) setSession(s) })
    return () => { live = false }
  }, [])
  const open = useCallback((e, face) => {
    if (!done) return
    const lookup = faceLookup(face)
    if (!lookup) return
    opener.current = e.currentTarget
    setEntry({ ...lookup, key: face.id })
  }, [done])
  const close = useCallback(() => {
    setEntry(null)
    const el = opener.current
    if (el?.isConnected) requestAnimationFrame(() => el.focus({ preventScroll: true }))
  }, [])
  const [only, setOnly] = useState(null)

  // The tiles' type, fitted once per layout.
  const rem = useMemo(() => {
    const px = typeof window === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize)
    return Number.isFinite(px) && px > 0 ? px : 16
  }, [])
  const rungs = useMemo(() => {
    if (!geo || !plan) return []
    const dn = DENSITY[geo.density]
    const room = geo.tileW - dn.pad
    return plan.cards.map(cd => ({
      term: fitRung(cd.face.term, TERM_RUNGS, dn.term, room, rem),
      read: dn.read < 0 ? null : fitRung(cd.face.kana, READ_RUNGS, dn.read, room, rem),
    }))
  }, [geo, plan, rem])

  const labels = useMemo(() => faces.map(face => {
    const v = t.clrVerdicts[face.verdict] ?? ''
    const extra = face.mastered ? `, ${t.clrCardMastered}` : face.up ? `, ${t.clrCardUp}` : ''
    return `${face.term}, ${v}${extra}`
  }), [faces, t])

  // Enter: the one way on -- a skip while the ceremony plays, the gate at
  // rest. One listener for the screen's life, reading the latest answer.
  const enterTo = useRef(null)
  useEffect(() => { enterTo.current = done ? onLeave : skip })
  const enter = useCallback(() => enterTo.current?.(), [])
  const leave = useCallback(e => { e.stopPropagation(); onLeave?.() }, [onLeave])

  if (!geo || !plan) {
    return (
      <main id="main-content" className="clr-desk">
        <div ref={sizer} className="clr-desk__sizer" aria-hidden="true" />
      </main>
    )
  }

  // ── what the frame shows, as the board's renderVals ──
  const atRest = reduced || st.skipped
  const b = reduced ? END : st.beat
  const is = k => b >= IDX[k] + 1
  const scene = b >= 1
  const live = !atRest && st.live
  const pre = !atRest && scene && !st.live
  const running = live || pre
  // After a skip, what was on screen stays put; only what had not come
  // yet fades in (a reduced scene fades in whole).
  const shown = k => st.skipped && !reduced && st.skipFrom >= IDX[k] + 1
  const ent = k => (atRest ? (shown(k) ? '' : 'clrk-fade') : 'clrk-arrive')
  const read = atRest ? n : st.read
  const launched = atRest ? n : st.launched
  const counts = atRest ? plan.finals : st.landed.slice(0, plan.verdicts.length)
  const landed = sum(counts)
  const xp = atRest ? fare.total : st.xp
  const pressed = is('PRESSED')
  const merged = is('MERGE')
  const lastV = plan.cards[n - 1]?.v

  const em = read > 0 ? plan.emits.of[read - 1] : -1
  const lampVerdict = read === 0 ? 1 : plan.cards[read - 1].face.verdict
  const rips = [0, 1, 2, 3].map(j => {
    const e = em >= j ? em - ((em - j) % 4) : -1
    return { cls: e < 0 ? 'clr-desk-rip' : `clr-desk-rip ${Math.floor(e / 4) % 2 ? 'clr-desk-rip--b' : 'clr-desk-rip--a'}`, v: e < 0 ? 1 : plan.emits.verdict[e] }
  })

  const streakNow = model.already || is('ROLL') ? model.streak : Math.max(0, model.streak - 1)
  const shine = !reduced && (st.skipped || (merged && xp === fare.total))
  const lvlTo = level ? (atRest ? level.to : level.from + (level.to - level.from) * (fare.total ? xp / fare.total : 1)) : 0
  const tomorrowDay = result?.day ? daysBefore(result.day, -1) : null
  const inDays = next.milestone != null ? next.milestone - model.streak : null
  const restAt = rest?.next_at ? t.clrDeskRestAt(rest.next_at, (rest.held ?? 0) === 0) : null

  const rootCls = [
    'clr-desk', `clr-desk--${geo.density}`,
    reduced && 'clrk--reduced', st.skipped && !reduced && 'clrk--skip',
  ].filter(Boolean).join(' ')
  const worldStyle = { height: geo.height, '--dive': geo.dive }
  const tileBox = { width: geo.tileW, height: geo.tileH }

  // The mini stamp's flight: off the seal and into today's slot.
  const sealCx = geo.x0 + geo.seal / 2
  const sealCy = geo.sealY + geo.seal / 2
  const slotCx = geo.hdrX + 6 * 36 + 14
  const slotCy = geo.weekY + 24
  const miniStyle = {
    left: geo.x0, top: geo.sealY, width: geo.seal, height: geo.seal,
    '--mx': Math.round(slotCx - sealCx), '--my': Math.round(slotCy - sealCy),
    '--mdip': Math.round(slotCy - sealCy + 59 * geo.seal / 200), '--mlift': Math.round(16 * geo.seal / 200),
    '--ms': (50 / geo.seal).toFixed(3), '--mmid': (80 / geo.seal).toFixed(3),
  }
  const specks = SPECKS.map(([deg, sz], j) => {
    const a = deg * Math.PI / 180
    const r = 94 * geo.seal / 200
    const out = 12 + (j % 3) * 7
    const c = geo.seal / 2
    return { x: Math.round(c + Math.cos(a) * r - sz / 2), y: Math.round(c + Math.sin(a) * r - sz / 2), s: sz, dx: Math.round(Math.cos(a) * out), dy: Math.round(Math.sin(a) * out), d: (j % 3) * 18 }
  })

  return (
    <main id="main-content" className={rootCls} onClick={done ? undefined : skip}>
      <div ref={sizer} className="clr-desk__sizer" aria-hidden="true" />
      <div className={['clr-desk__world', live && is('IMPACT') && !is('FINAL') && 'clrk-shake'].filter(Boolean).join(' ')} style={worldStyle}>

        {running && !is('FINAL') && plan.holes.map((h, i) => (
          <span key={i} className="clr-desk-hole clrk-fade" style={{ left: h.x, top: h.y, ...tileBox, '--d': `${h.d}ms` }} aria-hidden="true" />
        ))}

        {scene && (
          <div className="clr-desk-tally" style={{ left: geo.x0, top: geo.tallyTop, width: geo.centre, height: geo.gate }}>
            <div className="clr-desk-verdicts">
              {plan.verdicts.map(v => {
                let numCls = 'clr-desk-verdict__n'
                if (live && landed === n && v === lastV) numCls += ' clr-desk-thud'
                else if (live && counts[v] > 0) numCls += counts[v] % 2 ? ' clrk-bump-a' : ' clrk-bump-b'
                return (
                  <button
                    key={v} type="button"
                    className={['clr-desk-verdict', ent('SWEEP')].filter(Boolean).join(' ')}
                    style={{ '--ink': VERDICT_INK[v], '--d': `${atRest ? 0 : 120 + v * 50}ms` }}
                    aria-pressed={only === v}
                    aria-label={t.clrPileAria(t.clrPiles[v], counts[v])}
                    onClick={done ? () => setOnly(o => (o === v ? null : v)) : undefined}
                  >
                    <span className={numCls} style={{ '--w': String(plan.finals[v]).length }}>{counts[v]}</span>
                    <span className="clr-desk-verdict__name">{t.clrPiles[v]}</span>
                  </button>
                )
              })}
            </div>
            {is('TAIL') && (
              <p className={['clr-desk-summary', !(atRest && shown('TAIL')) && 'clrk-fade'].filter(Boolean).join(' ')} style={{ '--d': `${atRest ? 0 : 200}ms` }}>
                {marks.up > 0 && <span><i aria-hidden="true">↑</i> <b>{marks.up}</b> {t.clrSumUp(marks.up)}</span>}
                {marks.up > 0 && (marks.mastered > 0 || model.minutes != null) && <span aria-hidden="true">·</span>}
                {marks.mastered > 0 && <span><i aria-hidden="true">◆</i> <b>{marks.mastered}</b> {t.clrSumMastered(marks.mastered)}</span>}
                {marks.mastered > 0 && model.minutes != null && <span aria-hidden="true">·</span>}
                {model.minutes != null && <span><b>{model.minutes}</b> {t.clrSumMin}</span>}
              </p>
            )}
          </div>
        )}

        <div
          className={[
            'clr-desk-clipB', pre && 'clr-desk-pre', live && 'clr-desk-live', live && is('WAVE') && 'clr-desk-wave',
            atRest && (reduced || st.skipLanded === 0) && 'clrk-fade',
          ].filter(Boolean).join(' ')}
          style={{ top: geo.readerFoot, width: geo.sideX, height: geo.height - geo.readerFoot }}
        >
          <span className="clr-desk-clock" ref={clockEl} aria-hidden="true" />
          <ol
            className={['clr-desk__grid', only != null && `clr-desk__grid--only`].filter(Boolean).join(' ')}
            style={{ top: -geo.readerFoot }}
            aria-label={t.clrDeskGridAria(n)}
          >
            {scene && plan.cards.map((cd, i) => (
              <Tile
                key={cd.face.id ?? i}
                cd={cd}
                x={geo.deckX} y={geo.deckY} w={geo.tileW} h={geo.tileH}
                z={i + 1}
                termRung={rungs[i]?.term ?? 'title'}
                readRung={rungs[i]?.read}
                label={labels[i]}
                dim={only != null && cd.v !== only}
                onOpen={done && faceLookup(cd.face) ? open : undefined}
              />
            ))}
          </ol>
        </div>

        {running && !is('DONE') && (
          <div
            className={['clr-desk-reader', is('READER_OUT') ? 'clr-desk-reader--out' : 'clrk-arrive'].join(' ')}
            style={{ left: geo.readerX, top: geo.readerY, width: geo.readerW }}
            aria-hidden="true"
          >
            <Reader flash={em + 1} verdict={lampVerdict} />
            {rips.map((r, j) => <span key={j} className={r.cls} style={{ '--rc': VERDICT_INK[r.v] }} />)}
          </div>
        )}

        {running && !is('DONE') && (
          <div className={['clr-desk-clipA', live ? 'clr-desk-live' : 'clr-desk-pre'].join(' ')} style={{ width: geo.x0 + geo.readerW + 48, height: geo.slotLine }} aria-hidden="true">
            <div className="clr-desk-deck clrk-arrive">
              {plan.cards.map((cd, i) => {
                const k = i - launched
                return (
                  <DeckCard
                    key={cd.face.id ?? i} cd={cd} x={geo.deckX} y={geo.deckY} w={geo.tileW} h={geo.tileH}
                    k={k} lift={k < 0 && read <= i} termRung={rungs[i]?.term ?? 'title'} readRung={rungs[i]?.read} n={n}
                  />
                )
              })}
            </div>
          </div>
        )}

        {running && !is('IMPACT') && (
          <div className={['clr-desk-count', is('DONE') ? 'clr-desk-out' : 'clrk-arrive'].join(' ')} style={{ left: geo.hdrX, top: geo.countY }}>
            <p className="clr-desk-count__cap">{t.clrTripOfDay}</p>
            <p className="clr-desk-count__n"><span className="clr-desk-count__big">{landed}</span><span className="clr-desk-count__of">/ {n}</span></p>
            <span className="clr-desk-prog" aria-hidden="true"><i className="clr-desk-prog__fill" style={{ '--p': n ? (landed / n).toFixed(3) : 1 }} /></span>
          </div>
        )}

        {is('IMPACT') && (
          <>
            <ClearHeader
              cap="本日の運行 終了"
              title={t.clrTitle}
              className={['clr-desk-hdr', ent('IMPACT')].filter(Boolean).join(' ')}
              style={{ left: geo.hdrX, top: geo.hdrY, '--d': `${atRest ? 0 : 40}ms` }}
            />
            <div className={geo.stacked ? 'clr-desk-weekrow clr-desk-weekrow--stacked' : 'clr-desk-weekrow'} style={{ left: geo.hdrX, top: geo.weekY, width: geo.headWidth }}>
              <WeekStamps
                week={model.week}
                pending={!pressed}
                label={t.clrWeekAria(weekParts(model.week, t, lang, { pending: !pressed }))}
                slotProps={(entryDay, i) => {
                  const today = i === model.week.length - 1
                  let cls = ''
                  let d = null
                  if (atRest) { if (!shown('IMPACT') || (today && !shown('PRESSED'))) cls = 'clrk-fade' }
                  else if (!pressed) { cls = 'clr-desk-slot-in'; d = 120 + i * 35 }
                  else if (today) cls = 'clr-desk-press'
                  else if (entryDay.state !== 'missed') { cls = 'clr-desk-ripple'; d = 80 + (5 - i) * 40 }
                  return { className: cls, style: d == null ? undefined : { '--d': `${d}ms` } }
                }}
              />
              <p className={['clr-desk-streak', ent('IMPACT')].filter(Boolean).join(' ')} style={{ '--d': `${atRest ? 0 : 120}ms` }}>
                <Odometer value={streakNow} label={t.clrStreakDays(streakNow)} className="clr-desk-streak__odo" />
                <span className="clr-desk-streak__cap" aria-hidden="true">{t.clrDeskStreakWord(streakNow)}</span>
              </p>
            </div>
          </>
        )}

        {is('SEAL') && model.seal && (
          <div className={['clr-desk-seal', atRest ? (shown('IMPACT') ? '' : 'clrk-fade') : 'clr-desk-seal--live'].filter(Boolean).join(' ')} style={{ left: geo.x0, top: geo.sealY, width: geo.seal, height: geo.seal }}>
            <span className="clr-desk-seal__shadow" />
            <div className="clr-desk-seal__drop">
              <Seal day={model.seal.day} foot={model.seal.foot} size={geo.seal} tilt={SEAL_TILT} label={t.clrSealAria(longDate(result.day, lang))} />
            </div>
          </div>
        )}

        {live && is('IMPACT') && !is('FINAL') && (
          <div className="clr-desk-impact" style={{ left: geo.x0, top: geo.sealY, width: geo.seal, height: geo.seal }} aria-hidden="true">
            <span className="clr-desk-ink" />
            <span className="clr-desk-bloom" />
            <span className="clr-desk-bloom clr-desk-bloom--2" />
            <Specks specks={specks} />
          </div>
        )}

        {live && is('FLY') && !pressed && model.seal && (
          <div className="clr-desk-mini" style={miniStyle} aria-hidden="true">
            <div className="clr-desk-mx"><div className="clr-desk-my">
              <span className="clr-desk-mini__shadow" />
              <span className="clr-desk-mini__disc" />
              <Seal day={model.seal.day} foot={model.seal.foot} size={geo.seal} tilt={SEAL_TILT} />
            </div></div>
          </div>
        )}

        <div className={['clr-desk-side', entry && 'clr-desk-side--entry'].filter(Boolean).join(' ')} style={{ left: geo.sideX, top: geo.fareY, width: geo.side, height: geo.bandTop + geo.band - geo.fareY }}>
          <SideLookup lookup={entry} onExit={close} session={session}>
            {(atRest || (scene && landed >= 1)) && (
              <div
                className={['clrk-card clr-desk-fare', geo.fareH < 150 && 'clr-desk-fare--tight', atRest ? (st.skipped && !reduced && st.skipLanded >= 1 ? '' : 'clrk-fade') : 'clrk-arrive'].filter(Boolean).join(' ')}
                style={{ height: geo.fareH }}
              >
                <p className={['clr-desk-total', live && merged && 'clrk-bump-a'].filter(Boolean).join(' ')}>
                  <XpTotal
                    value={xp}
                    unit={t.clrXpUnit}
                    shine={shine}
                    glints={shine ? glintsFor(fare.total) : []}
                    figureClass="clr-desk-total__xp"
                  />
                </p>
                <p className={['clr-desk-break', merged ? (atRest && shown('MERGE') ? '' : 'clrk-fade') : 'clrk-hide'].filter(Boolean).join(' ')}>
                  <span><b>+{fare.run}</b> {t.clrFareRun}</span>
                  {fare.bonus > 0 && <span aria-hidden="true">·</span>}
                  {fare.bonus > 0 && <span><b>+{fare.bonus}</b> {t.clrFarePrime}</span>}
                </p>
                {level && (
                  <div className="clr-desk-lvlrow">
                    <span className="clr-desk-lvlrow__n">{level.level}</span>
                    <LevelBar from={level.from} to={lvlTo} label={t.clrLevelAria(level.level, Math.round(lvlTo * 100))} />
                    <span className="clr-desk-lvlrow__n">{level.next}</span>
                  </div>
                )}
              </div>
            )}

            {is('TAIL') && (
              <div
                className={['clrk-dash clr-desk-tom', ent('TAIL')].filter(Boolean).join(' ')}
                style={{ top: geo.bandTop - geo.fareY, height: geo.band, '--d': `${atRest ? 0 : 60}ms` }}
              >
                {tomorrow && tomorrowDay && (
                  <div className="clr-desk-tom__head">
                    <Slot glyph={weekdayKanji(tomorrowDay)} state="wait" tilt={-3} className="clr-desk-tom__slot" aria-hidden="true" />
                    <div>
                      <p className="clr-desk-tom__day">{t.clrTomorrowDay(dayName(tomorrowDay, lang))}</p>
                      <p className="clr-desk-tom__sub">{tomorrow.cards > 0 ? t.clrTomorrowSub(tomorrow.cards, tomorrow.minutes) : t.clrDeskTomorrowNone}</p>
                    </div>
                  </div>
                )}
                {inDays != null && inDays > 0 && (
                  <>
                    <div className="clr-desk-next" role="img" aria-label={t.clrDeskNextAria(next.milestone, inDays)}>
                      <span className="clr-desk-next__name" lang="ja" aria-hidden="true">{ticketName(next.milestone)}</span>
                      <span className="clr-desk-next__tag" aria-hidden="true">{inDays === 1 ? t.clrNextTag : t.clrDeskNextIn(inDays)}</span>
                    </div>
                    <p className="clr-desk-tom__line">
                      {next.milestone}<span className="clr-desk-sup">{t.clrOrdinalSuffix(next.milestone)}</span>{t.clrNextDay}{t.clrNextTicketName(next.milestone)}
                      {next.jackpot ? <> <b className="clr-desk-gold">+{next.jackpot} {t.clrXpUnit}</b></> : null}
                    </p>
                  </>
                )}
                <div className="clr-desk-tom__rest">
                  <Slot state="rest" className={(rest?.held ?? 0) === 0 ? 'clr-desk-stub clr-desk-stub--empty' : 'clr-desk-stub'} aria-hidden="true" />
                  <p className="clr-desk-tom__resttxt">
                    <b>{t.clrRestTitle}</b>
                    <span><span className="clr-desk-num">{rest?.held ?? 0}</span> {t.clrRestHeld}</span>
                    {restAt && (
                      <span>{restAt.pre}<span className="clr-desk-num">{rest.next_at}</span>{restAt.sup && <span className="clr-desk-sup">{restAt.sup}</span>}{restAt.post}</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </SideLookup>
        </div>

        {is('TAIL') && (
          <div className="clr-desk-gatewrap" style={{ left: geo.sideX, top: geo.tallyTop, width: geo.side }}>
            <GateButton
              compact keys label={t.backToStation} onClick={leave}
              arrive={!(atRest && shown('TAIL'))}
              arriveDelay={atRest ? 0 : 400}
              className="clr-desk-gate"
            />
          </div>
        )}

        {live && is('CHIP') && !merged && fare.bonus > 0 && <PrimeChip bonus={fare.bonus} label={t.clrPrimeChip} />}
      </div>
      <EnterKey onEnter={enter} disabled={Boolean(entry)} />
    </main>
  )
}

// The rim's ink specks (deg, size): the board's ten, round the seal's edge.
const SPECKS = [[-28, 6], [16, 4], [58, 5], [100, 6], [146, 4], [192, 5], [232, 4], [270, 6], [312, 4], [344, 5]]

// The total's glints: one by its top-right shoulder, one at its left
// foot, one over its first digit -- the board's three, placed for the
// figure's width (a tabular digit is .62em of the 2.5rem figure).
function glintsFor(total) {
  const chars = 1 + String(Math.max(0, Math.round(total))).length
  const w = chars * 0.62 * 40
  return [
    { x: Math.round(w + 7), y: -1, size: 12, delay: 900 },
    { x: -5, y: 31, size: 8, delay: 2100 },
    { x: 35, y: -3, size: 8, delay: 3300 },
  ]
}

// ── the prime: out of the streak figure, over the name's end, into the total ──
// Measured at its beat, so the flight starts on the streak's figure and
// ends on the total whatever the window's layout.
function PrimeChip({ bonus, label }) {
  const ref = useRef(null)
  const [path, setPath] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    const world = el?.parentElement
    const from = world?.querySelector('.clr-desk-streak__odo')
    const to = world?.querySelector('.clr-desk-total__xp')
    if (!world || !from || !to) return
    const w = world.getBoundingClientRect()
    const a = from.getBoundingClientRect()
    const z = to.getBoundingClientRect()
    const x = a.left + a.width / 2 - w.left
    const y = a.top + a.height / 2 - w.top
    const dx = z.left + z.width / 2 - w.left - x
    const dy = z.top + z.height / 2 - w.top - y
    setPath({ x, y, dx: Math.round(dx), dy: Math.round(dy) })
  }, [])
  const style = path
    ? { left: path.x, top: path.y, '--cx': path.dx, '--cx1': Math.round(path.dx * 47 / 381), '--cy': path.dy, '--cy2': Math.min(path.dy, 0) - 23 }
    : { visibility: 'hidden' }
  return (
    <div ref={ref} className="clr-desk-chip" style={style} aria-hidden="true">
      {path && <div className="clr-desk-chipx"><div className="clr-desk-chipy"><XpChip amount={bonus} label={label} /></div></div>}
    </div>
  )
}
