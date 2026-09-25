// ── Lanes — the day's services, as the gate and the run name them ──
// A lane is one (section, level, mode) service due today, or one of the
// learner's own decks under one mode (backend: study/daily_queue.py).
// The gate lists them as switches, the run captions each card with the
// same words, so the words live in one place.

/** What a lane IS, for its pigment: a section, or anyone's own deck. */
export function laneTypeOf(lane) {
  return lane.kind === 'personal' ? 'personal' : lane.source
}

/** Where a card came from, in words a person would use: a deck name,
 *  a JLPT level, or a kana set's label rather than its stored slug.
 *  `kanaSetLabel` is passed in rather than imported so this module
 *  stays free of the locale tables. */
export function laneWhere(lane, t, kanaSetLabel) {
  if (!lane) return ''
  if (lane.kind === 'personal') return lane.deck_name
  return lane.source === 'kana' ? kanaSetLabel(t, lane.deck) : lane.deck
}

/** The run's path for a choice: the query carries only a partial
 *  choice — an empty `lanes` already means the whole queue on the
 *  backend, and the run's session key must not churn. */
export function runPathFor(lanes, off, take = null) {
  const chosen = lanes.filter(l => !off.has(l.id))
  // A length shorter than the choice (plan 135): the run carries each
  // lane's share, which names the lanes too.
  if (take != null && take < chosen.reduce((n, l) => n + laneCount(l), 0)) {
    return `/today/run?quota=${encodeURIComponent(quotaParam(splitTake(chosen, take)))}`
  }
  if (chosen.length === lanes.length) return '/today/run'
  return `/today/run?lanes=${encodeURIComponent(chosen.map(l => l.id).join(','))}`
}

// ── 区間 — a run of a chosen length (plan 135) ────────────────
// The desk's gate offers a run of 20, 50 or 100 instead of the whole
// day. The length is dealt over the chosen lanes exactly as the queue
// deals a batch (backend study/daily_queue.interleave): one card from
// each lane in turn, in the queue's own order -- most overdue lane
// first -- so the figure each lane prints is what the run will serve
// from it. The run hands each lane's remainder back as `quota`, and the
// server serves no lane past it.

/** The run lengths offered beside "all". */
export const TAKE_STEPS = [20, 50, 100]

/** What a lane puts in the run: its reviews and its new cards. */
export function laneCount(lane) {
  return (lane?.due ?? 0) + (lane?.new ?? 0)
}

/** `take` dealt round-robin over `lanes` (queue order): id -> cards.
 *  A null take, or one past the total, is every lane whole. */
export function splitTake(lanes, take) {
  const out = new Map(lanes.map(l => [l.id, 0]))
  const total = lanes.reduce((n, l) => n + laneCount(l), 0)
  if (take == null || take >= total) {
    for (const l of lanes) out.set(l.id, laneCount(l))
    return out
  }
  let dealt = 0
  while (dealt < take) {
    let progressed = false
    for (const l of lanes) {
      if (out.get(l.id) < laneCount(l)) {
        out.set(l.id, out.get(l.id) + 1)
        dealt += 1
        progressed = true
        if (dealt >= take) break
      }
    }
    if (!progressed) break
  }
  return out
}

/** "a:3,b:5" -> Map; the lane id is everything before the last ':'. */
export function parseQuota(raw) {
  const out = new Map()
  for (const part of (raw ?? '').split(',')) {
    const i = part.lastIndexOf(':')
    if (i <= 0) continue
    const n = Number.parseInt(part.slice(i + 1), 10)
    if (Number.isFinite(n) && n > 0) out.set(part.slice(0, i), n)
  }
  return out
}

/** Map -> "a:3,b:5", lanes at zero left out, in a stable order. */
export function quotaParam(quota) {
  return [...quota].filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([id, n]) => `${id}:${n}`).join(',')
}

/** "in 3 hours" / "tomorrow", in the UI's language. */
export function untilNext(iso, lang) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  const mins = Math.round(ms / 60000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (mins < 60) return rtf.format(Math.max(1, mins), 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

/** Reviews due today per deck id (as a string), from the day's lanes —
 *  the shelf's and a deck page's "n due". */
export function dueByDeck(today) {
  const out = new Map()
  for (const lane of today?.lanes ?? []) {
    if (lane.kind !== 'personal') continue
    out.set(String(lane.deck_id), (out.get(String(lane.deck_id)) ?? 0) + lane.due)
  }
  return out
}
