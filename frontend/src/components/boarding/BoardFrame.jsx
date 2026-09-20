import { useLang } from '../../LangContext'
import { BackChevron } from './icons'

// ── The frame every boarding screen stands in (plan 075) ─────────
// The canvas's `.brd`: a head with the back button and the track (the
// line with its stops, your train at the one you are answering); the
// body with the question and its answers standing as one block on the
// centre line of the room between; the foot docked at the bottom,
// rising with the keyboard. Composed from these four so a screen file
// is only its own question and its own content.

export function BoardHead({ index, total, onBack }) {
  const { t } = useLang()
  // The head's track is the line: one stop per question, the stops
  // behind you filled, the one you stand at drawn larger (your train),
  // the ones ahead empty -- so the count is read off the drawing and
  // no figure is printed. A stop stands at its own share of the rail,
  // the first on the left edge and the last on the right (the rail
  // has total-1 legs), and the filled run ends under your stop.
  const at = n => (total > 1 ? ((n - 1) / (total - 1)) * 100 : 0)
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
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index}
        aria-label={t.onbStepsAria(index, total)}
      >
        <div className="brd__rail" />
        <div className="brd__done" style={{ width: `${at(index)}%` }} />
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          const state = n < index ? 'passed' : n === index ? 'here' : 'ahead'
          return <span key={n} className={`brd__stop brd__stop--${state}`} style={{ left: `${at(n)}%` }} />
        })}
      </div>
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
    than the block needs (index.css, "The content stands on the
    centre line; the air gives way before the body scrolls"). Rendered
    by BoardQuestion, so a screen only ever asks for it directly when
    it writes its own question block -- the pass does. */
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
