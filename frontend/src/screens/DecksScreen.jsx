import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import EmptyState from '../components/EmptyState'
import { Loading } from '../components/Loading'

export default function DecksScreen({ session }) {
  const navigate  = useNavigate()
  const { t }     = useLang()

  // Colors pulled from the app's real theme palette (index.css :root)
  // instead of the generic purple/cyan/pink placeholders this used to
  // have — accent = kanji's own rust-red, accent4 a cool blue for
  // vocab, accent6 a teal for grammar, accent3 a muted mauve for pure
  // hand cards, accent2 (gold) for the unrestricted "anything goes"
  // option. Using the CSS vars directly (not their hex values) means
  // these also follow the light/dark theme switch automatically.
  const DECK_TYPES = [
    { value: 'mixed',     label: t.mixedType,     desc: t.mixedDesc,     color: 'var(--accent2)' },
    { value: 'flashcard', label: t.flashcardType, desc: t.flashcardDesc, color: 'var(--accent3)' },
    { value: 'vocab',     label: t.vocabType,     desc: t.deckVocabDesc, color: 'var(--accent4)' },
    { value: 'kanji',     label: t.kanjiType,     desc: t.deckKanjiDesc, color: 'var(--accent)'  },
    { value: 'grammar',   label: t.grammarType,   desc: t.deckGrammarDesc, color: 'var(--accent6)' },
  ]

  const typeColor = type => DECK_TYPES.find(d => d.value === type)?.color ?? 'var(--accent2)'
  const typeLabel = type => DECK_TYPES.find(d => d.value === type)?.label ?? type

  const [decks, setDecks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('mixed')

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  useEffect(() => { fetchDecks() }, [])

  function fetchDecks() {
    setLoading(true)
    apiFetch('/api/decks', session)
      .then(r => r.json())
      .then(data => { setDecks(data.decks || []); setLoading(false) })
      // Without this, a failed/unreachable request left `loading` true
      // forever — the spinner just spun with no way out. Falls back to
      // an empty list (→ the "no decks yet" EmptyState) instead.
      .catch(() => setLoading(false))
  }

  function createDeck() {
    if (!newName.trim()) return
    apiFetch('/api/decks', session, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    })
      .then(r => r.json())
      .then(deck => {
        setDecks(prev => [{ ...deck, card_count: 0 }, ...prev])
        setNewName('')
        setCreating(false)
      })
  }

  function deleteDeck(id, name) {
    if (!confirm(`${t.delete} "${name}"?`)) return
    apiFetch(`/api/decks/${id}`, session, { method: 'DELETE' })
      .then(() => setDecks(prev => prev.filter(d => d.id !== id)))
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.decks} autoHide />

      <div className="container page-pad">

        <div className="decks-toolbar">
          <button onClick={() => setCreating(c => !c)} className="btn-primary-purple decks-toolbar__btn">
            {creating ? t.cancel : t.createDeck}
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="card decks-create-card">
            <div className="decks-create-card__title">{t.createDeck}</div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createDeck()}
              placeholder={t.deckNamePlaceholder}
              autoFocus
              className="decks-create-input"
            />
            <div className="decks-type-row">
              {DECK_TYPES.map(dt => (
                <button
                  key={dt.value}
                  onClick={() => setNewType(dt.value)}
                  className={`decks-type-btn${newType === dt.value ? ' decks-type-btn--active' : ''}`}
                  style={{ '--type-color': dt.color }}
                >
                  {dt.label}
                  <div className="decks-type-btn__desc">{dt.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={createDeck} className="btn-primary-purple decks-create-submit">
              {t.createDeck}
            </button>
          </div>
        )}

        {loading && <Loading />}

        {!loading && decks.length === 0 && (
          <EmptyState icon="📚" message={t.noDecks} hint={t.createFirstDeck} />
        )}

        {!loading && decks.length > 0 && (
          <div className="grid-3">
            {decks.map(deck => (
              <div key={deck.id} className="card deck-card" style={{ '--type-color': typeColor(deck.type) }}>
                <div className="deck-card__header">
                  <div>
                    <div className="deck-card__name">{deck.name}</div>
                    <div className="deck-card__type">
                      {typeLabel(deck.type)}
                    </div>
                  </div>
                  <button onClick={() => deleteDeck(deck.id, deck.name)} className="deck-card__delete">
                    🗑
                  </button>
                </div>
                <div className="deck-card__count">
                  {deck.card_count} {t.cards}
                </div>
                <div className="deck-card__actions">
                  <button
                    onClick={() => navigate(`/decks/${deck.id}`, { state: { deck } })}
                    className="deck-card__edit-btn">
                    {t.edit}
                  </button>
                  <button
                    onClick={() => navigate(`/decks/${deck.id}/study`, { state: { deck } })}
                    className="deck-card__study-btn">
                    {t.study}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}