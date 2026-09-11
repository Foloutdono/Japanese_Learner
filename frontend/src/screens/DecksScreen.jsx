import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { useTodaySummary } from '../stores/today'
import { Bar } from '../components/chrome/Bar'
import { Console, ConsoleTop, Chips, Chip, ConsoleAction, ConsoleIndex } from '../components/chrome/Console'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { deckTypes, deckTypeOf } from '../components/decks/deckTypes'
import { LibraryShelf } from '../components/decks/LibraryShelf'
import { dueByDeck } from '../domain/lanes'
import { BooksIcon, CrossIcon, PlusIcon } from '../components/ui/Icons'

// ── 教材 — the shelf (plan 071) ───────────────────────────────
// /learn/decks on the canvas: the bar with the one creating action in
// its aside, the console (type chips, the index field, the count),
// the create form when it is open, and a platform card per deck —
// the type's glyph in the roundel, the name, the type and today's due
// count, the card count in the aside. A card is one tap into the
// deck's own page, which is where its actions live now.
//
// Filtering happens entirely in the browser: /api/decks returns the
// whole shelf in one request (one row per deck, not per card), so a
// search endpoint would be a round trip to re-sort a list already in
// hand. The due counts are the shared today store's personal lanes.

export default function DecksScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const today = useTodaySummary().data

  // Type identity (pigment + glyph) lives in components/decks/
  // deckTypes.js so this screen and DeckDetailScreen show the same
  // deck the same way.
  const DECK_TYPES = deckTypes(t)

  const [decks, setDecks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('standard')
  const [query, setQuery]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const searchRef = useRef(null)

  function fetchDecks() {
    setLoading(true)
    apiFetch('/api/decks', session)
      .then(r => r.json())
      .then(data => { setDecks(data.decks || []); setLoading(false) })
      // A failed request settles into the empty shelf rather than a
      // wait that never ends.
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchDecks() is the shelf's initial load, not a state reset.
    fetchDecks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function createDeck() {
    if (!newName.trim()) return
    apiFetch('/api/decks', session, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim(), type: newType }),
    })
      .then(r => r.json())
      .then(deck => {
        if (deck?.error || deck?.detail) return
        setDecks(prev => [{ ...deck, card_count: 0 }, ...prev])
        setNewName('')
        setCreating(false)
      })
      .catch(() => {})
  }

  // Only the types actually on the shelf get a chip: a filter for a
  // structure you own no decks of can only ever return nothing.
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
      const label = deckTypeOf(d.type, t).label.toLowerCase()
      return d.name.toLowerCase().includes(q) || label.includes(q)
    })
  }, [decks, query, typeFilter, t])

  const due = dueByDeck(today)

  function clearFilters() {
    playUi('click-mode-selection')
    setQuery('')
    setTypeFilter('all')
    searchRef.current?.focus()
  }

  const countLabel = shown.length === 1 ? t.decksCountOne : t.decksCount.replace('{n}', shown.length)

  return (
    <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
      <Bar
        code="KZ"
        color="var(--line-decks)"
        title={t.decks}
        aside={creating ? (
          <Chip onClick={() => { playUi('click-mode-selection'); setCreating(false) }}>
            <CrossIcon size={14} />{t.cancel}
          </Chip>
        ) : (
          <ConsoleAction onClick={() => { playUi('click-mode-selection'); setCreating(true) }}>
            <PlusIcon size={14} />{t.createDeck}
          </ConsoleAction>
        )}
      />

      <Console>
        <ConsoleTop>
          <Chips label={t.decksAllTypes}>
            <Chip on={typeFilter === 'all'} color="var(--line-decks)" onClick={() => { playUi('click-mode-selection'); setTypeFilter('all') }}>
              {t.decksAllTypes}
            </Chip>
            {presentTypes.map(dt => (
              <Chip key={dt.value} on={typeFilter === dt.value} glyph={dt.glyph} color={dt.color}
                onClick={() => { playUi('click-mode-selection'); setTypeFilter(dt.value) }}>
                {dt.label}
              </Chip>
            ))}
          </Chips>
        </ConsoleTop>
        <ConsoleIndex
          inputRef={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onClear={() => { setQuery(''); searchRef.current?.focus() }}
          placeholder={t.decksSearchPlaceholder}
          clearLabel={t.cancel}
          count={loading ? undefined : countLabel}
        />
      </Console>

      {creating && (
        <div className="form">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createDeck()}
            placeholder={t.deckNamePlaceholder}
            autoFocus
            className="field"
            aria-label={t.deckNamePlaceholder}
          />
          <div className="type-list" role="radiogroup" aria-label={t.createDeck}>
            {DECK_TYPES.map(dt => {
              const on = newType === dt.value
              return (
                <button
                  key={dt.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`type-row${on ? ' type-row--on' : ''}`}
                  onClick={() => { playUi('click-mode-selection'); setNewType(dt.value) }}
                >
                  <span className="chip__glyph type-row__glyph" lang="ja" aria-hidden="true" style={{ '--tab-color': dt.color }}>{dt.glyph}</span>
                  <span className="type-row__names">
                    <span className="type-row__label">{dt.label}</span>
                    <span className="type-row__desc">{dt.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={createDeck} className="btn-primary" disabled={!newName.trim()}>
            {t.createDeck}
          </button>
        </div>
      )}

      {loading && <Loading />}

      {!loading && decks.length === 0 && (
        <Empty icon={<BooksIcon size={40} />} message={t.noDecks} hint={t.createFirstDeck} />
      )}

      {!loading && decks.length > 0 && shown.length === 0 && (
        <Empty
          icon={<BooksIcon size={40} />}
          message={t.decksNoMatch}
          hint={t.decksNoMatchHint}
          action={{ label: t.decksClearFilters, onClick: clearFilters }}
        />
      )}

      {!loading && shown.length > 0 && (
        <div className="platform-grid">
          {shown.map(deck => {
            const dt = deckTypeOf(deck.type, t)
            const n = due.get(String(deck.id)) ?? 0
            return (
              <button
                key={deck.id}
                type="button"
                className="platform-card deck-card"
                style={{ '--rail': dt.color, '--line-color': dt.color }}
                onClick={() => { playUi('click-mode-selection'); navigate(`/learn/decks/${deck.id}`, { state: { deck } }) }}
              >
                <span className="platform-card__lead deck-card__lead">
                  <span className="wmap-roundel deck-card__glyph" lang="ja" aria-hidden="true">{dt.glyph}</span>
                </span>
                <span className="platform-card__body">
                  <span className="platform-card__title">{deck.name}</span>
                  <span className="platform-card__desc">
                    {dt.label}
                    {/* A followed deck looks exactly like one of your
                        own on this shelf otherwise, and the difference
                        matters: you cannot edit it, and its cards can
                        change under you. */}
                    {deck.author && <> · <span className="lib-card__author">{t.libraryBy(deck.author)}</span></>}
                    {n > 0 && <> · <span className="deck-card__due">{t.todayDue(n)}</span></>}
                  </span>
                </span>
                <span className="platform-card__aside deck-card__aside">
                  <span className="deck-card__count"><b className="deck-card__fig">{deck.card_count ?? 0}</b><span className="deck-card__unit">{t.cards}</span></span>
                </span>
                <span className="platform-card__go" aria-hidden="true">▶</span>
              </button>
            )
          })}
        </div>
      )}

      {/* The library, below your own decks — which is where it was
          asked for. It prints nothing at all while empty, so a learner
          with no decks still meets one empty state and not two. */}
      <LibraryShelf session={session} t={t} />
    </main>
  )
}
