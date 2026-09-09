// ── JLPT level pigments ───────────────────────────────────
// N5 through N1, easiest to hardest, warming as they go. Used by the
// level badge, and by the entry card as the pigment its border takes
// on hover and when it is the open entry.
//
// The card's bottom edge carried this colour too, until the stage
// moved onto that edge (owner's ruling; see .dict-entry-card in
// index.css for the six directions it was chosen from). The wall shows
// how far along the cards are now, and the level is read from the
// badges.
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
