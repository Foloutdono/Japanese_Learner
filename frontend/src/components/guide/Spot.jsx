import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// ── 案内 — the spot (plan 100), and the first ride's cue ──────────
// One element over a rect whose shadow IS the scrim (box-shadow 0 0 0
// 100vmax), wearing the anchor's own corner. The guide draws it over
// each stop it explains; the first ride draws it over the one thing a
// note asks the learner to press -- the card to turn, the 🔍 to open,
// the bar or the tile to rate with -- and over nothing when a note only
// explains, so the lit thing is always the next thing to do.
//
// It takes no pointer events, and neither does its shadow: the thing
// it frames is pressed through it, and so is anything it dims.
export const PAD = 6
const MOVE_MS = 260

export function Spot({ rect, radius = 'card', className = '' }) {
  return (
    <div
      className={`guide__spot guide__spot--${radius}${className ? ` ${className}` : ''}`}
      style={{
        top: rect.top - PAD, left: rect.left - PAD,
        width: rect.width + 2 * PAD, height: rect.height + 2 * PAD,
        '--guide-move': `${MOVE_MS}ms`,
      }}
      aria-hidden="true"
    />
  )
}

function rectOf(target) {
  const el = document.querySelector(target)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { el, rect: { top: r.top, left: r.left, width: r.width, height: r.height } }
}

// The ride's cue: the spot over `target`, a CSS selector, measured the
// way the guide measures its stops -- on a resize, a scroll, the target
// changing size and the end of any animation or transition (the card
// arrives, and grows on the flip), with two late measures for an
// arrival that fires no event. One element for the whole ride, so a
// new target is the spot gliding there rather than a second one.
export function Cue({ target, radius = 'card' }) {
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setRect(rectOf(target)?.rect ?? null)
      })
    }
    update()
    const late = [setTimeout(update, 320), setTimeout(update, 760)]
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    document.addEventListener('animationend', update, true)
    document.addEventListener('transitionend', update, true)
    const found = rectOf(target)
    const ro = found && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (found) ro?.observe(found.el)
    return () => {
      cancelAnimationFrame(raf)
      late.forEach(clearTimeout)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('animationend', update, true)
      document.removeEventListener('transitionend', update, true)
      ro?.disconnect()
    }
  }, [target])

  if (!rect) return null
  return createPortal(<Spot rect={rect} radius={radius} className="guide__spot--cue" />, document.body)
}
