import { useLang } from '../../LangContext'

// ── The two fields the guest pass is claimed with ────────────────
// Deliberately only the fields and their messages: the host docks its
// own action where its own chrome puts actions -- Settings' slip, its
// `.btn-secondary` on the row. The state is hooks/useClaim.js. The
// boarding keeps the card by a link instead (plan 246:
// components/boarding/CardSheets.jsx), with no password to set.
//
// `.field--page` is the field with its well stepped up to the surface:
// this is mounted on `.settings`, which paints nothing, so a plain
// `.field` (drawn to sit in a surface, its well --bg-main, its border
// transparent) would be an invisible box with floating placeholder text.
export function ClaimFields({ claim, autoFocus = false }) {
  const { t } = useLang()
  const onEnter = e => { if (e.key === 'Enter') claim.submit() }
  return (
    <>
      <input
        type="email"
        className="field field--page"
        placeholder={t.email}
        aria-label={t.email}
        autoComplete="email"
        autoFocus={autoFocus}
        value={claim.email}
        onChange={e => claim.setEmail(e.target.value)}
        onKeyDown={onEnter}
        disabled={!!claim.done}
      />
      <input
        type="password"
        className="field field--page"
        placeholder={t.password}
        aria-label={t.password}
        autoComplete="new-password"
        value={claim.password}
        onChange={e => claim.setPassword(e.target.value)}
        onKeyDown={onEnter}
        disabled={!!claim.done}
      />
      {claim.error && <p className="auth-message auth-message--error" role="alert">{claim.error}</p>}
      {claim.done && <p className="auth-message auth-message--success" role="status">{claim.done}</p>}
    </>
  )
}
