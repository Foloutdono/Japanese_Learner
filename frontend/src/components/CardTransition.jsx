import { useState, useEffect } from 'react'
import { CardStamp } from './CardStamp'

// How long a just-answered card sticks around, visibly held next to
// the live one, before giving up on a stage_up that never came and
// finally fading away. Long enough to comfortably outlast a routine
// XP toast's full on-screen life (see NORMAL_DURATION + the
// xp-toast-fall animation in XpToast.jsx/index.css, ~2s together) —
// the card the toast is celebrating shouldn't already be gone while
// the toast is still up. A stamp that lands after this window is
// simply missed; on a slow connection that's a far smaller problem
// than showing a promotion on the wrong card, which is the bug this
// whole component originally exists to fix.
const REST_MS = 2100

/**
 * Wraps one screen's card content so switching cards is an animated
 * transition instead of an instant cut, AND so a stage-promotion
 * stamp (see CardStamp.jsx) always lands on the card it actually
 * belongs to — never on whatever card happens to be current by the
 * time the review response comes back.
 *
 * Why this needs to exist: useCardSession's advance() pops the next
 * card off the local queue the instant a rating is picked, so `card`
 * (and therefore `cardKey`/`children` below) has already moved on to
 * the *next* card before the review POST for the one just answered
 * has any chance to resolve. Naively rendering `children` directly
 * means a stamp fired later renders wherever `children` currently is
 * — i.e. on top of the next card. The fix has to be spatial, not just
 * about timing: the previous card is kept around, visibly set apart
 * from the live one (see .card-transition-rest in index.css),
 * specifically so a stamp landing on it can never read as belonging
 * to the card the reviewer is now looking at.
 *
 * The resting card holds at essentially full visibility the entire
 * time it's waiting — it settles into its "set aside" position once,
 * on entry, and then does not move or dim again until it actually
 * leaves. Earlier this dimmed early and jumped back to full size the
 * instant a stamp arrived, which read as the card vanishing and then
 * glitching back — the whole point of holding it is so nothing about
 * it changes out from under the reward feedback (the XP toast, and
 * the stamp when there is one) that's supposed to belong to it.
 *
 * `cardKey` — the current card's id. `stamp` — the same `{ id, to }`
 * shape CardStamp already takes, plus `cardKey` identifying which
 * card it belongs to (screens should set this from the closure-
 * captured card at review time, not whatever `card` is by the time
 * the response arrives). `onStampDone` fires once a shown stamp's
 * animation genuinely finishes — mirrors CardStamp's own onDone
 * contract. `children` is the current card's display content (just
 * the PromptCard, not MCQGrid/RatingBar — those already reflect the
 * live card immediately and don't need this treatment).
 *
 * Only ever tracks one card "at rest" at a time — answering a second
 * card before the first one's rest window elapses drops the first
 * one's chance at a stamp. That only happens in quick bursts, and
 * losing an occasional stamp there is a far smaller problem than the
 * one this component exists to fix.
 */
export function CardTransition({ cardKey, stamp, onStampDone, className, children }) {
  // "Adjust state during render" (see the React docs on storing
  // information from previous renders) — runs synchronously before
  // paint whenever cardKey changes, so there's never a frame where
  // the outgoing card's content has already been overwritten by the
  // incoming one.
  const [state, setState] = useState({ key: cardKey, content: children, resting: null })

  if (cardKey !== state.key) {
    setState({
      key: cardKey,
      content: children,
      resting: { key: state.key, content: state.content, leaving: false },
    })
  } else if (children !== state.content) {
    // Same card, content refreshed in place (Kanji/Vocab's
    // re-translate-on-language-change) — no transition, just swap.
    setState(s => ({ ...s, content: children }))
  }

  const resting = state.resting
  const restingStamp = resting && !resting.leaving && stamp?.cardKey === resting.key ? stamp : null

  const startLeaving = () => {
    setState(s => (s.resting && s.resting.key === resting.key
      ? { ...s, resting: { ...s.resting, leaving: true } }
      : s))
  }
  const removeResting = () => {
    setState(s => (s.resting && s.resting.key === resting.key ? { ...s, resting: null } : s))
  }

  useEffect(() => {
    if (!resting || resting.leaving || restingStamp) return
    const timer = setTimeout(startLeaving, REST_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting?.key, resting?.leaving, restingStamp])

  const handleRestAnimationEnd = (e) => {
    if (e.animationName === 'card-transition-fade-out') removeResting()
  }

  const restClass = [
    'card-transition-rest',
    restingStamp && 'card-transition-rest--stamping',
    resting?.leaving && 'card-transition-rest--leaving',
  ].filter(Boolean).join(' ')

  return (
    <div className={`quiz-card-stage card-transition${className ? ` ${className}` : ''}`}>
      <div key={state.key} className="card-transition-live">
        {state.content}
      </div>
      {resting && (
        <div key={resting.key} className={restClass} onAnimationEnd={handleRestAnimationEnd}>
          {resting.content}
          {restingStamp && (
            <CardStamp
              transition={restingStamp}
              onDone={() => { startLeaving(); onStampDone?.() }}
            />
          )}
        </div>
      )}
    </div>
  )
}