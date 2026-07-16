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
const LEVEL_HINTS = {
  N5: 'Beginner-friendly vocabulary',
  N4: 'Solidify core grammar',
  N3: 'Boost reading fluency',
  N2: 'Master intermediate kanji',
  N1: 'Challenge your best Japanese',
}

export default function LevelSelector({
  onSelect,
  color = 'var(--accent)',
  levels = DEFAULT_LEVELS,
}) {
  return (
    <div className="level-selector">
      <div className="level-selector__header">
        <div className="level-selector__eyebrow">Vocabulary JLPT</div>
        <div className="level-selector__title">Choose your JLPT level</div>
        <div className="level-selector__subtitle">Tap a tile to begin the next challenge.</div>
      </div>
      <div className="level-selector__grid">
        {levels.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            className="level-selector__tile"
            style={{ background: color }}
          >
            <div className="level-selector__tile-badge">{l}</div>
            <div className="level-selector__tile-copy">{LEVEL_HINTS[l]}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
