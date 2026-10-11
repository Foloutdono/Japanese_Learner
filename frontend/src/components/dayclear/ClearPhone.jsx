import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playDayClear, playFareTick, playStamp } from '../../lib/audio'
import { composing } from '../../lib/keyGuards'
import { dialogOpen } from '../../lib/dialogOpen'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { useRatingScale } from '../../stores/ratingScale'
import {
  ClearHeader, WeekStamps, XpTotal, XpChip, LevelBar, Slot, Reader, RunCard, Seal, Bloom, Specks, GateButton,
  VERDICT_INK,
} from './kit'
import { longDate, weekParts } from './aria'
import { daysBefore, weekdayKanji } from '../../domain/dayClear'
import { fareAt, layoutFor, pileOf, sealSpecks, sweepPlan } from './sweep'
import PileSheet from './PileSheet'

// ── 終着 — the everyday clear on a phone (plan 191) ───────────────────
// The canvas's Main board (390×844), as drawn: the run's cards fanned
// in a deck under the count of the day's trip, swept one by one through
// a gate reader -- each card lifts, dives through the slot, the lamp
// flashing its verdict's ink with a ripple off the mark, then arcs (an X
// and a Y of their own, a seeded jitter) onto its pile, which bumps --
// at a pace that accelerates from 260 to 40ms and slows for the last
// three; the count becomes the header and the reader steps away; the
// day's station stamp drops from above and slams into the reader's
// place (the screen shakes 3px, the ink takes with its grain, a bloom,
// specks), the streak rolls under it, the impression flies on an arc
// into today's slot of the week row while the piles rise; the figure
// glides home as the fare arrives, the prime's chip flies into the total
// and it counts, the level bar fills; then the rest: the piles as
// buttons, the run's summary, tomorrow's dashed strip and the gate.
// Drawn full screen, without the HUD or the tab bar (the route's stage
// frame).
//
// The board's numbers are components/dayclear/sweep.js; this file draws
// them. One clock: the cards fly on CSS animations started in one style
// pass, and the beats read that clock (an invisible animation of their
// own, .clr-phone__clock), so a beat never drifts off the flight it
// follows.
//
// A tap, a click or Enter skips to the rest (what was on screen stays
// still, what was not fades in); reduced motion is the rest at once,
// fades only. On a milestone day (`handover`) the everyday stamp is the
// first half of the ceremony: the streak is shown and taken home unrolled
// (the milestone rolls it), the piles fade instead of rising, and once
// the figure is home onHandover() hands the screen over -- no fare, no
// rest. A skip on a milestone day hands over at once.
//
// The piles: three when the learner's bar offers Perfect (or the run
// holds one), else two -- À revoir and Justes -- centred, Perfect folded
// into Justes. At rest each pile opens the list of its cards, each card
// its dictionary entry (PileSheet).
//
// Props (the contract DayClearView relies on):
//   result    POST /api/today/clear's cleared answer
//   run       the run's tally: { at, cleared, xp, minutes, cards }
//   model     domain/dayClear's clearModel(result, run)
//   reduced   the rest state at once, fades only (root: .clrk--reduced)
//   handover  a milestone day: hand over after the stamp beat
//   onHandover()  the stamp beat is done on a milestone day
//   onFareBeat()  the fare has landed (the view then plays a level-up)
//   onLeave()     the gate: back to the station (/today)
const INK = VERDICT_INK
const CAP = '本日の運行 終了'

// The xp glints: the board's three stars round "+252" at 4.5rem, as
// offsets from the figure's right edge (the first) or its left (the
// others), so a figure of another width keeps them in its corners.
const GLINTS = [
  { right: 6, y: 2, size: 14, delay: 900 },
  { x: -6, y: 52, size: 10, delay: 2100 },
  { x: 54, y: -3, size: 10, delay: 3300 },
]

// The frame's height before it is measured: a stage is the whole window.
function frameHeight() {
  return typeof window === 'undefined' ? 844 : window.innerHeight
}

