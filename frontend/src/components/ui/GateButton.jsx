import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { PassWave } from '../profile/PassWave'

/** 改札 — the gate you tap your pass on (plan 164; DESIGN.md, "The gate
    button"): a gold pill, the pass's contactless mark in a sumi reader
    at its left, ripples leaving the reader, a halo it breathes. Until
    it can be pressed it is the gate's outline, and the change to
    pressable WAKES it: the fill comes in and the pill overshoots once.
    Only on that change -- a gate that arrives ready does not pop -- so
    `waking` follows the `disabled` it was last rendered with, never the
    mount.

    The boarding's Continue (components/boarding/BoardFrame.jsx) and
    Today's Depart (components/station/GateCard.jsx) are the two gates,
    and a deck's Study on the desk (screens/DeckDetailScreen.jsx, plan
    179) the third.
    `keys` prints the Enter cap at the pill's right end: only where
    Enter really does press it.

    終着 (plan 191): the day cleared's screens draw the gate as their
    canvas does -- `compact`, the boards' 52px pill and 32px reader, and
    `arrive`, the way in (it rises 16px with one small overshoot, then
    breathes), after `arriveDelay` ms. Both are the kit's
    (components/dayclear/kit, the primitives region of index.css). */
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
        <i className="btn-depart__rip" />
        <i className="btn-depart__rip" />
        <PassWave className="pass__wave btn-depart__wave" />
      </span>
      <span className="btn-depart__jp">{label}</span>
      {keys && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
    </button>
  )
}
