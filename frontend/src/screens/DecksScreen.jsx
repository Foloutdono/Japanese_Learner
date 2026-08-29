import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import EmptyState from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import { deckTypes, deckTypeOf } from '../components/decks/deckTypes'
import { SearchIcon } from '../components/dictionary/DictionaryDetail'
import { TrashIcon, PencilIcon, PlayIcon, BooksIcon, CrossIcon } from '../components/ui/Icons'

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
  // 'mixed' no longer exists as a structure (see deckTypes.js), so a
  // form defaulting to it offered a type the backend would reject.
  const [newType, setNewType]   = useState('standard')
  // Which deck is currently asking "delete?" in place. Replaces the
  // native confirm() this screen used to throw.
  const [confirmingId, setConfirmingId] = useState(null)

  // ── The shelf's index ──────────────────────────────────────
  // Filtering happens entirely in the browser: /api/decks returns the
  // whole shelf in one request (it is one row per deck, not per card),
  // so a search endpoint would be a round trip to re-sort a list
  // already in hand. No debounce needed for the same reason.
  const [query, setQuery]     = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const searchRef = useRef(null)


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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchDecks() is a real network fetch (the shelf's initial load), not a state reset; its setLoading/setDecks calls are the point of this mount-time effect, not something a key-remount could replace.
    fetchDecks()
  }, [])

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

  // Only the types actually on the shelf get a chip. A filter for a
  // structure you own no decks of is a control that can only ever
  // return nothing — and on a shelf of two decks it would be three
  // dead chips out of four.
  const presentTypes = useMemo(() => {
    const owned = new Set(decks.map(d => d.type))
    return DECK_TYPES.filter(dt => owned.has(dt.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, t])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return decks.filter(d => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false
      if (!q) return true
      // Name and type label both, so "kanji" finds every kanji deck
      // whatever its name — the same thing the type chips do, reachable
      // without leaving the field.
      const label = deckTypeOf(d.type, t).label.toLowerCase()
      return d.name.toLowerCase().includes(q) || label.includes(q)
    })
  }, [decks, query, typeFilter, t])

  function clearFilters() {
    playUi('click-mode-selection')
    setQuery('')
    setTypeFilter('all')
    searchRef.current?.focus()
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.decks} autoHide />

      {/* 蘇芳 is injected here, on the content shell, per DESIGN.md's
          "the pigment is injected once": everything below reads
          var(--line-color) rather than naming --line-decks itself.
          StationHeader below is self-closing and a *sibling* of the
          rest, so it tints only itself — without this, the screen's
          primary button would fall back to 仮名's red. It goes on
          <main> rather than on .screen deliberately: the top bar
          carries no line colour at all, and scoping it here makes
          that structural rather than a thing to remember. */}
      <main id="main-content" className="container page-pad"
        style={{ '--line-color': 'var(--line-decks)' }}>
        <StationHeader />

        {/* ── 目録 — the shelf's index ────────────────────────
            One console, the same instrument the dictionary opens with
            (see .dict-console): what you are looking through along the
            top, the field itself across the bottom, and the one action
            that creates rather than finds pinned to the right of the
            top edge where it can't be mistaken for a filter.

            The "Create deck" button used to be a lone right-aligned
            button floating over an otherwise bare page — the only
            control on the screen, and nothing to say what the list
            under it was. */}
        <div className="decks-console">
          <div className="decks-console__top">
            <div className="decks-filter-row">
              <button
                onClick={() => { playUi('click-mode-selection'); setTypeFilter('all') }}
                className={`decks-filter-btn${typeFilter === 'all' ? ' decks-filter-btn--active' : ''}`}
              >
                {t.decksAllTypes}
              </button>
              {presentTypes.map(dt => (
                <button
                  key={dt.value}
                  onClick={() => { playUi('click-mode-selection'); setTypeFilter(dt.value) }}
                  style={{ '--tab-color': dt.color }}
                  className={`decks-filter-btn${typeFilter === dt.value ? ' decks-filter-btn--active' : ''}`}
                >
                  <span className="decks-filter-glyph" lang="ja" aria-hidden="true">{dt.glyph}</span>
                  {dt.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => { playUi('click-mode-selection'); setCreating(c => !c) }}
              className={`decks-console__new${creating ? ' decks-console__new--open' : ''}`}
            >
              {creating ? <><CrossIcon size={12} /> {t.cancel}</> : <>+ {t.createDeck}</>}
            </button>
          </div>

          <div className="decks-index-bar">
            <SearchIcon />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t.decksSearchPlaceholder}
              className="decks-index-bar__input"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); searchRef.current?.focus() }}
                className="decks-index-bar__clear"
                aria-label={t.cancel}
                title={t.cancel}
              >
                <CrossIcon size={12} />
              </button>
            )}
            {!loading && (
              <div className="decks-index-bar__count">
                {shown.length === 1
                  ? t.decksCountOne
                  : t.decksCount.replace('{n}', shown.length)}
              </div>
            )}
          </div>
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

        {/* An empty SHELF and an empty RESULT are different situations
            and used to give the same "no decks yet" message — which,
            with two decks sitting behind a filter, was simply untrue.
            This one offers the way out instead of advice. */}
        {!loading && decks.length > 0 && shown.length === 0 && (
          <EmptyState
            icon={<BooksIcon size={40} />}
            message={t.decksNoMatch}
            hint={t.decksNoMatchHint}
            action={{ label: t.decksClearFilters, onClick: clearFilters }}
          />
        )}

        {!loading && shown.length > 0 && (
          /* Same grid and the same card object as every other choice in
             the app (see ModeSelector / .platform-card): a coloured
             rail, the roundel, then the name. A deck used to be a plain
             web card in a rigid 3-column grid — the one list in the app
             that didn't look like the app. */
          <div className="platform-grid decks-grid">
            {shown.map(deck => {
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
      </main>
    </div>
  )
}