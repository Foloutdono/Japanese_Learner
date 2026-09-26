// ── 机 — a grid of tiles walked with the arrow keys (plan 123) ─────
// The two-dimensional sibling of hooks/useListWalk: the dictionary's
// catalogue is one tab stop, the open tile, and the arrows move along
// the grid as the eye reads it -- ←/→ one tile, ↑/↓ one row, the row's
// length read off the grid's own columns (it reflows with the window),
// Home and End to either end of what is loaded. A move moves the focus
// and calls `onMove(index)`, which opens that tile beside the grid, so
// the ring and the open entry never disagree. Kept from the page under
// it: the page's own ←/→ walk the catalogue only when the focus is
// elsewhere. The grid's keydown handler, or nothing (a phone).
//
// `tiles` (plan 136) is for a grid whose tiles are not its children: the
// analyser's shelf wraps each card's door with its ✕, so it names the
// doors, one to a cell.
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
const TILES = ':scope > :is(a[href], button)'

export function useGridWalk(active, onMove, tiles = TILES) {
  return active ? e => walk(e, onMove, tiles) : undefined
}

function walk(e, onMove, selector) {
  if (!KEYS.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
  const grid = e.currentTarget
  const tiles = [...grid.querySelectorAll(selector)]
  const at = tiles.indexOf(document.activeElement)
  if (at < 0) return
  const columns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)
  const last = tiles.length - 1
  const to = {
    ArrowLeft: at - 1, ArrowRight: at + 1, ArrowUp: at - columns, ArrowDown: at + columns, Home: 0, End: last,
  }[e.key]
  e.preventDefault()
  e.stopPropagation()
  const next = Math.min(last, Math.max(0, to))
  if (next === at) return
  tiles[next].focus()
  onMove?.(next)
}
