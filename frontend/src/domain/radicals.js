// ── 部首 — a page of the radical index, as a shelf ───────────
// The station reads a page of the index as a shelf of lessons, not as a
// lookup (components/selection/RadicalSelector.jsx, `order="rank"`), so
// it puts the biggest families first — 氵 files 123 of the course's
// kanji and 夂 one — with Kangxi order between equals.
export const byRank = (a, b) => b.count - a.count || a.number - b.number

// ── The radical the desk's bare index opens on (plan 115) ────
// On the desk the index stands beside every radical's page, so the page
// that was only the index opens on a radical: the first of the page it
// was left on (?stroke=), else of the first page, in the order above —
// the biggest family there. Null when the index holds nothing.
export function firstRadical(groups, stroke) {
  const group = groups.find(g => g.stroke_count === stroke) ?? groups[0]
  return group?.radicals.length ? [...group.radicals].sort(byRank)[0].number : null
}
