import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { currentSession } from '../../lib/session'
import { playClick, playUi } from '../../lib/audio'
import { refreshSummary, useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus, useVolumes, refreshJourney } from '../../stores/journey'
import { journeyModel, minutesFor } from '../../domain/goalMath'
import { goalDerived } from '../onboarding/goalDerived'
import { DEFAULT_PER_DAY, PACES } from '../onboarding/paces'
import { SettingsPage, Slip } from './SettingsPage'
import { useLearningSave } from './learningSave'
import { dateFormat, stopParts, timeAxis } from './contract'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

const iso = d => d.toISOString().slice(0, 10)

// ── 種別 — the service (a field of the pass, plan 139) ──────────
// The daily pace was on two pages — Learning's three cards, saved on a
// tap, and Destination's three, waiting for Reprint — over the one
// number both wrote (user_profiles.daily_new_target). It is this page
// now, and each service says what it costs and what it buys: the
// minutes a day beside it, and, where the pass has a destination, the
// line it rides to that stop on one time axis, so Express's arrival
// stands against Rapide's rather than appearing only once picked. The
// learner's own pace of the last fortnight is the dashed fourth line —
// the one the pass is actually riding — and not a choice.
//
// With a destination the date is a promise, so a service is dialled and
// Reprint prints the date it reaches (POST /api/journey/reprint, the
// date and the pace on the contract that exists, from a fresh clock).
// Without one there is no date to print: a service is saved on the
// spot through the learning PATCH, as Learning's cards were.
export function ServicePage({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const summary = useProfileSummary()
  const { data: status, at: nowMs } = useJourneyStatus()
  const { data: volumes } = useVolumes()
  const { save, saving, failed: saveFailed } = useLearningSave(session)
  const [pick, setPick] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(false)
  const desk = useDesk()

  const startLevel = summary?.jlptLevel ?? null
  const dest = status?.goalLevel ?? null
  const withDest = dest != null
  const printedPace = status?.plannedPerDay ?? summary?.dailyNewTarget ?? null
  const chosen = pick ?? printedPace ?? DEFAULT_PER_DAY
  const dirty = withDest && chosen !== printedPace
  // One tab stop (plan 123). Dialled services are checked by the arrows;
  // a service that saves on the spot is walked, and Space chooses.
  const onWalk = useRadioWalk(desk, { check: withDest })

  const now = nowMs ? new Date(nowMs) : null
  const arrive = perDay => (withDest && volumes && startLevel && now && perDay > 0
    ? goalDerived(volumes, startLevel, { dest, mode: 'service', perDay }, now).targetDate
    : null)
  const model = status && now ? journeyModel(status, now) : null
  const actual = model?.actualPerDay > 0 ? model.actualPerDay : null
  const rows = PACES.map(p => ({ ...p, at: arrive(p.perDay) }))
  const yours = actual ? arrive(actual) : null
  const drawn = rows.every(r => r.at)
  const axis = drawn ? timeAxis(now, [...rows.map(r => r.at), ...(yours ? [yours] : [])], lang) : null
  const code = stopParts(t, dest).code
  const fmt = dateFormat(lang)
  const printedDate = status?.goalTargetDate ? new Date(status.goalTargetDate) : null
  const chosenDate = dirty ? arrive(chosen) : printedDate
  const fraction = new Intl.NumberFormat(lang === 'fr' ? 'fr' : 'en', { maximumFractionDigits: 1 })

  function choose(perDay) {
    if (perDay === chosen && !withDest) return
    playClick()
    if (withDest) { setDone(false); setPick(perDay) }
    else save({ dailyNewTarget: perDay })
  }

  function reprint() {
    if (!dirty || !volumes || busy) return
    playUi('click')
    setBusy(true)
    setFailed(false)
    // A fresh clock for the printed date: the office's own rule.
    const target = iso(goalDerived(volumes, startLevel, { dest, mode: 'service', perDay: chosen }, new Date()).targetDate)
    currentSession()
      .then(session => apiJson('/api/journey/reprint', session, { method: 'POST', body: JSON.stringify({ goalTargetDate: target, dailyNewTarget: chosen }) }))
      .then(() => Promise.all([refreshJourney(), refreshSummary()]))
      .then(() => { setPick(undefined); setDone(true) })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  const custom = printedPace != null && !PACES.some(p => p.perDay === printedPace)

  return (
    <SettingsPage title={t.destService}>
      <Slip>
        {axis ? (
          <div className="svc-chart" role="radiogroup" aria-label={t.destService} onKeyDown={onWalk}>
            <span className="svc-chart__axis" aria-hidden="true">
              {axis.ticks.map(tick => (
                <span key={tick.label} className="svc-chart__tick" style={{ left: `${tick.pct}%` }}>{tick.label}</span>
              ))}
            </span>
            {rows.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={chosen === p.perDay}
                tabIndex={radioTab(desk, i, PACES.findIndex(q => q.perDay === chosen))}
                disabled={busy}
                className={`svc-row${chosen === p.perDay ? ' svc-row--on' : ''}`}
                data-pace={p.perDay}
                onClick={() => choose(p.perDay)}
              >
                <span className="svc-row__names">
                  <span className="svc-row__name">
                    {t.paceName[p.id]}
                    {p.recommended && <span className="svc__star" aria-hidden="true"> ★</span>}
                  </span>
                  <span className="svc-row__pace">{p.perDay} {t.settingsPerDay} · {t.settingsPaceMinutes(minutesFor(p.perDay))}</span>
                  {p.perDay === printedPace && <span className="svc-row__tag">{t.destOnPass}</span>}
                </span>
                <Line axis={axis} at={p.at} code={code} fmt={fmt} />
              </button>
            ))}
            {yours && (
              <div className="svc-row svc-row--yours">
                <span className="svc-row__names">
                  <span className="svc-row__name">{t.settingsYourPace}</span>
                  <span className="svc-row__pace">{t.settingsYourPaceSub(fraction.format(actual))}</span>
                </span>
                <Line axis={axis} at={yours} code={code} fmt={fmt} dashed />
              </div>
            )}
          </div>
        ) : (
          <div className="svc-grid" role="radiogroup" aria-label={t.destService} onKeyDown={onWalk}>
            {PACES.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={chosen === p.perDay}
                tabIndex={radioTab(desk, i, PACES.findIndex(q => q.perDay === chosen))}
                disabled={saving || busy}
                className={`svc${chosen === p.perDay ? ' svc--on' : ''}`}
                data-pace={p.perDay}
                onClick={() => choose(p.perDay)}
              >
                <span className="svc__jp">{t.paceName[p.id]}</span>
                <span className="svc__pace">
                  {p.perDay} {t.settingsPerDay}
                  {p.recommended && <> <span className="svc__star" aria-hidden="true">★</span></>}
                </span>
                <span className="svc__words">{t.settingsPaceMinutes(minutesFor(p.perDay))}</span>
              </button>
            ))}
          </div>
        )}
        {/* A pace set outside the three services (the column is a free
            integer) still shows honestly instead of nowhere. */}
        {custom && <span className="slip__hint">{t.settingsPaceCustom(printedPace)}</span>}
      </Slip>

      {withDest ? (
        <div className="stg-foot">
          {chosenDate && (
            <div className="stg-foot__line dest-line">
              <span className="cap">{t.destValidUntil}</span>
              <b className="dest-line__date">{fmt.format(chosenDate)}</b>
              {dirty && printedDate && <span className="stg-foot__was">{t.settingsInsteadOf(fmt.format(printedDate))}</span>}
            </div>
          )}
          <div className="form__row">
            <button type="button" className="btn-depart btn-depart--sheet" disabled={busy || !dirty} data-action="pace-reprint" onClick={reprint}>
              <span className="btn-depart__jp">{t.destReprint}</span>
            </button>
          </div>
        </div>
      ) : (
        // Without a destination there is no line to draw: the way to
        // one, rather than three rails ending nowhere. A slip of its own
        // (plan 145), saying why: a bare button under the card ran the
        // pane's width on the desk, past the card's edge.
        <Slip label={t.settingsGoal} across>
          <span className="slip__hint">{t.settingsGoalNoneDesc}</span>
          <button
            type="button"
            className="btn-secondary slip__act"
            data-action="goal-set"
            onClick={() => { playClick(); navigate('/profile/settings/destination', { replace: desk }) }}
          >
            {t.settingsGoalSet}
          </button>
        </Slip>
      )}

      {done && <p className="hint" role="status">{t.settingsGoalIssued}</p>}
      {(failed || saveFailed) && <p className="hint" role="alert">{t.onbPassError}</p>}
    </SettingsPage>
  )
}

// Where a service's line ends: the destination's roundel at its arrival,
// and the date over it, reaching back from it past the middle of the
// axis and forward from it before, so a phone's narrow track holds it.
function Line({ axis, at, code, fmt, dashed = false }) {
  const pct = axis.place(at)
  const reach = pct > 50 ? 'svc-row__when--back' : ''
  return (
    <span className="svc-row__track">
      <span className={`svc-row__rail${dashed ? ' svc-row__rail--dashed' : ''}`} style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className={`svc-row__end${dashed ? ' svc-row__end--dashed' : ''}`} style={{ left: `${pct}%` }} aria-hidden="true">{code}</span>
      <span className={`svc-row__when ${reach}`} style={{ left: `${pct}%` }}>{fmt.format(at)}</span>
    </span>
  )
}
