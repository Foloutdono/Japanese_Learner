import { useState, useEffect, useRef, useCallback } from 'react'

// Once the queue drops to this many unreviewed cards, kick off a
// background refill — small enough that a refill is rarely idle for
// long, big enough that a burst of fast answers doesn't outrun it.
const REFILL_AT = 4

// Bump when the shape of a cached card changes. Every storageKey built
// by sessionKey() carries this, so a bump orphans (and then sweeps) the
// old caches instead of feeding a stale shape to a renderer that no
// longer understands it. Only the deck-study screen used to version its
// key; the other four had no version at all, which is why a payload
// change could hand `choices.map` an undefined.
// v4: the study-mode taxonomy changed, so a v3 entry's storage key
// names a retired mode ('qcm-kj-m', 'flashcard'). sweepStaleCaches
// deletes them; without the bump they would refetch under a key the
// backend no longer serves.
const CACHE_VERSION = 'v4'

const KEY_PREFIX = 'jp-session'

/**
 * Build a session storage key. Screens must use this rather than
 * assembling the string themselves, so the version segment can never be
 * forgotten on one screen and present on another.
 *
 *   sessionKey('kanji', level, mode) -> 'jp-session:v3:kanji:N5:kanji.flashcard.f2b'
 */
export function sessionKey(...parts) {
  return [KEY_PREFIX, CACHE_VERSION, ...parts].join(':')
}

/** The placeholder key used while a screen's selection is incomplete. */
export const IDLE_KEY = 'idle'

// A cached entry has to be an array of card-shaped objects, and every
// card has to belong to the mode we're about to render it in. Without
// this check a queue cached under an older payload shape reaches a
// renderer that assumes fields it doesn't have.
function isUsableQueue(value, mode) {
  if (!Array.isArray(value)) return false
  return value.every(card => (
    card !== null
    && typeof card === 'object'
    && typeof card.card_id === 'string'
    && card.card_id.length > 0
    && (mode == null || card.mode == null || card.mode === mode)
  ))
}

function loadCache(storageKey, mode, validateCard) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!isUsableQueue(parsed, mode)) {
      window.localStorage.removeItem(storageKey)
      return []
    }
    if (validateCard && !parsed.every(validateCard)) {
      window.localStorage.removeItem(storageKey)
      return []
    }
    return parsed
  } catch {
    // Unparseable — drop it rather than leaving a poison entry that
    // fails again on every future mount.
    try { window.localStorage.removeItem(storageKey) } catch { /* ignore */ }
    return []
  }
}

function saveCache(storageKey, queue) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(queue))
  } catch {
    // Storage full/disabled — session just won't survive a reload,
    // nothing else about the current session is affected.
  }
}

// Delete session caches left behind by an older CACHE_VERSION. Runs
// once per page load; without it every taxonomy or payload change leaves
// its dead caches in localStorage forever.
let sweptThisLoad = false
function sweepStaleCaches() {
  if (sweptThisLoad) return
  sweptThisLoad = true
  try {
    const keep = `${KEY_PREFIX}:${CACHE_VERSION}:`
    const doomed = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(`${KEY_PREFIX}:`) && !key.startsWith(keep)) doomed.push(key)
    }
    doomed.forEach(key => window.localStorage.removeItem(key))
  } catch {
    // Storage unavailable — nothing to sweep.
  }
}

