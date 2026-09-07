import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus, openStatus } from '../../stores/journey'
import { useCredits, openBalance } from '../../stores/credits'
import { useOnline } from '../../hooks/useOnline'
import { useXpGain } from './useXpGain'
import { journeyModel } from '../../domain/goalMath'
import { playClick } from '../../lib/audio'

// ── 運行案内 — the HUD (plan 068) ─────────────────────────────
// The strip across the top of every tab screen: sumi, two registers
// of ink, no line colour. Three objects, each a door:
//
//   level    the roundel the old top bar already had, the level
//            inside it, the fare (+4 xp) rising off it in gold when a
//            review pays in. Tap → the pass.
//   status   a station panel: the journey model's word in the
//            learner's language with the drift in days beside it
//            (AHEAD · 9d, ON TIME, LATE · 9d, SUSPENDED after 14 idle
//            days), inked --success / --warning / --danger. When the
//            network is gone the panel says so instead — the one
//            place the shell owns up to being offline. Tap → the
//            status sheet (components/journey/StatusSheet.jsx, plan
//            074): the pass's back, as a sheet.
//   pass     the commuter pass at pocket size with the balance inside
//            (stores/credits, plan 069; ∞ on a subscription). The
//            card's edge goes warning at ≤5 and danger at 0. Tap → the
//            balance sheet (components/credits/BalanceSheet.jsx).

// The figure itself: the amount, and a unit in the caption register so
// a bare number under a level roundel cannot be read as levels. `key`
// on the caller remounts it per gain so the rise replays; the caller
// clears its gain off this element's own animationend, never off a
// timer guessing at the CSS.
export function FareFigure({ gain, className, onEnd }) {
  if (!gain) return null
  return (
    <span
      key={gain.id}
      className={className}
      aria-hidden="true"
      onAnimationEnd={e => { if (e.animationName === 'hud-fare') onEnd() }}
    >
      +{gain.delta}<span className="hud-fare__unit">xp</span>
    </span>
  )
}

// The word on the panel, and the class that inks it. slightlyBehind
// and delayed both read "late" — the days beside the word are what
// tell the two apart, and the ink does the rest.
function statusOf(model) {
  if (!model?.status) return null
  const { status, deltaDays } = model
  const days = status === 'ahead' || status === 'slightlyBehind' || status === 'delayed'
    ? (deltaDays == null ? null : Math.abs(deltaDays))
    : null
  return { status, days: days || null }
}

// The station panel itself — the word and the drift — shared with the
// status sheet (plan 074), which opens on the same object it was
// tapped from. A button on the HUD, a plain mark on the sheet.
export function StatusChip({ model, onClick = null }) {
  const { t } = useLang()
  const panel = statusOf(model)
  if (!panel) return null
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-label': t.hudStatusLabel } : {})}
      className={`hud__status hud__status--${panel.status}`}
    >
      <span className="hud__status-word">{t.hudStatus[panel.status]}</span>
      {panel.days && <span className="hud__status-delta">· {t.hudDays(panel.days)}</span>}
    </Tag>
  )
}

function HudStatus({ onClick }) {
  const { t } = useLang()
  const online = useOnline()
  const { data } = useJourneyStatus()

  if (!online) {
    return (
      <button type="button" className="hud__status hud__status--offline" onClick={onClick}>
        <span className="hud__status-word">{t.hudOffline}</span>
      </button>
    )
  }
  // No contract yet (never onboarded): nothing to judge, no panel.
  return <StatusChip model={data ? journeyModel(data) : null} onClick={onClick} />
}

// The pass at pocket size. Shared with the stage head (plan 070), so a
// run shows the same object the shell does.
export function HudPass({ onClick }) {
  const { t } = useLang()
  const credits = useCredits()
  const balance = credits?.unlimited ? null : credits?.balance
  const low = balance != null && balance > 0 && balance <= 5
  const out = balance === 0
  const classes = ['hud__pass', low ? 'hud__pass--low' : '', out ? 'hud__pass--out' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} onClick={onClick} aria-label={t.passLabel}>
      {/* The contactless mark: three rings, classed rather than bare
          spans so the pass block's own `span` rules never meet them
          in stylelint's specificity order. */}
      <span className="hud__pass-wave" aria-hidden="true">
        <span className="hud__pass-ring" />
        <span className="hud__pass-ring hud__pass-ring--2" />
        <span className="hud__pass-ring hud__pass-ring--3" />
      </span>
      {credits?.unlimited && <span className="hud__pass-fig hud__pass-fig--inf">∞</span>}
      {balance != null && (
        <span className="hud__pass-fig">
          {balance}<span className="hud__pass-of">/{credits.cap}</span>
        </span>
      )}
    </button>
  )
}

export function Hud() {
  const { t } = useLang()
  const navigate = useNavigate()
  const summary = useProfileSummary()
  const { gain, clear } = useXpGain(summary)
  const toPass = () => { playClick(); navigate('/profile') }

  return (
    <header className="hud">
      <div className="hud__inner">
        <button
          type="button"
          className={`hud__level${gain ? ' hud__level--gain' : ''}`}
          onClick={toPass}
          aria-label={summary ? `${t.level} ${summary.level}` : t.profileTitle}
        >
          <span>{summary?.level ?? ''}</span>
          <FareFigure gain={gain} className="hud-fare" onEnd={clear} />
        </button>
        {/* The panel opens the status sheet — the pass's back (plan
            074) — rather than walking to the pass. */}
        <HudStatus onClick={() => { playClick(); openStatus() }} />
        <HudPass onClick={() => { playClick(); openBalance() }} />
      </div>
    </header>
  )
}