export default function ClearPhone({ result, model, reduced = false, handover = false, onHandover, onFareBeat, onLeave }) {
  const { t, lang } = useLang()
  const scale = useRatingScale()
  const cards = useMemo(() => model.cards ?? [], [model.cards])
  // The piles are decided once, with the run: a bar that offers Perfect
  // -- or a run that holds one, rated on such a bar -- has three.
  const [piles] = useState(() => (scale === 'full' || cards.some(c => c.verdict === 2) ? 3 : 2))
  const plan = useMemo(() => sweepPlan(cards, { piles }), [cards, piles])
  const specks = useMemo(() => sealSpecks(), [])
  const B = plan.beats
  const IDX = useMemo(() => Object.fromEntries(plan.order.map((k, i) => [k, i + 1])), [plan])
  const FINAL = plan.order.length
  // A milestone day stops at HOME: the rest is the milestone's.
  const END = handover ? IDX.HOME : FINAL
  const n = plan.flights.length

  const [setFrame, size] = useBoxSize(true)
  const lay = layoutFor(size?.height ?? frameHeight())

  const [st, setSt] = useState(() => ({
    beat: reduced ? FINAL : 0, launched: 0, read: 0, landed: 0, xp: model.fare.run,
    skipped: false, skipBeat: 0, skipLanded: 0,
  }))
  const stRef = useRef(st)
  useEffect(() => { stRef.current = st })

  // The callbacks a beat fires, read through a ref: the view hands new
  // arrow functions on every render.
  const cb = useRef({ onHandover, onFareBeat })
  useEffect(() => { cb.current = { onHandover, onFareBeat } })
  const fired = useRef({ stamp: false, clear: false, fare: false, handed: false })
  const fire = useCallback(what => {
    if (fired.current[what]) return
    fired.current[what] = true
    if (what === 'stamp') playStamp()
    else if (what === 'clear') playDayClear()
    else if (what === 'fare') cb.current.onFareBeat?.()
    else if (what === 'handed') cb.current.onHandover?.()
  }, [])

  // ── the clock ──
  const clockEl = useRef(null)
  const raf = useRef(0)
  const t0 = useRef(0)
  const tick = useRef(0)
  useEffect(() => {
    if (reduced) {
      // The rest, now: the arrival heard, the fare (or the handover) said.
      fire('clear')
      fire(handover ? 'handed' : 'fare')
      return undefined
    }
    let anim = null
    const clock = now => {
      if (!anim && clockEl.current?.getAnimations) anim = clockEl.current.getAnimations()[0] ?? null
      if (anim && anim.playState !== 'idle' && anim.currentTime != null) return Number(anim.currentTime)
      return now - t0.current
    }
    const count = (arr, at) => { let k = 0; for (let i = 0; i < arr.length; i++) if (arr[i] <= at) k++; return k }
    const step = now => {
      const at = clock(now)
      let beat = 1
      for (let i = 0; i < plan.order.length; i++) if (B[plan.order[i]] <= at) beat = i + 1
      beat = Math.min(beat, END)
      const xp = handover ? model.fare.run : fareAt(at, B.MERGE, model.fare.run, model.fare.total)
      const s = stRef.current
      if (s.skipped) return
      const next = { beat, launched: count(plan.L, at), read: count(plan.R, at), landed: count(plan.A, at), xp }
      if (next.beat !== s.beat || next.launched !== s.launched || next.read !== s.read || next.landed !== s.landed || next.xp !== s.xp) {
        setSt(p => ({ ...p, ...next }))
      }
      // The beats' sounds and hand-offs, each once, however a frame falls.
      if (at >= B.IMPACT) fire('stamp')
      if (at >= B.PRESSED) fire('clear')
      if (!handover && xp !== s.xp && now - tick.current > 64) { tick.current = now; playFareTick() }
      if (!handover && at >= B.MERGE + 520) fire('fare')
      if (beat >= END) {
        raf.current = 0
        if (handover) fire('handed')
        return
      }
      raf.current = requestAnimationFrame(step)
    }
    // Beat 0 shows the deck with every flight at its first frame; two
    // frames later the flights start by a class, and the beats read the
    // flights' own clock from then on.
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        setSt(p => ({ ...p, beat: 1 }))
        raf.current = requestAnimationFrame(ts => { t0.current = ts; step(ts) })
      })
    })
    return () => cancelAnimationFrame(raf.current)
    // The plan is the screen's constant timeline: one run per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const skip = useCallback(() => {
    const s = stRef.current
    if (reduced || s.skipped || s.beat >= END) return
    cancelAnimationFrame(raf.current)
    raf.current = 0
    if (handover) {
      fire('handed')
      return
    }
    setSt({ ...s, beat: FINAL, launched: n, read: n, landed: n, xp: model.fare.total, skipped: true, skipBeat: s.beat, skipLanded: s.landed })
    fire('clear')
    fire('fare')
  }, [reduced, END, FINAL, handover, n, model.fare.total, fire])

  // Enter skips too (a key, where a tap would); at rest it is the
  // focused control's.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Enter' || e.repeat || e.defaultPrevented || composing(e) || dialogOpen()) return
      const s = stRef.current
      if (reduced || s.skipped || s.beat >= END) return
      e.preventDefault()
      skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [skip, reduced, END])

  // ── what each beat shows (the board's renderVals) ──
  const atRest = reduced || st.skipped
  const b = reduced ? FINAL : st.beat
  const is = k => b >= IDX[k]
  const launched = atRest ? n : st.launched
  const read = atRest ? n : st.read
  const landed = atRest ? n : st.landed
  const live = b >= 1 && !atRest
  const skipped = st.skipped && !reduced
  const was = k => skipped && st.skipBeat >= IDX[k]
  const enter = (k, cls) => (was(k) ? '' : cls)
  const flight = atRest ? 'clr-phone--rest' : b >= 1 ? 'clr-phone--live' : 'clr-phone--pre'
  const xpNow = atRest ? model.fare.total : st.xp
  const shine = !reduced && !handover && (st.skipped || (is('MERGE') && xpNow === model.fare.total))

  // the streak's figure under the stamp and home: rolled on an everyday
  // clear, unrolled on a milestone's (the milestone rolls it)
  const streak = model.streak
  const shown = handover ? Math.max(0, streak - 1) : streak
  // the figure the roll starts from: the day before's, unless today was
  // counted by an earlier run's clear (`already`), as on the desk
  const before = model.already ? streak : Math.max(0, streak - 1)

  // ── the glide home: the stage's figure onto the rest line's ──
  const stageRef = useRef(null)
  const stageFigRef = useRef(null)
  const restFigRef = useRef(null)
  const [glide, setGlide] = useState({ x: -22.5, y: -261 })
  const gliding = is('GLIDE') && !atRest
  useLayoutEffect(() => {
    if (!gliding || !stageRef.current || !stageFigRef.current || !restFigRef.current) return
    const k = lay.scale || 1
    const box = stageRef.current.getBoundingClientRect()
    const fig = stageFigRef.current.getBoundingClientRect()
    const to = restFigRef.current.getBoundingClientRect()
    const bx = box.left + box.width / 2
    const by = box.top + box.height / 2
    const fx = fig.left + fig.width / 2
    const fy = fig.top + fig.height / 2
    const tx = to.left + to.width / 2
    const ty = to.top + to.height / 2
    const next = { x: Number(((tx - bx - (fx - bx) * 0.5) / k).toFixed(1)), y: Number(((ty - by - (fy - by) * 0.5) / k).toFixed(1)) }
    setGlide(g => (g.x === next.x && g.y === next.y ? g : next))
  }, [gliding, lay.scale])

  // ── the piles ──
  const counts = [0, 0, 0]
  const top = [-1, -1, -1]
  for (let i = 0; i < landed; i++) {
    const f = plan.flights[i]
    for (let v = 0; v < 3; v++) counts[v] += f.counts[v]
    top[f.v] = i
  }
  const lastV = n ? plan.flights[n - 1].v : -1
  const names = t.clrPiles
  const [openPile, setOpenPile] = useState(null)

  const week = model.week ?? []
  const pressed = is('PRESSED')
  const freshWeek = skipped && !was('DONE')
  const lastSlot = week.length - 1
  const slotProps = (entry, i) => {
    const classes = []
    if (i === lastSlot && pressed) classes.push(live ? 'clr-phone__press' : was('PRESSED') ? '' : 'clrk-slot--press')
    if (!pressed) classes.push('clr-phone__slot-in')
    else if (i !== lastSlot && entry.state === 'studied' && live) classes.push('clr-phone__ripple')
    if (freshWeek) classes.push('clrk-fade')
    const d = pressed ? 90 + (lastSlot - i) * 45 : (B.IMPACT - B.DONE) + i * 35
    return { className: classes.filter(Boolean).join(' '), style: { '--d': `${d}ms` } }
  }

  const fare = model.fare
  const level = model.level
  const marks = model.marks
  const tomorrow = model.tomorrow
  const next = model.next
  const tomorrowKanji = result?.day ? weekdayKanji(daysBefore(result.day, -1)) : null
  const hasBonus = fare.bonus > 0
  const pileRise = handover ? 'clr-phone__riser clr-phone__low' + (is('RISE') ? ' clr-phone__gone' : '')
    : 'clr-phone__riser' + (!atRest && !is('RISE') ? ' clr-phone__low' : '') +
      (skipped && st.skipBeat < IDX.RISE ? ' clr-phone__snap clrk-fade' : '')
  const rootStyle = {
    '--clr-h': lay.height, '--clr-k': lay.scale, '--clr-fare': lay.fare, '--clr-sum': lay.sum,
    '--clr-tomorrow': lay.tomorrow, '--clr-low': lay.low, '--clr-rest': lay.rest, '--clr-fall': lay.fall,
    '--clr-chip-y': lay.fare - 131,
  }
  const classes = ['clr-phone', reduced && 'clrk--reduced', skipped && 'clrk--skip', handover && 'clr-phone--handover'].filter(Boolean).join(' ')

  return (
    <main id="main-content" className={classes} style={rootStyle} onClick={skip}>
      <div className="clr-phone__frame" ref={setFrame}>
        <div className="clr-phone__stage">
          <div className={'clr-phone__world' + (live && is('IMPACT') && !is('FINAL') ? ' clrk-shake' : '') + (reduced ? ' clrk-fade' : '')}>

            {!atRest && !is('SEAL') && (
              <div className={'clr-phone__count' + (is('DONE') ? ' clr-phone__out' : ' clrk-arrive')} aria-hidden="true">
                <p className="clr-phone__cap">{t.clrTripOfDay}</p>
                <p className="clr-phone__n">
                  <span className="clr-phone__num clr-phone__read">{read ? plan.cum[read - 1] : 0}</span>
                  <span className="clr-phone__num clr-phone__of">/ {plan.total}</span>
                </p>
                <span className="clr-phone__prog"><i style={{ '--p': plan.total ? (read ? plan.cum[read - 1] : 0) / plan.total : 0 }} /></span>
              </div>
            )}

            {is('DONE') && (
              <>
                <ClearHeader center cap={CAP} title={t.clrTitle} className={'clr-phone__hdr' + enter('DONE', ' clrk-arrive')} style={{ '--d': '140ms' }} />
                <WeekStamps
                  week={week}
                  pending={!pressed}
                  className="clr-phone__week"
                  label={t.clrWeekAria(weekParts(week, t, lang, { pending: !pressed }))}
                  slotProps={slotProps}
                />
              </>
            )}

            {(is('HOME') || (is('SEAL') && !atRest)) && (
              <p className={'clr-phone__streak' + (is('HOME') ? (skipped && !was('HOME') ? ' clrk-fade' : '') : ' clr-phone__ghost')}
                 aria-hidden={!is('HOME') || undefined}>
                <span className="clr-phone__num" ref={restFigRef}>{shown}</span>{' '}
                <span className={is('HOME') && !was('HOME') ? 'clrk-fade' : ''}>{t.clrStreakWordN(shown)}</span>
              </p>
            )}

            {is('FARE') && !handover && (
              <div className={'clr-phone__fare' + enter('FARE', ' clrk-arrive')}>
                <p className={'clr-phone__total' + (is('MERGE') && live && hasBonus ? ' clrk-bump-a' : '')}>
                  <XpTotal
                    value={xpNow}
                    shine={shine}
                    figureClass="clr-phone__xp"
                    glints={shine ? GLINTS.map(g => ({ x: g.right != null ? `calc(100% + ${g.right}px)` : g.x, y: g.y, size: g.size, delay: g.delay })) : []}
                    label={`+${fare.total} ${t.clrXpUnit}`}
                  />
                </p>
                <p className={'clr-phone__break ' + (is('MERGE') ? 'clrk-fade' : 'clrk-hide')}>
                  <span><b>+{fare.run}</b> {t.clrFareRun}</span>
                  {hasBonus && <>{' '}<span aria-hidden="true">·</span>{' '}<span><b>+{fare.bonus}</b> {t.clrFarePrime}</span></>}
                </p>
                {level && (
                  <div className="clr-phone__lvl">
                    <span className="clr-phone__num">{level.level}</span>
                    <LevelBar from={level.from} to={is('MERGE') ? level.to : level.from} label={t.clrLevelAria(level.level, Math.round(level.to * 100))} />
                    <span className="clr-phone__num">{level.next}</span>
                  </div>
                )}
              </div>
            )}

            <div className={pileRise + ' clr-phone__riser--piles'}>
              {plan.faces.map((p, v) => (
                <button
                  key={v}
                  type="button"
                  className={[
                    'clr-phone__pile', v === 0 && 'clr-phone__pile--wrong', !(skipped && st.skipBeat >= 1) && 'clrk-arrive',
                    counts[v] > 0 && 'clr-phone__pile--has',
                  ].filter(Boolean).join(' ')}
                  style={{ '--px': p.x, '--jit': `${p.jit}deg`, '--ink': INK[v], '--d': `${140 + v * 50}ms` }}
                  aria-label={t.clrPileAria(names[v], counts[v])}
                  disabled={atRest && counts[v] === 0}
                  onClick={atRest ? e => { e.stopPropagation(); setOpenPile(v) } : undefined}
                >
                  <span className="clr-phone__tray" aria-hidden="true" />
                  <span className="clr-phone__face" aria-hidden="true">
                    <span className={'clr-phone__num clr-phone__pile-n' + (
                      live && landed === n && v === lastV ? ' clr-phone__thud'
                        : live && counts[v] > 0 ? (counts[v] % 2 ? ' clrk-bump-a' : ' clrk-bump-b') : '')}
                    >{counts[v]}</span>
                    <span className="clr-phone__pile-name">{names[v]}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className={'clr-phone__clipB ' + flight + (atRest || is('IMPACT') ? ' clr-phone__clipB--open' : '') + (is('RISE') && !handover ? ' clr-phone--settled' : '') +
                            (skipped && st.skipLanded < n ? ' clrk-fade' : '')} aria-hidden="true">
              <i className="clr-phone__clock" ref={clockEl} />
              <div className={pileRise}>
                {plan.flights.map(c => {
                  const buried = c.i < landed && c.i < top[c.v]
                  return (
                    <div key={c.i} className="clr-phone__fx" style={flightStyle(c, -lay.low, c.i + 1)}>
                      <div className={'clr-phone__fy' + (c.last ? ' clr-phone__fy--last' : '')}>
                        <div className={'clr-phone__fr' + (c.last ? ' clr-phone__fr--last' : '')}>
                          <RunCard
                            face={c.face}
                            paper
                            className={'clr-phone__card clr-phone__card--b' + (c.fast ? ' clr-phone__card--fast' : '') + (buried ? ' clr-phone__card--buried' : '')}
                            style={{ '--ink': INK[c.v] }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {!atRest && !is('IMPACT') && (
              <div className={'clr-phone__reader' + (is('DONE') ? ' clr-phone__reader--out' : ' clrk-arrive')}>
                <Reader flash={read} verdict={read ? plan.flights[read - 1].v : 1} />
              </div>
            )}

            {!atRest && !is('IMPACT') && (
              <div className={'clr-phone__clipA ' + flight} aria-hidden="true">
                <div className="clr-phone__deck clrk-arrive">
                  {plan.flights.map(c => {
                    const k = c.i - launched
                    const under = k >= 1
                    return (
                      <div
                        key={c.i}
                        className={'clr-phone__slot' + (under ? ' clr-phone__slot--under' : k === 0 ? ' clr-phone__slot--top' : '')}
                        style={{ ...flightStyle(c, 0, 100 - c.i), transform: under ? plan.fan[Math.min(k, 2)] : 'none', opacity: k >= 3 ? 0 : 1 }}
                      >
                        <div className={'clr-phone__fy' + (c.last ? ' clr-phone__fy--last' : '')}>
                          <div className={'clr-phone__fr' + (c.last ? ' clr-phone__fr--last' : '')}>
                            <RunCard face={c.face} paper className={'clr-phone__card clr-phone__card--a' + (c.fast ? ' clr-phone__card--fast' : '')} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {is('SEAL') && !pressed && !atRest && model.seal && (
              <div className={'clr-phone__seal' + (is('IMPACT') ? ' clr-phone__seal--hit' : '')} aria-hidden="true">
                <span className="clr-phone__glow" />
                {is('IMPACT') && (
                  <>
                    <span className="clr-phone__ink" />
                    <Bloom left={-14} top={-14} size={196} />
                    <span className="clr-phone__bloom2" />
                    <Specks specks={specks} />
                  </>
                )}
                <div className={'clr-phone__sx' + (is('FLY') ? ' clr-phone__sx--fly' : '')}>
                  <div className={'clr-phone__sy' + (is('FLY') ? ' clr-phone__sy--fly' : '')}>
                    <div className="clr-phone__drop">
                      <Seal day={model.seal.day} foot={model.seal.foot} size={168} tilt={-8} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {is('SEAL') && !is('HOME') && !atRest && (
              <div
                ref={stageRef}
                className={'clr-phone__sstage ' + (gliding ? 'clr-phone__glide' : 'clrk-arrive')}
                style={{ '--d': '260ms', '--gx': glide.x, '--gy': glide.y }}
                aria-hidden="true"
              >
                <StreakRoll from={handover ? shown : before} to={shown} roll={is('ROLL')} figRef={stageFigRef} />
                <span className="clr-phone__sstage-cap">{t.clrStreakWordN(handover ? shown : is('ROLL') ? streak : before)}</span>
              </div>
            )}

            {is('CHIP') && !is('CHIPGONE') && !atRest && !handover && hasBonus && (
              <div className="clr-phone__chip" aria-hidden="true">
                <div className="clr-phone__chipx">
                  <div className="clr-phone__chipy"><XpChip amount={fare.bonus} label={t.clrPrimeChip} /></div>
                </div>
              </div>
            )}

            {is('TAIL') && !handover && (
              <>
                {(marks.up > 0 || marks.mastered > 0 || model.minutes != null) && (
                  <p className={'clr-phone__sum' + enter('TAIL', ' clrk-arrive')}>
                    {joinDots([
                      marks.up > 0 && <span key="up"><b>{marks.up}</b> {t.clrSumUp(marks.up)}</span>,
                      marks.mastered > 0 && <span key="m"><b>{marks.mastered}</b> {t.clrSumMastered(marks.mastered)}</span>,
                      model.minutes != null && <span key="min"><b>{model.minutes}</b> {t.clrSumMin}</span>,
                    ])}
                  </p>
                )}
                {tomorrow && (
                  <div className={'clrk-dash clr-phone__tomorrow' + enter('TAIL', ' clrk-arrive')} style={{ '--d': '110ms' }}>
                    {tomorrowKanji && <Slot glyph={tomorrowKanji} state="wait" still tilt={-3} aria-hidden="true" />}
                    <div className="clr-phone__tomorrow-txt">
                      <p className="clr-phone__tomorrow-main">
                        {tomorrow.cards > 0 ? t.clrTomorrow(tomorrow.cards, tomorrow.minutes) : t.clrTomorrowNone}
                      </p>
                      {next?.milestone && next?.jackpot ? (
                        <p className="clr-phone__tomorrow-sub">
                          {next.milestone}<span className="clr-phone__sup">{t.clrOrdinalSuffix(next.milestone)}</span>
                          {t.clrNextDay}{t.clrNextTicketName(next.milestone)}{' '}
                          <span className="clr-phone__gold">+{next.jackpot}&#160;{t.clrXpUnit}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
                <div className="clr-phone__gate">
                  <GateButton compact arrive={!was('TAIL')} arriveDelay={240} label={t.backToStation} onClick={onLeave} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {result?.day && <span className="sr-only">{t.clrSealAria(longDate(result.day, lang))}</span>}
      {openPile != null && (
        <PileSheet
          name={names[openPile]}
          count={counts[openPile]}
          cards={cards.filter(c => pileOf(c.verdict, piles) === openPile)}
          ink={INK[openPile]}
          onClose={() => setOpenPile(null)}
        />
      )}
    </main>
  )
}

// A flight's variables, as unitless numbers (the stylesheet multiplies)
// and times; `o` shifts copy B's frame by the drop its riser holds it at.
function flightStyle(c, o, z) {
  return {
    zIndex: z, '--o': o, '--d': `${c.d}ms`, '--f': `${c.f}ms`, '--tx': c.tx, '--ax': c.ax,
    '--sy': c.sy, '--jit': `${c.jit}deg`, '--lean': `${c.lean}deg`,
  }
}

// "4 montent · 1 maîtrisée · 11 min": the parts there are, dotted.
function joinDots(parts) {
  const out = []
  parts.filter(Boolean).forEach((p, i) => {
    if (i) out.push(' ', <span key={`dot${i}`} aria-hidden="true">·</span>, ' ')
    out.push(p)
  })
  return out
}

// ── the streak's odometer under the stamp ──
// One column a digit, each rolling from the day before's figure to
// today's (5 → 6, 9 → 10 rolls on through 0, and a new leading column
// rolls in from blank). The kit's odometer classes; the value is said
// by the rest line. The roll waits 260ms, the figure's own arrival
// delay, which the board's odometer inherited as its transition delay.
const CELLS = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
function StreakRoll({ from, to, roll, figRef }) {
  const target = String(to)
  const before = String(from).padStart(target.length, ' ')
  const now = roll ? target : before
  return (
    <span className="clrk-odo clr-phone__odo" ref={figRef}>
      {target.split('').map((_, i) => {
        const prev = before[i]
        const ch = now[i]
        const idx = ch === ' ' ? 0 : ch === '0' && roll && prev === '9' ? 11 : Number(ch) + 1
        return (
          <span key={i} className="clrk-odo__col" style={{ '--n': idx, '--d': `${260 + (target.length - 1 - i) * 60}ms` }}>
            {CELLS.map((c, k) => <span key={k} className="clrk-odo__d">{c || '\u00a0'}</span>)}
          </span>
        )
      })}
    </span>
  )
}
