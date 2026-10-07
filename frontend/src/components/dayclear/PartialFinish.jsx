import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playArrival } from '../../lib/audio'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { EnterKey } from '../chrome/DeskKeys'
import { ClearHeader, XpTotal, QuietButton, GateButton, Seal } from './kit'
import { runXp, sealDate, utcToday, weekdayKanji } from '../../domain/dayClear'

// ── 途中下車 — a run that ended with cards left today (plan 191) ───────
// The canvas's Partial board (390×844): "Trajet terminé" -- the leg's
// fare in three figures under one hairline each (20 révisions, +118 xp,
// 85 % justes); the day drawn as a loop line out of 辻駅 and back, a stop
// a card: the ridden stretch the 3px rail, the stop where the learner
// got off ringed, the stretch still to ride dashed, and at its end, back
// at 辻駅, the day's stamp waiting -- the slot's waiting look at the
// seal's size (a dashed ring, the glyph cut but not inked); then "14
// cartes restent aujourd'hui", the tease (~5 min for the day's stamp and
// the streak bonus, +55 xp), and the quiet way back over the gate
// "Continuer · 14 cartes". A run cut short by a chosen length (quota),
// one lane or the credits ends here.
//
// Its entrance is the board's: each piece arrives on its own delay, the
// stop pops and greets twice with a ripple, the gate rises and breathes.
// A tap skips to the rest (what had started snaps to it, what had not
// fades in); reduced motion is the rest, fades only. On a short phone
// the air gives way first, then the loop draws smaller.
//
// Props:
//   result   the not-cleared answer: { cleared: false, remaining,
//            seconds_per_review, preview: { streak, bonus, jackpot, milestone } }
//   run      the run's tally ({ at, cleared, xp, minutes, cards })
//   desk     drawn beside the rail (the composition at the phone's width)
//   reduced  the rest state at once
//   onContinue()  the rest of the day: /today/run
//   onLeave()     the quiet way back: /today

// Each entrance: [entrance class, its start (ms) -- its --d].
const ENT = {
  hdr: ['clrk-arrive', 0],
  fig1: ['clrk-arrive', 60],
  fig2: ['clrk-arrive', 90],
  fig3: ['clrk-arrive', 120],
  map: ['clrk-fade', 160],
  seal: ['clrk-fade', 260],
  left: ['clrk-arrive', 320],
  tease: ['clrk-arrive', 350],
  quiet: ['clrk-fade', 400],
  gate: ['gate', 440],
}
// The stop's two greeting ripples end (1.3s + 2 × 2.6s): the rest.
const REST = 6500

// The loop: one stop a card, 辻駅 at the top, clockwise.
const BOX = 320
const C = BOX / 2
const R = 146
const f2 = v => Number(v.toFixed(2))

