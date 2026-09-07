import { useLang } from '../../LangContext'
import { BoardQuestion, Continue, BoardLink } from './BoardFrame'
import { useClaim } from '../../hooks/useClaim'
import { ClaimFields } from '../account/ClaimAccount'
import { ProviderButton } from '../account/ProviderButton'

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
