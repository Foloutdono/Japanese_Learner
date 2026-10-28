import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { refreshSummary } from '../../stores/profileSummary'
import { Sheet } from '../chrome/Sheet'
import { KeyFace } from './DuelKey'
import { DUELS_PATH } from './DuelsDoor'

// ── 新しい — the duels' key, announced once (plan 286) ─────────────
// The owner's ask with the key: the learners who met Today before it
// stood beside the gate are told, once, over Today. The server decides
// who is told (GET /api/profile's `duelsNews`, routes/onboarding.
// duels_news_open: a learner whose Today guide ended before the key's
// stop was in it) and is told it was seen, whichever way the sheet is
// shut (POST /api/onboarding/news/duels), so it is shown on one device
// only. A learner new to Today meets the key in its guide instead, and
// the guide's stamp is the news's too.
//
// The key drawn as its picture, a title and a line, the way to the hall
// (the key's own) and the quiet way past.
//
// Props:
//   session
//   onClose()  the sheet is gone; Today stops drawing it at once

export function DuelsNewsSheet({ session, onClose }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const seen = useRef(false)

  function shut(action) {
    if (seen.current) return
    seen.current = true
    countUse('duels_news', action)
    apiJson('/api/onboarding/news/duels', session, { method: 'POST' })
      .then(() => refreshSummary())
      .catch(() => {})
    onClose()
  }

  function go() {
    playClick()
    shut('open')
    navigate(DUELS_PATH)
  }

  function later() {
    playClick()
    shut('hide')
  }

  return (
    <Sheet open onClose={() => shut('hide')} label={t.newsDuelsTitle} className="tdy-sheet pvp-news">
      <span className="sheet__cap">{t.newsCap}</span>
      <div className="pvp-news__art" aria-hidden="true">
        <span className="pvp-key"><KeyFace /></span>
      </div>
      <h2 className="sheet__jp pvp-news__title">{t.newsDuelsTitle}</h2>
      <p className="pvp-news__lead">{t.newsDuelsLead(t.depart)}</p>
      <div className="pvp-news__acts">
        <button type="button" className="btn-primary" data-action="duels-news-go" onClick={go}>{t.newsDuelsGo}</button>
        <button type="button" className="btn-secondary" data-action="duels-news-later" onClick={later}>{t.newsDuelsLater}</button>
      </div>
    </Sheet>
  )
}
