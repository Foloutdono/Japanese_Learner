import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { CommuterPass } from '../profile/CommuterPass'
import { useCredits } from '../../stores/credits'
import { CAP, SIGNUP_BONUS, showsCap, refillMinutes } from '../../domain/credits'
import { BoardQuestion, Continue } from './BoardFrame'
import { SOURCES } from '../../domain/paywall'
import { OfferButton } from '../credits/OfferButton'
import { useCountUp, stillPreferred } from './countUp'

// ── The pass, issued (plan 075) ──────────────────────────────────
// The last arrival screen: the printed commuter pass slides up and the
// 発行 seal lands on it. The pass is the profile's own object
// (components/profile/CommuterPass.jsx) with the holder at level one
// and the balance on its foot -- a new account's SIGNUP_BONUS, the
// welcome core/credits.py grants on first read. It is above the cap, so
// the line prints the figure without one (domain/credits' showsCap).
// "Enter the station" posts the whole contract; the gate then opens
// (App.jsx's TicketGate finale).
//
// The offer sits above that button as a quiet line, never as the
// primary action: the last thing a learner does before their first
// lesson must be starting it. It is shown here because this is the
// screen where the balance is explained, which is the only place the
// pass means anything yet.

// The profile's holder as printed: the initial with no ring, since plan
// 143 took the XP arc off the pass (the balance row's bar is the climb).
function PrintedHolder({ name }) {
  return (
    <div className="pass__holder">
      <div className="pass__avatar-wrap">
        <div className="pass__avatar">{name.charAt(0).toUpperCase()}</div>
      </div>
      <span className="profile-card__name">{name}</span>
    </div>
  )
}

// The balance line as the boarding prints it: the store's answer when
// it has one, and the welcome -- what a fresh account holds -- until
// then. Same classes as components/credits/BalanceLine.jsx, so
// the profile and the boarding print the same line.
function PrintedBalance() {
  const { t } = useLang()
  const credits = useCredits()
  const cap = credits?.cap ?? CAP
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const counting = balance != null && !stillPreferred()
  const shown = useCountUp(balance, counting)
  // The note says the balance was GIVEN, so it prints only when the
  // balance is the welcome itself. A learner who already had an
  // account (the boarding's sign-in road ends on this same pass) sees
  // their own figure counted up, and is not told it is a present.
  const gift = balance === SIGNUP_BONUS
  return (
    <div className="jour-line balance-line">
      {/* The word and the figure are one part — see BalanceLine, whose
          composition this repeats. (The gift note is absolute, so it
          takes no part in the line's division.) */}
      <span className="balance-line__reading">
        <span className="jour-line__status"><b className="balance-line__word">{t.balanceLabel}</b></span>
        <span className="jour-line__validity">
          <b>{balance == null ? '∞' : shown}</b>
          {balance != null && (
            <span className="jour-cap">
              {showsCap(balance, cap) ? `/ ${cap} ` : ''}{t.creditsUnit}
            </span>
          )}
        </span>
      </span>
      {/* The rhythm rather than an hour: a welcome over the cap has no
          next credit to name yet, and the rhythm is what it will be
          (plan 141). */}
      {balance != null && <span className="jour-cap balance-line__refill">{t.balanceRefillRate(refillMinutes(credits))}</span>}
      {gift && <span className="brd-gift" aria-live="polite">{t.brdCreditsGift(balance)}</span>}
    </div>
  )
}

// Why "Enter the station" did not go through, over the button that
// posts the contract: here, and on the desk wherever that button went
// once this screen folded away (the plan, the account; plan 140).
// 'refused' is the office answering and turning the contract down -- a
// wrong thing to blame on the connection, and the one case where trying
// again unchanged earns the same answer. 'network' is the line the app
// never got down.
export function PassError({ error }) {
  const { t } = useLang()
  if (!error) return null
  return (
    <p className="brd__error" role="alert" data-error={error}>
      {error === 'refused' ? t.brdPassRefused : t.onbPassError}
    </p>
  )
}

// On a phone (plan 167, the owner's A-La carte) the pass stands in the
// room under its question, and a road in the pass's metal runs from it
// down to the gate's reader: the card is what is tapped on the way in.
// The offer, when there is one, is a quiet line over the gate, as every
// quiet way in the boarding is, drawn as they are. The desk never shows
// this screen (plan 140: the pass is issued on the plan).
export default function PassStep({ name, profile, onEnter, busy = false, error = null }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdEnjoy}>
          <Emphasized text={t.brdPassQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage brd-issue-stn">
          <div className="brd-issue">
            <CommuterPass profile={{ ...profile, username: name }} t={t} footer={<PrintedBalance />} headingTag="span">
              <PrintedHolder name={name} />
            </CommuterPass>
            <span className="brd-issue__shine" aria-hidden="true" />
          </div>
          <span className="brd-issue__road" aria-hidden="true" />
        </div>
      </div>
      <div className="brd__foot brd__foot--road">
        <OfferButton source={SOURCES.ONBOARDING} className="brd__link" />
        <PassError error={error} />
        <Continue keys label={t.brdEnter} onClick={onEnter} disabled={busy} data-action="enter" />
      </div>
    </>
  )
}
