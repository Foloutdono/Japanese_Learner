import { useLang } from '../../LangContext'
import { supabase } from '../../lib/supabase'
import { SettingsPage, Slip } from './SettingsPage'

// ── Account ───────────────────────────────────────────────────
// Who the card is issued to, the privacy policy (plan 066), and the
// sign-out. `local` scope: this is "sign out of this device", which is
// what the row says — the default `global` also revokes the learner's
// other devices.
export function AccountPage({ session }) {
  const { t } = useLang()
  return (
    <SettingsPage title={t.account}>
      {session?.user?.email && (
        <Slip label={t.settingsIssuedTo}>
          <span className="slip__value">{session.user.email}</span>
        </Slip>
      )}
      <Slip label={t.privacyPolicy}>
        <a className="btn-secondary slip__act" href="/privacy.html" target="_blank" rel="noreferrer">{t.privacyPolicy}</a>
      </Slip>
      <Slip label={t.signOutDesc}>
        <button type="button" className="btn-secondary slip__act" onClick={() => supabase.auth.signOut({ scope: 'local' })}>
          {t.signOut}
        </button>
      </Slip>
    </SettingsPage>
  )
}
