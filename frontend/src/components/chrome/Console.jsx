import { Link } from 'react-router-dom'
import { SearchIcon, CrossIcon } from '../ui/Icons'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

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
//     <ConsoleIndex value onChange onClear count="128 results" toggle={…} />
//   </Console>
export function Console({ children, className = '', guide }) {
  return <div className={`console ${className}`.trim()} data-guide={guide}>{children}</div>
}

// ── The console's band ──
// ONE control, edge to edge across the console, its options divided by
// the console's own hairline rather than set in a pill of their own —
// the rating bar's construction at console width (DESIGN.md,
// Controls): segments split by rules, the chosen one WASHED at 14%
// rather than filled.
//
// It is for a control that applies to the WHOLE of what the console
// answers with rather than narrowing it: the library's ordering is the
// first, at the head, over the chips that narrow and the field that
// searches. As a pill in row 1 it left most of the row empty and read
// as a third filter; a band fills the width because it is about the
// full width of what is below it.
//
// On the desk (plan 123) it is one tab stop and its arrows move and
// check, as a radio group's do (hooks/useRadioWalk).
export function ConsoleBand({ options, value, onChange, label }) {
  const desk = useDesk()
  const onWalk = useRadioWalk(desk)
  const checked = options.findIndex(opt => opt.key === value)
  return (
    <div className="console__band" role="radiogroup" aria-label={label} onKeyDown={onWalk}>
      {options.map((opt, i) => {
        const on = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={radioTab(desk, i, checked)}
            className={`console__band-opt${on ? ' console__band-opt--on' : ''}`}
            onClick={() => { if (!on) onChange(opt.key) }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function ConsoleTop({ children }) {
  return <div className="console__top">{children}</div>
}

// `className` is for a second row of chips under the first (the
// dictionary's JLPT levels under its collections): ConsoleTop wraps and
// every Chips takes the full row, so two of them already stack — the
// class only draws the hairline between them.
export function Chips({ children, label, className = '', guide }) {
  return <div className={`console__chips ${className}`.trim()} role={label ? 'group' : undefined} aria-label={label} data-guide={guide}>{children}</div>
}

// A chip is a choice, so it says whether it is chosen (aria-pressed).
// `glyph` is the roundel a section chip carries (単 / 漢 / 文); `color`
// is that section's pigment, read by the on state.
//
// `to` (plan 123): a chip that is a door to a place rather than a
// choice -- the library from the shelf -- is a link on the desk, and
// says nothing about being pressed.
export function Chip({ on = false, glyph, color, onClick, children, className = '', to, ...rest }) {
  if (to != null) {
    return (
      <Link
        to={to}
        className={`chip ${className}`.trim()}
        style={color ? { '--tab-color': color } : undefined}
        onClick={onClick}
        {...rest}
      >
        {glyph && <span className="chip__glyph" lang="ja" aria-hidden="true">{glyph}</span>}
        {children}
      </Link>
    )
  }
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

// `toggle` is a control that belongs to the field rather than to the
// set above it: the dictionary's 部 index, which is not a sixth
// collection to browse but a second way of reading the one already
// chosen. It rides the row's trailing edge, past the count, the way a
// lone action rides row 1's (.console__top > .console__action).
//
// `field={false}` is that same row with nothing to type into — the
// dictionary browsing its radical index, where the toggle is the only
// way back out. The row stays, holding the toggle alone, rather than
// the whole thing going and taking the way out with it.
export function ConsoleIndex({ value, onChange, onClear, placeholder, count, inputRef, clearLabel, toggle, field = true, ...rest }) {
  // The clear is an icon; on the desk it says what it does under a
  // pointer too (plan 123).
  const desk = useDesk()
  if (!field) {
    return toggle ? <div className="console__index console__index--bare">{toggle}</div> : null
  }
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
        <button type="button" className="console__clear" onClick={onClear} aria-label={clearLabel} title={desk ? clearLabel : undefined}>
          <CrossIcon size={14} />
        </button>
      )}
      {count != null && <span className="console__count">{count}</span>}
      {toggle}
    </div>
  )
}

// ── The segmented control ──
// Two to four options in a pill, one of them on. `full` stretches it
// across the row (the analyzer's Text / Photo / Video). Options carry
// `jp` for a Japanese word and `label` for the plain one; either or
// both, and `icon` a glyph before the word (the analyser's three
// sources, plan 136). On the desk (plan 123) it is one tab stop and its
// arrows move and check, as a radio group's do (hooks/useRadioWalk).
export function Seg({ options, value, onChange, full = false, className = '', label }) {
  const desk = useDesk()
  const onWalk = useRadioWalk(desk)
  const checked = options.findIndex(opt => opt.key === value)
  return (
    <div className={`seg${full ? ' seg--full' : ''} ${className}`.trim()} role="radiogroup" aria-label={label} onKeyDown={onWalk}>
      {options.map((opt, i) => {
        const on = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={radioTab(desk, i, checked)}
            className={`seg__opt${on ? ' seg__opt--on' : ''}`}
            onClick={() => { if (!on) onChange(opt.key) }}
          >
            {opt.icon}
            {opt.label && <span className="seg__opt-latin">{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