/** The loop line's geometry for `done` cards of `total`: the two arcs, the stops, the terminus and where the learner got off. */
// eslint-disable-next-line react-refresh/only-export-components -- the drawing's geometry, read by the tests; not a component.
export function loopOf(done, total) {
  const step = 360 / Math.max(1, total)
  const pt = k => {
    const a = ((-90 + k * step) * Math.PI) / 180
    return [f2(C + R * Math.cos(a)), f2(C + R * Math.sin(a))]
  }
  const arc = (k0, k1) => {
    const [x0, y0] = pt(k0)
    const [x1, y1] = pt(k1)
    const large = (k1 - k0) * step > 180 ? 1 : 0
    return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}`
  }
  // A stop a card while they stand apart; a long day is drawn as its two
  // stretches alone.
  const roomy = (2 * Math.PI * R) / Math.max(1, total) >= 9
  const stops = []
  if (roomy) {
    for (let k = 1; k < total; k++) {
      if (k !== done) stops.push({ k, at: pt(k), done: k < done })
    }
  }
  return { ahead: arc(done, total), ridden: arc(0, done), stops, term: pt(0), here: pt(done) }
}

export default function PartialFinish({ result, run, desk = false, reduced = false, onContinue, onLeave }) {
  const { t, lang } = useLang()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    playArrival()
  }, [])

  // ── the clock: the entrances run on CSS; the rest is the board's 6.5s ──
  const [st, setSt] = useState(() => ({ rest: reduced, skipped: false, skipT: 0 }))
  const t0 = useRef(0)
  useEffect(() => {
    if (reduced) return undefined
    t0.current = performance.now()
    const id = setTimeout(() => setSt(s => ({ ...s, rest: true })), REST)
    return () => clearTimeout(id)
  }, [reduced])
  const skip = useCallback(() => {
    setSt(s => (reduced || s.rest ? s : { rest: true, skipped: true, skipT: performance.now() - t0.current }))
  }, [reduced])
  const skipped = st.skipped && !reduced
  // Skipped: what was on its way snaps to rest; what had not started fades in.
  const ent = key => {
    const [cls, at] = ENT[key]
    if (!skipped) return cls
    return st.skipT < at ? 'clrk-fade' : ''
  }

  // ── the figures ──
  const cards = run?.cards ?? []
  const done = run?.cleared ?? cards.length
  const right = cards.length ? Math.round((100 * cards.filter(c => c.verdict >= 1).length) / cards.length) : null
  const left = result?.remaining ?? 0
  const total = done + left
  const minutes = result?.seconds_per_review ? Math.max(1, Math.ceil((left * result.seconds_per_review) / 60)) : null
  const preview = result?.preview ?? {}
  const prime = (preview.bonus ?? 0) + (preview.jackpot ?? 0)
  const day = utcToday(run?.at ? new Date(run.at) : undefined)
  const loop = useMemo(() => loopOf(done, total), [done, total])
  let tease
  if (preview.milestone) {
    const name = t.clrNextTicketName(preview.milestone)
    tease = minutes != null ? t.ptlTeaseTicket(minutes, name) : t.ptlTeaseTicketNoMin(name)
  } else {
    tease = minutes != null ? t.ptlTease(minutes) : t.ptlTeaseNoMin
  }

  // ── the loop's size: the air gives way first, then the loop ──
  const [setDay, daySize] = useBoxSize(true)
  const [setBelow, belowSize] = useBoxSize(true)
  const room = daySize && belowSize ? daySize.height - belowSize.height : BOX
  const k = Math.max(0.5, Math.min(1, room / BOX))

  const classes = ['ptl', desk && 'ptl--desk', reduced && 'clrk--reduced', skipped && 'clrk--skip'].filter(Boolean).join(' ')
  const gate = ent('gate')
  return (
    <main id="main-content" className={classes} onClick={skip}>
      <ClearHeader center cap="途中下車" title={t.ptlTitle} className={['ptl__hdr', ent('hdr')].filter(Boolean).join(' ')} />

      <ul className="ptl__fare" aria-label={t.ptlRunAria}>
        <li className={['ptl__fig', ent('fig1')].filter(Boolean).join(' ')} style={{ '--d': '60ms' }}>
          <span className="ptl__num">{done}</span>{' '}
          <span className="ptl__cap">{t.ptlReviews}</span>
        </li>
        <li className={['ptl__fig', ent('fig2')].filter(Boolean).join(' ')} style={{ '--d': '90ms' }}>
          <XpTotal
            value={runXp(result, run)}
            unit={null}
            shine={!reduced}
            shineDelay={900}
            figureClass="ptl__xp"
            glints={reduced ? [] : [{ x: 'calc(100% + 5px)', y: 0, size: 10, delay: 1800 }, { x: -5, y: 23, size: 8, delay: 3000 }]}
          />
          {' '}<span className="ptl__cap">{t.clrXpUnit}</span>
        </li>
        {right != null && (
          <li className={['ptl__fig', ent('fig3')].filter(Boolean).join(' ')} style={{ '--d': '120ms' }}>
            <span className="ptl__num">{right}<span className={lang === 'fr' ? 'ptl__pct ptl__pct--fine' : 'ptl__pct'}>%</span></span>{' '}
            <span className="ptl__cap">{t.ptlRight}</span>
          </li>
        )}
      </ul>

      <section className="ptl__day" aria-label={t.ptlDayAria} ref={setDay}>
        <div className="ptl__loop" role="img" aria-label={t.ptlLoopAria(done, total, left)} style={{ '--k': k }}>
          <div className="ptl__drawing">
            <svg className={['ptl__map', ent('map')].filter(Boolean).join(' ')} style={{ '--d': '160ms' }} viewBox="0 0 320 320" aria-hidden="true" focusable="false">
              <path className="ptl__line ptl__line--ahead" d={loop.ahead} />
              <path className="ptl__line ptl__line--done" d={loop.ridden} />
              {loop.stops.map(s => (
                <circle key={s.k} className={s.done ? 'ptl__stop ptl__stop--done' : 'ptl__stop'} cx={s.at[0]} cy={s.at[1]} r="3.5" />
              ))}
              <circle className="ptl__term" cx={loop.term[0]} cy={loop.term[1]} r="7" />
              <circle className="ptl__term-dot" cx={loop.term[0]} cy={loop.term[1]} r="2.5" />
              <circle className="ptl__ripple" cx={loop.here[0]} cy={loop.here[1]} r="11" />
              <circle className="ptl__ring" cx={loop.here[0]} cy={loop.here[1]} r="11" />
              <circle className="ptl__here" cx={loop.here[0]} cy={loop.here[1]} r="6" />
            </svg>
            <div className={['ptl__seal', ent('seal')].filter(Boolean).join(' ')} style={{ '--d': '260ms' }} aria-hidden="true">
              <Seal day={weekdayKanji(day)} foot={sealDate(day)} crisp className="ptl__wait" />
              <span className="ptl__seal-ring" />
            </div>
          </div>
        </div>
        <div className="ptl__below" ref={setBelow}>
          <p className={['ptl__left', ent('left')].filter(Boolean).join(' ')} style={{ '--d': '320ms' }}>
            <span className="ptl__num">{left}</span>{' '}
            <span>{t.ptlLeft(left)}</span>
          </p>
          <p className={['ptl__tease', ent('tease')].filter(Boolean).join(' ')} style={{ '--d': '350ms' }}>
            {tease}
            {prime > 0 && <> <b className="ptl__gold">+{prime}&#160;{t.clrXpUnit}</b></>}
          </p>
        </div>
      </section>

      <div className="ptl__act">
        <QuietButton className={['ptl__quiet', ent('quiet')].filter(Boolean).join(' ')} style={{ '--d': '400ms' }} onClick={onLeave}>
          {t.backToStation}
        </QuietButton>
        <GateButton
          compact
          arrive={gate === 'gate'}
          arriveDelay={440}
          keys={desk}
          label={t.ptlContinue(left)}
          onClick={onContinue}
          className={['ptl__gate', gate === 'clrk-fade' && 'clrk-fade'].filter(Boolean).join(' ')}
        />
      </div>
      <EnterKey onEnter={onContinue} />
    </main>
  )
}
