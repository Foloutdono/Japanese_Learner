import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiJson, ApiError } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { track } from '../lib/track'
import { Bar, Leave } from '../components/chrome/Bar'
import { Chip } from '../components/chrome/Console'
import { Sheet } from '../components/chrome/Sheet'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { deckTypeOf } from '../components/decks/deckTypes'
import { BooksIcon } from '../components/ui/Icons'

// ── One published deck, before you commit to it ───────────────
// The page you read to decide. It shows what the deck is, who wrote it,
// how many people follow it, and enough of its cards to judge it by —
// then offers the one filled action, Follow.
//
// Following is a LINK, not a copy: the deck stays its author's and
// their later edits reach you. The copy is "Make it mine" on the deck's
// own page afterwards, and the line under the button says so, because
// that is the one thing about this feature a learner cannot guess.

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

export default function PublicDeckScreen({ session }) {
  const { deck_id } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()

  const [deck, setDeck]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [missing, setMissing]   = useState(false)
  const [busy, setBusy]         = useState(false)
  const [reportOpen, setReport] = useState(false)
  const [reported, setReported] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiJson(`/api/decks/library/${deck_id}`, session)
      .then(data => { setDeck(data); setLoading(false) })
      .catch(err => {
        setLoading(false)
        setMissing(err instanceof ApiError && err.status === 404)
      })
  }, [deck_id, session])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() is this page's initial fetch, not a state reset.
  useEffect(load, [load])

  function follow() {
    if (busy) return
    setBusy(true)
    playUi('click-screen-selection')
    apiJson(`/api/decks/${deck_id}/subscribe`, session, { method: 'POST' })
      .then(() => {
        track('deck_subscribe', {
          structure: deck?.type, cards: deck?.card_count, where: 'library',
        })
        // Straight onto the deck's own page: following it is the act
        // that makes it yours to study, so the next thing you want is
        // the deck, not this page again with one word changed.
        navigate(`/learn/decks/${deck_id}`)
      })
      .catch(() => { setBusy(false); load() })
  }

  function report(reason) {
    playUi('click-mode-selection')
    setReport(false)
    apiJson(`/api/decks/${deck_id}/report`, session, {
      method: 'POST', body: JSON.stringify({ reason }),
    })
      .then(() => setReported(true))
      .catch(() => {})
  }

  // The leave says `Retour` and not `Bibliothèque`, unlike every other
  // leave in the app, which names its destination: here the bar's own
  // title is already the library, and printing the word twice in one
  // header reads as a mistake rather than as a sign.
  if (loading) {
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        <Bar code="KZ" color="var(--line-decks)" title={t.library}
          aside={<Leave onClick={() => navigate('/learn/decks/library')}>{t.back}</Leave>} />
        <Loading />
      </main>
    )
  }

  if (missing || !deck) {
    return (
      <main id="main-content" className="learn" style={{ '--line-color': 'var(--line-decks)' }}>
        <Bar code="KZ" color="var(--line-decks)" title={t.library}
          aside={<Leave onClick={() => navigate('/learn/decks/library')}>{t.back}</Leave>} />
        <Empty icon={<BooksIcon size={40} />} message={t.libraryGone} hint={t.libraryGoneHint}
          action={{ label: t.librarySeeAll, onClick: () => navigate('/learn/decks/library') }} />
      </main>
    )
  }

  const dt = deckTypeOf(deck.type, t)
  const preview = deck.preview ?? []

  return (
    <main id="main-content" className="learn" style={{ '--line-color': dt.color }}>
      <Bar code="KZ" color="var(--line-decks)" title={t.library}
          aside={<Leave onClick={() => navigate('/learn/decks/library')}>{t.back}</Leave>} />

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
            onClick={() => { playUi('click-screen-selection'); navigate(`/learn/decks/${deck_id}`) }}>
            ▶ {t.libraryOpen}
          </button>
        ) : (
          <button type="button" className="btn-primary deck-identity__study"
            onClick={follow} disabled={busy}>
            {t.libraryFollow}
          </button>
        )}
      </div>

      {deck.description && <p className="lib-blurb">{deck.description}</p>}

      {/* The one thing a learner cannot guess about this feature. */}
      <p className="lib-note">{t.libraryLinkNote}</p>

      {preview.length > 0 && (
        <ul className="card-list lib-preview">
          {preview.map((card, i) => (
            <li key={card.id ?? card.raw_id ?? i} className="card-row lib-preview__row">
              <span className="card-row__front">
                <span className="card-row__jp" lang="ja">{card.front}</span>
                {card.kana && <span className="card-row__kana" lang="ja">{card.kana}</span>}
              </span>
              <span className="card-row__back">{card.back}</span>
            </li>
          ))}
        </ul>
      )}

      {deck.card_count > preview.length && (
        <p className="lib-note">{t.libraryAndMore(deck.card_count - preview.length)}</p>
      )}

      <div className="chip-row lib-foot">
        <Chip onClick={() => { playUi('click-mode-selection'); setReport(true) }}
          aria-haspopup="dialog" disabled={reported}>
          {reported ? t.libraryReported : t.libraryReport}
        </Chip>
      </div>

      <Sheet open={reportOpen} onClose={() => setReport(false)} label={t.libraryReport}
        cap={t.libraryReport}>
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
    </main>
  )
}
