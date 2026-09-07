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
export function runPathFor(lanes, off) {
  const chosen = lanes.filter(l => !off.has(l.id))
  if (chosen.length === lanes.length) return '/today/run'
  return `/today/run?lanes=${encodeURIComponent(chosen.map(l => l.id).join(','))}`
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
