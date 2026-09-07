import { useState } from 'react'
import { Sheet } from '../chrome/Sheet'
import { PlusIcon } from '../ui/Icons'

// Which deck to mine into, when none is remembered yet for this kind.
// Only ever offered decks of the matching type (see useMining.js's
// DECK_TYPE_FOR_KIND) -- a mismatched deck would make add_app_cards
// silently skip the card, which reads as "nothing happened".
//
// A bottom sheet (canvas DeckPickerSheet, plan 073): one row per deck
// with its type's roundel, its name and its card count, and a New
// deck row that opens a field. `currentId` (optional) marks the deck
// a press outside the picker would have targeted — the remembered
// deck for this kind — so the list answers "where did my last one go"
// at a glance.

const GLYPH = { vocab: '単', kanji: '漢', grammar: '文' }
const COLOR = { vocab: 'var(--line-vocab)', kanji: 'var(--line-kanji)', grammar: 'var(--line-grammar)' }

export function DeckPicker({ decks, t, onClose, onSelect, onCreate, currentId = null, word }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function submitCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
  }

  return (
    <Sheet open onClose={onClose} jp={word} cap={t.chooseDeck} label={t.chooseDeck}>
      <div className="surface picker">
        {decks.length === 0 && (
          <p className="hint picker__empty">{t.noDeckOfType}</p>
        )}
        {decks.map(d => {
          const current = d.id === currentId
          const count = d.card_count ?? d.cardCount
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
                style={{ '--line-color': COLOR[d.type] ?? 'var(--text-secondary)' }}
                lang="ja"
                aria-hidden="true"
              >
                {GLYPH[d.type] ?? '札'}
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
              onKeyDown={e => e.key === 'Enter' && submitCreate()}
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
