import { useEffect, useState } from 'react'

// ── The clock, read once a minute ─────────────────────────────
// A screen that says what is under way (the agenda's next block, plan
// 181) must notice a block starting while it is open, without reading
// the clock in render. The state turns over on each minute's mark, so
// "9:00" arrives at nine and not up to a minute late.
export function useMinute() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer
    const wait = () => 60_000 - (Date.now() % 60_000) + 50
    const tick = () => { setNow(new Date()); timer = setTimeout(tick, wait()) }
    timer = setTimeout(tick, wait())
    return () => clearTimeout(timer)
  }, [])
  return now
}
