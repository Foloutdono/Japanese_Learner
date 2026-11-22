import { useEffect, useState } from 'react'

// ── 任務 — the missions, as the screens read them (plan 328) ──────
// Until the backend answers (GET /api/missions), the only way in is a
// seed, from /dev/missions: nothing in a production build plants one, so
// every slot that reads this store draws nothing. The real fetch joins the
// store with the routes, on the createRemoteStore shape the other
// stores share.
let cache = null
const listeners = new Set()

export function seedMissions(data) {
  cache = data
  listeners.forEach(fn => fn())
}

export function useMissions() {
  const [data, setData] = useState(cache)
  useEffect(() => {
    const sync = () => setData(cache)
    listeners.add(sync)
    sync()
    return () => { listeners.delete(sync) }
  }, [])
  return data
}
