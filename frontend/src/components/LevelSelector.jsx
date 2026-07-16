/**
 * LevelSelector
 * Renders a row of JLPT level buttons (N5 → N1).
 *
 * Props:
 *   onSelect(level: string) — called when a level is clicked
 *   color  — button background color (default: var(--accent))
 *   levels — array of level strings (default: N5…N1)
 */

const DEFAULT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function LevelSelector({
  onSelect,
  color = 'var(--accent)',
  levels = DEFAULT_LEVELS,
}) {
  return (
    <div className="grid-5" style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 12, gridTemplateColumns: `repeat(${levels.length}, 1fr)` }}>
      {levels.map(l => (
        <button
          key={l}
          onClick={() => onSelect(l)}
          style={{
            background: color,
            color: '#fff',
            fontSize: 25,
            fontWeight: 'bold',
            padding: '24px 0',
            width: '100%',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