/**
 * Maintains a local queue of cards for one study session (one deck +
 * mode) and answers "what's the next card" out of that queue instead
 * of fetching one, so advancing between cards never waits on a
 * network round trip. The queue refills itself in the background
 * before it runs dry.
 *
 * @param {string} storageKey  built with sessionKey(); changing it
 *   starts a fresh session for the new key.
 * @param {(count: number, excludeIds: string[], signal: AbortSignal) => Promise<object[]>} fetchBatch
 *   Resolves to card objects, each with a `card_id`. Must THROW on a
 *   failed request rather than resolving to [] — see `done` below.
 *   The `signal` is aborted on unmount and on key change; the hook also
 *   applies its own timeout, so implementations no longer need one.
 * @param {number} [batchSize=10]
 * @param {string} [mode]  the mode these cards belong to; used to reject
 *   a cache written for a different mode.
 * @param {(card: object) => boolean} [validateCard]  extra per-mode
 *   shape check for cached cards, e.g. asserting an MCQ-hinted mode's
 *   cards actually carry choices.
 * @param {() => string[]} [extraExcludeIds]  ids to exclude on top of
 *   the queued ones — the just-reviewed set, so a fire-and-forget review
 *   POST that hasn't landed yet can't have its card handed straight back.
 * @param {number} [fetchTimeoutMs=10000]
 *
 * ── On failure ──
 * `error` is set only when a fetch fails AND the queue is empty, so a
 * cache-seeded queue still degrades silently the way it always has. The
 * hook then retries on its own with exponential backoff, because the
 * localStorage mirror was only ever a partial answer to a cold-starting
 * backend: it helps a returning user and does nothing at all for a first
 * visit. `retry()` is exposed for an explicit user-facing button.
 *
 * `done` is set ONLY on a successful empty response. A failed request can
 * no longer masquerade as an exhausted deck — which is what used to make
 * an expired token play the "quiz complete" fanfare.
 */
