import { useState } from 'react'
import { useDialog } from '../../hooks/useDialog'
import { CrossIcon } from '../ui/Icons'

// Which deck to mine into, when none is remembered yet for this kind.
// Only ever offered decks of the matching type (see useMining.js's
// DECK_TYPE_FOR_KIND) -- a mismatched deck would make add_app_cards
// silently skip the card, which reads as "nothing happened".
//
// The sheet chrome is shared with WordDetail; the CONTENTS are not.
// This used to borrow .detail-title too -- a 40px rule meant for a
// single-kanji headline -- which wrapped "Choisir un deck" onto two
// lines and made the dialog look broken. A dialog title is not a
// specimen, so it has its own modest size now.
//
// `currentId` (optional) marks the deck a press outside the picker
// would have targeted — the remembered deck for this kind — so the
// list answers "where did my last one go" at a glance.
export function DeckPicker({ decks, t, onClose, onSelect, onCreate, currentId = null }) {
  const dialogRef = useDialog(onClose)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function submitCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
  }

  return (
    <div onClick={onClose} className="detail-overlay-sheet">
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="card detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-picker-title"
      >
        <div className="detail-header">
          <h2 className="anl-deckpicker__title" id="deck-picker-title">{t.chooseDeck}</h2>
          <button onClick={onClose} className="detail-close-btn" aria-label={t.close}><CrossIcon size={16} /></button>
        </div>

        <div className="detail-section">
          {decks.length === 0 && (
            <div className="anl-history__empty">{t.noDeckOfType}</div>
          )}
          {decks.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              className={`anl-deckpicker__deck${d.id === currentId ? ' anl-deckpicker__deck--current' : ''}`}
              aria-current={d.id === currentId ? 'true' : undefined}
            >
              <span className="anl-deckpicker__name">{d.name}</span>
              {d.id === currentId && (
                <span className="anl-deckpicker__mark" aria-hidden="true">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="detail-section">
          {creating ? (
            <div className="anl-deckpicker__create">
              <input
                className="field field--panel anl-field"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitCreate()}
                placeholder={t.createDeck}
                autoFocus
              />
              <button onClick={submitCreate} disabled={!name.trim()} className="anl-action">
                {t.createDeck}
              </button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="anl-mine__options">
              {t.createDeck}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
