import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { track } from '../../lib/track'
import { dueByDeck } from '../../domain/lanes'
import { deckTypeOf } from './deckTypes'
import { DueChip } from '../station/LinePlate'
import { Loading } from '../ui/Loading'
import { ChevronIcon, PlusIcon, SearchIcon } from '../ui/Icons'

// ── 棚 — the shelf and the library beside the lines (plan 131) ──────
// The owner's pick of three drawn layouts ("A · 本線と棚"): on the desk
// the Learn gate is the four lines on the left and a column on the right
// at the dictionary entry's width, holding the learner's decks over the
// library. Before it the decks were a fifth plate with nothing in it and
// the library was two screens away, behind the shelf's Browse door.
//
// Three pieces, all desk-only (the phone keeps its fifth plate):
//   DeckShelfPanel — every deck on the shelf, owned or followed, a row
//     each with what it is due, and the way to make another.
//   LibraryPanel   — the library's most followed or newest three, a
//     Follow on each, and a search field that opens the library on its
//     answer. A row opens its PREVIEW in the panel's place.
//   DeckPreview    — one published deck judged at a glance: who wrote
//     it, three of its cards as tiles, its blurb, Follow and the way to
//     all its cards. The library screen's À la une draws the same one.

/** A deck's glyph in its structure's pigment, the shelf's own roundel. */
export function DeckRoundel({ type }) {
  const { t } = useLang()
  const dt = deckTypeOf(type, t)
  return (
    <span className="wmap-roundel gate-row__roundel" lang="ja" aria-hidden="true"
      style={{ '--line-color': dt.color }}>{dt.glyph}</span>
  )
}

