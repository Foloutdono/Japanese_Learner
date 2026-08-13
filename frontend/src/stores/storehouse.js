import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { applyLoadout } from './cosmetics'
import { refreshSummary } from './profileSummary'

// ── The storehouse, shared ─────────────────────────────────
// Same shape as profileSummary.js: one module-level cache, a set of
// mounted listeners, and a TTL — because the quick-change drawer can
// be opened from any screen in the app and reopened a dozen times in a
// session, and none of those should be a fetch.
//
// Every write path funnels through here too, so there is exactly one
// place that knows how to equip something: the drawer, the storehouse
// screen and anything added later all get the same optimistic paint,
// the same rollback on failure, and the same profile refresh
// afterwards.

const TZ = -new Date().getTimezoneOffset()
const TTL_MS = 60_000

let cache = null
let cacheAt = 0
let inflight = null
const listeners = new Set()

function emit() {
  listeners.forEach(fn => fn(cache))
}

function receive(data) {
  cache = data
  cacheAt = Date.now()
  // Paint the loadout onto <html> straight away — the whole app reads
  // its cosmetics off those attributes (see stores/cosmetics.js), so
  // this is what makes an equip visible on the card behind the drawer.
  applyLoadout(data.loadout)
  emit()
  return data
}

function withSession(fn) {
  return supabase.auth.getSession().then(({ data }) => {
    const session = data?.session
    if (!session) return Promise.reject(new Error('no session'))
    return fn(session)
  })
}

export function loadStorehouse({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return Promise.resolve(cache)
  // Two components opening at once must not become two requests.
  if (inflight) return inflight

  inflight = withSession(s => apiFetch(`/api/cosmetics?tz_offset=${TZ}`, s))
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('storehouse unavailable'))))
    .then(receive)
    .finally(() => { inflight = null })

  return inflight
}

/**
 * Equip, optimistically. The point of the drawer is that you can try a
 * paper mid-review and see it on the card underneath — waiting for a
 * round trip to find out what it looks like defeats the exercise. So
 * the loadout is repainted immediately and rolled back if the server
 * disagrees (it can: an item you don't own is a 403).
 */
export function equipCosmetic(slot, cosmeticId) {
  const previous = cache

  if (cache) {
    const loadout = { ...cache.loadout, [slot]: cosmeticId }
    cache = {
      ...cache,
      loadout,
      slots: {
        ...cache.slots,
        [slot]: cache.slots[slot].map(item => ({ ...item, equipped: item.id === cosmeticId })),
      },
    }
    cacheAt = Date.now()
    applyLoadout(loadout)
    emit()
  }

  return withSession(s => apiFetch(`/api/cosmetics/equip?tz_offset=${TZ}`, s, {
    method: 'POST',
    body: JSON.stringify({ slot, cosmetic_id: cosmeticId }),
  }))
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('equip rejected'))))
    .then(data => {
      receive(data)
      // The profile summary carries the loadout too (it's what dresses
      // the app on a cold load), so it has to be told rather than left
      // to expire and quietly undo this.
      refreshSummary()
      return data
    })
    .catch(err => {
      if (previous) {
        cache = previous
        applyLoadout(previous.loadout)
        emit()
      }
      throw err
    })
}

export function useStorehouse() {
  const [store, setStore] = useState(cache)

  useEffect(() => {
    listeners.add(setStore)
    return () => { listeners.delete(setStore) }
  }, [])

  return store
}
