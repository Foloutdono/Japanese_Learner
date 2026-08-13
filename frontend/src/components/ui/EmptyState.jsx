import { InboxIcon } from './Icons'

/**
 * EmptyState
 * Centered icon + message + optional hint, used when a list is empty.
 *
 * Props:
 *   icon    — a <Icon/> element (see Icons.jsx), default <InboxIcon/>
 *   message — primary text
 *   hint    — secondary smaller text (optional)
 *   action  — { label, onClick } to render an action button (optional)
 */
export default function EmptyState({ icon = <InboxIcon size={40} />, message, hint, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <div className="empty-state__message">{message}</div>
      {hint && (
        <div className="empty-state__hint">{hint}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="empty-state__action"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}