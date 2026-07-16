/**
 * ModeSelector
 * A tile grid where each tile shows an icon badge, a label and a
 * description. Shares the same grid, radius, shadow and hover motion
 * as LevelSelector for visual consistency — but keeps the card itself
 * neutral and colours only the icon badge, since study modes are
 * parallel choices, not a ranked difficulty ladder like JLPT levels.
 *
 * Props:
 *   modes    — array of { key, label, desc?, icon?, color? }.
 *              `icon` can be any short string/emoji; if omitted, the
 *              tile falls back to the label's first letter so every
 *              tile always has a badge to scan.
 *   onSelect(key) — called when a tile is clicked
 *   columns  — target column count on wide screens (default 3). The
 *              grid still wraps responsively on narrower screens.
 *   eyebrow, title, subtitle — optional header copy, same shape as
 *     LevelSelector's. Leave all three unset to render just the grid
 *     (e.g. when wrapped in <SelectionScreen>, which can supply its
 *     own header instead).
 */
const PALETTE = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--success)', 'var(--warning)']

export default function ModeSelector({ modes, onSelect, columns = 3, eyebrow, title, subtitle }) {
  const gridMaxWidth = Math.min(1000, columns * 260)

  return (
    <div className="mode-selector">
      {(eyebrow || title || subtitle) && (
        <div className="selector-header">
          {eyebrow && <div className="selector-header__eyebrow">{eyebrow}</div>}
          {title && <div className="selector-header__title">{title}</div>}
          {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
        </div>
      )}
      <div className="select-tile-grid" style={{ maxWidth: gridMaxWidth, margin: '0 auto' }}>
        {modes.map((m, i) => {
          const modeColor = m.color ?? PALETTE[i % PALETTE.length]
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className="select-tile select-tile--mode"
              style={{ '--mode-color': modeColor }}
            >
              <div className="select-tile__icon">{m.icon ?? m.label.charAt(0)}</div>
              <div className="select-tile__label">{m.label}</div>
              {m.desc && <div className="select-tile__desc">{m.desc}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}