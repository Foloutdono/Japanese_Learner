import { useLayoutEffect, useRef, useState } from 'react'

// ── The card's two sizes (plan 173) ──────────────────────────────────
// The card (PassCard.jsx) is drawn at two fixed sizes and scaled to its slot, the way
// the offers' stage is (plan 172): the face's print and both sides'
// stuff at FACE_W, where the scale's own tokens draw it, and the back's
// denser print at BACK_W, where the same tokens fit its smaller type.
// One measured width sets both factors, so the corners, the band and
// the edge agree on either side at any size: the rail's holder, the
// gate's reader, a run's level-up, the profile.
export const FACE_W = 272
export const BACK_W = 424

// The width each slot last measured (plan 291): a card drawn again in
// its slot (the profile's, at every visit) starts at it, so the reading
// before paint confirms it rather than drawing the card a second time,
// which held the Profile gate's tap for a beat.
const lastWidth = new Map()

/**
 * The slot's own width: a ref for the card's root and the width in
 * pixels, null until measured. offsetWidth, not the bounding box, so a
 * card hung or tilted by a transform (the gate's, the level-up's)
 * measures its box. The first reading is before paint, so the card
 * never shows unscaled. `slot` names the place (the card's class).
 */
export function useSlotWidth(slot = '') {
  const ref = useRef(null)
  const [width, setWidth] = useState(() => lastWidth.get(slot) ?? null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const read = () => {
      const measured = node.offsetWidth || null
      if (measured) lastWidth.set(slot, measured)
      setWidth(measured)
    }
    read()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [slot])
  return [ref, width]
}

/** The two scale factors, as the card's custom properties. */
export function scaleVars(width) {
  return width ? { '--pcard-kf': width / FACE_W, '--pcard-kb': width / BACK_W } : undefined
}

const CLASS = { free: 'cardFree', pro: 'cardPaid', max: 'cardPaid' }
/** The class printed on the card, in the learner's language. */
export const classLabel = (t, tier) => t[CLASS[tier]]
