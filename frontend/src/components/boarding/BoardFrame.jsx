import { useLang } from '../../LangContext'
import { BackChevron } from './icons'

// ── The frame every boarding screen stands in (plan 075) ─────────
// The canvas's `.brd`: a head with the back button, the track (the
// progress bar is the line, the train is where you are) and n/N; the
// body with the question under the head and the content centred in the
// room between; the foot docked at the bottom, rising with the
// keyboard. Composed from these four so a screen file is only its own
// question and its own content.

export function BoardHead({ index, total, onBack }) {
  const { t } = useLang()
  const pct = total > 0 ? Math.round((index / total) * 100) : 0
  return (
    <div className="brd__head">
      {onBack
        ? (
          <button type="button" className="brd__back" onClick={onBack} aria-label={t.back}>
            <BackChevron />
          </button>
        )
        : <span className="brd__back brd__back--void" aria-hidden="true" />}
      <div
        className="brd__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
        aria-label={t.onbStepsAria(index, total)}
      >
        <div className="brd__done" style={{ width: `${pct}%` }} />
        <span className="brd__train" style={{ left: `${pct}%` }} />
      </div>
      <span className="brd__count" aria-hidden="true">{index}/{total}</span>
    </div>
  )
}

export function BoardQuestion({ children, hint = null, as: Tag = 'h1' }) {
  return (
    <>
      <Tag className="brd__q" tabIndex={-1}>{children}</Tag>
      {hint && <p className="brd__hint">{hint}</p>}
      <BoardAir />
    </>
  )
}

/** The room between a question and its answers, drawn as a spacer
    rather than a margin so that it can give way on a phone shorter
    than the canvas's artboard (index.css, "The air gives way before
    the body scrolls"). Rendered by BoardQuestion, so a screen only
    ever asks for it directly when it writes its own question block
    -- the pass does. */
export function BoardAir() {
  return <div className="brd__air" aria-hidden="true" />
}

/** The one filled action: gold, full width, docked. */
export function Continue({ label, onClick, disabled = false, ...rest }) {
  return (
    <button type="button" className="btn-depart" onClick={onClick} disabled={disabled} {...rest}>
      <span className="btn-depart__jp">{label}</span>
      <span className="btn-depart__go" aria-hidden="true">▶</span>
    </button>
  )
}

export function BoardLink({ onClick, children, ...rest }) {
  return (
    <button type="button" className="brd__link" onClick={onClick} {...rest}>{children}</button>
  )
}
