import { useState } from 'react'
import { XpToast } from '../XpToast'
import RatingBar from '../RatingBar'

// ── XpToast × RatingBar — the reward lock ──────────────────
// Reproduces the guard added to KanaScreen / KanjiScreen / VocabScreen's
// postReview: while a level-up's xpToast is up and unclaimed
// (xpToast?.leveledUp), RatingBar is hidden and further reviews are
// refused, mirroring postReview's own early `return`. Use this to
// check the lock actually releases when XpToast's onDone fires — i.e.
// only once the curtain has genuinely finished closing, not the
// instant the claim button is clicked.
//
// Rate "01 — Parfait" to trigger a level-up in this demo (an easy,
// deliberate trigger, not the real level threshold). RatingBar should
// vanish until "Réclamer" is clicked, and clicking a quality button
// while it's gone should only add a "blocked" line to the log below,
// never a second toast stacked on the first.
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

      <p style={{ fontFamily: 'monospace', fontSize: 13, opacity: 0.7, maxWidth: 420 }}>
        Rate "01 — Parfait" to trigger a level-up. RatingBar should
        disappear until you click "Réclamer" in the curtain overlay.
      </p>

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