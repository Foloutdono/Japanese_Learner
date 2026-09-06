import { InboxIcon } from './Icons'

// ── 空 — the empty state, and the error ───────────────────────
// The canvas's states sheet (plan 067): an empty state names what is
// missing and the one thing to do about it — an icon slot, a serif
// message, one hint, at most one secondary action. An error is the
// same object owning up: the border and the icon go toward --danger,
// the message says it did not work, the action is the retry. Nothing
// else moves.
//
// Props:
//   icon    — an <Icon/> element (see Icons.jsx); InboxIcon by default,
//             `null` for none (the "no results" line has no icon)
//   message — the serif line
//   hint    — the sentence under it (optional)
//   action  — { label, onClick } (optional; at most one)
//   tone    — 'error' for the danger register
export default function Empty({ icon = <InboxIcon size={28} />, message, hint, action, tone }) {
  const error = tone === 'error'
  return (
    <div className={`empty${error ? ' empty--error' : ''}`} role={error ? 'alert' : undefined}>
      {icon && <span className="empty__icon" aria-hidden="true">{icon}</span>}
      <span className="empty__msg">{message}</span>
      {hint && <span className="empty__hint">{hint}</span>}
      {action && (
        <button type="button" onClick={action.onClick} className="btn-secondary empty__action">
          {action.label}
        </button>
      )}
    </div>
  )
}
