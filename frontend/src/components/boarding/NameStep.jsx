import { useLang } from '../../LangContext'
import { BoardQuestion, Continue, BoardLink } from './BoardFrame'

// ── 1 · the name (plan 075) ──────────────────────────────────────
// A real field, already focused: the keyboard comes up with the
// screen and pushes the foot above it. The name is the pass holder's
// (user_profiles.username, the same rule EditableUsername applies), so
// the office refuses what the profile would refuse -- here, before the
// pass prints, not on it.
//
// `onSignIn` is here because this is the first question and back from
// it leaves the boarding entirely: a learner who already has an
// account and tapped Embarquer by mistake should not have to guess
// that the way to their own account is backwards out of a flow they
// did not mean to start.
//
// `email` names the pass being filled in, and is the same door said
// out loud. The boarding only ever runs on an account with no journey
// on it (App.jsx gates on onboarded_at), so an address here means one
// thing: this is a NEW pass for that address. A guest has none and
// sees nothing. The learner it is written for is the one who pressed
// "Continue with Google", landed on an account Supabase had just
// minted for a Google identity no pass carried, and was shown seven
// questions with no hint that their own journey was somewhere else —
// see components/settings/AccountPage.jsx for the road back to it.
export default function NameStep({
  value, onChange, onContinue, onSignIn = null, email = null,
  error = null, busy = false,
}) {
  const { t } = useLang()
  const canGo = value.trim().length > 0 && !busy
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={email ? t.brdNameNewPass(email) : null}>{t.brdNameQ}</BoardQuestion>
        <div className="brd__stage">
          <input
            className={`brd-field${value ? '' : ' brd-field--empty'}`}
            autoFocus
            value={value}
            maxLength={20}
            autoComplete="nickname"
            aria-label={t.brdNameAria}
            aria-invalid={error ? true : undefined}
            placeholder={t.brdNameAria}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canGo) onContinue() }}
          />
          {error && <p className="brd__error" role="alert">{error}</p>}
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} disabled={!canGo} data-action="continue" />
        {onSignIn && <BoardLink onClick={onSignIn} data-action="sign-in">{t.brdHaveAccount}</BoardLink>}
      </div>
    </>
  )
}
