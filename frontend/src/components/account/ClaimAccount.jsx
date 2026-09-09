import { useLang } from '../../LangContext'

// ── The two fields the guest pass is claimed with ────────────────
// Deliberately only the fields and their messages: each host docks its
// own action where its own chrome puts actions — the boarding's gold
// button in `.brd__foot`, the settings slip's `.btn-secondary` on the
// row. The state is hooks/useClaim.js.
//
// `variant` picks the host's own field object rather than dropping one
// screen's into another's room. `.field` is drawn to sit in a surface
// (its well is --bg-main, its border transparent), so on a bare
// --bg-main page it would be an invisible box with floating
// placeholder text. Two answers, and which one is right is the host's
// to say: the boarding takes `.brd-field`, the object that page
// already uses for the name, which dims its border while empty the
// same way NameStep's does; the settings page takes `.field--page`,
// which is the same field with its well stepped up to the surface —
// this variant is mounted on `.settings`, which paints nothing, so
// without it the claim's two fields were the invisible box the
// paragraph above describes. The messages are the same either way:
// `.auth-message` carries no assumption about what it stands on.
const FIELDS = {
  auth: () => 'field field--page',
  board: value => `brd-field${value ? '' : ' brd-field--empty'}`,
}

export function ClaimFields({ claim, variant = 'auth', autoFocus = false }) {
  const { t } = useLang()
  const fieldClass = FIELDS[variant] ?? FIELDS.auth
  const onEnter = e => { if (e.key === 'Enter') claim.submit() }
  return (
    <>
      <input
        type="email"
        className={fieldClass(claim.email)}
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
        className={fieldClass(claim.password)}
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
