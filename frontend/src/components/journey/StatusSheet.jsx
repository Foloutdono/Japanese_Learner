import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { Sheet } from '../chrome/Sheet'
import { useJourneyStatus, useVolumes, useStatusOpenedAt, closeStatus, refreshJourney } from '../../stores/journey'
import { refreshSummary, useProfileSummary } from '../../stores/profileSummary'
import { addDays, journeyModel, journeyPositions, nextStop } from '../../domain/goalMath'
import { MAX_PACE } from '../onboarding/paces'
import { GhostTrack } from './GhostTrack'
import { journeyStations } from './stations'

// ── 運行状況 — the status sheet (進捗が主役, chosen off a four-
// direction mockup round; plan 074 drew the two-lane one it replaces) ─
// The pass's back, as a bottom sheet off the HUD's station panel, and
// it leads with DISTANCE: how far along the line you are (the count,
// the percent, the stop you are heading for and the backlog in items),
// then the ghost track directly under it as the proof, then two
// comparison rows — pace and arrival, each against what the pass
// promised, with the difference already worked out — and, when behind,
// the two honest moves: run faster and keep the date, or reprint the
// date at the pace kept.
//
// Why distance first: itemsDone/itemsTotal arrived on every payload,
// placed the car as a percentage and was then thrown away, so the one
// fact a learner can act on without arithmetic was the one fact the
// sheet never printed. The four-figure lattice went with it — two of
// its cells were one comparison and two were another, and it left both
// subtractions to the reader.
//
// The judgement is domain/goalMath's journeyModel over the same facts
// the HUD reads (stores/journey), so the sheet can never disagree with
// the panel that opened it.
//
// A pass with no destination is judged on pace alone and points at the
// office (Settings › Destination); a pass with no contract at all
// (never onboarded) has nothing to show and the panel never opens it.

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

export function StatusSheet({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  // 0 while the sheet is closed; the moment it opened otherwise.
  const nowMs = useStatusOpenedAt()
  const open = nowMs > 0
  const { data: status } = useJourneyStatus()
  const { data: volumes } = useVolumes()
  const summary = useProfileSummary()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const model = useMemo(
    () => (status && nowMs ? journeyModel(status, new Date(nowMs)) : null),
    [status, nowMs],
  )

  if (!open) return null
  if (!model || model.status == null) return null

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
  const { youF, planF, behind: itemsBehind } = journeyPositions(status, model, new Date(nowMs))
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
    closeStatus()
    navigate('/profile/settings/destination')
  }

  return (
    <Sheet
      open
      onClose={closeStatus}
      sumi
      className={`status-sheet jour-st--${model.status}`}
      /* The verdict is a word no longer printed on this sheet — the
         state's ink and the two deltas carry it — so the sheet's own
         name is where a screen reader still hears it. */
      label={`${t.hudStatusLabel} — ${t.jourStatus[model.status]}`}
    >
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
              <button type="button" className="jour-act" disabled={busy} onClick={() => { closeStatus(); navigate('/today') }}>
                <strong>{t.jourActResume}</strong>{t.jourActResumeSub}
              </button>
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
                  <strong>{t.jourActReprint(fmt.format(model.projected))}</strong>
                  {t.jourActReprintSub(nf.format(model.actualPerDay))}
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
    </Sheet>
  )
}
