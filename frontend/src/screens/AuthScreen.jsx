import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export default function AuthScreen() {
  const { t } = useLang()
  const [mode, setMode]       = useState('login') // 'login' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
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

    if (mode === 'signup' && username && !USERNAME_RE.test(username)) {
      setError(t.usernameInvalid || '3-20 caractères : lettres, chiffres, underscore.')
      return
    }

    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess(t.signupSuccess)
        // Username is optional at signup — if left blank, /api/profile
        // will assign a random one on first login, editable later from
        // the Profile screen. If a session comes back immediately (no
        // email confirmation required), set it right away rather than
        // waiting on that fallback. When confirmation *is* required,
        // there's no session yet to authenticate this call with, so
        // the chosen name can't be applied until they log in — at
        // which point the random fallback has already claimed a name
        // and they'd need to rename it manually. Revisit once we know
        // whether email confirmation is enabled for this project.
        if (username && data.session) {
          apiFetch('/api/profile', data.session, {
            method: 'PATCH',
            body: JSON.stringify({ username }),
          }).catch(() => {})
        }
      }
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
          {mode === 'signup' && (
            <input
              type="text"
              placeholder={t.usernameOptional || 'Nom d’utilisateur (facultatif)'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="auth-input"
              maxLength={20}
            />
          )}
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