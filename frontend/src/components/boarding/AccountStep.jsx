import { useLang } from '../../LangContext'
import { BoardQuestion, Continue, BoardLink } from './BoardFrame'
import { useClaim } from '../../hooks/useClaim'
import { ClaimFields } from '../account/ClaimAccount'
import { ProviderButton } from '../account/ProviderButton'
import { authRedirectError, authRedirectMessage, isAlreadyLinked } from '../../lib/authRedirect'

// ── 本乗車券 — the last stop before the pass ─────────────────────
// The boarding runs on a guest pass (lib/guest.js), so by the time
// anyone reaches this screen they already have a level, a destination,
// a rhythm and an hour — all of it real, all of it on a real account
// that simply has no way back into it. This screen is where that is
// offered, and it is the LAST thing asked rather than the first,
// because a stranger has no reason to hand over an email before they
// have seen what it buys.
//
// Three ways out, and none of them is a wall: put credentials on the
// pass you already hold, sign in to one you already had, or ride on
// without either. The skip is the point of the screen — an account
// asked for at the end and refusable is a different promise from one
// demanded at the door.
export default function AccountStep({ onCreated, onSkip, onSignIn, onLeaveForAuth = null }) {
  const { t } = useLang()
  const claim = useClaim()

  // 改札 — on the web the learner comes BACK to this screen after
  // Google (the stash in screens/BoardingFlow.jsx puts them here), and
  // a refusal arrives on the URL rather than as a returned value:
  // lib/authRedirect.js took it off the URL as the app loaded. A plain
  // read, not state: it cannot change while this page load lasts, and
  // the next attempt is a new load.
  const refused = authRedirectError()

  return (
    <>
      <div className="brd__body brd__body--arrival">
        <BoardQuestion hint={t.brdAccountHint}>{t.brdAccountQ}</BoardQuestion>
        <div className="brd__stage">
          {/* `link` so the guest KEEPS this account rather than being
              handed a second, empty one; onLeaveForAuth is the last
              moment before the web navigates away, when the answers
              still only exist in memory. */}
          <ProviderButton link onBeforeRedirect={onLeaveForAuth} onDone={onCreated} onError={claim.setError} />
          {/* Said here rather than on the fields' own line below: this
              is what the button above did, and the one refusal with a
              way out of it is answered immediately underneath.
              It stands only until the fields have news of their own.
              A refusal read off the URL cannot expire on its own — it
              is a fact about this page load — so a learner who took
              the email road after Google turned them away was left
              reading two red lines at once, the older of which was
              about a road they had already left. The newer answer is
              the one they asked for. */}
          {refused && !claim.error && !claim.done && (
            <p className="auth-message auth-message--error" role="alert" data-oauth="refused">
              {authRedirectMessage(refused, t)}
            </p>
          )}
          {/* That Google account is already somebody's pass, so it
              cannot be added to this one — but it can be ridden.
              Signing in leaves this guest behind, so it is offered as
              its own button and never taken on the learner's behalf,
              and it deliberately does NOT stash: these answers belong
              to the pass being left, not the one being boarded. */}
          {isAlreadyLinked(refused) && (
            <ProviderButton
              label={t.oauthSignInInstead}
              onDone={onCreated}
              onError={claim.setError}
            />
          )}
          <p className="auth-or">{t.orWithEmail}</p>
          <ClaimFields claim={claim} variant="board" />
        </div>
      </div>
      <div className="brd__foot">
        {claim.done
          ? <Continue label={t.onbContinue} onClick={onCreated} data-action="account-done" />
          : (
            <Continue
              label={t.brdAccountCreate}
              onClick={claim.submit}
              disabled={!claim.filled || claim.busy}
              data-action="account-create"
            />
          )}
        {!claim.done && (
          <>
            <BoardLink onClick={onSignIn} data-action="account-sign-in">{t.brdHaveAccount}</BoardLink>
            <BoardLink onClick={onSkip} data-action="account-skip">{t.brdAccountSkip}</BoardLink>
          </>
        )}
      </div>
    </>
  )
}
