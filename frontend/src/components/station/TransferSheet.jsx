import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { SOURCES } from '../../lib/transfer/bounds'
import { refreshSummary } from '../../stores/profileSummary'
import { Sheet } from '../chrome/Sheet'

// ── 乗換 — the sheet over Today, once (plan 243b) ─────────────────
// The owner's pick P1 of the canvas: a learner new to the app, the
// first ride behind them, is asked once whether they studied somewhere
// else -- the apps the ticket reads, as plain pills, and two ways out:
// to Settings › Correspondance, or "I'm starting here". Shut any other
// way (the scrim, Escape, a push down), it counts as the second. The
// server decides who is asked (GET /api/profile's `transferOffer`,
// routes/transfer.offer_open) and is told the answer
// (POST /api/transfer/offer), so it is asked on one device only.
//
// Props:
//   session
//   onClose()  the sheet is gone; Today stops drawing it at once

export function TransferSheet({ session, onClose }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const answered = useRef(false)

  function answer(choice) {
    if (answered.current) return
    answered.current = true
    apiJson('/api/transfer/offer', session, { method: 'POST', body: JSON.stringify({ choice }) })
      .then(() => refreshSummary())
      .catch(() => {})
    onClose()
  }

  function go() {
    playClick()
    answer('go')
    navigate('/profile/settings/transfer')
  }

  function later() {
    playClick()
    answer('later')
  }

  return (
    <Sheet open onClose={() => answer('later')} label={t.trSheetQ} className="tdy-sheet tr-sheet">
      <span className="sheet__cap">{t.trCap}</span>
      <h2 className="sheet__jp tr-sheet__q">{t.trSheetQ}</h2>
      <p className="tr-sheet__lead">{t.trSheetLead}</p>
      <ul className="tr-chips" aria-label={t.trFrom}>
        {SOURCES.map(s => <li key={s} className="tr-chip">{t.trSource[s]}</li>)}
      </ul>
      <div className="tr-sheet__acts">
        <button type="button" className="btn-primary" data-action="transfer-offer-go" onClick={go}>{t.trSheetGo}</button>
        <button type="button" className="btn-secondary" data-action="transfer-offer-later" onClick={later}>{t.trSheetLater}</button>
        <span className="tr-sheet__note">{t.trSheetFoot}</span>
      </div>
    </Sheet>
  )
}
