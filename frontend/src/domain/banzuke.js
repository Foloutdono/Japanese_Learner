// ── 番付 — what a board shows (plan 262) ──────────────────────────
// The six divisions of sumo, foot to top, as study/banzuke.py numbers
// them. Their names are proper nouns, the same in every language.
export const DIVISIONS = [
  { key: 'jonokuchi', jp: '序ノ口', latin: 'Jonokuchi' },
  { key: 'jonidan', jp: '序二段', latin: 'Jonidan' },
  { key: 'sandanme', jp: '三段目', latin: 'Sandanme' },
  { key: 'makushita', jp: '幕下', latin: 'Makushita' },
  { key: 'juryo', jp: '十両', latin: 'Jūryō' },
  { key: 'makuuchi', jp: '幕内', latin: 'Makuuchi' },
]

// The places the profile's board keeps above the learner's own when
// the learner stands below its top.
export const TOP_ROWS = 3

/**
 * The rows one board shows on the profile, by rank, and where the ⋯
 * goes: the top whole while the learner stands in it or their
 * neighbours (`board.near`) meet it, else its first TOP_ROWS, the ⋯,
 * and the learner between their neighbours. A board without neighbours
 * (an older answer) closes on the learner's own row after its top, as
 * it always did.
 *
 * Returns [{ gap: true } | { e }], in order.
 */
export function boardRows(board, top = TOP_ROWS) {
  const entries = board?.entries ?? []
  const me = board?.me ?? null
  const near = board?.near ?? []
  const inTop = me && entries.some(e => e.username === me.username)
  let rows
  if (inTop || !me || me.rank == null) rows = [...entries]
  // Neighbours that meet the top join it whole, no ⋯ hiding a row.
  else if (near.length && near[0].rank <= entries.length + 1) rows = [...entries, ...near]
  else if (near.length) rows = [...entries.slice(0, top), ...near]
  else rows = [...entries, me]
  return withGaps(dedupe(rows))
}

function dedupe(rows) {
  const seen = new Map()
  for (const e of rows) if (e && e.rank != null && !seen.has(e.rank)) seen.set(e.rank, e)
  return [...seen.values()].sort((a, b) => a.rank - b.rank)
}

// A ⋯ wherever two shown ranks are not next to each other.
function withGaps(rows) {
  const out = []
  rows.forEach((e, i) => {
    if (i && e.rank > rows[i - 1].rank + 1) out.push({ gap: true })
    out.push({ e })
  })
  return out
}

/**
 * The desk's one board (plan 248): the ranks either side shows, down
 * one column, a ⋯ wherever two are not next to each other. Each side
 * keeps its own entry per rank.
 *
 * Returns { lines: [{ gap: true } | { rank }], sides: [Map, Map] }.
 */
export function bothRows(week, all, top = TOP_ROWS) {
  const sides = [week, all].map(b => new Map(boardRows(b, top).filter(r => r.e).map(r => [r.e.rank, r.e])))
  const ranks = [...new Set(sides.flatMap(s => [...s.keys()]))].sort((a, b) => a - b)
  const lines = []
  ranks.forEach((rank, i) => {
    if (i && rank > ranks[i - 1] + 1) lines.push({ gap: true })
    lines.push({ rank })
  })
  return { lines, sides }
}

/** The row's movement since the day began: 'up', 'down' or null. */
export function moveOf(e) {
  if (!e?.move) return null
  return e.move > 0 ? 'up' : 'down'
}
