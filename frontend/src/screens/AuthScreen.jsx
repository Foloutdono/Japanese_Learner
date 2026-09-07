import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../LangContext'
import { Seg } from '../components/chrome/Console'
import { BackChevron } from '../components/boarding/icons'
import { ProviderButton } from '../components/account/ProviderButton'

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
// Google sits above the segmented control because it answers both
// halves of it at once: there is no such thing as signing up versus
// signing in with a provider, only arriving. It is a ghost button —
// the filled action on this screen is the one below it (DESIGN.md).
export default function AuthScreen({ mode: initialMode = 'login', onBack } = {}) {
  const { t } = useLang()
  const [mode, setMode]         = useState(initialMode) // 'login' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(null)

  function switchMode(next) {
    setMode(next)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess(t.signupSuccess)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  const onEnter = e => { if (e.key === 'Enter') handleSubmit() }

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
        <span className="auth-header__glyph" lang="ja">{t.appTitle}</span>
        <h1 className="auth-header__title">{t.learnJapanese}</h1>
      </div>

      <div className="auth-card">
        <ProviderButton onError={setError} />
        <p className="auth-or">{t.orWithEmail}</p>
        <Seg
          full
          options={[{ key: 'login', label: t.login }, { key: 'signup', label: t.signup }]}
          value={mode}
          onChange={switchMode}
          label={t.authModeAria}
        />
        <input
          type="email"
          className="field"
          placeholder={t.email}
          aria-label={t.email}
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={onEnter}
        />
        <input
          type="password"
          className="field"
          placeholder={t.password}
          aria-label={t.password}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={onEnter}
        />
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        {success && <p className="auth-message auth-message--success" role="status">{success}</p>}
        <button type="button" className="auth-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? t.loading : mode === 'login' ? t.loginBtn : t.signupBtn}
        </button>
      </div>

      <p className="auth-foot">{t.authFoot}</p>
    </main>
  )
}
