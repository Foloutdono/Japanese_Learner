import { useEffect } from 'react'
import { useLang } from '../../LangContext'
import { playCorrect, playWrong } from '../../lib/audio'

export default function RatingBar({ onRate, active }) {
  const { t } = useLang()

  // Best-first, and it must STAY that way -- the keyboard handler below
  // indexes this array positionally (QUALITY_BTNS[idx].q), so "1" means
  // Perfect only as long as index 0 IS Perfect. The bar now renders
  // worst-first (see the JSX below), but that's a display-only reversal;
  // reversing this array instead would silently flip every digit
  // shortcut. See RatingBar.browser.test.jsx, which pins this contract.
  const QUALITY_BTNS = [
    { q: 5, key: 'perfect',      label: t.perfect      },
    { q: 4, key: 'correctHesit', label: t.correctHesit },
    { q: 3, key: 'difficult',    label: t.difficult    },
    { q: 2, key: 'wrongSeen',    label: t.wrongSeen    },
    { q: 1, key: 'wrongRated',   label: t.wrongRated   },
    { q: 0, key: 'blackout',     label: t.blackout     },
  ]

  // Keys 1-6 map to the 6 quality buttons. On an AZERTY keyboard the
  // unshifted number row types &é"' rather than 1234, so those are
  // accepted too — same physical top-row keys, either layout.
  const AZERTY_INDEX = { '&': 0, 'é': 1, '"': 2, "'": 3, '(': 4, '§': 5 }

  // Shared by the on-screen buttons and the keyboard shortcuts below,
  // so a rating fired either way gets the same tap feedback.
  function handleRate(q) {
    if (q > 2)
      playCorrect()
    else
      playWrong()
    onRate(q)
  }

  useEffect(() => {
    if (!active) return
    const handler = e => {
      const idx = e.key in AZERTY_INDEX ? AZERTY_INDEX[e.key] : parseInt(e.key) - 1
      if (idx >= 0 && idx <= 5) handleRate(QUALITY_BTNS[idx].q)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onRate])

  if (!active) return null

  return (
    <div className="rating-bar">
      {/* One continuous instrument, worst to best -- see index.css for
          why. `.map()` already returns a new array, so the `.reverse()`
          below sorts that copy and never QUALITY_BTNS itself; DOM order
          (and therefore tab and screen-reader order) matches what is on
          screen while the keyboard handler above keeps indexing the
          untouched original. The digit is captured BEFORE the reverse,
          which is the only place it can be read correctly. */}
      <div className="rating-bar__buttons">
        {QUALITY_BTNS.map((b, i) => ({ ...b, digit: i + 1 })).reverse().map(({ q, label, digit }) => (
          <button
            key={q}
            type="button"
            onClick={() => handleRate(q)}
            className={`rating-bar__btn rating-bar__btn--q${q}`}
            /* The digits are deliberately NOT drawn (numeric indices are
               noise on a control this size) and are deliberately NOT in
               display order: QUALITY_BTNS is best-first, so "1" is Parfait at
               the RIGHT end and "6" is Blackout at the left. Undiscoverable
               and reversed is a bad pair, so the shortcut is at least
               announced to assistive tech and shown on hover. */
            aria-keyshortcuts={String(digit)}
            title={`${label} (${digit})`}
          >
            {/* The ring is the whole colour story now: unfilled at rest,
                filled when this rating is the one chosen. Marked hidden
                because it says nothing the label does not -- it is the
                seal, and the word beside it is the name. */}
            <span className="rating-bar__btn-ring" aria-hidden="true" />
            <span className="rating-bar__btn-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}