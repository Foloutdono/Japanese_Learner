import { playUi } from '../../lib/audio'
import { deckTypeOf } from './deckTypes'

// ── One published deck, as a shelf card ───────────────────────
// The same `.platform-card` the shelf uses for your own decks, on
// purpose: a deck someone else wrote is still a deck, and giving the
// library its own card shape would say otherwise. What it adds is the
// two figures that only a public deck has — who wrote it, and how many
// people follow it.
//
// Shared by the block under My decks (LibraryShelf) and the library
// screen, rather than each drawing its own row. Every near-copy of a
// component in this app has drifted from its original within two
// features.

export function LibraryCard({ deck, t, onOpen }) {
  const dt = deckTypeOf(deck.type, t)
  const followers = deck.followers ?? 0

  return (
    <button
      type="button"
      className="platform-card deck-card lib-card"
      style={{ '--rail': dt.color, '--line-color': dt.color }}
      onClick={() => { playUi('click-mode-selection'); onOpen(deck) }}
    >
      <span className="platform-card__lead deck-card__lead">
        <span className="wmap-roundel deck-card__glyph" lang="ja" aria-hidden="true">{dt.glyph}</span>
      </span>
      <span className="platform-card__body">
        <span className="platform-card__title">{deck.name}</span>
        <span className="platform-card__desc">
          {dt.label}
          {deck.author && <> · <span className="lib-card__author">{t.libraryBy(deck.author)}</span></>}
        </span>
        {deck.description && (
          <span className="lib-card__blurb">{deck.description}</span>
        )}
      </span>
      <span className="platform-card__aside deck-card__aside">
        <span className="deck-card__count">
          <b className="deck-card__fig">{deck.card_count ?? 0}</b>
          <span className="deck-card__unit">{t.cards}</span>
        </span>
        {followers > 0 && (
          <span className="lib-card__follows">{t.libraryFollowers(followers)}</span>
        )}
      </span>
      <span className="platform-card__go" aria-hidden="true">▶</span>
    </button>
  )
}
