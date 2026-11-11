import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ROLL_LEAD, ROLL_TAIL } from '../../domain/readingRoll'

// ── 巻物 — the passage rolling up its card (plan 258) ─────────────
// The lines of a text pass up the card at a steady pace, the one at
// its middle lit and the rest stepped back by their distance from it,
// the card's top and bottom fading them out. One timeline: the first
// line stands for ROLL_LEAD, the roll takes `seconds`, the last stands
// for ROLL_TAIL.
//
// The column is moved by a Web Animation on its transform, which the
// browser runs on the compositor, off the main thread: a roll this slow
// moves a fraction of a pixel a frame, and a frame loop setting a
// transform from script stepped, whatever React was busy with. The
// animation is also what holds the place: pause, a speed changed
// mid-roll and a resize all keep where the roll had got to. Script only
// reads the clock, a frame at a time, to light the line at the middle
// and to tell the screen a few times a second how far on it is (never
// anything that moves). A tab left in the background pauses the roll
// rather than reading on for nobody.

const REPORT_MS = 250   // how often the screen is told the roll's place

// The column's transform at a place: the line at the viewport's middle.
const at = (height, mid) => ({ transform: `translate3d(0, ${height / 2 - mid}px, 0)` })

/** `onProgress(p)` is the timeline's, 0 to 1. `onEnd` is called once it
 *  is over; without it the roll stops on its last line and waits (the
 *  untimed pace's text stays up until the reader is done). */
export function RollingPassage({ entries, seconds, paused = false, furigana = false, onProgress, onEnd, label }) {
  const view = useRef(null)
  const column = useRef(null)
  const animation = useRef(null)
  const geometry = useRef({ mids: [], height: 0 })
  const measureRef = useRef(() => {})
  const [active, setActive] = useState(0)

  // The latest props, read by the effects below without restarting them.
  const latest = useRef({ seconds, paused, onProgress, onEnd })
  useLayoutEffect(() => { latest.current = { seconds, paused, onProgress, onEnd } })

  // The animation: made once, its keyframes rewritten whenever the
  // geometry changes (the card resized, furigana turned on, a font
  // loaded), which keeps its time.
  useLayoutEffect(() => {
    const col = column.current
    const measure = () => {
      if (!view.current || !col) return
      const mids = [...col.children].map(el => el.offsetTop + el.offsetHeight / 2)
      const height = view.current.clientHeight
      geometry.current = { mids, height }
      if (!mids.length || typeof col.animate !== 'function') return
      const frames = [at(height, mids[0]), at(height, mids[mids.length - 1])]
      if (animation.current) {
        animation.current.effect.setKeyframes(frames)
        return
      }
      const { seconds: s, paused: held } = latest.current
      const a = col.animate(frames, {
        duration: s * 1000, delay: ROLL_LEAD * 1000, endDelay: ROLL_TAIL * 1000, easing: 'linear', fill: 'both',
      })
      if (held || document.hidden) a.pause()
      animation.current = a
    }
    measureRef.current = measure
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(view.current)
    ro?.observe(col)
    return () => {
      ro?.disconnect()
      animation.current?.cancel()
      animation.current = null
    }
  }, [])

  // New lines or readings, whatever the size they come out at.
  useLayoutEffect(() => { measureRef.current() }, [entries, furigana])

  // A speed changed mid-roll keeps the place reached, not the seconds.
  useLayoutEffect(() => {
    const a = animation.current
    if (!a) return
    const { delay, duration, endDelay } = a.effect.getTiming()
    const next = seconds * 1000
    if (duration === next) return
    const now = a.currentTime ?? 0
    a.effect.updateTiming({ duration: next })
    a.currentTime = now <= delay ? now
      : now < delay + duration ? delay + ((now - delay) / duration) * next
        : delay + next + Math.min(endDelay, now - delay - duration)
  }, [seconds])

  // Held by the learner, or by the tab being out of sight.
  useEffect(() => {
    const sync = () => {
      const a = animation.current
      if (!a) return
      if (paused || document.hidden) a.pause()
      else if (a.playState === 'paused') a.play()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [paused])

  // Reading the clock: the lit line, the report, the end.
  useEffect(() => {
    let frame
    let lit = 0
    let reported = -1
    let ended = false
    const tick = () => {
      const a = animation.current
      const { mids } = geometry.current
      if (a && mids.length) {
        const { delay, duration, endDelay } = a.effect.getTiming()
        const now = a.currentTime ?? 0
        const r = Math.min(1, Math.max(0, (now - delay) / duration))
        const y = mids[0] + r * (mids[mids.length - 1] - mids[0])
        let near = 0
        mids.forEach((m, i) => { if (Math.abs(m - y) < Math.abs(mids[near] - y)) near = i })
        if (near !== lit) { lit = near; setActive(near) }

        const total = delay + duration + endDelay
        const slot = Math.floor(now / REPORT_MS)
        if (slot !== reported) { reported = slot; latest.current.onProgress?.(Math.min(1, now / total)) }
        if (now >= total && !ended && latest.current.onEnd) {
          ended = true
          latest.current.onProgress?.(1)
          latest.current.onEnd()
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={`roll${furigana ? ' roll--furigana' : ''}`} ref={view} role="group" aria-label={label}>
      <div className="roll__column" ref={column}>
        {entries.map((entry, i) => (
          <p
            key={i}
            lang="ja"
            className={`roll__line${i === active ? ' roll__line--now' : ''}`}
            // How far from the middle: the line's opacity steps down by it.
            style={{ '--d': Math.min(3, Math.abs(i - active)) }}
          >
            {furigana
              ? entry.parts.map((part, j) => (part.reading
                ? <ruby key={j}>{part.text}<rt>{part.reading}</rt></ruby>
                : part.text))
              : entry.text}
          </p>
        ))}
      </div>
    </div>
  )
}
