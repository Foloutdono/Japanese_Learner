import { useEffect, useState } from 'react'

// ── 縁 — the referral, as the screens read it (plan 332) ──────────
// Seed-only until the backend answers (/dev/referral plants it): nothing in
// a production build does, so every slot that reads it draws nothing.
let cache = null
const listeners = new Set()

export function seedReferral(data) {
  cache = data
  listeners.forEach(fn => fn())
}

export function useReferral() {
  const [data, setData] = useState(cache)
  useEffect(() => {
    const sync = () => setData(cache)
    listeners.add(sync)
    sync()
    return () => { listeners.delete(sync) }
  }, [])
  return data
}
