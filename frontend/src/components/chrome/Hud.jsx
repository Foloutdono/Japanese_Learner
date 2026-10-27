import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus } from '../../stores/journey'
import { useCredits, useClaimLanded, openBalance } from '../../stores/credits'
import { useOnline } from '../../hooks/useOnline'
import { useXpGain } from './useXpGain'
import { journeyModel } from '../../domain/goalMath'
import { showsCap } from '../../domain/credits'
import { cardTier, xpClimb } from '../../domain/passCard'
import { StruckMark } from '../offers/StruckMark'
import { Wave } from '../offers/icons'
import { InfinitySign } from '../pass/InfinitySign'
import { GearIcon } from '../ui/Icons'
import { playClick } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { statusOf, showStatus } from './hudStatus'
import { StripRefill } from '../credits/RefillCard'

// ── 運行案内 — the HUD (plan 068) ─────────────────────────────
// The strip across the top of every tab screen: sumi, two registers
// of ink, no line colour. Three objects (four until plan 173 folded the
// level's roundel and the pass into one strip, below), each a door:
//
//   gear     Réglages, at the start (plan 275, the owner's pick C of
//            the canvas "Tsuji — settings in the HUD"): the soft ink,
//            lit as the tab bar lights its gate while a settings page
//            is open. The phone's settings were a door behind Profile.
//   status   a station panel: since plan 199 the goal's ring (環, the
//            owner's pick A, after plan 174's arrival plate), the
//            destination's grade in a roundel whose arc is the share
//            done, the share and the drift beside it (+17j, −9j, À
//            L'HEURE, SUSPENDU), inked --success / --warning /
//            --danger. A contract with no destination keeps the
//            word-and-days panel it had. When
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

// 環 — the goal as a ring (plan 199, the owner's pick A of the canvas
// "Tsuji — Today at a glance", which found the arrival plate -- a white
// plate on a dark panel beside the card's own strip -- out of tune with
// the rest of the chrome). The destination's grade in a roundel, the
// share of its items done as the roundel's arc in the state's ink (a
// ring, the way the app draws a pigment), and beside it the share and
// the drift, signed, in that ink: where you are going, how far along,
// and whether the train is ahead. The same journeyModel the sheet reads.
const RING_R = 14.5
const RING_C = 2 * Math.PI * RING_R
export function GoalRing({ status, model, onClick }) {
  const { t } = useLang()
  const panel = statusOf(model)
  if (!panel) return null
  const total = status.itemsTotal ?? 0
  const share = total > 0 ? Math.min(1, Math.max(0, (status.itemsDone ?? 0) / total)) : 0
  const pct = Math.floor(share * 100)
  const drift = panel.days == null
    ? t.hudStatus[panel.status]
    : `${panel.status === 'ahead' ? '+' : '−'}${t.hudDays(panel.days)}`
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={[t.hudStatusLabel, status.goalLevel, t.percent(pct), panel.days == null ? drift : (panel.status === 'ahead' ? t.cardDriftAhead(panel.days) : t.cardDriftLate(panel.days))].filter(Boolean).join(' · ')}
      className={`hud__status hud__status--${panel.status} hud__status--ring`}
      data-guide="hud.status"
    >
      <svg className="hud__ring" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
        <circle className="hud__ring-track" cx="17" cy="17" r={RING_R} />
        {share > 0 && (
          <circle className="hud__ring-arc" cx="17" cy="17" r={RING_R} strokeDasharray={`${share * RING_C} ${RING_C}`} transform="rotate(-90 17 17)" />
        )}
        <text className="hud__ring-dest" x="17" y="17.5" textAnchor="middle" dominantBaseline="middle">{status.goalLevel}</text>
      </svg>
      <span className="hud__ring-figs" aria-hidden="true">
        <b>{t.percent(pct)}</b>
        <span className="hud__status-word">{drift}</span>
      </span>
    </button>
  )
}

// The panel as the chrome draws it: the offline word when the network
// has gone, else the goal's ring -- or, for a contract with no
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
  if (model?.hasGoal && data.goalLevel) return <GoalRing status={data} model={model} onClick={onClick} />
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
// On arrival with credits the refill landed, the card drops out from
// under the strip, is charged, and goes back (StripRefill, plan 276);
// the balance it comes back with glints once on its door.
//
// The roundel's place went to the station panel, on the strip's left.

/** The balance half: the mark and the figure. */
function HudBalance({ onClick }) {
  const { t } = useLang()
  const desk = useDesk()
  const credits = useCredits()
  const landed = useClaimLanded()
  const balance = credits?.unlimited ? null : credits?.balance
  const label = [t.passLabel, credits?.unlimited ? t.cardUnlimited : balance != null ? `${balance} / ${credits.cap}` : null].filter(Boolean).join(' · ')
  return (
    <button type="button" className="hstrip__bal" onClick={onClick} aria-label={label} title={desk ? label : undefined} data-guide="hud.pass">
      {landed > 0 && <i key={landed} className="hstrip__landed" aria-hidden="true" />}
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
      <StripRefill />
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
      <StripRefill />
    </div>
  )
}

// ── 設定 — the gear (plan 275) ───────────────────────────────
// A place, so a link. Lit on every settings page, the index and the
// pages behind it, as the tab bar's gate is lit on its stations. A
// hairline parts it from the panel beside it (index.css), and goes with
// the panel when there is none.
function HudGear() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const on = pathname === '/profile/settings' || pathname.startsWith('/profile/settings/')
  return (
    <Link
      to="/profile/settings"
      className={on ? 'hud__gear hud__gear--on' : 'hud__gear'}
      aria-label={t.settings}
      aria-current={on ? 'page' : undefined}
      data-guide="hud.settings"
      onClick={() => playClick()}
    >
      <GearIcon size={22} />
    </Link>
  )
}

// The HUD's three objects, in the order it prints them: the gear and
// the station panel at the start, the strip at the end. The desk's rail
// sets the panel's and the strip's doors at its foot (DeskPass.jsx, the
// holder): the same stores, doors and anchors; its settings are a place
// on the rail.
export function HudInstruments() {
  return (
    <>
      <div className="hud__lead">
        <HudGear />
        {/* The panel opens the status sheet — the card's journey (plan
            074) — rather than walking to the card. */}
        <HudStatus onClick={() => { playClick(); showStatus() }} />
      </div>
      <HudStrip />
    </>
  )
}

export function Hud({ away = false, arrive = false }) {
  return (
    <header className={away ? 'hud hud--away' : arrive ? 'hud hud--arrive' : 'hud'}>
      <div className="hud__inner">
        <HudInstruments />
      </div>
    </header>
  )
}
