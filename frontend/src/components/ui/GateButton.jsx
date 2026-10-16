import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'

/** 改札 — the gate you tap your pass on (plan 164, redrawn in plan 225;
    DESIGN.md, "The gate button"): a gold pill lit from above, a sumi
    reader at its left end holding the card scanner's mark, a hairline
    between the reader and the word. Pressing it lights the reader.
    Until it can be pressed it is the gate's outline, and the change to
    pressable WAKES it: the fill comes in and the pill overshoots once.
    Only on that change -- a gate that arrives ready does not pop -- so
    `waking` follows the `disabled` it was last rendered with, never the
    mount.

    Drawn as the painted Practice gate drew its own (the canvas
    "Practice gate — five wheels", board 4), the owner's word being that
    every gate should be that one, its mark a card scanner. The pass's
    contactless arcs it carried read as a speaker's.

    The boarding's Continue (components/boarding/BoardFrame.jsx) and
    Today's Depart (components/station/GateCard.jsx) are the two gates,
    a deck's Study on the desk (screens/DeckDetailScreen.jsx, plan 179)
    the third, and the painted Practice gate's (components/practice/
    gate) the fourth.
    `keys` prints the Enter cap at the pill's right end: only where
    Enter really does press it.

    終着 (plan 191): the day cleared's screens draw the gate as their
    canvas does -- `compact`, the boards' 52px pill -- and `arrive`, the
    way in (it rises 16px with one small overshoot), after `arriveDelay`
    ms. Both are the kit's (components/dayclear/kit, the primitives
    region of index.css). */
export function GateButton({ label, onClick, disabled = false, keys = false, compact = false, arrive = false, arriveDelay = 0, className = '', style, ...rest }) {
  const { t } = useLang()
  const [waking, setWaking] = useState(false)
  const was = useRef(disabled)
  useEffect(() => {
    if (was.current && !disabled) setWaking(true)
    was.current = disabled
  }, [disabled])
  const woke = e => { if (e.animationName === 'btn-gate-wake') setWaking(false) }
  const classes = [
    'btn-depart', 'btn-depart--gate', waking && 'btn-depart--waking',
    compact && 'clrk-gate--compact', arrive && 'clrk-gate--arrive', className,
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      onAnimationEnd={woke}
      disabled={disabled}
      style={arrive && arriveDelay ? { '--gate-d': `${arriveDelay}ms`, ...style } : style}
      aria-keyshortcuts={keys ? 'Enter' : undefined}
      {...rest}
    >
      <span className="btn-depart__reader" aria-hidden="true">
        <ScanMark />
      </span>
      <span className="btn-depart__jp">{label}</span>
      {keys && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
    </button>
  )
}

/** The reader's mark: a card in a scanner's frame, its stripe across
    it. Inked by the reader (currentColor). */
function ScanMark() {
  return (
    <svg className="btn-depart__scan" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" />
      <path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" />
      <path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" />
      <path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <rect x="7" y="8.5" width="10" height="7" rx="1.2" />
      <path d="M7 11h10" />
    </svg>
  )
}
