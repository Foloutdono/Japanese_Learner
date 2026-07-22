import { useState } from 'react'
import { XpToast } from '../XpToast'
import RatingBar from '../RatingBar'

// Reproduces the guard in every screen's postReview: while a level-up
// xpToast is up and unclaimed (xpToast?.leveledUp), RatingBar is
// hidden and further reviews are refused. Rate "01 — Parfait" to
// trigger a level-up here; the lock should only release once
// XpToast's onDone fires (curtain fully closed), not on the claim click.
function LockDemo() {
  const [xpToast, setXpToast] = useState(null)
  const [log, setLog] = useState([])

  const pushLog = line =>
    setLog(prev => [`${new Date().toLocaleTimeString()} — ${line}`, ...prev].slice(0, 8))

  function postReview(quality) {
    if (xpToast?.leveledUp) {
      pushLog(`blocked: rated q${quality} while a level-up is still unclaimed`)
      return
    }
    const leveledUp = quality === 5
    setXpToast({
      amount: leveledUp ? 50 : quality * 4 + 2,
      id: Date.now(),
      leveledUp,
      newLevel: 7,
      quality,
    })
    pushLog(`recorded: q${quality}${leveledUp ? ' → level up!' : ''}`)
  }

  return (
    <div style={{ paddingTop: 40 }}>
      <XpToast
        toast={xpToast}
        onDone={() => {
          setXpToast(null)
          pushLog('xpToast cleared (onDone) — lock released')
        }}
      />

      <RatingBar active={!xpToast?.leveledUp} onRate={postReview} />

      <div style={{ marginTop: 24, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  )
}

export default {
  title: 'Feedback/XpToast/Reward lock (combined)',
}

export const Lock = { render: () => <LockDemo /> }