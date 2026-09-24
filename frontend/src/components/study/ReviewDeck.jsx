import { useEffect, useState } from 'react'
import { playClick } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { runKey } from '../../lib/keyGuards'
import { Flashcard } from './QuizComponents'
import { CardTransition } from './CardTransition'
import PromptCard from './PromptCard'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { ChevronIcon, OpenBookIcon } from '../ui/Icons'

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
//   dictTerm(card), dictKana(card), dictCategory — optional
//     dictionary-lookup wiring. Both are per-card functions; pass
//     dictKana wherever the cards have a reading, or the sheet can
//     open a homograph instead of the card in hand.
//   onReplaySound(card)          — optional sound-replay wiring
//   onExit       — called from the empty state's back button (the
//     screen's own TopBar already covers the non-empty case)
//   foot         — optional: what these cards are ("N4 · Kanji"); the
//     card's footer strip prints it beside "Nothing is graded"
export default function ReviewDeck({
  cards, loading, t, session,
  renderFront, renderBack, dictTerm, dictKana, dictCategory, onReplaySound,
  onExit, foot,
}) {
  const [index, setIndex] = useState(0)
  const desk = useDesk()
  const count = cards?.length ?? 0

  // 机 (plan 123): ← and → turn the pages of a browse. Its Prev/Next
  // stay where they are rather than follow the card (a target pressed
  // over and over must not move), so the keys are the way through
  // without the pointer. Not from a field, a dialog or a chord.
  useEffect(() => {
    if (!desk || count === 0) return undefined
    const at = Math.min(index, count - 1)
    const onKey = e => {
      if (!runKey(e) || e.shiftKey) return
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      e.preventDefault()
      const to = Math.max(0, Math.min(count - 1, at + step))
      if (to === at) return
      playClick()
      setIndex(to)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, count, index])

  if (loading) return <Loading />

  if (!cards || cards.length === 0) {
    return (
      <Empty
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
        <PromptCard foot={foot ? { left: foot, right: t.nothingGraded } : undefined}>
          <Flashcard
            t={t}
            resetKey={card.card_id}
            front={renderFront(card)}
            back={renderBack(card)}
            dictTerm={dictTerm ? dictTerm(card) : undefined}
            dictKana={dictKana ? dictKana(card) : undefined}
            dictCategory={dictCategory}
            session={session}
            onReplaySound={onReplaySound ? () => onReplaySound(card) : undefined}
          />
        </PromptCard>
      </CardTransition>
      {/* The stage's foot (canvas RunBrowse): the way back, and the
          filled action forward. */}
      <div className="stage__foot browse-nav">
        <button type="button" onClick={goPrev} disabled={safeIndex === 0} className="btn-secondary" aria-keyshortcuts={desk ? 'ArrowLeft' : undefined}>
          <ChevronIcon direction="left" size={14} /> {t.reviewPrev}
          {desk && <kbd className="desk-kbd" aria-hidden="true">←</kbd>}
        </button>
        <button type="button" onClick={goNext} disabled={safeIndex === cards.length - 1} className="btn-primary" aria-keyshortcuts={desk ? 'ArrowRight' : undefined}>
          {t.reviewNext} <ChevronIcon direction="right" size={14} />
          {desk && <kbd className="desk-kbd" aria-hidden="true">→</kbd>}
        </button>
      </div>
    </>
  )
}
