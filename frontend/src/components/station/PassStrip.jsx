import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { StampRally } from './StampRally'

// ── The strip under the gate (plan 070) ──────────────────────
// The pass at strip size: the stamp rally and the day's new-item
// gauge, and nothing else of the card — a shortcut to the profile,
// where the full pass lives. It replaces the hall pass (the whole
// CommuterPass mounted under the old home's gate), which a phone
// never showed anyway.

// ── 新規 — the day's new-item gauge ──────────────────────────
// The onboarding pace (user_profiles.daily_new_target), spent live:
// the bar is progress toward the target; past it the count keeps
// counting while the bar stays full, because "12 / 10" is information
// and a bar over 100% is noise. Renders nothing for an account with
// no stored pace.
export function PaceGauge({ pace, t }) {
  const pct = Math.min(100, Math.round((100 * pace.newToday) / Math.max(1, pace.target)))
  const met = pace.newToday >= pace.target
  return (
    <span className="hall-pace" role="img" aria-label={t.paceGaugeAria(pace.newToday, pace.target)}>
      <span className="hall-pace__name">
        <span className="hall-pace__latin">{t.paceGaugeLabel}</span>
      </span>
      <span className="hall-pace__bar" aria-hidden="true">
        <span className="hall-pace__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="hall-pace__count" aria-hidden="true">
        {pace.newToday}<span className="hall-pace__sep"> / </span>{pace.target}
      </span>
      {met && <span className="onb-reco-badge hall-pace__met" aria-hidden="true">済</span>}
    </span>
  )
}

export default function PassStrip({ pace }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const summary = useProfileSummary()

  // No summary yet (first paint, or the quiet-fail fetch): no strip.
  // The profile tab remains the way to the pass meanwhile.
  if (!summary) return null

  return (
    <button type="button" className="pass pass--strip" onClick={() => navigate('/profile')} aria-label={t.passLabel}>
      <StampRally week={summary.week} streak={summary.streak} t={t} />
      {pace && <PaceGauge pace={pace} t={t} />}
    </button>
  )
}
