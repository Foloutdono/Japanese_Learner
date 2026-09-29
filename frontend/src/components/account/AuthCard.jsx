import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../LangContext'
import { Seg } from '../chrome/Console'
import { ProviderButton } from './ProviderButton'
import { authRedirectError, authRedirectMessage } from '../../lib/authRedirect'

// ── The sign-in card (plan 075; lifted out of AuthScreen, plan 122) ──
// Google, then Login / Sign up as a segmented control, the two fields,
// the one action. It is the Welcome's sign-in at every width: in
// Board's place on the desk (plan 163) and in the promise's on a phone
// (plan 167, which retired AuthScreen), so a returning learner signs in
// with no second screen.
//
// Google sits above the segmented control because it answers both
// halves of it at once: there is no such thing as signing up versus
// signing in with a provider, only arriving. It is a ghost button —
// the filled action is the one below it (DESIGN.md).
//
//   initialMode  'login' | 'signup' -- the side it opens on
//   autoFocus    the email field takes the focus on mount
//   seg          draw the Login / Sign up control; without it the card
//                stays on initialMode (the desk signs in only)
//   frame        the Welcome's (plans 163, 167): lays the card out
//                itself, handed { head, submit } -- the card's parts
//                down to the answers, and the action's { onClick,
//                disabled, label } -- so its action can stand where the
//                Welcome's Board did (the desk) or on the gold road
//                round the form (a phone)
export function AuthCard({ initialMode = 'login', autoFocus = false, seg = true, frame = null }) {
  const { t } = useLang()
  const [mode, setMode]         = useState(initialMode) // 'login' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  // 改札 — a Google round trip that came back refused lands as a fresh
  // page load with the reason on the URL, never as a returned value
  // (lib/authRedirect.js), so this line starts on it. App opens the
  // card for it; without that the learner would be shown the sign-in
  // form with nothing said, which is indistinguishable from a button
  // that did nothing. Ordinary state from there on: the next attempt,
  // or switching sides, replaces it.
  const [error, setError]       = useState(() => authRedirectMessage(authRedirectError(), t))
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

  const head = (
    <>
      <ProviderButton onError={setError} />
      <p className="auth-or">{t.orWithEmail}</p>
      {seg && (
        <Seg
          full
          options={[{ key: 'login', label: t.login }, { key: 'signup', label: t.signup }]}
          value={mode}
          onChange={switchMode}
          label={t.authModeAria}
        />
      )}
      <input
        type="email"
        className="field"
        placeholder={t.email}
        aria-label={t.email}
        autoComplete="email"
        autoFocus={autoFocus}
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
    </>
  )
  const submit = { onClick: handleSubmit, disabled: loading, label: loading ? t.loading : mode === 'login' ? t.loginBtn : t.signupBtn }
  if (frame) return frame({ head, submit })

  return (
    <div className="auth-card">
      {head}
      <button type="button" className="auth-submit" onClick={submit.onClick} disabled={submit.disabled}>
        {submit.label}
      </button>
    </div>
  )
}
