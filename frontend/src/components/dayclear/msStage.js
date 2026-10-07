import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { dialogOpen } from '../../lib/dialogOpen'
import { composing } from '../../lib/keyGuards'
import { playFareTick } from '../../lib/audio'

// ── 記念 — what the two milestone ceremonies share (plan 191) ─────────
// MilestoneTicket (3, 7, 14) and MilestoneMonth (30 and up) are the
// canvas's Milestone-7 and Milestone-30 boards, each drawn on a 390×844
// phone with every object at a position the board's build script
// computed. The app's screens are not all 844 tall, so each ceremony
// keeps the board's x (a 390px column, centred in the screen or in the
// desk's content area) and reads its y off the screen's height: at 844
// exactly the board's, shorter the air gives way first -- each gap
// loses its slack in proportion until 667, an iPhone SE's height -- and
// under 667 the column is drawn at 667 and scaled to fit, so nothing is
// ever cut. This module is that frame and the few habits the two
// boards share: their bezier, the skip keys and the fare's tick.

/** The board's phone. */
export const BOARD_W = 390
export const BOARD_H = 844
/** The shortest column drawn at full size; below it the column is scaled. */
export const MIN_H = 667

/** Clamp `v` into [lo, hi]. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * The air the column gives way, one entry per gap, as the boards' build
 * scripts lay them out: `slack` is what a gap can lose between 844 and
 * 667 (the slacks sum to 177, so 667 is every gap at its minimum).
 * Returns each gap's change for a column `h` tall -- negative below 844,
 * positive above (the same weights spend the extra air), or the
 * `extra` weights' share above when given.
 */
export function airFor(h, slacks, extra = slacks) {
  if (h <= BOARD_H) {
    const k = (BOARD_H - Math.max(h, MIN_H)) / (BOARD_H - MIN_H)
    return slacks.map(s => -s * k)
  }
  const sum = extra.reduce((a, b) => a + b, 0) || 1
  return extra.map(s => (h - BOARD_H) * s / sum)
}

/**
 * The box the ceremony is drawn in, measured: the screen on a phone,
 * the content area beside the rail on the desk. Before the first
 * measure, the window's size (the phone's frame is the window). The
 * layout effect measures before the first paint, so the column never
 * paints at a guessed height.
 */
export function useStageBox(ref) {
  const [box, setBox] = useState(() => ({
    w: typeof window === 'undefined' ? BOARD_W : window.innerWidth,
    h: typeof window === 'undefined' ? BOARD_H : window.innerHeight,
  }))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const read = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setBox(b => (Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { w: r.width, h: r.height }))
      }
    }
    read()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

/**
 * The column's frame for a box: drawn `colH` tall (never under 667),
 * scaled by `scale` (1 from 667 up) from its top centre, and the gate's
 * inset from the column's edges (22, more when the screen is narrower
 * than the board, so the gate stays 22px from the screen's edge).
 */
export function columnFrame({ w, h }) {
  const scale = h >= MIN_H ? 1 : h / MIN_H
  const colH = h >= MIN_H ? h : MIN_H
  const inset = 22 + Math.max(0, (BOARD_W * scale - w) / 2) / scale
  return { scale, colH, inset }
}

/**
 * The boards' bezier, inverted: for a CSS cubic-bezier, the time
 * fraction at which `progress` is reached (Milestone-7 lights each stamp
 * as the line's front arrives).
 */
export function bezierTime(x1, y1, x2, y2) {
  const bx = s => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s
  const by = s => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s
  return y => {
    let lo = 0
    let hi = 1
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2
      if (by(m) < y) lo = m
      else hi = m
    }
    return bx((lo + hi) / 2)
  }
}

/**
 * A tap, a click or Enter skips a ceremony to its rest (the boards'
 * skip()); at rest the screen's own buttons answer. Enter is the
 * ceremony's only while nothing else owns it: not a field's, not a
 * dialog's, not the 進級's board.
 */
export function useSkipKey(skip, active) {
  const ref = useRef(skip)
  useEffect(() => { ref.current = skip })
  useEffect(() => {
    if (!active) return undefined
    const onKey = e => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (composing(e) || dialogOpen() || document.documentElement.hasAttribute('data-levelup')) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      e.preventDefault()
      ref.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

/** The fare's tick, at most once every 80ms however fast the figure counts. */
export function useFareTick() {
  const last = useRef(0)
  return useCallback(() => {
    const now = typeof performance === 'undefined' ? Date.now() : performance.now()
    if (now - last.current < 80) return
    last.current = now
    playFareTick()
  }, [])
}

/**
 * The left offset, in px from `ancestor`, of `el`'s layout box (the
 * offset chain, so a transform in flight -- an entrance still waiting on
 * its delay -- does not move the measure).
 */
export function offsetIn(el, ancestor) {
  let x = 0
  let y = 0
  let node = el
  while (node && node !== ancestor) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent
  }
  return { x, y, w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 }
}
