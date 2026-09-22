import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { refreshJourney } from '../../stores/journey'
import { refreshSummary } from '../../stores/profileSummary'
import { addDays, journeyPositions, nextStop } from '../../domain/goalMath'
import { MAX_PACE } from '../onboarding/paces'
import { GhostTrack } from './GhostTrack'
import { journeyStations } from './stations'

// ── 運行状況 — the pass's back, wherever it is drawn ─────────────────
// The body of the status sheet (components/journey/StatusSheet.jsx):
// distance first — the count, the percent, the stop you are heading for
// and the backlog in items — then the ghost track as its proof, then the
// two comparisons (pace, arrival) with the subtraction done, and, when
// behind, the two honest moves. See StatusSheet.jsx for why it leads
// with distance.
//
// Its own component since the desk (plan 113): on a computer the same
// body stands beside the fare gate on Today (JourneyPanel.jsx) rather
// than behind a tap on the HUD, because the question it answers — am I
// on course? — is the one the gate is the answer to. The sheet renders
// it exactly as it did before the extraction.
//
// `onLeave` runs before any action that walks away (the sheet closes
// itself); `resume` offers "resume" when suspended — pointless on the
// screen that IS the resumption, so the Today panel leaves it off.

const iso = d => d.toISOString().slice(0, 10)

// One comparison: what is happening, what was promised, and the
// difference — which is the reader's subtraction, done for them and
// inked in the state's own colour.
function Cmp({ label, value, unit, promised, delta }) {
  return (
    <div className="jour-cmp">
      <span className="jour-cmp__k">{label}</span>
      <span className="jour-cmp__v">
        {value}
        {unit && <span className="jour-cmp__u">{unit}</span>}
      </span>
      {delta && <span className="jour-cmp__d">{delta}</span>}
      <span className="jour-cmp__sub">{promised}</span>
    </div>
  )
}

export function JourneyBody({ status, model, now, volumes, summary, session, onLeave = () => {}, resume = true }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const loc = lang === 'fr' ? 'fr' : 'en'
  // The year rides on every date now. Without it a projection that
  // crossed a year end printed "3 Jan" beside a promised "15 Feb" and
  // read as EARLY, while the sheet's own word said late.
  const fmt = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' })
  const nf = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 })
  const signed = new Intl.NumberFormat(loc, { maximumFractionDigits: 1, signDisplay: 'always' })
  const int = new Intl.NumberFormat(loc)
  const start = status.goalStartLevel ?? summary?.jlptLevel ?? null
  const stations = journeyStations(volumes, start, status.goalLevel, status.itemsTotal)
  const { youF, planF, behind: itemsBehind } = journeyPositions(status, model, now)
  const behind = model.status === 'delayed' || model.status === 'slightlyBehind'
  const canRecover = behind && model.recovery != null && model.recovery <= MAX_PACE

  // The head's second line: the stop the train is heading for, and how
  // many items it stands behind the promise. Without stops (no volumes
  // yet, no destination) there is no next stop to name.
  const stop = stations.length > 1 ? nextStop(stations, youF) : null
  const drift = itemsBehind == null || Math.abs(itemsBehind) < 1
    ? null
    : itemsBehind > 0
      ? t.statusBehindPlan(int.format(itemsBehind))
      : t.statusAheadPlan(int.format(-itemsBehind))
  const leg = [
    stop ? t.statusNextStop(stop.label) : stations.length > 1 ? t.statusArrived : null,
    drift,
  ].filter(Boolean).join(' · ')

  const paceDelta = model.actualPerDay - model.plannedPerDay
  const showPaceDelta = Math.abs(paceDelta) >= 0.05

  async function reprint(body) {
    if (busy) return
    setBusy(true)
    setError(false)
    try {
      await apiJson('/api/journey/reprint', session, { method: 'POST', body: JSON.stringify(body) })
      // The pace rides on the summary, the facts on the journey store:
      // both redraw the HUD and this sheet from the fresh answer.
      await Promise.all([refreshJourney(), refreshSummary()])
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function toOffice() {
    playClick()
    onLeave()
    navigate('/profile/settings/destination')
  }

  return (
    <>
      {status.itemsTotal > 0 && (
        <div className="jour-dist">
          <span className="jour-dist__count">
            {int.format(status.itemsDone)}
            <span className="jour-dist__of">/ {int.format(status.itemsTotal)}</span>
          </span>
          <span className="jour-dist__pct">
            {new Intl.NumberFormat(loc, { style: 'percent' }).format(youF / 100)}
          </span>
          {leg && <span className="jour-dist__leg">{leg}</span>}
        </div>
      )}

      <GhostTrack stations={stations} youF={youF} planF={planF} />

      <div className="jour-cmps">
        <Cmp
          label={t.statusPace}
          value={nf.format(model.actualPerDay)}
          unit={t.perDayUnit}
          promised={t.statusPromisedPace(model.plannedPerDay)}
          delta={showPaceDelta ? signed.format(paceDelta) : null}
        />
        {model.hasGoal && (
          <Cmp
            label={t.statusArrival}
            value={model.projected ? fmt.format(model.projected) : '—'}
            promised={model.planned ? t.statusOnPassDate(fmt.format(model.planned)) : null}
            delta={model.deltaDays ? t.statusDaysDelta(model.deltaDays) : null}
          />
        )}
      </div>

      {model.hasGoal && (behind || model.status === 'suspended') && (
        <div className="jour-rev__actions">
          {model.status === 'suspended' ? (
            <>
              {resume && (
                <button type="button" className="jour-act" disabled={busy} onClick={() => { onLeave(); navigate('/today') }}>
                  <strong>{t.jourActResume}</strong>{t.jourActResumeSub}
                </button>
              )}
              {model.remaining > 0 && (
                <button
                  type="button"
                  className="jour-act"
                  disabled={busy}
                  onClick={() => reprint({ dailyNewTarget: 5, goalTargetDate: iso(addDays(new Date(), model.remaining / 5)) })}
                >
                  <strong>{t.jourActSlow(5)}</strong>
                  {t.jourActSlowSub(fmt.format(addDays(new Date(), model.remaining / 5)))}
                </button>
              )}
            </>
          ) : (
            <>
              {canRecover && (
                <button type="button" className="jour-act" disabled={busy} onClick={() => reprint({ dailyNewTarget: model.recovery })}>
                  <strong>{t.jourActRecover(model.recovery)}</strong>
                  {t.jourActRecoverSub(fmt.format(model.planned))}
                </button>
              )}
              {model.projected && (
                <button type="button" className="jour-act" disabled={busy} onClick={() => reprint({ goalTargetDate: iso(model.projected) })}>
                  <strong>{t.jourActReprint}</strong>
                  {t.jourActReprintSub(fmt.format(model.projected))}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!model.hasGoal && (
        <p className="hint status-sheet__none">
          {t.jourNoDest}{' '}
          <button type="button" className="status-sheet__office" onClick={toOffice}>{t.jourNoDestLink}</button>
        </p>
      )}

      {error && <p className="hint status-sheet__error" role="alert">{t.jourReprintError}</p>}
    </>
  )
}
