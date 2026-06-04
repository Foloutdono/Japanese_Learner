/**
 * ModeSelector
 * A card-grid where each card shows a mode label + description.
 * Used on Grammar (flashcard/mcq/fill), StudyScreen config, etc.
 *
 * Props:
 *   modes    — array of { key, label, desc }
 *   onSelect(key) — called when a card is clicked
 *   columns  — grid column count (default 3)
 */
export default function ModeSelector({ modes, onSelect, columns = 3 }) {
  const gridClass = `grid-${columns}`

  return (
    <div className={gridClass}>
      {modes.map(m => (
        <button
          key={m.key}
          onClick={() => onSelect(m.key)}
          style={{
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            padding: '28px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {m.icon && (
            <div style={{ fontSize: 28 }}>{m.icon}</div>
          )}
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{m.label}</div>
          {m.desc && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {m.desc}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
