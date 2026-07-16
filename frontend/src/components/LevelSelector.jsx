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
      {levels.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => onSelect(l)}
          style={{ background: color }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
