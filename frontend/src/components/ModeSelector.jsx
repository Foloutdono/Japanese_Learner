/**
 * ModeSelector
 * Renders study modes as a single-column, hairline-divided list —
 * matching LevelSelector's row treatment rather than a grid of
 * icon-badged cards. Modes are parallel choices, so by default every
 * row shares one accent colour; pass m.color on individual modes only
 * when a genuine semantic distinction is needed (e.g. right/wrong).
 *
 * Props:
 *   modes    — array of { key, label, desc?, color? }
 *   onSelect(key) — called when a row is clicked
 *   eyebrow, title, subtitle — optional header copy, same shape as
 *     LevelSelector's. Leave all three unset to render just the list
 *     (e.g. when wrapped in <SelectionScreen>, which can supply its
 *     own header instead).
 *   columns  — accepted for backward compatibility, no longer affects
 *     layout now that modes render as a list rather than a grid.
 */
export default function ModeSelector({ modes, onSelect, title }) {
  return (
    <div className="mode-selector">
      {(title) && (
        <div className="selector-header">
          {title && <div className="selector-header__title">{title}</div>}
        </div>
      )}
      <div className="choice-list">
        {modes.map((m, i) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onSelect(m.key)}
            className="choice-row"
            style={{ '--row-color': m.color ?? 'var(--accent)' }}
          >
            <span className="choice-row__accent" aria-hidden="true" />
            <span className="choice-row__index">{String(i + 1).padStart(2, '0')}</span>
            <span className="choice-row__main">
              <span className="choice-row__title">{m.label}</span>
              {m.desc && <span className="choice-row__desc">{m.desc}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}