import { useState } from 'react'
import { DeckPicker } from './DeckPicker'

// Turns something found in a Sentence into a Card in one of the
// learner's decks -- the missing button that makes the analyzer worth
// coming back to. Writes go through the existing, already-tested
// POST /api/decks/{id}/cards(/app) (see useMining.js); this component
// adds no backend surface of its own.
//
// Generalized over WHAT gets mined: `onMine(deckId)` is the actual
// write (an app-card reference via mining.mineApp, or a client-built
// cloze via mining.mineCloze) -- this component only owns picking the
// target deck and showing the outcome.
//
// `mining` is a useMining(session) instance, shared by every mine
// control on the screen -- undefined is a valid, deliberate value
// (ReadingScreen.jsx doesn't create one), in which case this renders
// nothing at all rather than a broken control.
export function MineButton({ mining, kind, disabled, disabledReason, label, successLabel, onMine, t }) {
  const [showPicker, setShowPicker] = useState(false)
  const [pending, setPending] = useState(false)
  // null = not attempted yet; a number once a mine WRITE succeeded
  // (0 is a real, distinct outcome -- already in the deck, or a stale
  // reference -- shown differently from a successful add); 'error' when
  // the request itself failed (network, validation), distinct from both.
  const [outcome, setOutcome] = useState(null)
  // The outcome used to REPLACE the button, permanently. A learner who
  // added 猫 to "N5 words" and then wanted it in "Animals" too had no
  // control left to press until the page reloaded -- and useMining
  // remembers the last target per kind, so the second add would have
  // gone somewhere else on purpose.
  //
  // Now: the outcome sits next to a button that stays. Pressing again
  // opens the deck picker rather than repeating the remembered target,
  // because a second add is by definition a different deck.
  const [addedOnce, setAddedOnce] = useState(false)

  if (!mining) return null

  if (disabled) {
    return (
      <span className="analysis-mine-btn analysis-mine-btn--disabled" title={disabledReason}>
        {label ?? (t.mineToDeck ?? 'Mine')}
      </span>
    )
  }

  async function mine(deckId) {
    setPending(true)
    setShowPicker(false)
    try {
      const count = await onMine(deckId)
      setOutcome(typeof count === 'number' ? count : 1)
      setAddedOnce(true)
    } catch {
      setOutcome('error')
    } finally {
      setPending(false)
    }
  }

  function handleClick(e) {
    e.stopPropagation()
    const target = mining.targetFor(kind)
    // First press: the remembered deck, no dialog. Any press after a
    // successful add: choose, because repeating the same deck is what
    // just happened.
    if (target && !addedOnce) {
      mine(target.id)
    } else {
      setShowPicker(true)
    }
  }

  async function handleCreate(name) {
    const deck = await mining.ensureDeck(kind, name)
    mine(deck.id)
  }

  const outcomeText =
    outcome === 'error' ? (t.mineFailed ?? "Couldn't add this card.")
    : outcome > 0 ? (successLabel ?? (t.inDeck ?? 'In deck'))
    : (t.alreadyInDeck ?? 'Already there')
  const outcomeClassName =
    `analysis-mine-status${outcome > 0 ? ' analysis-mine-status--added' : ''}`

  return (
    <>
      <button onClick={handleClick} disabled={pending} className="analysis-mine-btn">
        {addedOnce ? (t.addToAnotherDeck ?? 'Add to another deck') : (label ?? (t.mineToDeck ?? 'Mine'))}
      </button>
      {outcome !== null && (
        <span className={outcomeClassName}>{outcomeText}</span>
      )}
      {showPicker && (
        <DeckPicker
          decks={mining.decksFor(kind)}
          currentId={mining.targetFor(kind)?.id ?? null}
          t={t}
          onClose={() => setShowPicker(false)}
          onSelect={mine}
          onCreate={handleCreate}
        />
      )}
    </>
  )
}
