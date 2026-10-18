// ── 号車 — how a line's cars stand (plan 251) ─────────────────────────
// The desk's line station stands the open stop's exercises as the cars
// of a train (components/selection/LinePlatforms.jsx). Two measures
// decide how: how many cars a row holds, and how large a car's face is
// drawn. Both read the room the page actually has, never the window's
// width, which the rail and the line's own width already take from.

// A car's narrowest: under it, a row takes one car fewer. The cars'
// gap is the grid's (--sp-5). Two to a row at the least, so even the
// desk's narrowest page keeps a train.
const CAR_MIN = 200
const CAR_GAP = 16

/**
 * The columns the cars stand in, and how many cells the lead car (the
 * first) spans: two to four columns by how many cars there are, fewer
 * where the page is too narrow for them; the lead takes what the last
 * row would leave empty, so the train has no gap in it.
 */
export function carsFor(n, width = null) {
  if (n <= 1) return { cols: 1, lead: 1 }
  let cols = n <= 4 ? 2 : n <= 6 ? 3 : 4
  if (width) cols = Math.max(2, Math.min(cols, Math.floor((width + CAR_GAP) / (CAR_MIN + CAR_GAP))))
  return { cols, lead: cols - ((n - 1) % cols) }
}

// The largest rung a car's face may take, from its well's own height and
// width (in whole pixels, as hooks/useBoxWidth's useBoxSize reads them):
// the study card's specimen rungs where the well can hold a card at
// them, a rung down each step it cannot. Measured, so the same face
// reads whole in a laptop's car and in a wide window's; the face then
// steps down from it for as long as its own content overflows the well
// (LinePlatforms' Specimen).
const RUNG_LG = { height: 190, width: 240 }
const RUNG_MD = 120

/** 'lg' | 'md' | 'sm', or null before the well is measured. */
export function rungFor(size) {
  if (!size) return null
  if (size.height >= RUNG_LG.height && size.width >= RUNG_LG.width) return 'lg'
  return size.height >= RUNG_MD ? 'md' : 'sm'
}
