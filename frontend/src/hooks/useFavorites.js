import { useState, useEffect, useCallback } from 'react'
import { apiJson } from '../lib/api'
import { track } from '../lib/track'
import { favoriteRef, favoriteId } from '../domain/favorites'

// ── お気に入り — the shelf, held once per screen ─────────────
// Owns "is this entry kept" for every plate the dictionary opens, the
// way useMining owns "which deck does this go in": one instance for
// the screen, read by the ★ on whichever entry is open — in the dock,
// in a lookup sheet stacked over it — and by the mark on every tile.
//
// The shelf's REFERENCES are fetched once on arrival
// (/api/dictionary/favorites/keys: a kind and a key each, nothing
// resolved), so lighting a star costs no request however many entries
// the learner opens. Toggling writes through PUT and is optimistic —
// the star turns at once, and turns back if the write fails, which is
// the one moment the plate has anything to say about it (plan 093).
//
// `undefined` is a valid value for a caller to pass on: a plate opened
// somewhere without a shelf (a quiz's lookup sheet) simply prints no
// star, the way it prints no ＋ without `mining`.
export function useFavorites(session) {
  const [ids, setIds] = useState(() => new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiJson('/api/dictionary/favorites/keys', session)
      .then(data => {
        if (cancelled) return
        setIds(new Set((data.favorites ?? []).map(favoriteId)))
      })
      .catch(() => { /* an empty shelf until the next visit */ })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [session])

  const has = useCallback(entry => {
    const ref = favoriteRef(entry)
    return !!ref && ids.has(favoriteId(ref))
  }, [ids])

  // Flips the entry's state and resolves to the new one (true = kept).
  // Rejects with the ApiError when the write fails, after undoing the
  // optimistic turn; null for an entry that cannot be kept at all.
  const toggle = useCallback(async entry => {
    const ref = favoriteRef(entry)
    if (!ref) return null
    const id = favoriteId(ref)
    const on = !ids.has(id)
    const flip = to => prev => {
      const next = new Set(prev)
      if (to) next.add(id)
      else next.delete(id)
      return next
    }
    setIds(flip(on))
    try {
      await apiJson('/api/dictionary/favorites', session, {
        method: 'PUT',
        body: JSON.stringify({ kind: ref.kind, key: ref.key, favorite: on }),
      })
    } catch (err) {
      setIds(flip(!on))
      throw err
    }
    // The kind and the direction, never the key: a key is a word the
    // learner looked up, which is theirs.
    track('favorite_toggle', { kind: ref.kind, on })
    return on
  }, [ids, session])

  return { loaded, count: ids.size, has, toggle }
}
