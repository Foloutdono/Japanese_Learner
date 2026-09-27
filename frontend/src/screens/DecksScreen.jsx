import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SplitRow } from '../components/selection/SplitRow'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { useTodaySummary } from '../stores/today'
import { Bar } from '../components/chrome/Bar'
import { Sheet } from '../components/chrome/Sheet'
import { useDesk } from '../hooks/useDesk'
import { Console, ConsoleTop, Chips, Chip, ConsoleAction, ConsoleIndex } from '../components/chrome/Console'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { deckTypes, deckTypeOf } from '../components/decks/deckTypes'
import { dueByDeck } from '../domain/lanes'
import { BooksIcon, CrossIcon, PlusIcon } from '../components/ui/Icons'
import { composing } from '../lib/keyGuards'
import { useRadioWalk, radioTab } from '../hooks/useRadioWalk'
import { useListWalk, useFollowFocus, WALK_KEYS } from '../hooks/useListWalk'
import { StationSplit } from '../components/selection/StationSplit'
import DeckDetailScreen from './DeckDetailScreen'

// ── 教材 — the shelf (plan 071) ───────────────────────────────
// /learn/decks on the canvas: the bar, the shelf's two doors under
// it, the console (type chips, the index field, the count), the
// create form when it is open, and a platform card per deck —
// the type's glyph in the roundel, the name, the type and today's due
// count, the card count in the aside. A card is one tap into the
// deck's own page, which is where its actions live now.
//
// The library used to be a three-deck preview shelf under the grid,
// and a shelf of your own is exactly what pushes it off the screen:
// past a handful of decks nobody scrolls far enough to reach it. So
// it is a door instead — beside the one that creates a deck, above
// the grid, at a fixed place that does not move as the shelf grows.
// The preview is no loss: /learn/decks/library draws the same cards
// with the orderings and the paging, and the request the preview cost
// this screen goes with it.
//
// Filtering happens entirely in the browser: /api/decks returns the
// whole shelf in one request (one row per deck, not per card), so a
// search endpoint would be a round trip to re-sort a list already in
// hand. The due counts are the shared today store's personal lanes.
//
// ── 机 — the shelf beside the open deck (plan 154) ──
// The owner's pick B of four drawn layouts (the canvas "Tsuji — the
// shelf (教材) layout"): on the desk the shelf is a list and the open
// deck's page stands beside it, so a deck is opened in place rather than
// left for. Both routes land here (App.jsx), as the library's do: one
// route component for /learn/decks and /learn/decks/:deck_id is what
// keeps the shelf's search, its chip and its focus while the deck beside
// it changes. The bare shelf opens on its first deck. On a phone a deck
// is a screen of its own, as it always was.
export default function DecksScreen({ session }) {
  const { deck_id } = useParams()
  const desk = useDesk()
  if (deck_id && !desk) return <DeckDetailScreen session={session} />
  return <DecksShelf session={session} open={desk ? deck_id ?? null : null} />
}

