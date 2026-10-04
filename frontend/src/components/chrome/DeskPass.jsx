import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus } from '../../stores/journey'
import { useCredits, openBalance } from '../../stores/credits'
import { useOnline } from '../../hooks/useOnline'
import { useXpGain } from './useXpGain'
import { FareFigure } from './Hud'
import { statusOf, showStatus } from './hudStatus'
import { journeyModel } from '../../domain/goalMath'
import { CAP, showsCap, nextCreditClock } from '../../domain/credits'
import { cardTier, xpClimb } from '../../domain/passCard'
import { StruckMark } from '../offers/StruckMark'
import { CardFace } from '../pass/PassCard'
import { InfinitySign } from '../pass/InfinitySign'
import { playClick } from '../../lib/audio'

// ── 定期入れ — the holder at the rail's foot (plan 127; the holder, plan 173) ──
// Plan 127 set the HUD's three instruments at the rail's foot as one
// card, the learner's pass. Plan 173 redrew the pass as the learner's
// card (components/pass/), and the owner's pick for the foot of the
// canvas page "The pocket pass & the level-up" is the holder: the
// case the card is carried in, the real card's top edge out of its
// mouth -- its stuff, its contactless mark and PASS, the corner 辻 with
// its road in the tier's ink -- and on the case the HUD's three doors,
// each with its guide anchor:
//
//   the climb    the struck 辻 at pocket size filled to the share of the
//                level climbed (the fare still rises off it), the bar,
//                the level and the XP. → the profile.
//   the balance  the figure over what it counts, or when the next
//                credit lands (+1 à 14:32), or what it costs on Pro;
//                ∞ drawn on a plan without one. → the balance sheet.
//   the journey  the drift over the journey's word, lit in the state's
//                ink; the offline word when the network has gone.
//                → the status sheet (showStatus: the panel beside
//                Today's gate, or the sheet).
//
// On the screens that print the whole card -- the profile and Settings
// -- the card is out of the holder and on the page, and the holder's
// mouth says so, so the card is never drawn twice. The case's edge is
// the balance's: warning at five or fewer, danger at none. Desk only:
// the phone carries the same doors on its HUD's strip.
function cardIsOut(pathname) {
  return pathname === '/profile' || pathname.startsWith('/profile/settings')
}

export function DeskPass() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const summary = useProfileSummary()
  const { gain, clear } = useXpGain(summary)
  const credits = useCredits()
  const online = useOnline()
  const { data } = useJourneyStatus()

  const tier = cardTier(credits)
  const climb = xpClimb(summary)
  const pct = Math.round(climb.share * 100)
  const figures = summary ? `${climb.into.toLocaleString(lang)} / ${climb.span.toLocaleString(lang)}` : ''
  const levelLabel = summary ? `${t.level} ${summary.level}` : t.profileTitle

  const unlimited = Boolean(credits?.unlimited)
  const balance = unlimited ? null : credits?.balance
  const cap = credits?.cap ?? CAP
  const low = balance != null && balance > 0 && balance <= 5
  const out = balance === 0
  // What the figure counts, or when the refill lands the next credit
  // (plan 141), or what it costs on Pro; Max's needs no counting.
  const next = balance != null && balance < cap ? nextCreditClock(credits, lang) : null
  const note = unlimited ? t.cardNoCreditShort
    : next ? t.balanceRefillLine(next)
      : tier === 'pro' ? t.cardPerExercise : t.creditsUnit

  // No contract yet (never onboarded): nothing to judge, no journey.
  const panel = online ? statusOf(data ? journeyModel(data) : null) : { status: 'offline', days: null }
  const word = panel && (panel.status === 'offline' ? t.hudOffline : t.hudStatus[panel.status])
  const drift = panel?.days ? t.hudDays(panel.days) : null

  const away = cardIsOut(pathname)
  const classes = [
    'desk-holder', `desk-holder--${tier}`,
    low ? 'desk-holder--low' : '', out ? 'desk-holder--out' : '', away ? 'desk-holder--away' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {away
        ? <span className="desk-holder__slot">{t.cardOnPage}</span>
        : (
          <span className="desk-holder__card">
            <CardFace tier={tier} name={summary?.username ?? ''} level={summary?.level ?? ''} share={climb.share} />
          </span>
        )}
      <div className="desk-holder__case">
        <button
          type="button"
          className={`desk-holder__lv${gain ? ' desk-holder__lv--gain' : ''}`}
          data-guide="hud.level"
          aria-label={summary ? `${levelLabel} · ${figures} xp` : levelLabel}
          title={levelLabel}
          onClick={() => { playClick(); navigate('/profile') }}
        >
          <span className="desk-holder__engr">
            <StruckMark xp={climb.share} className="desk-holder__mark" />
            <FareFigure gain={gain} className="hud-fare" onEnd={clear} />
          </span>
          <span className="desk-holder__track" aria-hidden="true">
            <i style={{ '--holder-xp': pct / 100 }} />
            {gain && gain.toPct > gain.fromPct && (
              <span
                key={gain.id}
                className="desk-holder__gain"
                style={{ '--holder-from': gain.fromPct / 100, '--holder-to': (gain.toPct - gain.fromPct) / 100 }}
              />
            )}
          </span>
          <b className="desk-holder__level">{summary?.level ?? ''} <small>{figures}</small></b>
        </button>
        <div className="desk-holder__row">
          <button
            type="button"
            className="desk-holder__cr"
            data-guide="hud.pass"
            aria-label={[t.passLabel, unlimited ? t.cardUnlimited : balance != null ? `${balance} / ${cap}` : null, note].filter(Boolean).join(' · ')}
            onClick={() => { playClick(); openBalance() }}
          >
            {unlimited && <span className="desk-holder__fig desk-holder__fig--inf"><InfinitySign /></span>}
            {balance != null && (
              <span className="desk-holder__fig">
                <b>{balance}</b>
                {showsCap(balance, cap) && <small>/{cap}</small>}
              </span>
            )}
            {(unlimited || balance != null) && <em>{note}</em>}
          </button>
          {panel && (
            <button
              type="button"
              className={`desk-holder__st desk-holder__st--${panel.status}`}
              data-guide="hud.status"
              aria-label={[t.hudStatusLabel, word, drift].filter(Boolean).join(' · ')}
              onClick={() => { playClick(); showStatus() }}
            >
              <b><i className="desk-holder__lamp" aria-hidden="true" />{drift ?? word}</b>
              {drift && <em>{word}</em>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
