import { useState } from 'react'
import { useDialog } from '../../hooks/useDialog'
import { CrossIcon } from '../ui/Icons'

// Which deck to mine into, when none is remembered yet for this kind.
// Only ever offered decks of the matching type (see useMining.js's
// DECK_TYPE_FOR_KIND) -- a mismatched deck would make add_app_cards
// silently skip the card, which reads as "nothing happened".
//
// Reuses the existing detail-overlay-sheet / detail-sheet / phrase-*
// classes rather than introducing new CSS, matching plan 015's
// established convention for this feature area.
export function DeckPicker({ decks, t, onClose, onSelect, onCreate }) {
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
          <div className="detail-title" id="deck-picker-title">{t.chooseDeck ?? 'Choose a deck'}</div>
          <button onClick={onClose} className="detail-close-btn" aria-label={t.close}><CrossIcon size={16} /></button>
        </div>

        <div className="detail-section">
          {decks.length === 0 && (
            <div className="phrase-history-empty">{t.noDeckOfType ?? 'No deck of this type yet'}</div>
          )}
          {decks.map(d => (
            <div key={d.id} onClick={() => onSelect(d.id)} className="phrase-history-row">
              <span>{d.name}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          {creating ? (
            <div className="phrase-input-actions">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitCreate()}
                placeholder={t.createDeck ?? 'New deck name'}
                autoFocus
              />
              <button onClick={submitCreate} disabled={!name.trim()} className="phrase-analyze-btn">
                {t.createDeck ?? 'Create'}
              </button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="phrase-history-toggle">
              {t.createDeck ?? 'Create a deck'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
