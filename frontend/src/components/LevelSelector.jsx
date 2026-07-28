import { useLang } from '../LangContext'
import { playUi } from './sound'

/**
 * LevelSelector
 * Renders JLPT levels as a single-column, hairline-divided list —
 * not a grid of coloured tiles. Each row pairs a small sequence
 * index with a large serif level mark and a hint, right-aligned
 * for asymmetry. One accent colour, used only on hover/focus.
 *
 * Props:
 *   onSelect(level)  — called when a level is clicked
 *   color            — optional accent colour override for this section, as
 *                       a hex string or CSS var(). Falls back to shu-iro
 *                       (var(--accent)) via CSS when omitted.
 *   levels           — array of level strings (default: N5…N1)
 *   title            — header copy. Defaults to t.selectLevel rather
 *                       than a hardcoded string, so a caller that
 *                       forgets to pass one still gets a translated
 *                       default instead of permanently-English text.
 *                       Pass title="" to hide the header line, or wrap
 *                       in <SelectionScreen> and omit it to use that
 *                       component's own header instead.
 */

const DEFAULT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function LevelSelector({
  onSelect,
  color,
  levels = DEFAULT_LEVELS,
  title,
}) {
  const { t } = useLang()
  // Previously a hardcoded English-only dict — now sourced from the
  // translation file so it actually changes with the app's language.
  const LEVEL_HINTS = {
    N5: t.levelHintN5,
    N4: t.levelHintN4,
    N3: t.levelHintN3,
    N2: t.levelHintN2,
    N1: t.levelHintN1,
  }
  const resolvedTitle = title === '' ? '' : (title ?? t.selectLevel)
  const rowStyle = color ? { '--row-color': color } : undefined

  return (
    <div className="level-selector">
      {(resolvedTitle) && (
        <div className="selector-header">
          {resolvedTitle && <div className="selector-header__title">{resolvedTitle}</div>}
        </div>
      )}
      <div className="choice-list">
        {levels.map((l, i) => (
          <button
            key={l}
            type="button"
            onClick={() => { playUi('click-selection'); onSelect(l) }}
            className="choice-row"
            style={rowStyle}
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