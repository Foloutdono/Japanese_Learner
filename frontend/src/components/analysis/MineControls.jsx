import { useState } from 'react'
import { MineButton } from './MineButton'

// ── One action, and a panel for the rest ──────────────────
// The Token card used to show two mine buttons side by side: "Mine" and
// "Make a cloze". Reported as confusing, and fairly: "mine" is
// SRS jargon and "cloze" is linguistics jargon, so the primary action on
// the screen was two words a learner has no reason to know.
//
// Now: one plain "Add to deck", which does the obvious thing (adds this
// word), and a settings disclosure holding the variant -- named for what
// it DOES ("fill-in-the-blank") and explained in a sentence, rather than
// named for what it is called.
//
// Both still go through MineButton, which owns deck targeting, the deck
// picker, and the add/already-there/failed outcomes. This component only
// decides what is offered and what it is called.
export function MineControls({ mining, t, word, sentenceText, buildCloze, onMineVocab }) {
  const [showOptions, setShowOptions] = useState(false)

  if (!mining) return null

  const canCloze = Boolean(word.vocab_match) && Boolean(sentenceText)
  const offDeck = !word.vocab_match

  return (
    <div className="anl-mine">
      <div className="anl-mine__row">
        <MineButton
          mining={mining}
          kind="vocab"
          disabled={offDeck}
          disabledReason={t.cannotMineOffDeck}
          label={t.addToDeck}
          onMine={offDeck ? undefined : onMineVocab}
          t={t}
        />
        {canCloze && (
          <button
            type="button"
            className="anl-mine__options"
            aria-expanded={showOptions}
            title={t.cardOptions}
            onClick={() => setShowOptions(o => !o)}
          >
            {t.cardOptions}
          </button>
        )}
      </div>

      {showOptions && canCloze && (
        <div className="anl-mine__panel">
          <p className="anl-mine__explain">{t.clozeExplain}</p>
          <MineButton
            mining={mining}
            kind="cloze"
            label={t.addCloze}
            successLabel={t.clozeCreated}
            onMine={deckId => {
              const { front, back, notes } = buildCloze(sentenceText, word)
              return mining.mineCloze({ deckId, front, back, notes })
            }}
            t={t}
          />
        </div>
      )}
    </div>
  )
}
