import { useMineAction, INERT_MINING } from './useMineAction'

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
// `className` replaces the default look outright (FocusCard prints the
// card's one filled action as `.btn-primary`) — the outcome text and the
// disabled note keep their own classes either way.
//
// `mining` is a useMining(session) instance, shared by every mine
// control on the screen -- undefined is a valid, deliberate value
// (ReadingRun.jsx doesn't create one), in which case this renders
// nothing at all rather than a broken control.
//
// `ariaLabel` makes the button an icon: `label` is then a glyph that
// stays put after a successful add (the dictionary plate's `+` ghost),
// and the words — "add", then "add to another deck" — move to the
// accessible name and the tooltip, where a roundel keeps them.
export function MineButton({ mining, kind, disabled, disabledReason, label, successLabel, onMine, t, className = '', ariaLabel }) {
  // Hooks before the early returns: `mining` undefined is a valid,
  // deliberate value (see above), answered by rendering nothing.
  const act = useMineAction({ mining: mining ?? INERT_MINING, kind, onMine, t, successLabel })

  if (!mining) return null

  if (disabled) {
    return (
      <span className="analysis-mine-btn analysis-mine-btn--disabled" title={disabledReason}>
        {label ?? (t.mineToDeck ?? 'Mine')}
      </span>
    )
  }

  const words = act.addedOnce
    ? (t.addToAnotherDeck ?? 'Add to another deck')
    : (ariaLabel ?? label ?? (t.mineToDeck ?? 'Mine'))

  return (
    <>
      <button
        onClick={act.press}
        disabled={act.pending}
        className={className || 'analysis-mine-btn'}
        aria-label={ariaLabel ? words : undefined}
        title={ariaLabel ? words : undefined}
      >
        {ariaLabel ? label : words}
      </button>
      {act.outcomeText !== null && (
        <span className={act.outcomeClassName}>{act.outcomeText}</span>
      )}
      {act.picker}
    </>
  )
}
