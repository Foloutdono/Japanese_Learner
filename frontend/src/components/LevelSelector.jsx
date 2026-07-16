/**
 * LevelSelector
 * Renders a responsive JLPT level tile grid, colour-branded to match
 * whatever section it lives in (Vocabulary, Kanji, Grammar...).
 *
 * Props:
 *   onSelect(level)  — called when a level is clicked
 *   color            — brand colour for this section, as a hex string
 *                       (default: '#e94560', i.e. var(--accent))
 *   levels           — array of level strings (default: N5…N1)
 *   eyebrow, title, subtitle — header copy. eyebrow/title default to the
 *     original copy so existing screens render unchanged, but every
 *     section should now pass its own eyebrow (e.g. "Kanji JLPT" for
 *     /kanji) — previously this header always said "Vocabulary JLPT" no
 *     matter which section rendered it. subtitle has no default: tapping
 *     a tile is self-explanatory, so the grid stays caption-free unless
 *     a screen has something genuinely new to say. Pass eyebrow="" / etc.
 *     to hide a line, or wrap in <SelectionScreen> and omit all three to
 *     use its header.
 */

const DEFAULT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const LEVEL_HINTS = {
  N5: 'Beginner-friendly vocabulary',
  N4: 'Solidify core grammar',
  N3: 'Boost reading fluency',
  N2: 'Master intermediate kanji',
  N1: 'Challenge your best Japanese',
}

// Darkens a #rrggbb colour towards black so each tile can use a subtle
// diagonal gradient instead of a flat fill. Falls back to the plain
// colour for anything that isn't a hex string (e.g. a CSS var()).
function shade(hex, percent) {
  if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) return hex
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - percent))
  const g = Math.round(((n >> 8) & 255) * (1 - percent))
  const b = Math.round((n & 255) * (1 - percent))
  return `rgb(${r}, ${g}, ${b})`
}

export default function LevelSelector({
  onSelect,
  color = '#e94560',
  levels = DEFAULT_LEVELS,
  eyebrow = 'Vocabulary JLPT',
  title = 'Choose your JLPT level',
  subtitle,
}) {
  return (
    <div className="level-selector">
      {(eyebrow || title || subtitle) && (
        <div className="selector-header">
          {eyebrow && <div className="selector-header__eyebrow" style={{ color }}>{eyebrow}</div>}
          {title && <div className="selector-header__title">{title}</div>}
          {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
        </div>
      )}
      <div className="select-tile-grid" style={{ maxWidth: 780, margin: '0 auto' }}>
        {levels.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            className="select-tile"
            style={{ background: `linear-gradient(135deg, ${color}, ${shade(color, 0.35)})` }}
          >
            <div className="select-tile__badge">{l}</div>
            <div className="select-tile__copy">{LEVEL_HINTS[l]}</div>
            <span className="select-tile__cue" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}