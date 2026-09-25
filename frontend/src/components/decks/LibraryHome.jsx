import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { deckTypeOf } from './deckTypes'
import { DeckPreview, DeckRoundel } from './GateShelf'
import { Loading } from '../ui/Loading'

// ── 机 — the library before a deck is opened (plan 132) ──────────────
// Beside the library's list on the desk, where the bare library used to
// open its first deck for you: three sections from GET
// /api/decks/library/home.
//
//   À la une — the deck the rule puts first (the most new followers
//     this week), drawn as the gate's preview: three cards, the blurb,
//     Follow.
//   Abonnements — the decks you follow, with the cards their authors
//     added since you last opened each ("+12 cartes"), or "À jour".
//   Tes publications — your public decks, their followers and a bar a
//     week for the last eight.
//
// A deck opened from the list takes this place (PublicDeckPane); the
// rail's Bibliothèque, or the list's own head, brings it back.

export function LibraryHome({ session }) {
  const { t } = useLang()
  const [home, setHome] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    apiJson('/api/decks/library/home', session)
      .then(data => { if (live) setHome(data) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session])

  if (failed) return <p className="gate-panel__empty">{t.libraryFailed}</p>
  if (!home) return <Loading />
  const following = home.following ?? []
  const published = home.published ?? []

  return (
    <div className="lib-home">
      <section className="gate-panel lib-home__featured" aria-labelledby="lib-featured-title">
        <header className="gate-panel__head">
          <span className="pf-line__roundel plate__roundel" lang="ja" aria-hidden="true">一</span>
          <span className="plate__names">
            <h2 id="lib-featured-title" className="plate__title">{t.libraryFeatured}</h2>
          </span>
          <span className="gate-row__fig">{t.libraryFeaturedWhen}</span>
        </header>
        {home.featured
          ? <DeckPreview key={home.featured.id} deckId={home.featured.id} listed={home.featured}
              session={session} where="featured" />
          : <p className="gate-panel__empty">{t.libraryEmptyHint}</p>}
      </section>

      <div className="lib-home__pair">
        <section className="gate-panel" aria-labelledby="lib-following-title">
          <header className="gate-panel__head">
            <span className="pf-line__roundel plate__roundel" aria-hidden="true">KZ</span>
            <span className="plate__names">
              <h2 id="lib-following-title" className="plate__title">{t.libraryFollowing}</h2>
              {following.length > 0 && <span className="plate__meta">{t.libraryFollowingCount(following.length)}</span>}
            </span>
          </header>
          <div className="gate-panel__body">
            {following.length === 0
              ? <p className="gate-panel__empty">{t.libraryFollowingNone}</p>
              : (
                <ul className="gate-rows">
                  {following.map(deck => (
                    <li key={deck.id} className="gate-rows__item">
                      <Link className="gate-row" to={`/learn/decks/${deck.id}`}
                        onClick={() => playUi('click-mode-selection')}>
                        <DeckRoundel type={deck.type} />
                        <span className="gate-row__names">
                          <span className="gate-row__name">{deck.name}</span>
                          <span className="gate-row__sub">
                            {t.cardsCount(deck.card_count)}{deck.author && <> · {t.libraryBy(deck.author)}</>}
                          </span>
                        </span>
                        {deck.new_cards > 0
                          ? <span className="gate-row__news">{t.libraryNewCards(deck.new_cards)}</span>
                          : <span className="gate-row__fig">{t.libraryUpToDate}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>

        <section className="gate-panel" aria-labelledby="lib-mine-title">
          <header className="gate-panel__head">
            <span className="pf-line__roundel plate__roundel" aria-hidden="true">KZ</span>
            <span className="plate__names">
              <h2 id="lib-mine-title" className="plate__title">{t.libraryMine}</h2>
              {published.length > 0 && (
                <span className="plate__meta">
                  {t.libraryMineCount(published.length)} · {t.libraryFollowers(published.reduce((n, d) => n + d.followers, 0))}
                </span>
              )}
            </span>
          </header>
          <div className="gate-panel__body">
            {published.length === 0
              ? <p className="gate-panel__empty">{t.libraryMineNone}</p>
              : (
                <ul className="gate-rows">
                  {published.map(deck => (
                    <li key={deck.id} className="gate-rows__item">
                      <Link className="gate-row" to={`/learn/decks/${deck.id}`}
                        onClick={() => playUi('click-mode-selection')}>
                        <DeckRoundel type={deck.type} />
                        <span className="gate-row__names">
                          <span className="gate-row__name">{deck.name}</span>
                          <span className="gate-row__sub">{deckTypeOf(deck.type, t).label} · {t.cardsCount(deck.card_count)}</span>
                        </span>
                        <Weeks weeks={deck.weeks} label={t.libraryWeeksLabel} />
                        <span className="gate-row__fig">{t.libraryFollowers(deck.followers)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>
      </div>
    </div>
  )
}

/** New followers a week, oldest first, as bars against the busiest week. */
function Weeks({ weeks, label }) {
  const most = Math.max(1, ...(weeks ?? []))
  return (
    <span className="lib-weeks" role="img" aria-label={label((weeks ?? []).join(', '))}>
      {(weeks ?? []).map((n, i) => (
        <i key={i} style={{ height: `${Math.max(8, Math.round((n / most) * 100))}%` }} />
      ))}
    </span>
  )
}
