import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { CardStamp } from './CardStamp'

// How long the outgoing card's own exit animation runs — must match
// the `card-transition-exit` duration in index.css exactly, since
// this is the timer that actually removes it from the DOM once the
// (CSS-driven) fade/lift is done.
const OUTGOING_MS = 220

/**
 * Wraps one screen's card content so switching cards is an animated
 * transition instead of an instant cut — a crossfade between the
 * outgoing and live card, with the container's height animating
 * between whatever each one naturally needs instead of snapping or
 * clipping.
 *
 * This used to also be responsible for routing a stage-promotion
 * stamp (see CardStamp.jsx) onto the right card, back when advance()
 * moved the deck on the instant a rating was picked — before the
 * review POST for the card just answered had any chance to resolve.
 * That's no longer how this works: Kana/Kanji/VocabScreen's
 * postReview() now holds the card in place and only calls advance()
 * once the XP toast and any stamp have actually finished (see the
 * `pendingGatesRef` bookkeeping in each screen). So by the time
 * `cardKey` below ever changes, there's nothing left pending on the
 * card being left behind — a stamp only ever has one card it could
 * possibly belong to: the current, still-live one. That's why this
 * component can now just render CardStamp directly over the live
 * card instead of keeping a separate "set aside" copy around to
 * catch a late arrival.
 *
 * `cardKey` — the current card's id. `stamp` — `{ id, to, cardKey }`,
 * the same shape CardStamp takes, plus `cardKey` identifying which
 * card it belongs to; only rendered while it matches the live
 * `cardKey`. `onStampDone` fires once a shown stamp's animation
 * genuinely finishes — mirrors CardStamp's own onDone contract.
 * `children` is the current card's display content (just the
 * PromptCard, not MCQGrid/RatingBar — those already reflect the live
 * card immediately and don't need this treatment).
 */
export function CardTransition({ cardKey, stamp, onStampDone, className, children }) {
  const [state, setState] = useState({ key: cardKey, content: children })
  const [outgoing, setOutgoing] = useState(null) // { key, content } | null
  const [height, setHeight] = useState(null) // px while animating, null once settled to auto

  const liveRef = useRef(null)
  const prevHeightRef = useRef(null)

  // "Adjust state during render" (see the React docs on storing
  // information from previous renders) — runs synchronously before
  // paint whenever cardKey (or in-place content) changes, so there's
  // never a frame where the outgoing card's content has already been
  // overwritten by the incoming one. `liveRef` still points at the
  // *old* DOM node at this point — the swap hasn't committed yet —
  // so this is also the one moment we can read its real height.
  if (cardKey !== state.key) {
    prevHeightRef.current = liveRef.current?.offsetHeight ?? null
    setOutgoing({ key: state.key, content: state.content })
    setState({ key: cardKey, content: children })
  } else if (children !== state.content) {
    // Same card, content refreshed in place (Kanji/Vocab's
    // re-translate-on-language-change) — no outgoing copy, just a
    // height re-measure in case the new text is longer or shorter.
    prevHeightRef.current = liveRef.current?.offsetHeight ?? null
    setState(s => ({ ...s, content: children }))
  }

  // Once the live card has actually rendered, animate the container
  // from whatever height the previous card left behind to this one's
  // real height — set the old height first (a same-frame no-op if
  // it's already there), then hand the target to the next frame so
  // the browser has something to transition *from*.
  useLayoutEffect(() => {
    const el = liveRef.current
    if (!el) return
    const target = el.offsetHeight
    if (prevHeightRef.current == null) {
      setHeight(target)
      return
    }
    setHeight(prevHeightRef.current)
    const raf = requestAnimationFrame(() => setHeight(target))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.key, state.content])

  useEffect(() => {
    if (!outgoing) return
    const timer = setTimeout(() => setOutgoing(null), OUTGOING_MS)
    return () => clearTimeout(timer)
  }, [outgoing?.key])

  // Once the height transition genuinely lands, let go of the
  // explicit pixel value so the box goes back to tracking its
  // content's real (auto) height — otherwise it'd stay pinned at a
  // stale number through any later reflow that has nothing to do
  // with this animation (MCQGrid appearing, a window resize…).
  const handleHeightTransitionEnd = (e) => {
    if (e.target === e.currentTarget && e.propertyName === 'height') {
      setHeight(null)
    }
  }

  // A stamp only ever belongs to the still-current card now, so
  // there's no routing to do — just show it whenever it matches.
  const showStamp = stamp?.cardKey === cardKey

  return (
    <div className={`quiz-card-stage${className ? ` ${className}` : ''}`}>
      <div
        className="card-transition"
        style={height != null ? { height } : undefined}
        onTransitionEnd={handleHeightTransitionEnd}
      >
        <div key={state.key} ref={liveRef} className="card-transition-live">
          {state.content}
        </div>
        {outgoing && (
          <div key={outgoing.key} className="card-transition-outgoing" aria-hidden="true">
            {outgoing.content}
          </div>
        )}
      </div>
      {showStamp && <CardStamp transition={stamp} onDone={onStampDone} />}
    </div>
  )
}