import { useContext, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { PassWave } from '../profile/PassWave'
import { BackChevron } from './icons'
import { BoardBack } from './boardBack'

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

/** The one filled action: gold, full width, docked. `keys` is the
    desk's (plan 122): Enter presses it -- hooks/useBoardKeys in the
    boarding, EnterKey on the Welcome and at a ride's end -- so it
    prints the key and names it. Only where Enter really does.

    改札 (plan 164, the owner's pick D of four drawn): the gate you tap
    your pass on -- a gold pill, the pass's contactless mark in a sumi
    reader at its left, ripples leaving the reader. Until an answer is
    picked it is the gate's outline, and the pick WAKES it: the fill
    comes in and the pill overshoots once. Only on that change -- a
    Continue that arrives ready does not pop -- so `waking` follows the
    `disabled` it was last rendered with, never the mount. */
export function Continue({ label, onClick, disabled = false, keys = false, ...rest }) {
  const { t } = useLang()
  const desk = useDesk()
  const back = useContext(BoardBack)
  const printed = keys && desk
  const [waking, setWaking] = useState(false)
  const was = useRef(disabled)
  useEffect(() => {
    if (was.current && !disabled) setWaking(true)
    was.current = disabled
  }, [disabled])
  const woke = e => { if (e.animationName === 'btn-gate-wake') setWaking(false) }
  const button = (
    <button
      type="button"
      className={waking ? 'btn-depart btn-depart--gate btn-depart--waking' : 'btn-depart btn-depart--gate'}
      onClick={onClick}
      onAnimationEnd={woke}
      disabled={disabled}
      aria-keyshortcuts={printed ? 'Enter' : undefined}
      {...rest}
    >
      <span className="btn-depart__reader" aria-hidden="true">
        <i className="btn-depart__rip" />
        <i className="btn-depart__rip" />
        <PassWave className="pass__wave btn-depart__wave" />
      </span>
      <span className="btn-depart__jp">{label}</span>
      {printed && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
    </button>
  )
  if (!printed || !back) return button
  return (
    <div className="desk-brd__floor">
      <FloorBackButton onClick={back} label={t.back} />
      {button}
    </div>
  )
}

function FloorBackButton({ onClick, label }) {
  return (
    <button type="button" className="desk-brd__back" onClick={onClick} data-action="back">
      <BackChevron />
      {label}
    </button>
  )
}

/** A floor with the way back alone, for the one question with no
    Continue -- the kana's, whose answers go on by themselves. On the
    desk, where the head's ‹ is not drawn (plan 140); nothing on a
    phone, which keeps its head. */
export function FloorBack() {
  const { t } = useLang()
  const desk = useDesk()
  const back = useContext(BoardBack)
  if (!desk || !back) return null
  return (
    <div className="brd__foot">
      <div className="desk-brd__floor">
        <FloorBackButton onClick={back} label={t.back} />
      </div>
    </div>
  )
}

export function BoardLink({ onClick, children, ...rest }) {
  return (
    <button type="button" className="brd__link" onClick={onClick} {...rest}>{children}</button>
  )
}
