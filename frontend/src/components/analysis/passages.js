// ── 帳 — what the analyser's shelf reads off a history entry (plan 136) ──
// Each entry carries `kind: 'passage' | 'session'` (useAnalyzerSession
// merges two endpoints): a session is the video platform, a passage a
// text or, by its `source`, a photo. Pure, so the node lane holds it.

export const SHELF_KINDS = ['video', 'text', 'photo']

/** Which platform a history entry came from, as the registry's key. */
export function kindOf(h) {
  if (h.kind === 'session') return 'video'
  return h.source === 'image' ? 'photo' : 'text'
}

/** What an entry prints: a session's first sentence where the server
 *  sent one -- the grab names its file after the video's id, which says
 *  nothing -- else its label. */
export function lineOf(h) {
  return h.firstLine || h.label || ''
}

/** Kept: only a passage can be (a session has no keep). */
export function keptOf(h) {
  return h.kind === 'passage' && Boolean(h.kept)
}

/** The console's chips, drawn only for what the shelf holds (DESIGN.md,
 *  the console): "All" beside a lone kind is a choice between everything
 *  and everything, so the kinds come only when there are two, and Kept
 *  only when something is. One chip alone is no row at all -- the
 *  caller draws the row from two up. */
export function shelfChips(entries) {
  const counts = Object.fromEntries(SHELF_KINDS.map(k => [k, entries.filter(h => kindOf(h) === k).length]))
  const present = SHELF_KINDS.filter(k => counts[k] > 0)
  const kept = entries.filter(keptOf).length
  return [
    { key: 'all', n: entries.length },
    ...(present.length > 1 ? present.map(k => ({ key: k, n: counts[k] })) : []),
    ...(kept ? [{ key: 'kept', n: kept }] : []),
  ]
}

/** Whether an entry stands on the shelf under a chip and a search. */
export function shelfShows(h, filter, query = '') {
  const inFilter = filter === 'all' || (filter === 'kept' ? keptOf(h) : kindOf(h) === filter)
  const q = query.trim().toLowerCase()
  return inFilter && (!q || lineOf(h).toLowerCase().includes(q) || (h.label ?? '').toLowerCase().includes(q))
}
