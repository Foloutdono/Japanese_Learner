import { useState } from 'react'
import { useLang } from '../../LangContext'
import { supabase } from '../../lib/supabase'
import { authRedirectError, authRedirectMessage } from '../../lib/authRedirect'
import { API_ORIGIN } from '../../lib/origin'
import { isNative, openExternal } from '../../lib/platform'
import { isGuest } from '../../lib/guest'
import { hasProvider } from '../../lib/oauth'
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
      {/* Only until the fields below have news of their own: a URL
          refusal lasts the whole page load, and stacking it over the
          claim's own answer reads as two faults where there is one. */}
      {refused && !claim.error && !claim.done && (
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

// ── 相互乗り入れ — Google on a pass that already has a key ───────
// The other half of the offer above, and the one whose absence sent
// learners round a loop they could not see the shape of.
//
// "Continue with Google" on the sign-in screen is signInWithOAuth: it
// opens the pass that carries that Google identity, and when NO pass
// carries it, Supabase issues a new one. Supabase attaches a Google
// identity to an existing account by itself only when that account's
// address is confirmed and the account did not start out anonymous —
// and the boarding starts every learner anonymous (lib/guest.js), so
// the accounts this app makes are exactly the ones that do not
// qualify. The learner presses Google, arrives on a second, empty
// pass, and is handed the boarding from question one; pressing it
// again does the same thing, because nothing about the second pass
// changed. The way out is not on that road at all: it is HERE, from
// inside the account they already hold, adding the identity that the
// button will then find.
//
// So the offer is made to any pass without it, not only to a guest's.
// `link`, never a plain sign-in, for the reason ClaimSlip gives: this
// learner has real progress, and signing in as somebody else would
// walk away from it silently.
function LinkGoogleSlip() {
  const { t } = useLang()
  const [error, setError] = useState(null)
  // Same rule as the slip above: a refusal read off the URL is a fact
  // about this page load (lib/authRedirect.js), and it stands only
  // until the button has news of its own.
  const refused = authRedirectError()
  return (
    <Slip label={t.linkGoogleLabel} cap={t.linkGoogleCap}>
      <p className="slip__hint">{t.linkGoogleDesc}</p>
      {/* On the web this never resolves — the page has left for
          Google and comes back as a new load, where the slip is
          simply gone. In the shell it does resolve, and the session
          in memory still says "no Google": refreshing it is what
          takes the offer off the screen. */}
      <ProviderButton
        link
        onDone={() => supabase.auth.refreshSession()}
        onError={setError}
      />
      {(error || refused) && (
        <p className="auth-message auth-message--error" role="alert">
          {error ?? authRedirectMessage(refused, t)}
        </p>
      )}
    </Slip>
  )
}

export function AccountPage({ session }) {
  const { t } = useLang()
  const guest = isGuest(session)
  // A guest is offered the whole account (ClaimSlip, Google included);
  // anyone else is offered only the identity they are missing.
  const offerGoogle = !guest && !!session && !hasProvider(session, 'google')
  return (
    <SettingsPage title={t.account}>
      {guest && <ClaimSlip />}
      {session?.user?.email && (
        <Slip label={t.settingsIssuedTo}>
          <span className="slip__value">{session.user.email}</span>
        </Slip>
      )}
      {/* Under the address, because it is about that address: this is
          the second key to the same pass, not a second pass. */}
      {offerGoogle && <LinkGoogleSlip />}
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
