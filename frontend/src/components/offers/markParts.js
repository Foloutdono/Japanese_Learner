import { MARK_INK, MARK_ROAD } from '../ui/markPaths'

// 辻 in its two parts (plan 171). The ink is five strokes cut from the
// font (scripts/build-mark.py): its first two subpaths are 十, the
// cross, and the rest are 辶's dot and zigzag; the road is 辶's sweep.
// The offers' passes fill 辶 -- dot, zigzag and sweep -- with the
// learner's XP, and never 十.
const SUBPATHS = MARK_INK.match(/M[^M]*/g)

export const CROSS = SUBPATHS.slice(0, 2).join('')
export const SHIN = SUBPATHS.slice(2).join('')
export const ROAD = MARK_ROAD
