import { useState } from 'react'
import { supabase } from '../supabase'
import { useLang } from '../LangContext'

export default function AuthScreen() {
  const { t } = useLang()
  const [mode, setMode]       = useState('login') // 'login' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

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

  return (
    <div className="auth-screen">
      <div className="auth-header">
        <div className="auth-header__glyph">{t.appTitle}</div>
        <div className="auth-header__title">{t.learnJapanese}</div>
      </div>

      <div className="card auth-card">
        <div className="auth-mode-toggle">
          {[['login', t.login], ['signup', t.signup]].map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              className={`auth-mode-toggle__btn${mode === m ? ' auth-mode-toggle__btn--active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="auth-fields">
          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="auth-input"
          />
          <input
            type="password"
            placeholder={t.password}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="auth-input"
          />
        </div>

        {error && <div className="auth-message auth-message--error">{error}</div>}
        {success && <div className="auth-message auth-message--success">{success}</div>}

        <button onClick={handleSubmit} disabled={loading} className="auth-submit">
          {loading ? t.loading : mode === 'login' ? t.loginBtn : t.signupBtn}
        </button>
      </div>
    </div>
  )
}