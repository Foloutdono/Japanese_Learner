import { useLang } from '../../LangContext'
import Empty from '../ui/Empty'
import { WarningIcon } from '../ui/Icons'
import { ReportProblem } from '../feedback/FeedbackSheet'

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
// sentence, Try again. The sentence used to be the backend's own
// whenever there was one, because a refusal that names the real
// problem is worth more than an apology. But the backend's sentence is
// English ("Invalid token", "Deck not found") and lib/api.js's own
// fallback carries an API path, and this app is read in French first
// (plan 215). So the intent is kept by name instead: a refusal the
// learner can act on is recognised by what it IS, and gets its own
// line from the table; everything else, the network's failures
// included, gets the sheet's line — the connection, and that nothing
// was lost.
const HINTS = {
  // The pass was refused: lib/api.js is already mending or dropping
  // the session, and signing in again is the way back.
  session_expired: t => t.sessionExpired,
  // Deleted, unfollowed, or never this learner's to study.
  deck_not_found: t => t.deckGone,
}

// The name of what went wrong, or null. A bare code the backend sent
// (ApiError.code) wins; otherwise the two worth naming are read off
// the status, and for the deck the request it answered.
function sessionErrorCode(error) {
  if (HINTS[error?.code]) return error.code
  if (error?.status === 401) return 'session_expired'
  if (error?.status === 404 && /^\/api\/decks\//.test(error.path ?? '')) return 'deck_not_found'
  return null
}

// 「Signaler ce problème」 under the retry (plan 222, door C): the
// sheet opens with the failure's area and status to join. Not under an
// expired session, which cannot send it, nor where no session is given.
export default function SessionError({ error, onRetry, session = null }) {
  const { t } = useLang()
  const code = sessionErrorCode(error)
  const named = HINTS[code]
  return (
    <Empty
      tone="error"
      icon={<WarningIcon size={28} />}
      message={t.errorTitle}
      hint={named ? named(t) : t.errorHint}
      action={onRetry ? { label: t.tryAgain, onClick: onRetry } : undefined}
    >
      {session && code !== 'session_expired' && <ReportProblem session={session} error={error} />}
    </Empty>
  )
}