function DecksShelf({ session, open }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const desk = useDesk()
  const today = useTodaySummary().data

  // Type identity (pigment + glyph) lives in components/decks/
  // deckTypes.js so this screen and DeckDetailScreen show the same
  // deck the same way.
  const DECK_TYPES = deckTypes(t)

  const [decks, setDecks]       = useState([])
  const [loading, setLoading]   = useState(true)
  // The gate's New deck (plan 132) arrives with the form asked for.
  const location = useLocation()
  const [creating, setCreating] = useState(() => Boolean(location.state?.create))
  const [newName, setNewName]   = useState('')
  const [newType, setNewType]   = useState('standard')
  const [query, setQuery]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const searchRef = useRef(null)
  // The deck's type, one tab stop walked with the arrows on the desk
  // (plan 123), where the form is a dialog.
  const onWalkTypes = useRadioWalk(desk)
  // The shelf beside the open deck is one tab stop, walked with ↑/↓,
  // as the library's is (plan 123).
  const onShelfWalk = useListWalk(desk)
  const shelfRef = useRef(null)
  useFollowFocus(shelfRef, open, desk)

  // `quiet` asks again without the wait: the shelf beside an open deck
  // (plan 154) refreshes under it rather than blanking to a loader.
  function fetchDecks({ quiet = false } = {}) {
    if (!quiet) setLoading(true)
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
        // 机 (plan 123): the desk keeps the new deck's dialog because
        // it ends on the deck it made: its page, its first card's form
        // open. Beside the shelf since plan 154, so the shelf takes the
        // deck in first, clear of anything that would filter it out.
        if (desk) {
          const made = { ...deck, card_count: 0, role: deck.role ?? 'owner' }
          setDecks(prev => [made, ...prev])
          setCreating(false)
          setNewName('')
          setQuery('')
          setTypeFilter('all')
          navigate(`/learn/decks/${deck.id}`, { state: { deck: made, add: true } })
          return
        }
        setDecks(prev => [{ ...deck, card_count: 0 }, ...prev])
        setNewName('')
        setCreating(false)
        // The new deck must be on the shelf it was made from: a type
        // chip or a query still in force would filter it out, and the
        // form would close on nothing (plan 123).
        setQuery('')
        setTypeFilter('all')
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

  // What the open deck tells the shelf beside it (plan 154): its card
  // count as cards come and go, and that it has left the shelf --
  // deleted, unfollowed -- or brought a copy onto it. A deck that went
  // is dropped at once, before the bare shelf's redirect (below) can
  // land on it again, and the shelf is asked again under the page.
  const onCount = useCallback((id, n) => {
    setDecks(prev => prev.map(d => (String(d.id) === String(id) && d.card_count !== n ? { ...d, card_count: n } : d)))
  }, [])
  const onGone = useCallback(id => {
    setDecks(prev => prev.filter(d => String(d.id) !== String(id)))
    fetchDecks({ quiet: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onChanged = useCallback(() => fetchDecks({ quiet: true }), [])  // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    playUi('click-mode-selection')
    setQuery('')
    setTypeFilter('all')
    searchRef.current?.focus()
  }

  const countLabel = shown.length === 1 ? t.decksCountOne : t.decksCount.replace('{n}', shown.length)

  // A phone opens the form in the page, under the doors; the desk opens
  // it as a dialog over the shelf (plan 114), so the shelf does not
  // move to make room for a form and back.
  const createForm = (
    <div className="form">
      <input
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !composing(e) && createDeck()}
        placeholder={t.deckNamePlaceholder}
        autoFocus
        className="field"
        aria-label={t.deckNamePlaceholder}
      />
      <div className="type-list" role="radiogroup" aria-label={t.createDeck} onKeyDown={onWalkTypes}>
        {DECK_TYPES.map((dt, i) => {
          const on = newType === dt.value
          return (
            <button
              key={dt.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={radioTab(desk, i, DECK_TYPES.findIndex(d => d.value === newType))}
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
  )

  // The console: the type chips, the index field, the count. The same
  // object on a phone's page and at the head of the desk's list.
  const console_ = (
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
  )

  const noMatch = (
    <Empty
      icon={<BooksIcon size={40} />}
      message={t.decksNoMatch}
      hint={t.decksNoMatchHint}
      action={{ label: t.decksClearFilters, onClick: clearFilters }}
    />
  )

  // A deck on the shelf: the type's glyph in the roundel, the name, the
  // type and today's due count, the card count in the aside. On a phone
  // one tap into the deck's own page; on the desk (plan 154) a link that
  // opens the deck beside the list, replacing the page as a split's row
  // does, the open one marked the way a split marks it.
  function deckRow(deck, { isOpen = false, tabIndex } = {}) {
    const dt = deckTypeOf(deck.type, t)
    const n = due.get(String(deck.id)) ?? 0
    return (
      <SplitRow
        key={deck.id}
        to={desk ? `/learn/decks/${deck.id}` : undefined}
        state={{ deck }}
        className={`platform-card deck-card${isOpen ? ' desk-stop--open' : ''}`}
        aria-current={isOpen ? 'page' : undefined}
        tabIndex={tabIndex}
        style={{ '--rail': dt.color, '--line-color': dt.color }}
        onClick={() => { playUi('click-mode-selection'); if (!desk) navigate(`/learn/decks/${deck.id}`, { state: { deck } }) }}
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
      </SplitRow>
    )
  }

  const browseDoor = (
    <Chip
      aria-pressed={undefined}
      to={desk ? '/learn/decks/library' : undefined}
      onClick={() => { playUi('click-mode-selection'); if (!desk) navigate('/learn/decks/library') }}
    >
      <BooksIcon size={14} />{t.libraryBrowse}
    </Chip>
  )

  const createSheet = desk && (
    <Sheet open={creating} onClose={() => setCreating(false)} jp="教材" cap={t.createDeck} label={t.createDeck} dismiss>
      {createForm}
    </Sheet>
  )

  // 机 (plan 154): the shelf as a list and the open deck as the page
  // beside it, drawn as the owner's pick B: the index field over the
  // types as glyph chips with their counts, a row per deck -- its glyph,
  // its name, its cards (and whose it is), what it is due -- and the
  // two doors at the list's foot. The bare shelf opens on its first
  // deck. A shelf still loading, or with no deck on it, keeps the
  // one-column page below: there is nothing to stand beside it.
  if (desk && !loading && decks.length > 0) {
    if (!open) return <Navigate replace to={`/learn/decks/${decks[0].id}`} />
    const listed = shown.some(d => String(d.id) === String(open))
    const typeCount = type => decks.filter(d => d.type === type).length
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        <Bar code="KZ" color="var(--line-decks)" title={t.decks} />
        <StationSplit
          className="desk-split--decks"
          label={t.decks}
          list={(
            <>
              <Console className="shelf-console">
                <ConsoleIndex
                  inputRef={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onClear={() => { setQuery(''); searchRef.current?.focus() }}
                  placeholder={t.decksSearchPlaceholder}
                  clearLabel={t.cancel}
                  aria-label={t.decksSearchPlaceholder}
                  count={String(shown.length)}
                />
                <ConsoleTop>
                  <Chips label={t.decksAllTypes}>
                    <Chip on={typeFilter === 'all'} color="var(--line-decks)" onClick={() => { playUi('click-mode-selection'); setTypeFilter('all') }}>
                      {t.decksAllTypes}
                    </Chip>
                    {presentTypes.map(dt => (
                      <Chip key={dt.value} on={typeFilter === dt.value} glyph={dt.glyph} color={dt.color}
                        aria-label={`${dt.label} · ${typeCount(dt.value)}`} title={dt.label}
                        onClick={() => { playUi('click-mode-selection'); setTypeFilter(dt.value) }}>
                        <span className="shelf-console__n">{typeCount(dt.value)}</span>
                      </Chip>
                    ))}
                  </Chips>
                </ConsoleTop>
              </Console>
              {shown.length === 0 && noMatch}
              {shown.length > 0 && (
                <div className="shelf-rows" ref={shelfRef} onKeyDown={onShelfWalk} aria-keyshortcuts={WALK_KEYS}>
                  {shown.map((deck, i) => {
                    const isOpen = String(deck.id) === String(open)
                    const dt = deckTypeOf(deck.type, t)
                    const n = due.get(String(deck.id)) ?? 0
                    return (
                      <SplitRow
                        key={deck.id}
                        to={`/learn/decks/${deck.id}`}
                        state={{ deck }}
                        className={`shelf-row${isOpen ? ' shelf-row--open' : ''}`}
                        aria-current={isOpen ? 'page' : undefined}
                        tabIndex={(listed ? isOpen : i === 0) ? 0 : -1}
                        style={{ '--line-color': dt.color }}
                        onClick={() => playUi('click-mode-selection')}
                      >
                        <span className="wmap-roundel shelf-row__roundel" lang="ja" aria-hidden="true">{dt.glyph}</span>
                        <span className="shelf-row__names">
                          <span className="shelf-row__name">{deck.name}</span>
                          <span className="shelf-row__sub">
                            {t.cardsCount(deck.card_count ?? 0)}
                            {deck.author && <> · {t.libraryBy(deck.author)}</>}
                          </span>
                        </span>
                        {n > 0 && <span className="shelf-row__due" title={t.todayDue(n)}>{n}<span className="sr-only"> {t.todayDue(n)}</span></span>}
                      </SplitRow>
                    )
                  })}
                </div>
              )}
              {/* The shelf's two doors at its foot: the page beside it
                  holds the screen's one filled action, so a new deck is
                  a ghost here. */}
              <div className="decks-doors">
                <Chip className="decks-doors__create" onClick={() => { playUi('click-mode-selection'); setCreating(true) }}>
                  <PlusIcon size={14} />{t.createDeck}
                </Chip>
                {browseDoor}
              </div>
            </>
          )}
        >
          <DeckDetailScreen session={session} deckId={open} pane onCount={onCount} onGone={onGone} onChanged={onChanged} />
        </StationSplit>
        {createSheet}
      </main>
    )
  }

  return (
    <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
      <Bar code="KZ" color="var(--line-decks)" title={t.decks} />

      {/* The two doors. Browse holds its place while the create form
          is open — only the door it opened turns into the way out, so
          the row keeps its shape rather than collapsing to one button
          and back. It is a destination and not a filter, hence no
          pressed state for the Chip to report: the same note
          PracticeScreen's level chips carry. */}
      <div className="decks-doors">
        {browseDoor}
        {/* On the desk the form is a dialog (below), which closes
            itself: the door stays "+ New deck". */}
        {creating && !desk ? (
          <Chip onClick={() => { playUi('click-mode-selection'); setCreating(false) }}>
            <CrossIcon size={14} />{t.cancel}
          </Chip>
        ) : (
          <ConsoleAction onClick={() => { playUi('click-mode-selection'); setCreating(true) }}>
            <PlusIcon size={14} />{t.createDeck}
          </ConsoleAction>
        )}
      </div>

      {console_}

      {creating && !desk && createForm}

      {loading && <Loading />}

      {!loading && decks.length === 0 && (
        <Empty icon={<BooksIcon size={40} />} message={t.noDecks} hint={t.createFirstDeck} />
      )}

      {!loading && decks.length > 0 && shown.length === 0 && noMatch}

      {!loading && shown.length > 0 && (
        <div className="platform-grid">
          {shown.map(deck => deckRow(deck))}
        </div>
      )}
      {createSheet}
    </main>
  )
}
