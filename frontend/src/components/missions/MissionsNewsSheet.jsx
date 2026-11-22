import { useRef } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { refreshSummary } from '../../stores/profileSummary'
import { askMissionsOpen } from '../../stores/missions'
import { Sheet } from '../chrome/Sheet'

// ── 新しい — the missions, announced once (plan 328) ───────────────
// As the duels' key was (plan 287): the learners who met Today before the
// pill stood under its legend are told once. The server decides who
// (GET /api/profile's `missionsNews`) and is told it was seen whichever
// way the sheet is shut (POST /api/onboarding/news/missions). "See the
// missions" asks the gate to open its own sheet.
//
// Props:
//   session
//   onClose()  the sheet is gone; Today stops drawing it at once

export function MissionsNewsSheet({ session, onClose }) {
  const { t } = useLang()
  const seen = useRef(false)

  function shut(action) {
    if (seen.current) return
    seen.current = true
    countUse('missions_news', action)
    apiJson('/api/onboarding/news/missions', session, { method: 'POST' })
      .then(() => refreshSummary())
      .catch(() => {})
    onClose()
  }

  function go() {
    playClick()
    shut('open')
    askMissionsOpen()
  }

  function later() {
    playClick()
    shut('hide')
  }

  return (
    <Sheet open onClose={() => shut('hide')} label={t.msnNewsTitle} className="tdy-sheet msn-news">
      <span className="sheet__cap">{t.newsCap}</span>
      <div className="msn-news__art" aria-hidden="true">
        <span className="msn-pill msn-pill--still">
          <span className="msn-pill__dots"><i className="on" /><i className="on" /><i /></span>
          <span className="msn-pill__n"><b>2</b>/3</span>
          <span className="msn-pill__sum">+30</span>
        </span>
      </div>
      <h2 className="sheet__jp msn-news__title">{t.msnNewsTitle}</h2>
      <p className="msn-news__lead">{t.msnNewsLead}</p>
      <div className="msn-news__acts">
        <button type="button" className="btn-primary" data-action="missions-news-go" onClick={go}>{t.msnNewsGo}</button>
        <button type="button" className="btn-secondary" data-action="missions-news-later" onClick={later}>{t.msnNewsLater}</button>
      </div>
    </Sheet>
  )
}
