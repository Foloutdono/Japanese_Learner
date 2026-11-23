import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { contentLang } from '../../lib/locale'
import { refreshToday } from '../../stores/today'
import { Loading } from '../ui/Loading'
import { SettingsPage, Slip } from './SettingsPage'

// ── 回送 — Settings › Set aside (plan 328) ─────────────────────────
// The cards the learner set aside from a run (components/study/
// SetAside.jsx), the latest first, each with its way back. Taken back, a
// card is served again on the schedule it had (routes/set_aside.py): a
// review it owes is due at once, a card never met waits its turn in its
// deck's order.

export function SetAsidePage({ session }) {
  const { t, lang } = useLang()
  const [cards, setCards] = useState(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let live = true
    apiJson(`/api/cards/set-aside?lang=${encodeURIComponent(contentLang(lang))}`, session)
      .then(data => { if (live) setCards(data.cards ?? []) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session, lang])

  function takeBack(cardId) {
    if (busy) return
    playClick()
    setBusy(cardId)
    setFailed(false)
    apiJson('/api/cards/take-back', session, { method: 'POST', body: JSON.stringify({ cardId }) })
      .then(() => { setCards(list => list.filter(c => c.cardId !== cardId)); refreshToday() })
      .catch(() => setFailed(true))
      .finally(() => setBusy(null))
  }

  if (!cards) {
    return (
      <SettingsPage title={t.settingsAside}>
        {failed ? <p className="hint" role="alert">{t.asideLoadError}</p> : <Loading />}
      </SettingsPage>
    )
  }

  return (
    <SettingsPage title={t.settingsAside}>
      {cards.length === 0 ? (
        <Slip>
          <span className="slip__hint">{t.asideEmpty}</span>
        </Slip>
      ) : (
        <Slip label={t.asideCount(cards.length)}>
          {failed && <p className="hint" role="alert">{t.rvError}</p>}
          <ul className="aside-list">
            {cards.map(card => {
              const jp = card.jp || card.cardId
              return (
                <li key={card.cardId} className="fb-card aside-row">
                  <span className="fb-card__face" lang="ja">{jp}</span>
                  <span className="fb-card__names">
                    {card.reading && <span className="fb-card__reading">{card.reading}</span>}
                    {card.meaning && <span className="fb-card__gloss">{card.meaning}</span>}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary aside-row__back"
                    data-action="set-aside-take-back"
                    aria-label={t.asideTakeBackLabel(jp)}
                    disabled={busy !== null}
                    onClick={() => takeBack(card.cardId)}
                  >
                    {t.asideTakeBack}
                  </button>
                </li>
              )
            })}
          </ul>
        </Slip>
      )}
    </SettingsPage>
  )
}
