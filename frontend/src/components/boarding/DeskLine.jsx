import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { SIGNUP_BONUS } from '../../domain/credits'
import { DeskMast } from '../chrome/DeskMast'
import { BackChevron } from './icons'
import { useCountUp, stillPreferred } from './countUp'

// ── 路線 — the line laid down the left (plan 140) ────────────────
// The owner's pick A of three directions drawn on the canvas "Desktop
// onboarding — options". The desk's chrome is the rail, and first
// contact lays it before it has any gates: a sumi column at
// --desk-side-w down the left edge, the rail's own masthead at its head
// (辻 over TSUJI), and under it the boarding as a line with a stop per
// question.
//
// It replaces two drawings of one thing. The track at the head was the
// line's stops with no names on them, and the journey at the window's
// right edge was four grey rows 700px from the answer that filled them.
// Now each stop is named, prints its answer once given, and the one
// being asked is lit and prints the pick as it stands -- before
// Continue, so the answer's consequence is read beside it. A stop
// already passed is a door back to its question (every answer is kept,
// as Back keeps them), until the plan is built and Back is gone.
//
// The column's foot is where the rail's foot will be: the projection,
// priced on every answer, while the questions run; the learner's pass
// once the plan is built -- the screen that issued it folds away on the
// desk, and "Enter the station" is on the plan (PlanStep's `last`).
//
// ── 仕上げ — the line as one rail, and your train on it (plan 154) ──
// The line was drawn a half-row at a time, each stop lighting its own
// wash and ring, so a Continue made the lit stop jump: one row went
// dark and another came on in the same frame, while the paper beside
// it was still pulling. Now the line is what it draws. One rail from
// the first stop to the last, the stretch ridden filled over it, and
// the lit stop's wash and ring are one object -- your train -- that
// runs down the rail to the stop being asked, and back up it when a
// door or Back is taken. The rows are measured (a stop whose answer
// wraps is a taller row), so the train stops on the dot whatever the
// row's height; the plan built, it runs to the last stop and fades,
// the whole line ridden. First drawn, the line is laid: the rail
// draws down from the head, the stops arrive in order, and the train
// stands at the first. An answer arrives on its stop rather than
// appearing on it. Under reduced motion every one of those is the rest
// state (the 机 section of index.css).
//
//   stops      [{ key, label, value, state: done|now|next, onOpen }]
//   projection { label, value } -- value null until it can be priced
//   pass       { name, profile } -- drawn instead of the projection
export function DeskLine({ stops, projection = null, pass = null }) {
  const { t } = useLang()
  const listRef = useRef(null)
  const route = useRoute(listRef, stops)
  return (
    <aside className="desk-brd__side" aria-label={t.brdBuildingAria}>
      <DeskMast />
      <div className={`desk-brd__route${route.ready ? ' desk-brd__route--ready' : ''}${route.lit ? '' : ' desk-brd__route--ridden'}`} style={route.style}>
        <span className="desk-brd__rail" aria-hidden="true" />
        <span className="desk-brd__ridden" aria-hidden="true" />
        {route.style && <span className="desk-brd__here" aria-hidden="true" />}
        <ol className="desk-brd__stops" ref={listRef}>
          {stops.map((stop, i) => {
            const face = (
              <>
                <span className="desk-brd__dot" aria-hidden="true" />
                <span className="desk-brd__txt">
                  <span className="desk-brd__lab">{stop.label}</span>
                  {stop.state !== 'next' && stop.value && (
                    // A pick arrives on its stop: keyed on the answer,
                    // so a change of mind lands again -- except the
                    // name, typed a letter at a time, and the hour,
                    // dragged half an hour at a time.
                    <span key={LIVE.has(stop.key) ? 'live' : stop.value} className="desk-brd__val">{stop.value}</span>
                  )}
                </span>
              </>
            )
            return (
              <li
                key={stop.key}
                className={`desk-brd__stop desk-brd__stop--${stop.state}`}
                data-stop={stop.key}
                aria-current={stop.state === 'now' ? 'step' : undefined}
                style={{ '--i': i }}
              >
                {stop.onOpen
                  ? (
                    <button type="button" className="desk-brd__door" onClick={stop.onOpen}>
                      {face}
                      <BackChevron />
                    </button>
                  )
                  : <div className="desk-brd__door">{face}</div>}
              </li>
            )
          })}
        </ol>
        {route.style && <span className="desk-brd__train" aria-hidden="true" />}
      </div>
      <div className="desk-brd__foot">
        {pass
          ? <ColumnPass name={pass.name} profile={pass.profile} />
          : projection && (
            <div className={`desk-brd__proj${projection.value == null ? ' desk-brd__proj--blank' : ''}`} data-stop="projection">
              <span className="desk-brd__lab">{projection.label}</span>
              {/* A new date drops in as a board's figure turns over. */}
              <span key={projection.value ?? 'blank'} className="desk-brd__fig">{projection.value ?? '—'}</span>
            </div>
          )}
      </div>
    </aside>
  )
}

