import { MARK_INK, MARK_ROAD } from '../ui/markPaths'

// 辻 in its two parts (plan 172). The ink is five strokes cut from the
// font (scripts/build-mark.py): its first two subpaths are 十, the
// cross, and the rest are 辶's dot and zigzag; the road is 辶's sweep.
// The XP fills the whole 辻 as one vessel, from the road's foot up
// through 十 (the cross filled only in the level-up until it was asked
// to at rest too).
const SUBPATHS = MARK_INK.match(/M[^M]*/g)

export const CROSS = SUBPATHS.slice(0, 2).join('')
export const SHIN = SUBPATHS.slice(2).join('')
export const ROAD = MARK_ROAD

// Where each part stands in the mark's own 1000-unit square (y down):
// 十 from its crown to its foot, the whole 辻 from that crown to the
// road's foot. The fill's level is one line across all of it.
export const MARK_TOP = 31
export const MARK_FOOT = 977
export const CROSS_FOOT = 783

/**
 * How much of 十's own height a share of the level fills. The share is
 * the climb of the whole mark, a line rising from the road's foot, so 十
 * -- standing on the road -- is reached once the line passes its foot,
 * a fifth of the way up, and is full with the mark.
 */
export function crossShare(share) {
  const level = MARK_FOOT - (MARK_FOOT - MARK_TOP) * Math.min(1, Math.max(0, share))
  return Math.min(1, Math.max(0, (CROSS_FOOT - level) / (CROSS_FOOT - MARK_TOP)))
}
