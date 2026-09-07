import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { Sheet } from '../chrome/Sheet'
import { StatusChip } from '../chrome/Hud'
import { useJourneyStatus, useVolumes, useStatusOpenedAt, closeStatus, refreshJourney } from '../../stores/journey'
import { refreshSummary, useProfileSummary } from '../../stores/profileSummary'
import { addDays, journeyModel } from '../../domain/goalMath'
import { MAX_PACE } from '../onboarding/paces'
import { GhostTrack } from './GhostTrack'
import { journeyStations } from './stations'

// ── 運行状況 — the status sheet (canvas StatusSheet, plan 074) ───
// The pass's back, as a bottom sheet off the HUD's station panel: the
// panel's own word at the top, the ghost track (your train above the
// rail, the plan's car below it, the gap in days), four figures — the
// last fortnight's pace, the promised one, the arrival at this pace
// and the date on the pass — and, when behind, the two honest moves:
// run faster and keep the date, or reprint the date at the pace kept.
// The judgement is domain/goalMath's journeyModel over the same facts
// the HUD reads (stores/journey), so the sheet can never disagree with
// the panel that opened it.
//
// A pass with no destination is judged on pace alone and points at the
// office (Settings › Destination); a pass with no contract at all
// (never onboarded) has nothing to show and the panel never opens it.

const iso = d => d.toISOString().slice(0, 10)

function Fig({ value, unit, label, state = false }) {
  return (
    <div className="jour-fig">
      <span className={`jour-fig__v${state ? ' jour-fig__v--st' : ''}`}>
        {value}
        {unit && <span className="jour-fig__u">{unit}</span>}
      </span>
      <span className="jour-fig__l">{label}</span>
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

  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { day: 'numeric', month: 'short' })
  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr' : 'en', { maximumFractionDigits: 1 })
  const start = status.goalStartLevel ?? summary?.jlptLevel ?? null
  const stations = journeyStations(volumes, start, status.goalLevel, status.itemsTotal)
  const youF = status.itemsTotal ? (status.itemsDone / status.itemsTotal) * 100 : 0
  let planF = null
  if (model.hasGoal && model.planned && status.goalSetAt) {
    const setAt = new Date(status.goalSetAt).getTime()
    const span = model.planned.getTime() - setAt
    planF = span <= 0 ? 100 : Math.min(Math.max(((nowMs - setAt) / span) * 100, 0), 100)
  }
  const behind = model.status === 'delayed' || model.status === 'slightlyBehind'
  const canRecover = behind && model.recovery != null && model.recovery <= MAX_PACE
  const gapLabel = model.deltaDays == null ? null : t.jourDays(Math.abs(model.deltaDays))

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
    <Sheet open onClose={closeStatus} sumi className={`status-sheet jour-st--${model.status}`} label={t.hudStatusLabel}>
      <div className="jour-rev__head"><StatusChip model={model} /></div>

      <GhostTrack
        stations={stations}
        youF={youF}
        planF={planF}
        gapDeltaDays={model.deltaDays}
        gapLabel={gapLabel}
        youLabel={t.jourYou}
        planLabel={t.jourPlan}
      />

      <div className="jour-figs">
        <Fig value={nf.format(model.actualPerDay)} unit={t.perDayUnit} label={t.statusLast14} />
        <Fig value={model.plannedPerDay} unit={t.perDayUnit} label={t.statusPromised} />
        <Fig value={model.projected ? fmt.format(model.projected) : '—'} label={t.statusAtThisPace} state />
        <Fig value={model.planned ? fmt.format(model.planned) : '—'} label={t.statusOnThePass} />
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
