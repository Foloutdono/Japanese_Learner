import { useState } from 'react'
import { DeckPicker } from './DeckPicker'

// ── The press, apart from the button ──
// What a mine control does when pressed — the remembered target or
// the picker, the write, the outcome — separated from how it is drawn
// so the dictionary plate's ＋ menu (plan 093) can offer the same act
// as a row beside "keep in favourites" without a second copy of it.
// Returns the press handler, the pending flag, the outcome line and
// the picker element (a portal dialog, rendered wherever the caller
// puts it — it must stay mounted while a menu around it closes).
export function useMineAction({ mining, kind, onMine, t, successLabel }) {
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

  function press(e) {
    e?.stopPropagation?.()
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
    outcome === null ? null
    : outcome === 'error' ? (t.mineFailed ?? "Couldn't add this card.")
    : outcome > 0 ? (successLabel ?? (t.inDeck ?? 'In deck'))
    : (t.alreadyInDeck ?? 'Already there')
  const outcomeClassName =
    `analysis-mine-status${outcome > 0 ? ' analysis-mine-status--added' : ''}`

  const picker = showPicker ? (
    <DeckPicker
      decks={mining.decksFor(kind)}
      currentId={mining.targetFor(kind)?.id ?? null}
      t={t}
      onClose={() => setShowPicker(false)}
      onSelect={mine}
      onCreate={handleCreate}
    />
  ) : null

  return { press, pending, addedOnce, outcomeText, outcomeClassName, picker }
}

// A deck-less stand-in so the hook can run unconditionally (here and on
// the dictionary plate, whose ＋ exists without `mining` too).
export const INERT_MINING = { targetFor: () => null, decksFor: () => [], ensureDeck: async () => null }
