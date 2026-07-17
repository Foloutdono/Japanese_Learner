/**
 * LevelSelector
 * Renders JLPT levels as a single-column, hairline-divided list —
 * not a grid of coloured tiles. Each row pairs a small sequence
 * index with a large serif level mark and a hint, right-aligned
 * for asymmetry. One accent colour, used only on hover/focus.
 *
 * Props:
 *   onSelect(level)  — called when a level is clicked
 *   color            — accent colour for this section, as a hex string
 *                       or CSS var() (default: var(--accent), shu-iro)
 *   levels           — array of level strings (default: N5…N1)
 *   eyebrow, title, subtitle — header copy. subtitle has no default:
 *     the list is self-explanatory. Pass eyebrow="" / etc. to hide a
 *     line, or wrap in <SelectionScreen> and omit all three to use
 *     its header instead.
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
  title = 'Choose your JLPT level'
}) {
  return (
    <div className="level-selector">
      {(title) && (
        <div className="selector-header">
          {title && <div className="selector-header__title">{title}</div>}
        </div>
      )}
      <div className="choice-list">
        {levels.map((l, i) => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            className="choice-row"
            style={{ '--row-color': color }}
          >
            <span className="choice-row__accent" aria-hidden="true" />
            <span className="choice-row__index">{String(i + 1).padStart(2, '0')}</span>
            <span className="choice-row__main">
              <span className="choice-row__title">{l}</span>
              <span className="choice-row__desc">{LEVEL_HINTS[l]}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}