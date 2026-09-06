import { SearchIcon, CrossIcon } from '../ui/Icons'

// ── The console (plan 068) ────────────────────────────────────
// The one index every catalogue screen has: a row of chips (and at
// most one action) over a field with a clear button and a count. The
// dictionary's own console (.dict-console) was the model; the canvas
// draws the same object on Decks, the dictionary and the Today
// picker, so it is one component now, in pieces a screen composes:
//
//   <Console>
//     <ConsoleTop>
//       <Chips>…<Chip on>…</Chips>
//       <ConsoleAction>Create deck</ConsoleAction>
//     </ConsoleTop>
//     <ConsoleIndex value onChange onClear count="128 results" />
//   </Console>
export function Console({ children, className = '' }) {
  return <div className={`console ${className}`.trim()}>{children}</div>
}

export function ConsoleTop({ children }) {
  return <div className="console__top">{children}</div>
}

export function Chips({ children, label }) {
  return <div className="console__chips" role={label ? 'group' : undefined} aria-label={label}>{children}</div>
}

// A chip is a choice, so it says whether it is chosen (aria-pressed).
// `glyph` is the roundel a section chip carries (単 / 漢 / 文); `color`
// is that section's pigment, read by the on state.
export function Chip({ on = false, glyph, color, onClick, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`chip${on ? ' chip--on' : ''} ${className}`.trim()}
      style={color ? { '--tab-color': color } : undefined}
      aria-pressed={on}
      onClick={onClick}
      {...rest}
    >
      {glyph && <span className="chip__glyph" lang="ja" aria-hidden="true">{glyph}</span>}
      {children}
    </button>
  )
}

export function ConsoleAction({ gold = false, onClick, children, ...rest }) {
  return (
    <button type="button" className={`console__action${gold ? ' console__action--gold' : ''}`} onClick={onClick} {...rest}>
      {children}
    </button>
  )
}

export function ConsoleIndex({ value, onChange, onClear, placeholder, count, inputRef, clearLabel, ...rest }) {
  return (
    <div className="console__index">
      <SearchIcon className="svg" />
      <input
        ref={inputRef}
        className={`console__field${value ? ' console__field--filled' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
      {value && onClear && (
        <button type="button" className="console__clear" onClick={onClear} aria-label={clearLabel}>
          <CrossIcon size={14} />
        </button>
      )}
      {count != null && <span className="console__count">{count}</span>}
    </div>
  )
}

// ── The segmented control ──
// Two to four options in a pill, one of them on. `full` stretches it
// across the row (the analyzer's Text / Photo / Video). Options carry
// `jp` for a Japanese word and `label` for the plain one; either or
// both.
export function Seg({ options, value, onChange, full = false, className = '', label }) {
  return (
    <div className={`seg${full ? ' seg--full' : ''} ${className}`.trim()} role="radiogroup" aria-label={label}>
      {options.map(opt => {
        const on = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`seg__opt${on ? ' seg__opt--on' : ''}`}
            onClick={() => { if (!on) onChange(opt.key) }}
          >
            {opt.jp && <span className="seg__opt-jp" lang="ja">{opt.jp}</span>}
            {opt.label && <span className="seg__opt-latin">{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
