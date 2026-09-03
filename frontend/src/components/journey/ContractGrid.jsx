import { serviceLabel } from '../onboarding/paces'
import { DEPART_JP } from '../onboarding/departures'

// ── The contract, printed on the back ─────────────────────────
// The cells of the application form (OnboardingFlow's printed pass),
// reprinted on the reverse of the pass they became: where you boarded,
// where you are going, the service you booked, the hour you said you
// would ride, the date the pass is good until, and the day it was
// issued. Only the cells the contract actually has — a goal-less pass
// prints its service and nothing it never promised.
//
// Its own module since 行先 (the settings counter) prints the same
// cells above the controls that change them: what you are about to
// edit and what the pass says must be one drawing, not two that drift.
// It inks with the panel family, so it belongs on a sumi ground — the
// pass's back gives it one, and the counter wraps it in
// .stg-goal__contract to do the same.

export function ContractGrid({ status, start, fmt, t }) {
  const service = status.plannedPerDay ? serviceLabel(status.plannedPerDay) : null
  const cells = [
    start && { k: '乗車駅', v: start },
    status.goalLevel && { k: '行先', v: status.goalLevel },
    service && {
      k: '種別',
      v: (
        <>
          <span lang="ja" className="jour-grid__jp">{service.jp}</span> · {status.plannedPerDay}
          <span className="jour-grid__u"> {t.settingsPerDay}</span>
        </>
      ),
    },
    DEPART_JP[status.dailyDeparture] && { k: '発車時刻', v: <span lang="ja" className="jour-grid__jp">{DEPART_JP[status.dailyDeparture]}</span> },
    status.goalTargetDate && { k: '有効期限', v: fmt.format(new Date(status.goalTargetDate)), gold: true },
    status.goalSetAt && { k: '発行日', v: fmt.format(new Date(status.goalSetAt)) },
  ].filter(Boolean)

  if (!cells.length) return null
  return (
    <div className="jour-grid">
      {cells.map(c => (
        <div key={c.k} className="jour-grid__cell">
          <span className="jour-grid__k" lang="ja">{c.k}</span>
          <span className={`jour-grid__v${c.gold ? ' jour-grid__v--gold' : ''}`}>{c.v}</span>
        </div>
      ))}
    </div>
  )
}
