import { useState } from 'react'
import { useLang } from '../LangContext'
import { claimAccount } from '../lib/guest'

// ── 本乗車券 — putting credentials on the pass already held ───────
// The state and the one call behind Settings › Account's guest slip
// and the boarding's last step (components/account/ClaimAccount.jsx
// draws the fields for both). It lives here rather than beside them
// because a file that exports a hook AND a component cannot be hot
// reloaded, and because two screens asking the same question should
// not be able to disagree about what a valid answer is.
//
// Nothing here creates an account from nothing: the learner already IS
// an account (lib/guest.js), and this puts an email and a password on
// it. That is why there is no "already registered, sign in instead"
// branch — signing in as someone else is a different action, offered
// beside this one rather than inside it.
export function useClaim({ onDone } = {}) {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)

  // Enough to catch a typo before the round trip; the real check is
  // Supabase's, whose message is shown verbatim when it disagrees.
  const filled = /.+@.+\..+/.test(email.trim()) && password.length >= 6

  async function submit() {
    if (!filled || busy) return
    setBusy(true)
    setError(null)
    const r = await claimAccount({ email: email.trim(), password })
    setBusy(false)
    if (!r.ok) { setError(r.message || t.genericError); return }
    setDone(r.needsConfirmation ? t.guestClaimConfirm : t.guestClaimDone)
    onDone?.(r)
  }

  return { email, setEmail, password, setPassword, error, done, busy, filled, submit }
}
