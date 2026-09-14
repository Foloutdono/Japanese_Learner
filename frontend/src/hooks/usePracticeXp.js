import { useCallback, useState } from 'react'
import { applyXpGain } from '../stores/profileSummary'

// ── The fare on a practice run ──────────────────────────────
// Reading, translation, comprehension, dictation and the exam grade an
// answer without scheduling a card, so nothing goes through
// useReviewGates. The grading endpoints pay the fare instead
// (srs.award_practice) and report it top-level in review()'s own
// shape, and this hook is the half of useReviewGates that turns that
// into what a card run shows: the level bar moving (applyXpGain, the
// one running total every level bar reads) and XpToast's tick and
// announcement — or the level board, when the gain crosses a line.
//
// `leveledUp` comes from applyXpGain's running total, not from the
// response, for the same reason useReviewGates ignores the preview's:
// the server judged this one answer against the ledger, and the cache
// has seen every gain since the last fetch.
//
// Returns { toast, toastDone, pay }: pass `toast`/`toastDone` to
// StudyStage, and call `pay(response, quality)` on a graded answer.
export function usePracticeXp() {
  const [toast, setToast] = useState(null)

  const pay = useCallback((response, quality = null) => {
    const amount = typeof response?.xp_earned === 'number' ? response.xp_earned : 0
    if (amount <= 0) return
    const { leveledUp, newLevel } = applyXpGain({ amount })
    setToast({ amount, id: Date.now(), leveledUp, newLevel, quality })
  }, [])

  const toastDone = useCallback(() => setToast(null), [])

  return { toast, toastDone, pay }
}
