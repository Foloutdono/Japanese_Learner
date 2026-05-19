import { useEffect } from 'react'

const QUALITY_BTNS = [
  { q: 5, label: 'Parfait',   color: '#00b894' },
  { q: 4, label: 'Correct',   color: '#00cec9' },
  { q: 3, label: 'Difficile', color: '#fdcb6e' },
  { q: 2, label: 'Raté (vu)', color: '#e17055' },
  { q: 1, label: 'Raté',      color: '#d63031' },
  { q: 0, label: 'Blackout',  color: '#6c5ce7' },
]

export default function RatingBar({ onRate, active }) {
  useEffect(() => {
    if (!active) return
    const handler = (e) => {
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx <= 5) onRate(QUALITY_BTNS[idx].q)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onRate])

  if (!active) return null

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Évaluez votre réponse — touches <kbd style={{
          background: 'var(--bg-panel)', padding: '2px 6px',
          borderRadius: 4, fontSize: 12,
        }}>1</kbd> à <kbd style={{
          background: 'var(--bg-panel)', padding: '2px 6px',
          borderRadius: 4, fontSize: 12,
        }}>6</kbd> :
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {QUALITY_BTNS.map(({ q, label, color }, i) => (
          <button key={q} onClick={() => onRate(q)}
            style={{ background: color, color: q >= 3 ? '#111' : '#fff', fontSize: 13 }}>
            <span style={{ opacity: 0.7, marginRight: 6, fontSize: 11 }}>[{i + 1}]</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}