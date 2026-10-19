import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ROLL_LEAD, ROLL_TAIL } from '../../domain/readingRoll'

// ── 巻物 — the passage rolling up its card (plan 258) ─────────────
// The lines of a text pass up the card at a steady pace, the one at
// its middle lit and the rest stepped back, and the card's top and
// bottom fade them out. One timeline: the first line stands for
// ROLL_LEAD, the roll takes `seconds`, the last stands for ROLL_TAIL.
//
// The column moves by a transform, never by top (DESIGN.md, "Nothing
// moves by top or left"), set from the frame loop rather than state:
// only a change of the lit line, and the timeline's progress at a tenth
// of a second, reach React. The loop counts the time it was drawn, a
// frame at most a tenth of a second long, so a tab left in the
// background holds the roll where it was instead of jumping it.

const PROGRESS_STEP = 10   // reports a second: tenths of one

/** `onProgress(p)` is the timeline's, 0 to 1. `onEnd` is called once it
 *  is over; without it the roll stops on its last line and waits (the
 *  untimed pace's text stays up until the reader is done). */
export function RollingPassage({ lines, seconds, paused = false, onProgress, onEnd, label }) {
  const view = useRef(null)
  const column = useRef(null)
  const geometry = useRef({ mids: [], height: 0 })
  const elapsed = useRef(0)
  const lit = useRef(0)
  const [active, setActive] = useState(0)
  const total = ROLL_LEAD + seconds + ROLL_TAIL

  // The latest props, read by the frame loop without restarting it.
  const latest = useRef({ seconds, onProgress, onEnd })
  useLayoutEffect(() => { latest.current = { seconds, onProgress, onEnd } })
  const ending = Boolean(onEnd)

  const place = useCallback(() => {
    const { mids, height } = geometry.current
    if (!mids.length || !column.current) return
    const r = Math.min(1, Math.max(0, (elapsed.current - ROLL_LEAD) / latest.current.seconds))
    const y = mids[0] + r * (mids[mids.length - 1] - mids[0])
    column.current.style.transform = `translate3d(0, ${height / 2 - y}px, 0)`
    let near = 0
    mids.forEach((m, i) => { if (Math.abs(m - y) < Math.abs(mids[near] - y)) near = i })
    if (near !== lit.current) { lit.current = near; setActive(near) }
  }, [])

  const measure = useCallback(() => {
    if (!view.current || !column.current) return
    geometry.current = {
      mids: [...column.current.children].map(el => el.offsetTop + el.offsetHeight / 2),
      height: view.current.clientHeight,
    }
    place()
  }, [place])

  // Measured when the lines change and when the card's size does (a
  // phone turned, a font loaded).
  useLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(view.current)
    return () => ro.disconnect()
  }, [lines, measure])

  // A speed changed mid-roll keeps the place reached, not the seconds.
  const was = useRef(seconds)
  useLayoutEffect(() => {
    if (was.current !== seconds) {
      const r = Math.min(1, Math.max(0, (elapsed.current - ROLL_LEAD) / was.current))
      if (elapsed.current > ROLL_LEAD && elapsed.current < ROLL_LEAD + was.current) {
        elapsed.current = ROLL_LEAD + r * seconds
      }
      was.current = seconds
    }
    latest.current.seconds = seconds
    place()
  }, [seconds, place])

  useEffect(() => {
    if (paused) return undefined
    let frame
    let last = performance.now()
    let reported = -1
    const step = now => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      elapsed.current = Math.min(total, elapsed.current + dt)
      place()
      const tenth = Math.floor(elapsed.current * PROGRESS_STEP)
      if (tenth !== reported) { reported = tenth; latest.current.onProgress?.(elapsed.current / total) }
      if (elapsed.current >= total) {
        latest.current.onEnd?.()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [paused, total, ending, place])

  return (
    <div className="roll" ref={view} role="group" aria-label={label}>
      <div className="roll__column" ref={column}>
        {lines.map((line, i) => (
          <p
            key={i}
            lang="ja"
            className={`roll__line${i === active ? ' roll__line--now' : i < active ? ' roll__line--past' : ''}`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
