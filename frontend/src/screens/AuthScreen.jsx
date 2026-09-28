import { useLang } from '../LangContext'
import { BackChevron } from '../components/boarding/icons'
import { AuthCard } from '../components/account/AuthCard'
import { Mark } from '../components/ui/Mark'

// ── Sign in (plan 075, canvas SignIn) ────────────────────────────
// The sign over one card: Login / Sign up as a segmented control, the
// two fields, the one action, and the line that takes the pressure
// off ("Everything can be changed later in Settings."). Reached from
// Welcome -- Board opens it on Sign up, "Have an account?" on Login --
// and the back button returns there. No username here any more: the
// boarding asks the name on its first screen, and Settings keeps it
// editable; a sign-up that needs email confirmation simply comes back
// to Login.
//
// A phone's screen only (plan 122): on the desk the card stands beside
// Board in the Welcome's side column (components/account/AuthCard).
export default function AuthScreen({ mode: initialMode = 'login', onBack } = {}) {
  const { t } = useLang()
  return (
    <main className="auth" id="main-content">
      {onBack && (
        <div className="auth__head">
          <button type="button" className="brd__back" onClick={onBack} aria-label={t.back}>
            <BackChevron />
          </button>
        </div>
      )}
      <div className="auth-header">
        <span className="auth-header__glyph" lang="ja"><Mark label={t.appTitle} /></span>
        <h1 className="auth-header__title">{t.learnJapanese}</h1>
      </div>

      <AuthCard initialMode={initialMode} />

      <p className="auth-foot">{t.authFoot}</p>
    </main>
  )
}
