import { useLang } from '../../LangContext'
import { BoardQuestion, Continue, BoardLink } from './BoardFrame'
import { composing } from '../../lib/keyGuards'
import { useDesk } from '../../hooks/useDesk'
import { playUi } from '../../lib/audio'

// The pass holder's name at its longest (EditableUsername's rule).
const NAME_MAX = 20

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
//
// The name is the station's (plan 163's D01 on the desk, plan 168's A01
// on a phone): its plate with the letters it has left, a pole down to
// the question's hub (`no`, its place on the line) and the line leaving
// it for the next stop (`next`, that stop's name). On the desk the way
// to an account already held stands under the hub; on a phone, over the
// gate, which stands in the same place on every screen.
export default function NameStep({
  value, onChange, onContinue, onSignIn = null, email = null,
  error = null, busy = false, no = null, next = null,
}) {
  const { t } = useLang()
  const desk = useDesk()
  const canGo = value.trim().length > 0 && !busy
  const field = (
    <input
      className={desk ? `brd-field${value ? '' : ' brd-field--empty'}` : 'brd-plate__field'}
      autoFocus
      value={value}
      maxLength={NAME_MAX}
      autoComplete="nickname"
      aria-label={t.brdNameAria}
      aria-invalid={error ? true : undefined}
      placeholder={t.brdNameAria}
      onChange={e => onChange(e.target.value)}
      // Enter in the field is the gate pressed (BoardFrame's Continue), and
      // sounds its departure.
      onKeyDown={e => { if (e.key === 'Enter' && canGo && !composing(e)) { playUi('click-screen-selection'); onContinue() } }}
    />
  )
  const refusal = error && <p className="brd__error" role="alert">{error}</p>
  const signIn = onSignIn && <BoardLink onClick={onSignIn} data-action="sign-in">{t.brdHaveAccount}</BoardLink>
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={email ? t.brdNameNewPass(email) : null}>{t.brdNameQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? (
            <div className="desk-brd__name">
              <div className="desk-brd__plate">
                {field}
                <span className="desk-brd__plate-count" aria-hidden="true">{`${value.length} / ${NAME_MAX}`}</span>
              </div>
              {refusal}
              <div className="desk-brd__name-line" aria-hidden="true">
                <span className="desk-brd__hub desk-brd__hub--pole">{no}</span>
                {next && (
                  <span className="desk-brd__name-next">
                    <span className="desk-brd__name-next-ring" />
                    {next}
                  </span>
                )}
              </div>
              {signIn}
            </div>
          ) : (
            <div className="brd-name">
              <label className="brd-plate">
                {field}
                <span className="brd-plate__count" aria-hidden="true">{`${value.length} / ${NAME_MAX}`}</span>
                <span className="brd-plate__stripe" aria-hidden="true" />
              </label>
              {refusal}
              <div className="brd-name__line" aria-hidden="true">
                <span className="brd-name__pole" />
                <span className="brd-hub brd-name__hub">{no}</span>
                <span className="brd-name__road" />
                {next && (
                  <span className="brd-name__next">
                    <span className="brd-name__ring" />
                    <span className="brd-name__lab">{next}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="brd__foot">
        {!desk && signIn}
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!canGo} data-action="continue" />
      </div>
    </>
  )
}
