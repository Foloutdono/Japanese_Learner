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
export function useMineAction({ mining, kind, onMine, t, successLabel, owner = null }) {
  // What the state below is about (plan 123). A control that stays
  // mounted while what it adds changes under it -- the dictionary
  // plate, walked from entry to entry -- passes the entry's key, and the
  // picker, the pending flag and the outcome each remember the owner
  // they were set for: 犬 no longer said "In deck" because 猫 had just
  // been added, and a picker left open no longer added the entry walked
  // to. Callers that mount one control per word pass nothing.
  const [pickerFor, setPickerFor] = useState(undefined)
  const showPicker = pickerFor === owner
  const setShowPicker = open => setPickerFor(open ? owner : undefined)
  const [pendingFor, setPendingFor] = useState(undefined)
  const pending = pendingFor === owner
  // null = not attempted yet; a number once a mine WRITE succeeded
  // (0 is a real, distinct outcome -- already in the deck, or a stale
  // reference -- shown differently from a successful add); 'error' when
  // the request itself failed (network, validation), distinct from both.
  const [result, setResult] = useState(null)
  const outcome = result?.owner === owner ? result.outcome : null
  // The outcome used to REPLACE the button, permanently. A learner who
  // added 猫 to "N5 words" and then wanted it in "Animals" too had no
  // control left to press until the page reloaded -- and useMining
  // remembers the last target per kind, so the second add would have
  // gone somewhere else on purpose.
  //
  // Now: the outcome sits next to a button that stays. Pressing again
  // opens the deck picker rather than repeating the remembered target,
  // because a second add is by definition a different deck.
  const addedOnce = result?.owner === owner && result.added

  async function mine(deckId) {
    // The owner this press was made for, held across the await: a
    // result lands on the entry it was about, whichever is shown now.
    const at = owner
    setPendingFor(at)
    setPickerFor(undefined)
    try {
      const count = await onMine(deckId)
      setResult({ owner: at, outcome: typeof count === 'number' ? count : 1, added: true })
    } catch {
      setResult(prev => ({ owner: at, outcome: 'error', added: prev?.owner === at && prev.added }))
    } finally {
      setPendingFor(p => (p === at ? undefined : p))
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
