import { useLang } from '../../LangContext'
import Empty from '../ui/Empty'
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
// The states sheet's error (plan 067): "That did not work", one
// sentence, Try again. A backend message replaces the sentence when
// there is one — FastAPI's messages name the real problem ("Invalid
// mode for kana: 'banana'") and are worth more than an apology — while
// a network failure, whose message is the browser's, gets the sheet's
// own line: the connection, and that nothing was lost.
export default function SessionError({ error, onRetry }) {
  const { t } = useLang()
  const detail = error?.status ? error.message : null
  return (
    <Empty
      tone="error"
      icon={<WarningIcon size={28} />}
      message={t.errorTitle}
      hint={detail || t.errorHint}
      action={onRetry ? { label: t.tryAgain, onClick: onRetry } : undefined}
    />
  )
}
