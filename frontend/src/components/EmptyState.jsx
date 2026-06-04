/**
 * EmptyState
 * Centered icon + message + optional hint, used when a list is empty.
 *
 * Props:
 *   icon    — emoji or string (default '📭')
 *   message — primary text
 *   hint    — secondary smaller text (optional)
 *   action  — { label, onClick } to render an action button (optional)
 */
export default function EmptyState({ icon = '📭', message, hint, action }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 15 }}>{message}</div>
      {hint && (
        <div style={{ fontSize: 13, marginTop: 8 }}>{hint}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{ background: 'var(--accent)', color: '#fff', marginTop: 20 }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
