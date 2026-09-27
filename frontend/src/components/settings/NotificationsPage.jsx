import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { nativePlatform, nudgePermission, requestNudgePermission } from '../../lib/platform'
import { whenLabel } from '../../lib/ahead'
import { refreshSummary, useProfileSummaryState } from '../../stores/profileSummary'
import { useAheadPlan } from '../../stores/ahead'
import { Seg } from '../chrome/Console'
import { ChevronIcon } from '../ui/Icons'
import { SettingsPage, Slip } from './SettingsPage'

// ── 通知 — Settings › Notifications (plan 156) ──────────────────
// The shells only (SettingsScreen leaves the row and the page out of
// the web): the daily train on or off, its hour -- a door to the
// ride's own page, the one place the hour is set -- and the next
// reminder exactly as it will read, from the plan NativeBridge last
// made (lib/ahead.js). Then the widget, which has nothing to set: how
// to put it on the lock or home screen, and what it shows.
//
// Turning the train on asks the OS first; the answer is stored only
// once the OS has said yes, so the switch never claims a reminder the
// phone will not deliver.
export function NotificationsPage() {
  const { t, lang } = useLang()
  const { summary } = useProfileSummaryState()
  const { nudges, failed: planFailed } = useAheadPlan()
  const [permission, setPermission] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let gone = false
    nudgePermission().then(p => { if (!gone) setPermission(p) })
    return () => { gone = true }
  }, [])

  const enabled = summary?.notifications === true
  const time = summary?.reminderTime ?? null
  const platform = nativePlatform() === 'ios' ? 'ios' : 'android'
  const denied = permission === 'denied'
  const next = enabled && time && !denied ? nudges?.[0] ?? null : null

  async function choose(key) {
    if (busy) return
    playClick()
    setFailed(false)
    const on = key === 'on'
    if (on) {
      const granted = permission === 'granted' || await requestNudgePermission()
      const now = await nudgePermission()
      setPermission(now)
      if (!granted) return
    }
    setBusy(true)
    try {
      await apiJson('/api/profile/learning', null, { method: 'PATCH', body: JSON.stringify({ notifications: on }) })
      await refreshSummary()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsPage title={t.settingsNotif}>
      <Slip label={t.notifDaily} cap={t.notifDailyCap}>
        <div className="stg-list">
          <div className="stg-row" data-row="remind">
            <span className="stg-row__names"><span className="stg-row__jp">{t.notifRemind}</span></span>
            <Seg
              label={t.notifRemind}
              value={enabled && !denied ? 'on' : 'off'}
              onChange={choose}
              options={[
                { key: 'on', label: t.notifOnOff.on },
                { key: 'off', label: t.notifOnOff.off },
              ]}
            />
          </div>
          <Link to="/profile/settings/hour" className="stg-row stg-row--link" data-row="hour">
            <span className="stg-row__names"><span className="stg-row__jp">{t.brdDeparture}</span></span>
            <span className="stg-row__value"><span className="stg-row__text">{time ?? t.destAnyTime}</span></span>
            <ChevronIcon direction="right" size={16} className="stg-row__chev" />
          </Link>
        </div>

        {next && (
          <div className="brd-notif" role="img" aria-label={`${t.notifNextAria}: ${next.title} — ${next.summary}`} data-next>
            <span className="brd-notif__app" aria-hidden="true">辻</span>
            <div className="brd-notif__body" aria-hidden="true">
              <div className="brd-notif__head">
                <span>{t.brdAppName}</span>
                <span>{whenLabel(next.at, new Date(), t, lang)} {time}</span>
              </div>
              <span className="brd-notif__title">{next.title}</span>
              <span className="brd-notif__text">{next.summary}</span>
              {next.lines.map(line => <span key={line} className="brd-notif__text">{line}</span>)}
            </div>
          </div>
        )}

        <p className="slip__hint">
          {denied ? t.notifDenied
            : !time ? t.notifNoHour
              : enabled && planFailed && !nudges ? t.notifFailed
                : enabled && nudges && !nudges.length ? t.notifQuiet
                  : t.notifRule}
        </p>
      </Slip>

      <Slip label={t.notifWidget} cap={t.notifWidgetCap[platform]}>
        <p className="slip__hint">{t.notifWidgetHow[platform]}</p>
        <p className="slip__hint">{t.notifWidgetWhat}</p>
      </Slip>

      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </SettingsPage>
  )
}
