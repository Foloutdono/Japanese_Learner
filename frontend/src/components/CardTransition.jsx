import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { CardStamp } from './CardStamp'
import { StageBadge } from './StageBadge'

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
 * `cardKey` — the current card's id, drives the crossfade. `children`
 * is always rendered live and up to date — it is NOT gated behind any
 * "did this actually change" check, because a screen's children can
 * carry live-updating props of their own (Kanji's `revealed={answered}`
 * inside its InlineReveal, for instance) that must never go stale
 * between real card swaps.
 *
 * `contentKey` is a separate, optional signal a screen can bump when
 * it knows the SAME card's content just changed size in place — right
 * now that's only Kanji/Vocab's re-translate-on-language-change (see
 * `card.lang` in those screens). It defaults to `cardKey`, so a screen
 * that never passes it (Kana) simply never triggers an in-place
 * re-measure — only a real card change ever does. This is the part
 * that used to be driven by comparing `children` for reference
 * equality, which broke down because JSX children are a fresh object
 * every render regardless of whether anything visually changed —
 * that mismatch was firing the in-place re-measure on essentially
 * every unrelated re-render (locked/toast/stamp/progress state
 * changes during postReview), each of which re-armed the height
 * transition. Most of those re-measures found identical before/after
 * heights, and a CSS transition between two equal values never fires
 * `transitionend` — so the height never made it back to `auto` and
 * stayed pinned to whatever px value happened to be measured,
 * cropping any later, taller card. Driving this off an explicit key
 * instead of object identity removes that entirely.
 *
 * `stamp` — `{ id, to, cardKey }`, the same shape CardStamp takes,
 * plus `cardKey` identifying which card it belongs to; only rendered
 * while it matches the live `cardKey`. `onStampDone` fires once a
 * shown stamp's animation genuinely finishes — mirrors CardStamp's
 * own onDone contract.
 *
 * `stage` — the live card's SRS stage ('new' | 'learning' |
 * 'mastered' | undefined), rendered as a permanent corner seal (see
 * StageBadge.jsx) rather than gated behind `cardKey` the way `stamp`
 * is — there's no "which card does this belong to" ambiguity to
 * resolve, it's always just whatever the current card's own stage is,
 * so it updates the instant `stage` does rather than waiting on the
 * crossfade. Omit it (or pass undefined) for card sources that don't
 * track a stage at all — StageBadge itself renders nothing in that
 * case.
 */
export function CardTransition({ cardKey, contentKey, stamp, onStampDone, stage, className, children }) {
  const effectiveContentKey = contentKey ?? cardKey

  const [liveKey, setLiveKey] = useState(cardKey)
  const [liveContentKey, setLiveContentKey] = useState(effectiveContentKey)
  const [outgoing, setOutgoing] = useState(null) // { key, content } | null
  const [height, setHeight] = useState(null) // px while animating, null once settled to auto

  const liveRef = useRef(null)
  const prevHeightRef = useRef(null)
  // Always tracks the latest children, so that when a real card swap
  // happens we have last render's content ready to hand off to
  // `outgoing` — without needing `children` itself to be part of any
  // equality check.
  const lastChildrenRef = useRef(children)

  // "Adjust state during render" (see the React docs on storing
  // information from previous renders) — runs synchronously before
  // paint whenever cardKey or contentKey changes, so there's never a
  // frame where the outgoing card's content has already been
  // overwritten by the incoming one. `liveRef` still points at the
  // *old* DOM node at this point — the swap hasn't committed yet —
  // so this is also the one moment we can read its real height.
  if (cardKey !== liveKey) {
    prevHeightRef.current = liveRef.current?.offsetHeight ?? null
    setOutgoing({ key: liveKey, content: lastChildrenRef.current })
    setLiveKey(cardKey)
    setLiveContentKey(effectiveContentKey)
  } else if (effectiveContentKey !== liveContentKey) {
    // Same card, content refreshed in place (Kanji/Vocab's
    // re-translate-on-language-change) — no outgoing copy, just a
    // height re-measure in case the new text is longer or shorter.
    prevHeightRef.current = liveRef.current?.offsetHeight ?? null
    setLiveContentKey(effectiveContentKey)
  }
  lastChildrenRef.current = children

  // Once the live card has actually rendered, animate the container
  // from whatever height the previous card left behind to this one's
  // real height — set the old height first (a same-frame no-op if
  // it's already there), then hand the target to the next frame so
  // the browser has something to transition *from*. If the two
  // heights turn out equal (common — most re-measures aren't a real
  // resize), skip the dance entirely: a CSS transition between two
  // identical values never fires `transitionend`, so going through
  // the pinned-height step here would leave the box permanently
  // stuck at that px value instead of tracking content normally.
  useLayoutEffect(() => {
    const el = liveRef.current
    if (!el) return
    const target = el.offsetHeight
    if (prevHeightRef.current == null || prevHeightRef.current === target) {
      setHeight(null)
      return
    }
    setHeight(prevHeightRef.current)
    const raf = requestAnimationFrame(() => setHeight(target))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, liveContentKey])

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
        <div key={liveKey} ref={liveRef} className="card-transition-live">
          {children}
        </div>
        {outgoing && (
          <div key={outgoing.key} className="card-transition-outgoing" aria-hidden="true">
            {outgoing.content}
          </div>
        )}
      </div>
      {showStamp && <CardStamp transition={stamp} onDone={onStampDone} />}
      <StageBadge stage={stage} />
    </div>
  )
}