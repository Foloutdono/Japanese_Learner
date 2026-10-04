import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus } from '../../stores/journey'
import { useCredits, openBalance } from '../../stores/credits'
import { useOnline } from '../../hooks/useOnline'
import { useXpGain } from './useXpGain'
import { journeyModel } from '../../domain/goalMath'
import { showsCap } from '../../domain/credits'
import { cardTier, xpClimb } from '../../domain/passCard'
import { StruckMark } from '../offers/StruckMark'
import { Wave } from '../offers/icons'
import { InfinitySign } from '../pass/InfinitySign'
import { playClick } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { statusOf, showStatus } from './hudStatus'

// ── 運行案内 — the HUD (plan 068) ─────────────────────────────
// The strip across the top of every tab screen: sumi, two registers
// of ink, no line colour. Two objects (three until plan 173 folded the
// level's roundel and the pass into one strip, below), each a door:
//
//   status   a station panel: since plan 174 the arrival plate (到着,
//            the owner's pick H4), the destination's grade on a white
//            plate edged in the state's ink, the month the train gets
//            there at the pace kept, and the drift under it (78 J
//            D'AVANCE, À L'HEURE, 9 J DE RETARD, SUSPENDU), inked
//            --success / --warning / --danger. A contract with no
//            destination keeps the word-and-days panel it had. When
//            the network is gone the panel says so instead — the one
//            place the shell owns up to being offline. Tap → the
//            status sheet (components/journey/StatusSheet.jsx, plan
//            074): the pass's back, as a sheet.
//   strip    the learner's card at pocket size (plan 173, HudStrip
//            below): the level and the balance, each its own door.

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
      data-guide="hud.status"
    >
      <span className="hud__status-word">{t.hudStatus[panel.status]}</span>
      {panel.days && <span className="hud__status-delta">· {t.hudDays(panel.days)}</span>}
    </Tag>
  )
}

// 到着 — the arrival plate (plan 174, the owner's pick H4 of the
// canvas "Tsuji — harmony"): where the line ends and when the train
// gets there at the pace kept. The destination's grade on a white plate
// (the station's own 駅名標 white) edged in the state's ink, the month
// of the projected arrival beside it, the drift under the month in the
// same ink. The judgement is the same journeyModel the sheet reads.
export function ArrivalPlate({ status, model, onClick }) {
  const { t, lang } = useLang()
  const panel = statusOf(model)
  if (!panel) return null
  const month = model.projected
    ? new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { month: 'long', year: 'numeric' }).format(model.projected)
    : null
  const drift = panel.days == null
    ? t.hudStatus[panel.status]
    : panel.status === 'ahead' ? t.cardDriftAhead(panel.days) : t.cardDriftLate(panel.days)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={[t.hudStatusLabel, status.goalLevel, month, drift].filter(Boolean).join(' · ')}
      className={`hud__status hud__status--${panel.status} hud__status--arrival`}
      data-guide="hud.status"
    >
      <span className="hud__dest" aria-hidden="true"><i /><b>{status.goalLevel}</b></span>
      <span className="hud__when" aria-hidden="true">
        {month && <b className="hud__month">{month}</b>}
        <span className="hud__status-word">{drift}</span>
      </span>
    </button>
  )
}

// The panel as the chrome draws it: the offline word when the network
// has gone, else the arrival plate -- or, for a contract with no
// destination (judged on pace alone), the word-and-days panel.
function HudStatus({ onClick }) {
  const { t } = useLang()
  const online = useOnline()
  const { data } = useJourneyStatus()

  if (!online) {
    return (
      <button type="button" className="hud__status hud__status--offline" data-guide="hud.status" onClick={onClick}>
        <span className="hud__status-word">{t.hudOffline}</span>
      </button>
    )
  }
  // No contract yet (never onboarded): nothing to judge, no panel.
  const model = data ? journeyModel(data) : null
  if (model?.hasGoal && data.goalLevel) return <ArrivalPlate status={data} model={model} onClick={onClick} />
  return <StatusChip model={model} onClick={onClick} />
}

