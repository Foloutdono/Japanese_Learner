import { useState } from 'react'
import { Sheet } from '../chrome/Sheet'
import { PlusIcon, BooksIcon } from '../ui/Icons'
import { composing } from '../../lib/keyGuards'
import { deckTypeOf } from '../decks/deckTypes'

// Which deck to mine into, when none is remembered yet for this kind.
// Only ever offered decks that take it -- the matching type, or a mixed
// deck (see useMining.js's DECK_TYPE_FOR_KIND) -- a mismatched deck would
// make add_app_cards silently skip the card, which reads as "nothing
// happened".
//
// A bottom sheet (canvas DeckPickerSheet, plan 073): one row per deck
// with its type's roundel, its name and its card count, and a New
// deck row that opens a field. `currentId` (optional) marks the deck
// a press outside the picker would have targeted — the remembered
// deck for this kind — so the list answers "where did my last one go"
// at a glance. Each row wears its deck type's roundel, the shelf's own
// (components/decks/deckTypes.js), so a mixed deck reads as one here too.

export function DeckPicker({ decks, t, onClose, onSelect, onCreate, currentId = null, word }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function submitCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
  }

  return (
    <Sheet open onClose={onClose} title={t.chooseDeck} sub={word} icon={BooksIcon} line="var(--line-decks)" label={t.chooseDeck} dismiss>
      <div className="surface picker">
        {decks.length === 0 && (
          <p className="hint picker__empty">{t.noDeckOfType}</p>
        )}
        {decks.map(d => {
          const current = d.id === currentId
          const count = d.card_count ?? d.cardCount
          const dt = deckTypeOf(d.type, t)
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              className={`picker-row${current ? ' picker-row--current' : ''}`}
              aria-current={current ? 'true' : undefined}
            >
              <span
                className="wmap-roundel picker-row__roundel"
                style={{ '--line-color': dt.color }}
                lang="ja"
                aria-hidden="true"
              >
                {dt.glyph}
              </span>
              <span className="picker-row__name" lang="ja">{d.name}</span>
              <span className="picker-row__count">
                {count != null ? t.cardsUnit(count) : ''}
                {current && <span className="picker-row__mark" aria-hidden="true"> ✓</span>}
              </span>
            </button>
          )
        })}
        {creating ? (
          <div className="picker-row picker-row--create">
            <input
              className="field"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !composing(e) && submitCreate()}
              placeholder={t.createDeck}
              aria-label={t.createDeck}
              autoFocus
            />
            <button type="button" onClick={submitCreate} disabled={!name.trim()} className="btn-primary picker-row__create">
              {t.createDeck}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="picker-row picker-row--new">
            <PlusIcon size={16} />
            <span className="picker-row__name picker-row__name--latin">{t.newDeck}</span>
          </button>
        )}
      </div>
    </Sheet>
  )
}
