import { useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { currentSession } from '../../lib/session'
import { playClick } from '../../lib/audio'
import { refreshSummary } from '../../stores/profileSummary'
import { useJourneyStatus, refreshJourney } from '../../stores/journey'
import { DEPARTURES, DEPART_TIMES } from '../onboarding/departures'
import { SettingsPage, Slip } from './SettingsPage'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

// ── 発車時刻 — the daily ride (a field of the pass, plan 139) ────
// The hour rides with or without a destination — it is a habit, not a
// promise, and the pass prints it either way. It is reprinted on the
// spot (POST /api/journey/reprint with the hour alone). It was the
// Destination page's last slip until that page was split along the
// pass's fields.
export function HourPage() {
  const { t } = useLang()
  const { data: status } = useJourneyStatus()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // The hour is saved on the spot, so its arrows move the focus alone
  // and Space chooses (plan 123).
  const desk = useDesk()
  const onWalk = useRadioWalk(desk, { check: false })
  const current = status?.dailyDeparture ?? null
  const hours = [...DEPARTURES, null]

  function setHour(id) {
    if (id === current || busy) return
    playClick()
    setBusy(true)
    setFailed(false)
    currentSession()
      .then(session => apiJson('/api/journey/reprint', session, { method: 'POST', body: JSON.stringify({ dailyDeparture: id }) }))
      .then(() => Promise.all([refreshJourney(), refreshSummary()]))
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  return (
    <SettingsPage title={t.destDailyRide}>
      <Slip>
        <div className="hour-grid" role="radiogroup" aria-label={t.destDailyRide} onKeyDown={onWalk}>
          {hours.map((id, i) => {
            const on = current === id
            return (
              <button
                key={id ?? 'free'}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={radioTab(desk, i, hours.indexOf(current))}
                disabled={busy || !status}
                data-hour={id ?? 'free'}
                className={`svc${on ? ' svc--on' : ''}`}
                onClick={() => setHour(id)}
              >
                <span className="svc__jp">{id ? t.destHour[id] : t.destFlexible}</span>
                <span className="svc__pace">{id ? DEPART_TIMES[id] : t.destAnyTime}</span>
              </button>
            )
          })}
        </div>
      </Slip>
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </SettingsPage>
  )
}
