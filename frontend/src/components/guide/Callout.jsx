import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// ── 案内 — the callout (plan 098; the guide's own from plan 100) ──
// One sentence beside the thing it is about. The thing is named by a
// `data-guide` attribute on the live DOM — the card, the rating bar, a
// gate's plate — never drawn again here: the callout points at the
// real element, so a change to the element changes the lesson for
// free, and there is no replica to drift.
//
// `place` says which edge of the anchor the note sits against:
//   'top'   — over the anchor's upper edge, inside it (a card whose
//             content is centred leaves its top empty);
//   'above' — resting on the anchor's top edge, outside it (a docked
//             bar, which has nothing empty inside).
//   'below' — under the anchor's bottom edge (a plate on a gate).
// The vertical is measured; the horizontal is the stage's own centre,
// which on a phone is the screen's. Re-measured on resize, on scroll
// and whenever the anchor itself changes size (the card grows on the
// flip), so the note follows the thing it is about.
//
// Portalled to document.body like the sheets: the stage column
// animates its height and clips nothing on purpose, and a fixed note
// inside a transformed ancestor would be positioned against the
// transform rather than the viewport.
//
// No buttons of its own here: the ride's note is read, not tapped, so
// it takes no pointer events and a learner can tap the card through
// it. The guide (plan 100) hands it a `foot` with Next and Skip, which
// is the one thing that makes it interactive.
const GAP = 8

function measure(anchor, place) {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`[data-guide="${anchor}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (place === 'above') return { bottom: Math.max(0, window.innerHeight - r.top + GAP) }
  if (place === 'below') return { top: r.bottom + GAP }
  return { top: r.top + GAP }
}

export function Callout({ anchor, place = 'top', text, foot, className = '', live = true }) {
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a measurement of the DOM, taken after layout; there is no render-time source for a rect.
      raf = requestAnimationFrame(() => setPos(measure(anchor, place)))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const el = document.querySelector(`[data-guide="${anchor}"]`)
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      ro?.disconnect()
    }
  }, [anchor, place, text])

  if (!pos) return null
  const classes = ['guide-callout', foot ? 'guide-callout--live' : '', className].filter(Boolean).join(' ')
  return createPortal(
    <div
      className={classes}
      style={pos}
      data-place={place}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      <p className="guide-callout__text">{text}</p>
      {foot && <div className="guide-callout__foot">{foot}</div>}
    </div>,
    document.body,
  )
}
