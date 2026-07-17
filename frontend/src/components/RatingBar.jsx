import { useEffect } from 'react'
import { useLang } from '../LangContext'

export default function RatingBar({ onRate, active }) {
  const { t } = useLang()

  // Keys 1-6 map to the 6 quality buttons
  const QUALITY_BTNS = [
    { q: 5, label: t.perfect      },
    { q: 4, label: t.correctHesit },
    { q: 3, label: t.difficult    },
    { q: 2, label: t.wrongSeen    },
    { q: 1, label: t.wrongRated   },
    { q: 0, label: t.blackout     },
  ]

  useEffect(() => {
    if (!active) return
    const handler = e => {
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx <= 5) onRate(QUALITY_BTNS[idx].q)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onRate])

  if (!active) return null

  return (
    <div className="rating-bar">
      <div className="rating-bar__hint">
        {t.rateAnswer}{' '}
        <kbd className="rating-bar__key">1</kbd>
        {' '}{t.to}{' '}
        <kbd className="rating-bar__key">6</kbd>
        {' :'}
      </div>
      <div className="rating-bar__buttons">
        {QUALITY_BTNS.map(({ q, label }, i) => (
          <button
            key={q}
            onClick={() => onRate(q)}
            className={`rating-bar__btn rating-bar__btn--q${q}`}
          >
            <span className="rating-bar__btn-index">[{i + 1}]</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}