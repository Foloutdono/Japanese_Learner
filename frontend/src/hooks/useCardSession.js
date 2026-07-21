import { useState, useEffect, useRef, useCallback } from 'react'

// Once the queue drops to this many unreviewed cards, kick off a
// background refill — small enough that a refill is rarely idle for
// long, big enough that a burst of fast answers doesn't outrun it.
const REFILL_AT = 4

function loadCache(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : []
  } catch {
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

/**
 * Maintains a local queue of cards for one study session (one deck +
 * mode) and answers "what's the next card" out of that queue instead
 * of fetching one, so advancing between cards never waits on a
 * network round trip. The queue refills itself in the background
 * before it runs dry.
 *
 * @param {string} storageKey - scopes the session, e.g.
 *   `jp-session:kana:hiragana_basic:qcm`. Changing it (switching
 *   deck/mode) starts a fresh session seeded from whatever was last
 *   cached under the new key, rather than continuing the old queue
 *   under a new name.
 * @param {(count: number, excludeIds: string[]) => Promise<object[]>} fetchBatch
 *   Must resolve to an array of card objects, each with a `card_id`.
 *   `excludeIds` are ids already sitting unreviewed in the queue, so
 *   the server doesn't hand back a card the user hasn't answered yet
 *   — this is what actually prevents the same-card-twice bug, not
 *   just the local queueing. Implementations should apply their own
 *   timeout (e.g. via AbortController) so a cold-starting backend
 *   doesn't hang a refill indefinitely — see usage note below.
 * @param {number} [batchSize=10]
 *
 * The localStorage mirror is what bridges a backend cold start: on
 * mount, the queue is seeded synchronously from the last cached
 * batch for this key, so a page load during the ~20s restart window
 * shows the last known cards immediately instead of a spinner, while
 * a background refill quietly retries the real backend underneath.
 * If that fetch fails or times out, the existing (possibly
 * cache-seeded) queue is left untouched and the next refill attempt
 * happens once the queue next drops to REFILL_AT — no error surfaces
 * to the screen unless the queue is *also* empty.
 *
 * Example fetchBatch, wired to a batch endpoint that takes
 * `count` + comma-separated `exclude`:
 *
 *   function makeFetchBatch(session, path) {
 *     return async (count, excludeIds) => {
 *       const controller = new AbortController()
 *       const timer = setTimeout(() => controller.abort(), 8000)
 *       try {
 *         const res = await apiFetch(
 *           `${path}&count=${count}&exclude=${excludeIds.join(',')}`,
 *           session,
 *           { signal: controller.signal },
 *         )
 *         const data = await res.json()
 *         return data.cards ?? []
 *       } finally {
 *         clearTimeout(timer)
 *       }
 *     }
 *   }
 */
export function useCardSession({ storageKey, fetchBatch, batchSize = 10 }) {
  const [queue, setQueue] = useState(() => loadCache(storageKey))
  const [done, setDone] = useState(false)
  const [fetching, setFetching] = useState(queue.length === 0)
  const refillingRef = useRef(false)
  const activeKeyRef = useRef(storageKey)

  // Deck/mode changed — start a fresh session for the new key instead
  // of refilling the old queue under a new name.
  useEffect(() => {
    if (activeKeyRef.current === storageKey) return
    activeKeyRef.current = storageKey
    const cached = loadCache(storageKey)
    setQueue(cached)
    setDone(false)
    setFetching(cached.length === 0)
  }, [storageKey])

  const refill = useCallback(async () => {
    if (refillingRef.current || done) return
    refillingRef.current = true
    if (queue.length === 0) setFetching(true)

    try {
      const excludeIds = queue.map((c) => c.card_id)
      const fresh = await fetchBatch(batchSize, excludeIds)

      // The deck/mode moved on while this was in flight — drop the
      // response rather than merging stale cards into the new session.
      if (activeKeyRef.current !== storageKey) return

      if (fresh.length === 0 && queue.length === 0) {
        setDone(true)
      } else if (fresh.length > 0) {
        setQueue((q) => {
          const merged = [...q, ...fresh]
          saveCache(storageKey, merged)
          return merged
        })
      }
    } catch {
      // Network hiccup or cold-start timeout — leave the existing
      // (possibly localStorage-seeded) queue exactly as it is; the
      // effect below will try again once the queue is next low.
    } finally {
      refillingRef.current = false
      setFetching(false)
    }
  }, [queue, done, fetchBatch, batchSize, storageKey])

  useEffect(() => {
    if (!done && queue.length <= REFILL_AT) refill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, storageKey, done])

  // Pop the front card off — call this once a review has been
  // recorded (fire-and-forget, same as today) and the next card
  // should show. No fetch happens here; the card is already in hand.
  const advance = useCallback(() => {
    setQueue((q) => {
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
    setQueue((q) => {
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
    advance,
    updateCurrent,
  }
}