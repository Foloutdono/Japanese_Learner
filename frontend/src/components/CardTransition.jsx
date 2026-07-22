import { useState, useEffect } from 'react'
import { CardStamp } from './CardStamp'

// How long a just-answered card sticks around, tucked visibly apart
// from the live one, waiting on a possible stage_up before it's given
// up on and removed. Generous enough to cover a typical review round
// trip (kana.py/kanji.py/vocab.py's post_*_review no longer makes the
// extra get_bulk_stats call it used to), short enough that the common
// case — a review that doesn't promote a card — doesn't leave
// anything lingering on screen. A stamp that lands after this window
// is simply missed; on a slow connection that's a far smaller problem
// than showing a promotion on the wrong card, which is the bug this
// whole component exists to fix.
const REST_MS = 1400

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
 * to the card the reviewer is now looking at — shortening REST_MS
 * alone wouldn't fix that, since a stamp arriving even a frame after
 * the live card swapped would still look misattributed if the two
 * shared the same on-screen position.
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
      resting: { key: state.key, content: state.content, leaving: false, hadStamp: false },
    })
  } else if (children !== state.content) {
    // Same card, content refreshed in place (Kanji/Vocab's
    // re-translate-on-language-change) — no transition, just swap.
    setState(s => ({ ...s, content: children }))
  }

  const resting = state.resting
  const restingStamp = resting && !resting.leaving && stamp?.cardKey === resting.key ? stamp : null

  // `hadStamp` picks which fade-out variant plays (see the two
  // card-transition-fade-out-* keyframes in index.css) — the resting
  // card can be leaving from two different opacities (settled at 0.4
  // with no stamp, or fully surfaced at 1 after one played), and a
  // single keyframe animation can't cleanly pick up from either
  // starting point, so there are two explicit ones instead of one
  // animation guessing where it's coming from.
  const startLeaving = (hadStamp) => {
    setState(s => (s.resting && s.resting.key === resting.key
      ? { ...s, resting: { ...s.resting, leaving: true, hadStamp } }
      : s))
  }
  const removeResting = () => {
    setState(s => (s.resting && s.resting.key === resting.key ? { ...s, resting: null } : s))
  }

  useEffect(() => {
    if (!resting || resting.leaving || restingStamp) return
    const timer = setTimeout(() => startLeaving(false), REST_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting?.key, resting?.leaving, restingStamp])

  const handleRestAnimationEnd = (e) => {
    if (e.animationName === 'card-transition-fade-out-settled'
      || e.animationName === 'card-transition-fade-out-stamped') {
      removeResting()
    }
  }

  const restClass = [
    'card-transition-rest',
    restingStamp && 'card-transition-rest--stamping',
    resting?.leaving && `card-transition-rest--leaving-from-${resting.hadStamp ? 'stamped' : 'settled'}`,
  ].filter(Boolean).join(' ')

  return (
    <div className={`quiz-card-stage card-transition${className ? ` ${className}` : ''}`}>
      <div key={state.key} className="card-transition-live">
        {state.content}
      </div>
      {resting && (
        <div className={restClass} onAnimationEnd={handleRestAnimationEnd}>
          {resting.content}
          {restingStamp && (
            <CardStamp
              transition={restingStamp}
              onDone={() => { startLeaving(true); onStampDone?.() }}
            />
          )}
        </div>
      )}
    </div>
  )
}