export function useCardSession({
  storageKey,
  fetchBatch,
  batchSize = 10,
  mode,
  validateCard,
  extraExcludeIds,
  fetchTimeoutMs = 10000,
}) {
  sweepStaleCaches()

  const [queue, setQueue] = useState(() => loadCache(storageKey, mode, validateCard))
  const [done, setDone] = useState(false)
  const [fetching, setFetching] = useState(queue.length === 0)
  const [error, setError] = useState(null)

  // Monotonic session generation. Bumped whenever storageKey changes.
  //
  // This replaces the old single `refillingRef` boolean, which was the
  // cause of the worst loading bug in the app: switching mode while a
  // refill was in flight left the boolean true, so the NEW session's
  // refill bailed out immediately; then the old response's `finally`
  // cleared the flag with nothing left to re-trigger the effect (its
  // deps were all unchanged), and the screen stayed blank forever.
  //
  // With a generation counter there is nothing to re-arm: a refill is
  // in flight for this session iff refillGenRef === genRef, so a new
  // generation is automatically free to fetch.
  const genRef = useRef(0)
  const refillGenRef = useRef(-1)
  const abortRef = useRef(null)
  const retryTimerRef = useRef(null)
  const attemptsRef = useRef(0)
  // Read inside refill() so the callback doesn't have to depend on
  // `queue` — depending on it made refill a new function on every single
  // answer, which is half of why the old trigger effect was so fragile.
  // Synced in an effect rather than during render; effects run in
  // declaration order, so this lands before the refill trigger below.
  const queueRef = useRef(queue)
  useEffect(() => { queueRef.current = queue }, [queue])

  const activeKeyRef = useRef(storageKey)

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  // Deck/mode changed — start a fresh session for the new key instead
  // of refilling the old queue under a new name.
  useEffect(() => {
    if (activeKeyRef.current === storageKey) return
    activeKeyRef.current = storageKey
    genRef.current += 1
    clearRetry()
    attemptsRef.current = 0
    abortRef.current?.abort()
    abortRef.current = null

    const cached = loadCache(storageKey, mode, validateCard)
    setQueue(cached)
    setDone(false)
    setError(null)
    setFetching(cached.length === 0)
    // validateCard is a fresh closure on most renders; the guard above
    // means only a real key change gets past the early return anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, mode, clearRetry])

  // Abort whatever is in flight when the component goes away.
  useEffect(() => () => {
    genRef.current += 1
    abortRef.current?.abort()
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
  }, [])

  const refill = useCallback(async () => {
    const gen = genRef.current
    if (refillGenRef.current === gen) return
    if (storageKey === IDLE_KEY) return
    refillGenRef.current = gen

    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs)

    const queued = queueRef.current
    if (queued.length === 0) setFetching(true)

    try {
      const excludeIds = [
        ...queued.map(c => c.card_id),
        ...(extraExcludeIds ? extraExcludeIds() : []),
      ]
      const fresh = await fetchBatch(batchSize, excludeIds, controller.signal)

      // The session moved on while this was in flight — drop the
      // response rather than merging stale cards into the new one.
      if (gen !== genRef.current) return

      attemptsRef.current = 0
      setError(null)

      if (fresh.length === 0) {
        // Only a SUCCESSFUL empty response means the deck is finished.
        if (queueRef.current.length === 0) setDone(true)
      } else {
        setQueue(q => {
          // De-dup by card_id: the old blind append could seat the same
          // card twice when a refill raced a key change.
          const seen = new Set(q.map(c => c.card_id))
          const merged = [...q, ...fresh.filter(c => !seen.has(c.card_id))]
          saveCache(storageKey, merged)
          return merged
        })
      }
    } catch (e) {
      if (gen !== genRef.current) return
      // A cache-seeded queue keeps playing; only a genuinely empty
      // session surfaces the failure.
      if (queueRef.current.length === 0) {
        setError(e)
        // Back off and retry — a cold-starting backend recovers on its
        // own without the user having to tap anything.
        const attempt = attemptsRef.current
        attemptsRef.current = attempt + 1
        if (attempt < 4) {
          clearRetry()
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            if (gen === genRef.current) {
              refillGenRef.current = -1
              setError(null)
            }
          }, 1000 * 2 ** attempt)
        }
      }
    } finally {
      clearTimeout(timer)
      if (abortRef.current === controller) abortRef.current = null
      // Generation-guarded: clearing this for a session that has already
      // been replaced is exactly what stranded the new one.
      if (gen === genRef.current) {
        refillGenRef.current = -1
        setFetching(false)
      }
    }
  }, [storageKey, fetchBatch, batchSize, extraExcludeIds, fetchTimeoutMs, clearRetry])

  useEffect(() => {
    if (!done && !error && queue.length <= REFILL_AT) refill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, storageKey, done, error])

  /** Explicit user-facing retry, for the error panel's button. */
  const retry = useCallback(() => {
    clearRetry()
    attemptsRef.current = 0
    refillGenRef.current = -1
    setError(null)
    setDone(false)
  }, [clearRetry])

  // Pop the front card off — call this once a review has been
  // recorded (fire-and-forget, same as today) and the next card
  // should show. No fetch happens here; the card is already in hand.
  const advance = useCallback(() => {
    setQueue(q => {
      const next = q.slice(1)
      saveCache(storageKey, next)
      return next
    })
  }, [storageKey])

  // Patch the current (head) card in place without advancing —
  // e.g. Kanji/Vocab re-translating the displayed card after a UI
  // language change. `updater` is either a partial object to merge
  // in, or a function old -> new (mirrors setState's two forms).
  const updateCurrent = useCallback((updater) => {
    setQueue(q => {
      if (q.length === 0) return q
      const [head, ...rest] = q
      const nextHead = typeof updater === 'function' ? updater(head) : { ...head, ...updater }
      const next = [nextHead, ...rest]
      saveCache(storageKey, next)
      return next
    })
  }, [storageKey])

  return {
    current: queue[0] ?? null,
    queueLength: queue.length,
    // Only a genuine "nothing to show yet" state — not shown once the
    // cache (or a previous fetch) has put at least one card in hand,
    // even while a refill is quietly running behind it.
    loading: fetching && queue.length === 0,
    done,
    // Non-null only when there is nothing to show AND the last fetch
    // failed. Screens must render an error state for this, or a failed
    // session shows an empty pane with no explanation (which is what it
    // used to do).
    error,
    retry,
    advance,
    updateCurrent,
  }
}
