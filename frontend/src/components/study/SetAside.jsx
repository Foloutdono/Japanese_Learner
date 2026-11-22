import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { EyeOffIcon } from '../ui/Icons'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { cardFace } from '../../lib/feedback'
import { refreshToday } from '../../stores/today'
import { settable, askSetAside, closeSetAside, useSetAsideAsk, cardSetAside } from '../../stores/setAside'

// ── 回送 — set a card aside (plan 328) ─────────────────────────────
// A word the learner does not want to learn -- テープレコーダー, the tape
// recorder, old tech -- leaves every queue: the eye beside the flag on
// an answered card asks, the sheet says what it does and where to take
// it back (Réglages › Set aside), and the run goes on to the next card
// without this one being answered. The server keeps the card's schedule
// as it stood (routes/set_aside.py).

/** The eye in the run's head, beside the flag, while the answer shows. */
export function CardSetAside({ card }) {
  const { t } = useLang()
  if (!settable(card)) return null
  return (
    <button
      type="button"
      className="fb-flag"
      aria-label={t.asideAsk}
      title={t.asideAsk}
      aria-haspopup="dialog"
      data-action="set-aside-open"
      onClick={() => askSetAside(card)}
    >
      <EyeOffIcon size={16} />
    </button>
  )
}

function Confirm({ session, card, onClose }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const inFlight = useRef(false)
  const face = cardFace(card)
  const name = face?.face || card.front || ''

  function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    playClick()
    setBusy(true)
    setFailed(null)
    apiJson('/api/cards/set-aside', session, { method: 'POST', body: JSON.stringify({ cardId: card.card_id }) })
      .then(() => {
        cardSetAside(card.card_id)
        refreshToday()
        onClose()
      })
      .catch(err => {
        inFlight.current = false
        setFailed(err?.status === 409 ? t.asideFull : t.asideError)
        setBusy(false)
      })
  }

  return (
    <>
      {name && (
        <div className="fb-card">
          <span className="fb-card__face" lang="ja">{name}</span>
          <span className="fb-card__names">
            {face?.reading && <span className="fb-card__reading">{face.reading}</span>}
            {(face?.meaning || card.back) && <span className="fb-card__gloss">{face?.meaning || card.back}</span>}
          </span>
        </div>
      )}
      <p className="lvl-sheet__body">{t.asideBody}</p>
      {failed && <p className="hint" role="alert">{failed}</p>}
      <button type="button" className="btn-depart btn-depart--sheet" data-action="set-aside-confirm" disabled={busy} onClick={confirm}>
        <span className="btn-depart__jp">{t.asideConfirm}</span>
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
      <button type="button" className="btn-secondary" data-action="set-aside-cancel" onClick={onClose}>{t.cancel}</button>
    </>
  )
}

/** The sheet the eye raises, rendered once by App beside <Routes/>. A
 *  navigation shuts it: it was about that screen's card. */
export function SetAsideHost({ session }) {
  const { t } = useLang()
  const open = useSetAsideAsk()
  const { pathname } = useLocation()
  useEffect(() => closeSetAside, [pathname])
  if (!open?.card) return null
  return (
    <Sheet open onClose={closeSetAside} title={t.asideTitle} icon={EyeOffIcon} label={t.asideTitle} className="lvl-sheet" initialFocus='[data-action="set-aside-cancel"]'>
      <Confirm key={open.card.card_id} session={session} card={open.card} onClose={closeSetAside} />
    </Sheet>
  )
}
