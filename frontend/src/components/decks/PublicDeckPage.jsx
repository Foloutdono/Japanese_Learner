import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { usePublicDeck } from '../../hooks/usePublicDeck'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { track } from '../../lib/track'
import { Sheet } from '../chrome/Sheet'
import Empty from '../ui/Empty'
import { Loading } from '../ui/Loading'
import { deckTypeOf } from './deckTypes'
import { BooksIcon, WarningIcon } from '../ui/Icons'

// ── One published deck, before you commit to it ───────────────
// The page you read to decide. It shows what the deck is, who wrote it,
// how many people follow it, and enough of its cards to judge it by —
// then offers the one filled action, Follow.
//
// Following is a LINK, not a copy: the deck stays its author's and
// their later edits reach you. The copy is "Make it mine" on the deck's
// own page afterwards. That used to be spelled out in a paragraph under
// the button; it was three lines of prose between the learner and the
// cards they came to read, and "Say less" (DESIGN.md) wins — the deck's
// own page is where the copy is offered, and where the sentence belongs
// if it is ever missed.
//
// Three pieces since plan 115: the fetch (hooks/usePublicDeck), the page's
// body (PublicDeckBody), and the two things that frame them — the
// phone's screen of its own (screens/PublicDeckScreen.jsx) and, on the
// desk, the pane beside the library's shelf (PublicDeckPane).

// The closed set the backend validates against (REPORT_REASONS), each
// with the locale key that names it. Flat keys rather than a nested
// object because locales.test.js compares the two tables value by value.
const REASONS = [
  ['spam',      'libraryReasonSpam'],
  ['offensive', 'libraryReasonOffensive'],
  ['wrong',     'libraryReasonWrong'],
  ['copyright', 'libraryReasonCopyright'],
  ['other',     'libraryReasonOther'],
]

// The identity, the blurb, the preview and the report sheet. `pending`
// is the desk's: the pane draws a deck from its shelf row before its own
// answer lands, and until then whether you follow it is not known, so
// Follow waits with it.
export function PublicDeckBody({ deck, deckId, session, onReload, pending = false }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [busy, setBusy]         = useState(false)
  const [reportOpen, setReport] = useState(false)
  const [reported, setReported] = useState(false)

  function follow() {
    if (busy) return
    setBusy(true)
    playUi('click-screen-selection')
    apiJson(`/api/decks/${deckId}/subscribe`, session, { method: 'POST' })
      .then(() => {
        track('deck_subscribe', {
          structure: deck?.type, cards: deck?.card_count, where: 'library',
        })
        // Straight onto the deck's own page: following it is the act
        // that makes it yours to study, so the next thing you want is
        // the deck, not this page again with one word changed.
        navigate(`/learn/decks/${deckId}`)
      })
      .catch(() => { setBusy(false); onReload() })
  }

  function report(reason) {
    playUi('click-mode-selection')
    setReport(false)
    apiJson(`/api/decks/${deckId}/report`, session, {
      method: 'POST', body: JSON.stringify({ reason }),
    })
      .then(() => setReported(true))
      .catch(() => {})
  }

  const dt = deckTypeOf(deck.type, t)
  const preview = deck.preview ?? []

  return (
    <>
      <div className="deck-identity" style={{ '--rail': dt.color }}>
        <span className="wmap-roundel deck-identity__roundel" lang="ja" aria-hidden="true"
          style={{ '--line-color': dt.color }}>{dt.glyph}</span>
        <span className="deck-identity__names">
          <h2 className="deck-identity__name">{deck.name}</h2>
          <span className="deck-identity__meta">
            {dt.label} · {t.cardsCount(deck.card_count)}
            {deck.author && <> · {t.libraryBy(deck.author)}</>}
            {deck.followers > 0 && <> · {t.libraryFollowers(deck.followers)}</>}
          </span>
        </span>
        {deck.followed ? (
          <button type="button" className="btn-primary deck-identity__study"
            onClick={() => { playUi('click-screen-selection'); navigate(`/learn/decks/${deckId}`) }}>
            ▶ {t.libraryOpen}
          </button>
        ) : (
          <button type="button" className="btn-primary deck-identity__study"
            onClick={follow} disabled={busy || pending}>
            {t.libraryFollow}
          </button>
        )}
        {/* Last in the DOM, first in the corner: the mark is read after
            the action it does not compete with, and placed by the grid. */}
        <button type="button" className="chip deck-identity__report"
          onClick={() => { playUi('click-mode-selection'); setReport(true) }}
          aria-haspopup="dialog" disabled={reported}
          title={reported ? t.libraryReported : t.libraryReport}
          aria-label={reported ? t.libraryReported : t.libraryReport}>
          <WarningIcon size={16} />
        </button>
      </div>

      {deck.description && <p className="lib-blurb">{deck.description}</p>}

      {/* The list and the count of what it left out are one block: the
          count is the list's caption, and at the page's own block gap it
          floated under the cards as a third thing of its own. */}
      {preview.length > 0 && (
        <div className="lib-preview">
          <ul className="card-list">
            {preview.map((card, i) => (
              <li key={card.id ?? card.raw_id ?? i} className="card-row">
                <span className="card-row__body">
                  <span className="card-row__front">
                    <span className="card-row__jp" lang="ja">{card.front}</span>
                    {card.kana && <span className="card-row__kana" lang="ja">{card.kana}</span>}
                  </span>
                  <span className="card-row__back">{card.back}</span>
                </span>
              </li>
            ))}
          </ul>
          {deck.card_count > preview.length && (
            <p className="lib-note">{t.libraryAndMore(deck.card_count - preview.length)}</p>
          )}
        </div>
      )}

      <Sheet open={reportOpen} onClose={() => setReport(false)} label={t.libraryReport}
        cap={t.libraryReport} dismiss>
        <p className="lib-note">{t.libraryReportNote}</p>
        <div className="type-list" role="group" aria-label={t.libraryReport}>
          {REASONS.map(([reason, key]) => (
            <button key={reason} type="button" className="type-row"
              onClick={() => report(reason)}>
              <span className="type-row__names">
                <span className="type-row__label">{t[key]}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

// ── 机 — a published deck beside the shelf (plan 115) ─────────────
// On the desk the library is the shelf beside the open deck's page, the
// way a station's stops stand beside a stop's platforms: another deck is
// one click, and the shelf — its search, its narrowing, how far down it
// was scrolled — never goes away to show it. The shelf's own row draws
// the deck at once (name, structure, count, author, followers, blurb);
// only the preview waits for the deck's own answer. Keyed by the deck
// by its caller, so nothing of one deck survives into the next.
export function PublicDeckPane({ deckId, listed, session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { deck, loading, missing, reload } = usePublicDeck(deckId, session)
  const shown = deck ?? listed

  if (missing) {
    return (
      <Empty icon={<BooksIcon size={40} />} message={t.libraryGone} hint={t.libraryGoneHint}
        action={{ label: t.librarySeeAll, onClick: () => navigate('/learn/decks/library', { replace: true }) }} />
    )
  }
  if (!shown) return loading ? <Loading /> : <Empty icon={<BooksIcon size={40} />} message={t.libraryFailed} hint={t.libraryFailedHint} />

  return (
    <section className="desk-shelf-page" aria-label={shown.name}
      style={{ '--line-color': deckTypeOf(shown.type, t).color }}>
      <PublicDeckBody deck={shown} deckId={deckId} session={session} onReload={reload} pending={!deck} />
      {!deck && loading && <Loading />}
    </section>
  )
}
