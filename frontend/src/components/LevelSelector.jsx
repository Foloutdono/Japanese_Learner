/**
 * LevelSelector
 * Renders a responsive JLPT level button grid.
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
    <div className="level-selector">
      <div className="level-selector__header">
        <div className="level-selector__title">Choose your JLPT level</div>
        <div className="level-selector__subtitle">Tap a tile to begin the next challenge.</div>
      </div>
      <div className="level-selector__grid">
        {levels.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            style={{
              background: color,
              backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 60%)',
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