/** The shelf: owned and followed decks, what each is due, a new one. */
export function DeckShelfPanel({ decks, today, guide }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const due = dueByDeck(today)
  const cards = (decks ?? []).reduce((n, d) => n + (d.card_count ?? 0), 0)
  const total = today?.by_source?.personal ?? 0

  return (
    <section className="gate-panel gate-panel--shelf" aria-labelledby="gate-shelf-title" data-guide={guide}>
      <header className="gate-panel__head">
        <span className="pf-line__roundel plate__roundel" aria-hidden="true">KZ</span>
        <span className="plate__names">
          <h2 id="gate-shelf-title" className="plate__title">{t.decksTitle}</h2>
          {decks?.length > 0 && <span className="plate__meta">{t.decksRowMeta(decks.length, cards)}</span>}
        </span>
        <DueChip due={total} />
      </header>
      <div className="gate-panel__body">
        {decks == null && <Loading />}
        {decks?.length === 0 && (
          <p className="gate-panel__empty"><b>{t.gateShelfEmpty}</b> {t.gateShelfEmptyHint}</p>
        )}
        {decks?.length > 0 && (
          <ul className="gate-rows">
            {decks.map(deck => {
              const dt = deckTypeOf(deck.type, t)
              return (
                <li key={deck.id} className="gate-rows__item">
                  <Link className="gate-row" to={`/learn/decks/${deck.id}`} state={{ deck }}
                    onClick={() => playUi('click-mode-selection')}>
                    <DeckRoundel type={deck.type} />
                    <span className="gate-row__names">
                      <span className="gate-row__name">{deck.name}</span>
                      <span className="gate-row__sub">
                        {dt.label} · {t.cardsCount(deck.card_count ?? 0)}
                        {deck.author && <> · {t.libraryBy(deck.author)}</>}
                        {deck.role === 'owner' && deck.visibility === 'public' && (
                          <> · <span className="gate-row__mine">{t.gateDeckPublished}</span></>
                        )}
                      </span>
                    </span>
                    <DueChip due={due.get(String(deck.id)) ?? 0} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <footer className="gate-panel__foot">
        <button type="button" className="gate-btn gate-btn--line"
          onClick={() => { playUi('click-mode-selection'); navigate('/learn/decks', { state: { create: true } }) }}>
          <PlusIcon size={16} />{t.newDeck}
        </button>
        <Link className="gate-link" to="/learn/decks" onClick={() => playUi('click-mode-selection')}>
          {t.librarySeeAll}<ChevronIcon direction="right" size={16} />
        </Link>
      </footer>
      <span className="plate__stripe" aria-hidden="true"><i style={{ width: '100%' }} /></span>
    </section>
  )
}

const SHOWN = 3

/** The library's head of list, a Follow on each, and its search. */
export function LibraryPanel({ session, onFollowed }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [sort, setSort] = useState('followed')
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const [query, setQuery] = useState('')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    apiJson(`/api/decks/library?sort=${sort}&limit=${SHOWN}`, session)
      .then(data => { if (live) setRows(data?.results ?? []) })
      .catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [sort, session, nonce])

  function followed() {
    setOpen(null)
    setNonce(n => n + 1)
    onFollowed?.()
  }

  function search(e) {
    e.preventDefault()
    const q = query.trim()
    playUi('click-mode-selection')
    navigate(q ? `/learn/decks/library?q=${encodeURIComponent(q)}` : '/learn/decks/library')
  }

  if (open) {
    return (
      <section className="gate-panel gate-panel--library" aria-label={open.name}>
        <DeckPreview deckId={open.id} listed={open} session={session} where="gate"
          onBack={() => { playUi('click-mode-selection'); setOpen(null) }} onFollowed={followed} />
      </section>
    )
  }

  return (
    <section className="gate-panel gate-panel--library" aria-labelledby="gate-library-title">
      <header className="gate-panel__head">
        <span className="pf-line__roundel plate__roundel" lang="ja" aria-hidden="true">書</span>
        <span className="plate__names">
          <h2 id="gate-library-title" className="plate__title">{t.library}</h2>
        </span>
        <span className="gate-seg" role="group" aria-label={t.librarySort}>
          {['followed', 'new'].map(key => (
            <button key={key} type="button" aria-pressed={sort === key}
              onClick={() => { if (sort !== key) { playUi('click-mode-selection'); setRows(null); setSort(key) } }}>
              {key === 'new' ? t.librarySortNew : t.librarySortFollowed}
            </button>
          ))}
        </span>
      </header>
      <div className="gate-panel__body">
        {rows == null && <Loading />}
        {rows?.length === 0 && <p className="gate-panel__empty">{t.libraryEmptyHint}</p>}
        {rows?.length > 0 && (
          <ul className="gate-rows">
            {rows.map(deck => (
              <li key={deck.id} className="gate-rows__item gate-row gate-row--lib">
                <button type="button" className="gate-row__open"
                  onClick={() => { playUi('click-mode-selection'); setOpen(deck) }}>
                  <DeckRoundel type={deck.type} />
                  <span className="gate-row__names">
                    <span className="gate-row__name">{deck.name}</span>
                    <span className="gate-row__sub">
                      {t.cardsCount(deck.card_count)}{deck.author && <> · {t.libraryBy(deck.author)}</>}
                    </span>
                  </span>
                  <span className="gate-row__fig">{t.libraryFollowers(deck.followers ?? 0)}</span>
                </button>
                <FollowButton deck={deck} session={session} where="gate" onFollowed={followed} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <form className="gate-panel__foot" role="search" onSubmit={search}>
        <label className="gate-field">
          <SearchIcon size={16} />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t.decksSearchPlaceholder} aria-label={t.decksSearchPlaceholder} />
        </label>
        <Link className="gate-link" to="/learn/decks/library" onClick={() => playUi('click-mode-selection')}>
          {t.libraryBrowse}<ChevronIcon direction="right" size={16} />
        </Link>
      </form>
    </section>
  )
}

/** Follow, in place: the deck joins the shelf and the caller refreshes. */
export function FollowButton({ deck, session, where, onFollowed, primary = false }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  function follow() {
    if (busy) return
    setBusy(true)
    playUi('click-screen-selection')
    apiJson(`/api/decks/${deck.id}/subscribe`, session, { method: 'POST' })
      .then(() => {
        track('deck_subscribe', { structure: deck.type, cards: deck.card_count, where })
        onFollowed?.(deck)
      })
      .catch(() => setBusy(false))
  }
  return (
    <button type="button" className={primary ? 'btn-primary gate-follow' : 'gate-btn gate-btn--line gate-follow'}
      onClick={follow} disabled={busy}>
      {primary && <PlusIcon size={16} />}{t.libraryFollow}
    </button>
  )
}

/** Three of a deck's cards as tiles: the front, its reading, the back. */
export function DeckSamples({ cards, size = 3 }) {
  const shown = (cards ?? []).slice(0, size)
  if (shown.length === 0) return null
  return (
    <ul className="deck-samples">
      {shown.map((card, i) => (
        <li key={card.id ?? card.raw_id ?? i} className="deck-sample">
          <span className="deck-sample__jp" lang="ja">{card.front}</span>
          {card.kana && card.kana !== card.front && <span className="deck-sample__kana" lang="ja">{card.kana}</span>}
          <span className="deck-sample__back">{card.back}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * One published deck, at a glance (the owner's "À la une" candidate):
 * drawn from its list row at once, its cards when its own answer lands.
 * `onBack` puts a way back to the list at its head (the gate's panel);
 * the library's À la une has nothing to go back to.
 */
export function DeckPreview({ deckId, listed, session, where, onBack, onFollowed }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [deck, setDeck] = useState(null)

  useEffect(() => {
    let live = true
    apiJson(`/api/decks/library/${deckId}`, session)
      .then(data => { if (live) setDeck(data) })
      .catch(() => {})
    return () => { live = false }
  }, [deckId, session])

  const shown = deck ?? listed
  if (!shown) return <Loading />
  const dt = deckTypeOf(shown.type, t)
  const open = `/learn/decks/library/${deckId}`

  return (
    <div className="deck-preview" style={{ '--line-color': dt.color }}>
      {(onBack || shown.followers > 0) && (
        <div className="deck-preview__top">
          {onBack && (
            <button type="button" className="gate-btn gate-btn--sm" onClick={onBack}>
              <ChevronIcon direction="left" size={16} />{t.library}
            </button>
          )}
          {shown.followers > 0 && <span className="gate-row__fig">{t.libraryFollowers(shown.followers)}</span>}
        </div>
      )}
      <div className="deck-preview__who">
        <DeckRoundel type={shown.type} />
        <span className="gate-row__names">
          <h3 className="deck-preview__name">{shown.name}</h3>
          <span className="gate-row__sub">
            {dt.label} · {t.cardsCount(shown.card_count ?? 0)}{shown.author && <> · {t.libraryBy(shown.author)}</>}
          </span>
        </span>
      </div>
      {deck ? <DeckSamples cards={deck.preview} /> : <Loading />}
      {shown.description && <p className="deck-preview__blurb">{shown.description}</p>}
      <div className="deck-preview__actions">
        {deck?.followed
          ? <Link className="btn-primary gate-follow" to={`/learn/decks/${deckId}`}>▶ {t.libraryOpen}</Link>
          : <FollowButton deck={shown} session={session} where={where} primary
              onFollowed={() => (onFollowed ? onFollowed(shown) : navigate(`/learn/decks/${deckId}`))} />}
        <Link className="gate-btn" to={open} onClick={() => playUi('click-mode-selection')}>
          {t.librarySeeCards(shown.card_count ?? 0)}<ChevronIcon direction="right" size={16} />
        </Link>
      </div>
    </div>
  )
}
