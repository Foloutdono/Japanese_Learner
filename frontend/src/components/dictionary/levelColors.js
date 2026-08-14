// ── JLPT level pigments ───────────────────────────────────
// N5 through N1, easiest to hardest, warming as they go. Used by the
// level badge and — since the catalogue redesign — by the entry card
// itself, whose bottom edge carries its level's colour the way a
// station plate carries its line's. A wall of them shows the
// difficulty spread of a search at a glance.
//
// Its own module rather than an export from DictionaryDetail.jsx: a
// file that exports both components and constants breaks fast refresh
// for everything importing it (react-refresh/only-export-components).
export const LEVEL_COLORS = {
  N5: 'var(--success)',
  N4: 'var(--accent2)',
  N3: 'var(--warning)',
  N2: 'var(--accent7)',
  N1: 'var(--danger)',
}
