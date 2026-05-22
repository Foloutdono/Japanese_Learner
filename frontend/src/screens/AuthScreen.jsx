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

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess(t.accountCreated)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 64, color: 'var(--accent)', fontFamily: 'Yu Gothic, sans-serif' }}>
          日本語
        </div>
        <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>
          {t.appSubtitle}
        </div>
      </div>

      {/* Card */}
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>

        {/* Mode toggle */}
        <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden' }}>
          {[['login', t.loginBtn], ['signup', t.signupBtn]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              style={{
                flex: 1, borderRadius: 0,
                background: mode === m ? 'var(--accent)' : 'var(--bg-panel)',
                color: 'var(--text-primary)', fontSize: 14,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ padding: '12px 16px', fontSize: 15 }}
          />
          <input
            type="password"
            placeholder={t.password}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ padding: '12px 16px', fontSize: 15 }}
          />
        </div>

        {/* Error / success */}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: 'var(--success)', fontSize: 13, marginTop: 12 }}>
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            background: 'var(--accent)', color: '#fff',
            width: '100%', marginTop: 20, fontSize: 15,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? t.loading : mode === 'login' ? t.loginBtn : t.signupBtn}
        </button>
      </div>
    </div>
  )
}