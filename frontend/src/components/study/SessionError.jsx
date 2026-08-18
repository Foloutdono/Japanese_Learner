import { useLang } from '../../LangContext'
import EmptyState from '../ui/EmptyState'
import { WarningIcon } from '../ui/Icons'

// ── When a study session can't load ──────────────────────────
// Shared by all five study screens, because a study session that fails
// to fetch used to render *nothing at all*: `loading` was false (the
// hook cleared it in a finally), `done` was false (never set on
// failure) and `current` was null, so every screen's three render
// branches were false at once and the quiz area was an empty box with
// no spinner, no message and no way forward. Worse, nothing retried —
// the refill trigger's dependencies were unchanged, so the session was
// dead until a reload.
//
// The hook now reports `error` for exactly that state and retries on its
// own with backoff; this is the surface that says so and offers the
// manual retry, so a failure is a recoverable moment rather than a
// mystery.
//
// `error.message` is shown deliberately: the backend's own messages name
// the real problem ("Invalid mode for kana: 'banana'"), which is worth
// far more than a generic apology while this rework is in flight.
export default function SessionError({ error, onRetry }) {
  const { t } = useLang()
  return (
    <EmptyState
      icon={<WarningIcon size={40} />}
      message={t.sessionLoadFailed}
      hint={error?.message}
      action={onRetry ? { label: t.retry, onClick: onRetry } : undefined}
    />
  )
}
