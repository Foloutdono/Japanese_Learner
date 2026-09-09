import { useLang } from '../../LangContext'
import { supabase } from '../../lib/supabase'
import { authRedirectError, authRedirectMessage } from '../../lib/authRedirect'
import { API_ORIGIN } from '../../lib/origin'
import { isNative, openExternal } from '../../lib/platform'
import { isGuest } from '../../lib/guest'
import { useClaim } from '../../hooks/useClaim'
import { ClaimFields } from '../account/ClaimAccount'
import { ProviderButton } from '../account/ProviderButton'
import { SettingsPage, Slip } from './SettingsPage'

// ── Account ───────────────────────────────────────────────────
// Who the card is issued to, the privacy policy (plan 066), and the
// sign-out. `local` scope: this is "sign out of this device", which is
// what the row says — the default `global` also revokes the learner's
// other devices.
//
// A guest (lib/guest.js) is issued to nobody yet, so the first slip
// becomes the offer instead of the address. This is the second half of
// letting the boarding be refused: an offer made once at the end and
// never again would make "continue without an account" a trap, since a
// guest pass lives in one browser's storage and nothing else. Signing
// out is that same trap with a button, so for a guest the row says so.
function ClaimSlip() {
  const { t } = useLang()
  const claim = useClaim()
  // 改札 — linking from here leaves the page on the web and comes back
  // to the app's ROOT, so a refusal arrives on the URL (read by
  // lib/authRedirect.js) rather than through onError, and it lands the
  // learner on /today rather than back on this slip. Saying it here is
  // what makes it findable at all: a learner who wonders what happened
  // comes back to the row they pressed. No fall-back to a plain
  // sign-in is offered, for the reason the comment below gives.
  const refused = authRedirectError()
  return (
    <Slip label={t.guestLabel} cap={t.guestCap}>
      <p className="slip__hint">{t.guestClaimDesc}</p>
      {/* `link`, and never a fall-back to a plain sign-in: this learner
          has real progress on this account, and signing in as a Google
          user instead would walk away from it without saying so. If
          manual linking is off on the project the error says so and
          nothing is lost. */}
      <ProviderButton link onError={claim.setError} />
      {refused && (
        <p className="auth-message auth-message--error" role="alert">{authRedirectMessage(refused, t)}</p>
      )}
      <p className="auth-or">{t.orWithEmail}</p>
      <ClaimFields claim={claim} />
      {!claim.done && (
        <button
          type="button"
          className="btn-secondary slip__act"
          onClick={claim.submit}
          disabled={!claim.filled || claim.busy}
        >
          {claim.busy ? t.loading : t.brdAccountCreate}
        </button>
      )}
    </Slip>
  )
}

export function AccountPage({ session }) {
  const { t } = useLang()
  const guest = isGuest(session)
  return (
    <SettingsPage title={t.account}>
      {guest && <ClaimSlip />}
      {session?.user?.email && (
        <Slip label={t.settingsIssuedTo}>
          <span className="slip__value">{session.user.email}</span>
        </Slip>
      )}
      <Slip label={t.privacyPolicy}>
        {/* In the shell the policy opens in the system browser at the web
            origin (plan 076): the bundled copy would open inside the
            WebView with no way back. */}
        <a
          className="btn-secondary slip__act"
          href="/privacy.html"
          target="_blank"
          rel="noreferrer"
          onClick={e => { if (isNative()) { e.preventDefault(); openExternal(`${API_ORIGIN}/privacy.html`) } }}
        >
          {t.privacyPolicy}
        </a>
      </Slip>
      <Slip label={guest ? t.signOutGuestDesc : t.signOutDesc}>
        <button type="button" className="btn-secondary slip__act" onClick={() => supabase.auth.signOut({ scope: 'local' })}>
          {t.signOut}
        </button>
      </Slip>
    </SettingsPage>
  )
}
