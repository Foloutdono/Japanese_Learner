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
// which on a phone is the screen's (on the desk's panels, the anchor's). Re-measured on resize, on scroll
// and whenever the anchor itself changes size (the card grows on the
// flip), so the note follows the thing it is about.
//
// Portalled to document.body like the sheets: the stage column
// animates its height and clips nothing on purpose, and a fixed note
// inside a transformed ancestor would be positioned against the
// transform rather than the viewport.
//
// A note per anchor, place and sentence (`key` below): a step that
// moves the lesson on mounts a NEW note where it belongs, faded in, and
// never carries the last one across the screen. The one note moved
// between the ride's anchors -- the card's top, under the 🔍, over the
// bar -- and for a frame stood at the old place's offset under the new
// place's rule (606 → 10 → 562 px, the run's whole layout shift: 1.02
// and 1.32 on a learner's phone, 2026-10-18). A note inserted is no
// shift; the same note moved is one. Re-measures still move it with its
// anchor, as they should.
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
  const pos = place === 'above' ? { bottom: Math.max(0, window.innerHeight - r.top + GAP) }
    : place === 'below' ? { top: r.bottom + GAP }
    : { top: r.top + GAP }
  // 机 (plan 133): on a run's three panels the stage is the middle
  // column, neither the window's middle nor what a lone side leaves, so
  // the note stands on its anchor, at the anchor's width.
  if (el.closest('.desk-run--panels')) return { ...pos, left: r.left + r.width / 2, width: r.width }
  return pos
}

export function Callout({ anchor, place = 'top', text, foot, className = '', live = true }) {
  const key = `${anchor}|${place}|${text}`
  // The position, with the note it was measured for: a stale one is
  // never drawn under a new note.
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a measurement of the DOM, taken after layout; there is no render-time source for a rect.
      raf = requestAnimationFrame(() => {
        const style = measure(anchor, place)
        setPos(style ? { key, style } : null)
      })
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
  }, [anchor, place, text, key])

  if (!pos || pos.key !== key) return null
  const classes = ['guide-callout', foot ? 'guide-callout--live' : '', className].filter(Boolean).join(' ')
  return createPortal(
    <div
      key={key}
      className={classes}
      style={pos.style}
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
