import { useLayoutEffect, useState } from 'react'

// ── The card's two sizes (plan 172) ──────────────────────────────────
// The card (PassCard.jsx) is drawn at two fixed sizes and scaled to its slot, the way
// the offers' stage is (plan 171): the face's print and both sides'
// stuff at FACE_W, where the scale's own tokens draw it, and the back's
// denser print at BACK_W, where the same tokens fit its smaller type.
// One measured width sets both factors, so the corners, the band and
// the edge agree on either side at any size: the rail's holder, the
// gate's reader, a run's level-up, the profile.
export const FACE_W = 272
export const BACK_W = 424

/**
 * The slot's own width: a callback ref and the width in pixels, null
 * until measured. offsetWidth, not the bounding box, so a card hung or
 * tilted by a transform (the gate's, the level-up's) measures its box.
 * The first reading is before paint, so the card never shows unscaled.
 */
export function useSlotWidth() {
  const [node, setNode] = useState(null)
  const [width, setWidth] = useState(null)
  useLayoutEffect(() => {
    if (!node) return
    const read = () => setWidth(node.offsetWidth || null)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, width]
}

/** The two scale factors, as the card's custom properties. */
export function scaleVars(width) {
  return width ? { '--pcard-kf': width / FACE_W, '--pcard-kb': width / BACK_W } : undefined
}

const CLASS = { free: 'cardFree', pro: 'ofrCardPro', max: 'ofrCardMax' }
/** The class printed on the card, in the learner's language. */
export const classLabel = (t, tier) => t[CLASS[tier]]
