// ── A recording on the learner's device, played this visit (plan 265) ──
// A session heard from a file the learner holds has no address the
// server knows (its media_url is NULL: the file never left the
// device), so its player plays the file itself, through an object URL
// kept here by the session's id for as long as the page lives. Reopened
// in a later visit, the session is its lines alone. A few at most: an
// object URL holds its file in memory until it is revoked.
const KEPT = 3
const urls = new Map()

export function keepLocalMedia(sessionId, file) {
  if (sessionId == null || !file || typeof URL?.createObjectURL !== 'function') return null
  if (urls.has(sessionId)) {
    URL.revokeObjectURL(urls.get(sessionId).url)
    urls.delete(sessionId)
  }
  while (urls.size >= KEPT) {
    const [oldest, kept] = urls.entries().next().value
    URL.revokeObjectURL(kept.url)
    urls.delete(oldest)
  }
  const kept = { url: URL.createObjectURL(file), sound: Boolean(file.type?.startsWith('audio/')) }
  urls.set(sessionId, kept)
  return kept
}

/** { url, sound } for a session heard from this device, or null. */
export function localMediaFor(sessionId) {
  return urls.get(sessionId) ?? null
}