// ── 帯 — the pocket pass as one strip (plan 173) ─────────────────
// The owner's pick of the canvas page "The pocket pass & the level-up":
// the card at full size belongs to Profile and Settings, and the HUD
// carries it as one strip in the card's own stuff (domain/passCard.js's
// cardTier: white plastic and its band, charcoal, satin platinum), two
// doors on it:
//
//   the level    the struck 辻 at pocket size, its road filled to the
//                climb, and the level beside it; the fare (+4 xp) rises
//                off it when a review pays in. Tap → the profile.
//   the balance  the contactless mark and the balance at the level's
//                size, its cap a step under; ∞ drawn on a plan without
//                one. The strip's edge goes warning at ≤5 and danger at
//                0 (plan 069). Tap → the balance sheet.
//
// The roundel's place went to the station panel, on the strip's left.

/** The balance half: the mark and the figure. */
function HudBalance({ onClick }) {
  const { t } = useLang()
  const desk = useDesk()
  const credits = useCredits()
  const balance = credits?.unlimited ? null : credits?.balance
  const label = [t.passLabel, credits?.unlimited ? t.cardUnlimited : balance != null ? `${balance} / ${credits.cap}` : null].filter(Boolean).join(' · ')
  return (
    <button type="button" className="hstrip__bal" onClick={onClick} aria-label={label} title={desk ? label : undefined} data-guide="hud.pass">
      <Wave />
      {credits?.unlimited && <span className="hstrip__fig hstrip__fig--inf"><InfinitySign /></span>}
      {balance != null && (
        <span className="hstrip__fig">
          <b>{balance}</b>
          {showsCap(balance, credits.cap) && <small>/{credits.cap}</small>}
        </span>
      )}
    </button>
  )
}

function stripClass(credits, solo = false) {
  const balance = credits?.unlimited ? null : credits?.balance
  return [
    'hstrip', `hstrip--${cardTier(credits)}`,
    solo ? 'hstrip--solo' : '',
    balance != null && balance > 0 && balance <= 5 ? 'hstrip--low' : '',
    balance === 0 ? 'hstrip--out' : '',
  ].filter(Boolean).join(' ')
}

// The balance alone, in the card's stuff: the stage head's (plan 070),
// so a run shows the same object the shell does.
export function HudPass({ onClick }) {
  const credits = useCredits()
  return (
    <div className={stripClass(credits, true)}>
      <HudBalance onClick={onClick} />
    </div>
  )
}

// The strip: the level's door and the balance's, perforated between.
function HudStrip() {
  const { t } = useLang()
  const navigate = useNavigate()
  const summary = useProfileSummary()
  const credits = useCredits()
  const { gain, clear } = useXpGain(summary)
  const desk = useDesk()
  const { share } = xpClimb(summary)
  const label = summary ? `${t.level} ${summary.level}` : t.profileTitle
  return (
    <div className={stripClass(credits)}>
      <button
        type="button"
        className={`hstrip__lv${gain ? ' hstrip__lv--gain' : ''}`}
        data-guide="hud.level"
        onClick={() => { playClick(); navigate('/profile') }}
        aria-label={label}
        title={desk ? label : undefined}
      >
        <StruckMark xp={share} etched={cardTier(credits) === 'max'} className="hstrip__mark" />
        <b>{summary?.level ?? ''}</b>
        <FareFigure gain={gain} className="hud-fare" onEnd={clear} />
      </button>
      <i className="hstrip__perf" aria-hidden="true" />
      <HudBalance onClick={() => { playClick(); openBalance() }} />
    </div>
  )
}

// The HUD's two objects, in the order it prints them: the station
// panel, then the strip. The desk's rail sets the same doors at its
// foot (DeskPass.jsx, the holder): the same stores, doors and anchors.
export function HudInstruments() {
  return (
    <>
      {/* The panel opens the status sheet — the card's journey (plan
          074) — rather than walking to the card. */}
      <HudStatus onClick={() => { playClick(); showStatus() }} />
      <HudStrip />
    </>
  )
}

export function Hud() {
  return (
    <header className="hud">
      <div className="hud__inner">
        <HudInstruments />
      </div>
    </header>
  )
}
