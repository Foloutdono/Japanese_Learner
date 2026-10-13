import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import PRINT from './print.json'

// ── 浮世絵 — the print behind Today's gate (plan 205) ─────────────
// The owner's pick of the canvas "Tsuji — Today, the visit card"
// (round 9): the gate drawn on a print of the hour, the dial its sun or
// its moon. The print is drawn ahead of time (scripts/today-print, a
// file per hour and frame under public/today/print/<rev>/) and laid
// behind the gate; the dial and the lines under it are the app's, live,
// placed in the print's own units so they stand where the canvas put
// them.

export { PRINT }

/** Which print the hour shows: 曙 dawn from 5:00, 帰帆 the day from
 *  9:00, 落雁 dusk from 16:00, 秋月 the night from 19:30, all local. */
const FROM = [[5 * 60, 'dawn'], [9 * 60, 'day'], [16 * 60, 'dusk'], [19 * 60 + 30, 'night']]
export function printHour(now) {
  const m = now.getHours() * 60 + now.getMinutes()
  let hour = 'night'
  for (const [at, name] of FROM) if (m >= at) hour = name
  return hour
}

// A print fetched once a visit: the hour's file is a few hundred
// kilobytes, and an hour's turn is the only reason to fetch another.
const scenes = new Map()
const sceneUrl = key => `/today/print/${PRINT.rev}/${key}.json`

/** The hour's print for the frame, or null until it has come (or when
 *  it cannot: the gate stands on the sky's colours without it). Nothing
 *  is fetched before the frame has said which print it takes. */
export function usePrintScene(hour, device) {
  const key = device ? `${hour}-${device}` : null
  const [got, setGot] = useState(null)
  useEffect(() => {
    if (!key || scenes.has(key)) return undefined
    let live = true
    fetch(sceneUrl(key))
      .then(r => (r.ok ? r.json() : null))
      .then(doc => {
        if (!doc?.layers?.sky) return
        scenes.set(key, doc)
        if (live) setGot(key)
      })
      .catch(() => {})
    return () => { live = false }
  }, [key])
  return got === key || scenes.has(key) ? scenes.get(key) : null
}

// How much of the print's sky a short screen may lose before its foot
// gives way instead: the room above the dial's ring, less a margin.
const LIFT = { phone: 56, desk: 64 }

// The canvas drew two prints, for a phone's frame and the desk's. A
// frame wider than this to its height (a tablet, a phone on its side)
// takes the desk's print, centred on its dial: the phone's, filled to
// that width, would swell the dial and lose its foreground under the
// gate.
const WIDE = 0.7

// Where the phone's lines stand under the dial's rings, in the print's
// units: the minutes and the hour they end, then the legend.
export const BELOW = { time: 28, keys: 54 }

/**
 * Which print the frame takes and where it stands: `u` pixels to the
 * print's unit, and the print's corner (`x`, `y`) in the frame. The
 * print fills the frame's width, centred on the anchor (the frame's
 * middle in the phone's layout, the gate's column on the desk, so the
 * dial stands over the gate) as far as the frame's height lets it grow
 * to: past that it keeps its ground and the dial its side. Its foot
 * sits on the frame's foot: a taller frame shows more sky over it, a
 * shorter one loses sky first, then ground. Null until the frame has
 * been measured.
 */
export function usePrintFrame(layout, anchorRef = null) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const print = layout === 'desk' || r.width / r.height > WIDE ? 'desk' : 'phone'
      const frame = PRINT.frames[print]
      const anchor = anchorRef?.current?.getBoundingClientRect()
      const hx = anchor?.width ? anchor.left + anchor.width / 2 - r.left : r.width / 2
      const centred = Math.max(hx / frame.cx, (r.width - hx) / (frame.w - frame.cx))
      const u = Math.max(r.width / frame.w, Math.min(centred, r.height / (frame.h - LIFT[print])))
      const x = Math.min(0, Math.max(r.width - frame.w * u, hx - frame.cx * u))
      const next = { print, u, x, y: Math.max(r.height - frame.h * u, -LIFT[print] * u) }
      setBox(prev => (prev && prev.print === next.print && Math.abs(prev.u - next.u) < 1e-4
        && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 ? prev : next))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (anchorRef?.current) ro.observe(anchorRef.current)
    return () => ro.disconnect()
  }, [layout, anchorRef])
  return [ref, box]
}

/** The print's inks and geometry as the gate's custom properties. */
export function printVars(hour, print, box) {
  const look = PRINT.hours[hour]
  const frame = PRINT.frames[print]
  const { u, x, y } = box ?? { u: 1, x: 0, y: 0 }
  return {
    '--tpr-u': `${u}px`,
    '--tpr-x': `${x}px`,
    '--tpr-y': `${y}px`,
    '--tpr-w': frame.w,
    '--tpr-h': frame.h,
    // The room the phone's lines take over its foot: down to the
    // legend's foot, with the sky's lift taken off.
    '--tpr-room': frame.cy + frame.fare + BELOW.keys + 12 - LIFT[print],
    '--tpr-sky-h': (frame.horizon + 12) / frame.h,
    '--tpr-top': look.band,
    // The print's own sky and ground, for the moment before it has come.
    '--tpr-sky': `linear-gradient(${look.sky.map(([o, c]) => `${c} ${((o * frame.horizon) / frame.h * 100).toFixed(2)}%`).join(', ')}, ${look.ground} ${(frame.horizon / frame.h * 100).toFixed(2)}%)`,
    '--tpr-ink': look.ink.text,
    '--tpr-soft': look.ink.soft,
    '--tpr-disc-soft': look.ink.discSoft,
    '--tpr-count-a': look.ink.countA,
    '--tpr-count-b': look.ink.countB,
    '--tpr-fare': look.disc.fare,
    '--tpr-grain': `url(/today/print/${PRINT.rev}/grain.png)`,
    '--tpr-paper': `url(/today/print/${PRINT.rev}/paper.png)`,
  }
}

/** A place on the print, in its units, for an element of the gate. */
export function at(x, y) {
  return { '--at-x': x, '--at-y': y }
}
