import { useState } from 'react'
import { playClick } from './sound'
import { Flashcard } from './QuizComponents'
import { CardTransition } from './CardTransition'
import PromptCard from './PromptCard'
import { Loading } from './Loading'
import EmptyState from './EmptyState'
import { ChevronIcon, OpenBookIcon } from './Icons'

// ── Review deck (self-paced, ungraded browse) ──────────────
// The counterpart to the graded quiz flow (useCardSession + RatingBar
// + /review POSTs): a fixed list of cards the user has already
// studied, fetched once from a *_review_cards endpoint, flipped
// through with the same Flashcard front/back interaction everyone
// already knows — but no rating, no XP, no SRS write. Prev/Next just
// move a local index; there's no queue to refill.
//
// Props:
//   cards        — [{ card_id, stage, ...category-specific fields }]
//   loading      — true while the initial fetch is in flight
//   t, session   — passed straight through to Flashcard/RevealActions
//   renderFront/renderBack(card) — JSX for each face
//   dictTerm(card), dictCategory — optional dictionary-lookup wiring
//   onReplaySound(card)          — optional sound-replay wiring
//   onExit       — called from the empty state's back button (the
//     screen's own TopBar already covers the non-empty case)
export default function ReviewDeck({
  cards, loading, t, session,
  renderFront, renderBack, dictTerm, dictCategory, onReplaySound,
  onExit,
}) {
  const [index, setIndex] = useState(0)

  if (loading) return <Loading />

  if (!cards || cards.length === 0) {
    return (
      <EmptyState
        icon={<OpenBookIcon size={40} />}
        message={t.reviewEmpty}
        action={{ label: t.backToMenu, onClick: onExit }}
      />
    )
  }

  const safeIndex = Math.min(index, cards.length - 1)
  const card = cards[safeIndex]

  function goPrev() { playClick(); setIndex(i => Math.max(0, i - 1)) }
  function goNext() { playClick(); setIndex(i => Math.min(cards.length - 1, i + 1)) }

  return (
    <>
      <div className="review-deck__counter">{safeIndex + 1} / {cards.length}</div>
      <CardTransition cardKey={card.card_id} stage={card.stage}>
        <PromptCard>
          <Flashcard
            t={t}
            resetKey={card.card_id}
            front={renderFront(card)}
            back={renderBack(card)}
            dictTerm={dictTerm ? dictTerm(card) : undefined}
            dictCategory={dictCategory}
            session={session}
            onReplaySound={onReplaySound ? () => onReplaySound(card) : undefined}
          />
        </PromptCard>
      </CardTransition>
      <div className="review-deck__nav">
        <button onClick={goPrev} disabled={safeIndex === 0} className="btn-panel">
          <ChevronIcon direction="left" size={14} /> {t.reviewPrev}
        </button>
        <button onClick={goNext} disabled={safeIndex === cards.length - 1} className="btn-panel">
          {t.reviewNext} <ChevronIcon direction="right" size={14} />
        </button>
      </div>
    </>
  )
}
