import { useEffect, useState } from 'react'

// A station clock, told the truth. Updated on the turn of each minute
// rather than by a one-second interval — anything reading it either
// wants the digits (the departure board) or the date (the concourse),
// and both only actually change once a minute at the very fastest, so
// re-rendering React sixty times to move a number that changes once
// is not a trade worth making. Shared rather than duplicated so the
// board and the concourse tick from the same clock instead of two
// independently-drifting setTimeouts.
export function useStationClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer
    const schedule = () => {
      const ms = 60_000 - (Date.now() % 60_000)
      timer = setTimeout(() => { setNow(new Date()); schedule() }, ms + 20)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])

  return now
}
