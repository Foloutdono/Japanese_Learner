import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { CommuterPass } from '../profile/CommuterPass'
import { StampRally } from './StampRally'

// ── The pass, in the hall ────────────────────────────────────
// The profile's CommuterPass, mounted on the home screen under the
// fare gate — the same object, which is the point (DESIGN.md's test:
// a screen belongs by reusing the components that already encode the
// specs). What differs is the frame: it is a shortcut to the profile,
// its label is not this screen's heading, and it carries the two
// figures the concourse strip used to hold — the streak, finally as
// the スタンプラリー DESIGN.md specifies rather than a flame, and the
// day's 新規 pace.
//
// On phones the hall hides this card entirely and the concourse's
// compact IC card takes over (560px query) — one identity object per
// viewport, never two.

// ── 新規 — the day's new-item gauge ──────────────────────────
// The onboarding pace (user_profiles.daily_new_target), spent live —
// moved here from the retired concourse strip, unchanged in meaning:
// the bar is progress toward the target; past it the count keeps
// counting while the bar stays full, because "12 / 10" is information
// and a bar over 100% is noise. Renders nothing for an account with
// no stored pace.
function PaceGauge({ pace, t }) {
  const pct = Math.min(100, Math.round((100 * pace.newToday) / Math.max(1, pace.target)))
  const met = pace.newToday >= pace.target
  return (
    <span className="hall-pace" role="img" aria-label={t.paceGaugeAria(pace.newToday, pace.target)}>
      <span className="hall-pace__name">
        <span className="hall-pace__jp" lang="ja">新規</span>
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

export default function HallPass({ pace }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const summary = useProfileSummary()

  // No summary yet (first paint, or the quiet-fail fetch): the hall
  // simply has no pass. The concourse IC card's blank state remains
  // the profile's doorway, so nothing is unreachable meanwhile.
  if (!summary) return null

  const ready = summary.daruma?.ready ?? 0

  return (
    <button type="button" className="hall-pass" onClick={() => navigate('/profile')}>
      <CommuterPass
        profile={summary}
        t={t}
        headingTag="span"
        footer={
          <>
            <StampRally week={summary.week} streak={summary.streak} t={t} />
            {pace && <PaceGauge pace={pace} t={t} />}
          </>
        }
      >
        <div className="hall-pass__holder">{summary.username}</div>
      </CommuterPass>

      {ready > 0 && (
        <span className="ic-card__dot" title={t.darumaReadyCount(ready)}>{ready}</span>
      )}
    </button>
  )
}
