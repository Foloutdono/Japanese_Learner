import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { CosmeticSwatch } from './CosmeticSwatch'
import { playSfx } from '../../lib/audio'

// ── 開封 — opening the storehouse ──────────────────────────
// The third and lightest of the app's three celebrations, and
// deliberately the quietest:
//
//   XpToast level-up  — a kabuki curtain call. The whole stage.
//   DarumaRitual 満願  — a calligrapher's gesture. One brush, one eye.
//   this              — a storehouse door sliding open. One object.
//
// It has to be the quietest because it's the only one that can fire in
// a batch: cross a threshold that unlocks three items at once and you
// get three in a row, so anything on the scale of the other two would
// be exhausting rather than rewarding. So: the kura's double doors
// part, the object is lifted out on a plinth of light, its name is
// read, and the doors shut. Click to advance early.
//
// `items` is the backend's `unseen` list (see routes/cosmetics.py) —
// whole catalogue entries, earned and not yet celebrated. `onDone`
// fires once the last has been shown, and the screen POSTs /seen.
const HOLD_MS = 2600

export function CosmeticUnlock({ items, onDone }) {
  const [i, setI] = useState(0)
  const total = items?.length ?? 0
  const item = items?.[i]

  if (!item) return null

  // Keyed per item so each one is a fresh mount: the door animations
  // only ever play on mount, and `closing` has to start false again
  // for every object in the queue.
  return (
    <UnlockDoor
      key={item.id}
      item={item}
      index={i}
      total={total}
      onAdvance={() => (i + 1 < total ? setI(i + 1) : onDone?.())}
    />
  )
}

function UnlockDoor({ item, index, total, onAdvance }) {
  const { t } = useLang()
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    playSfx('level-up')
    const timer = setTimeout(() => setClosing(true), HOLD_MS)
    return () => clearTimeout(timer)
  }, [])

  // The doors shutting is what ends each item, so the handoff hangs
  // off that animation genuinely finishing rather than a second timer
  // racing the first. Only the left door is listened for — they're
  // symmetric, and two would advance twice.
  const handleAnimationEnd = (e) => {
    if (e.animationName === 'kura-doors-close') onAdvance()
  }

  return (
    <div
      className={`kura-unlock${closing ? ' kura-unlock--closing' : ''}`}
      aria-live="polite"
      onAnimationEnd={handleAnimationEnd}
      onClick={() => setClosing(true)}
    >
      <div className="kura-unlock__door kura-unlock__door--left" aria-hidden="true" />
      <div className="kura-unlock__door kura-unlock__door--right" aria-hidden="true" />

      <div className="kura-unlock__stage">
        <div className="kura-unlock__eyebrow">{t.cosmeticUnlocked}</div>

        <div className="kura-unlock__object">
          <CosmeticSwatch item={item} size={92} />
        </div>

        <div className="kura-unlock__jp" lang="ja">{item.jp}</div>
        <div className="kura-unlock__name">{t.cosmeticName?.[item.id] ?? item.id}</div>
        <div className="kura-unlock__slot">{t.cosmeticSlot?.[item.slot]}</div>

        {total > 1 && <div className="kura-unlock__count">{index + 1} / {total}</div>}
      </div>
    </div>
  )
}