// The stops whose value changes as it is entered rather than picked.
const LIVE = new Set(['name', 'time'])

// Where the rail runs and where the train stands, read off the rows: the
// rail from the first dot to the last (a dot is centred on its row), the
// stretch ridden to the lit stop's dot -- or to the last once the plan is
// built -- and the train over the lit row. Read before paint, again when
// a stop, its state or its answer changes, and whenever the list's box
// does (an answer wrapping onto a second line). The transitions are
// switched on the frame after the first reading, so the line is drawn in
// place rather than sliding in from the column's top. The wash and the
// train are drawn once there is a reading to stand them on.
function useRoute(listRef, stops) {
  const [geo, setGeo] = useState(null)
  const [ready, setReady] = useState(false)
  const shape = stops.map(s => `${s.key}:${s.state}:${s.value ?? ''}`).join('|')
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const read = () => {
      const rows = [...list.children]
      if (rows.length === 0) return
      const mid = row => row.offsetTop + row.offsetHeight / 2
      const lit = rows.find(row => row.getAttribute('aria-current') === 'step') ?? null
      const at = lit ?? rows.at(-1)
      const next = {
        top: mid(rows[0]),
        rail: mid(rows.at(-1)) - mid(rows[0]),
        ride: mid(at) - mid(rows[0]),
        y: at.offsetTop,
        h: at.offsetHeight,
        lit: lit != null,
      }
      setGeo(g => (g && Object.keys(next).every(k => g[k] === next[k]) ? g : next))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(read)
    observer.observe(list)
    return () => observer.disconnect()
  }, [listRef, shape])
  useEffect(() => {
    if (!geo || ready) return undefined
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [geo, ready])
  return {
    ready,
    lit: geo?.lit ?? true,
    // Plain numbers, read as pixels by the sheet (calc(var(--x) * 1px)):
    // the lengths are measured off the rows, not chosen from the scale.
    style: geo && {
      '--rail-top': geo.top,
      '--rail-h': geo.rail,
      '--ride-h': geo.ride,
      '--here-y': geo.y,
      '--here-h': geo.h,
    },
  }
}

// The learner's pass at the column's foot, where the rail will carry
// it from the first card on (DeskPass, plan 127) -- in the same
// material, with nothing on it to press yet: the holder, the level and
// its climb, and the balance counted up to what the account holds, with
// the gold note saying it was given (the pass step's own moment, owner's
// call; components/boarding/countUp.js).
function ColumnPass({ name, profile }) {
  const { t } = useLang()
  const credits = useCredits()
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const shown = useCountUp(balance, balance != null && !stillPreferred())
  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  return (
    <div className="desk-brd__pass" data-stop="pass">
      <span className="desk-brd__holder">{name}</span>
      <div className="desk-brd__face">
        <span className="desk-brd__lvl" aria-label={`${t.level} ${profile.level}`}>{profile.level}</span>
        <span className="desk-brd__climb">
          <span className="desk-pass__track">
            <span className="desk-pass__fill" style={{ width: `${Math.round((into / span) * 100)}%` }} />
          </span>
          <span className="desk-pass__xp">
            {into.toLocaleString()} / {span.toLocaleString()}
            <span className="desk-pass__unit">xp</span>
          </span>
        </span>
        <span className="desk-brd__purse">
          <b className="desk-brd__bal">{credits?.unlimited ? '∞' : shown}</b>
          <span className="desk-pass__note">{t.creditsUnit}</span>
        </span>
      </div>
      {balance === SIGNUP_BONUS && <span className="desk-brd__gift" aria-live="polite">{t.brdCreditsGift(balance)}</span>}
      <span className="desk-brd__sheen" aria-hidden="true" />
    </div>
  )
}
