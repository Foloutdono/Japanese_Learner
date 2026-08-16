import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import EmptyState from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import { deckTypes, deckTypeOf } from '../components/decks/deckTypes'
import { TrashIcon, PencilIcon, PlayIcon, BooksIcon } from '../components/ui/Icons'

export default function DecksScreen({ session }) {
  const navigate  = useNavigate()
  const { t }     = useLang()

  // Type identity (pigment + glyph) lives in components/decks/
  // deckTypes.js so this screen and DeckDetailScreen show the same
  // deck the same way — see that file for why a kanji deck is
  // wisteria and not whatever accent was spare.
  const DECK_TYPES = deckTypes(t)

  const [decks, setDecks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('mixed')
  // Which deck is currently asking "delete?" in place. Replaces the
  // native confirm() this screen used to throw.
  const [confirmingId, setConfirmingId] = useState(null)

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

  function deleteDeck(id) {
    playUi('click-screen-selection')
    setConfirmingId(null)
    apiFetch(`/api/decks/${id}`, session, { method: 'DELETE' })
      .then(() => setDecks(prev => prev.filter(d => d.id !== id)))
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.decks} autoHide />

      <div className="container page-pad">
        <StationHeader />

        <div className="decks-toolbar">
          <button
            onClick={() => { playUi('click-mode-selection'); setCreating(c => !c) }}
            className="btn-deck-primary decks-toolbar__btn"
          >
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
                  onClick={() => { playUi('click-mode-selection'); setNewType(dt.value) }}
                  className={`decks-type-btn${newType === dt.value ? ' decks-type-btn--active' : ''}`}
                  style={{ '--type-color': dt.color }}
                >
                  <span className="decks-type-btn__glyph" lang="ja" aria-hidden="true">{dt.glyph}</span>
                  <span className="decks-type-btn__label">{dt.label}</span>
                  <span className="decks-type-btn__desc">{dt.desc}</span>
                </button>
              ))}
            </div>
            <button onClick={createDeck} className="btn-deck-primary decks-create-submit">
              {t.createDeck}
            </button>
          </div>
        )}

        {loading && <Loading />}

        {!loading && decks.length === 0 && (
          <EmptyState icon={<BooksIcon size={40} />} message={t.noDecks} hint={t.createFirstDeck} />
        )}

        {!loading && decks.length > 0 && (
          /* Same grid and the same card object as every other choice in
             the app (see ModeSelector / .platform-card): a coloured
             rail, the roundel, then the name. A deck used to be a plain
             web card in a rigid 3-column grid — the one list in the app
             that didn't look like the app. */
          <div className="platform-grid decks-grid">
            {decks.map(deck => {
              const dt = deckTypeOf(deck.type, t)
              return (
              <div
                key={deck.id}
                className="platform-card deck-card"
                style={{ '--rail': dt.color }}
              >
                {/* Roundel only. The type's name goes in the body
                    below, not under the roundel where .platform-card__
                    unit lives — that slot is 72px wide, sized for 番線,
                    and "Vocabulaire" spilled straight out of it. */}
                <span className="platform-card__lead">
                  <span className="platform-card__no deck-card__glyph" lang="ja">{dt.glyph}</span>
                </span>

                <span className="platform-card__body deck-card__body">
                  <span className="platform-card__title">{deck.name}</span>
                  <span className="platform-card__desc">
                    <span className="deck-card__type">{dt.label}</span>
                    {' · '}{deck.card_count} {t.cards}
                  </span>

                  {/* The delete question takes over the action row it
                      was triggered from, rather than floating over the
                      card — as an absolutely-positioned chip in the
                      corner it sat on top of the deck's own title. */}
                  {confirmingId === deck.id ? (
                    <span className="deck-card__actions">
                      <span className="deck-card__confirm-q">{t.deleteDeckConfirm}</span>
                      <button onClick={() => deleteDeck(deck.id)} className="deck-card__btn deck-card__btn--danger">
                        <TrashIcon size={14} /> {t.delete}
                      </button>
                      <button
                        onClick={() => { playUi('click-mode-selection'); setConfirmingId(null) }}
                        className="deck-card__btn deck-card__btn--muted">
                        {t.cancel}
                      </button>
                    </span>
                  ) : (
                    <span className="deck-card__actions">
                      <button
                        onClick={() => { playUi('click-mode-selection'); navigate(`/decks/${deck.id}`, { state: { deck } }) }}
                        className="deck-card__btn">
                        <PencilIcon size={14} /> {t.edit}
                      </button>
                      <button
                        onClick={() => { playUi('click-screen-selection'); navigate(`/decks/${deck.id}/study`, { state: { deck } }) }}
                        className="deck-card__btn deck-card__btn--study">
                        <PlayIcon size={14} /> {t.study}
                      </button>
                    </span>
                  )}
                </span>

                {/* Destructive, so it stays a quiet icon in the corner
                    rather than a third button competing with Study.
                    Hidden while its own question is on screen. */}
                {confirmingId !== deck.id && (
                  <button
                    onClick={() => { playUi('click-mode-selection'); setConfirmingId(deck.id) }}
                    className="deck-card__delete"
                    aria-label={t.delete}
                    title={t.delete}
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}