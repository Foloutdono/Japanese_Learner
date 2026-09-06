import { apiJson, ApiError } from './api'
import { applySpend, reconcileCredits, markRunOut } from '../stores/credits'

// ── Posting a review, with the fare (plan 069) ─────────────────
// Every study screen used to fire its review POST and forget it. It
// still does not wait on the response for anything the card shows —
// but the response now carries `credits`, and a 402 mid-run is the one
// failure the learner must hear about. So the six call sites go
// through here: the balance drops by the fare the moment the rating
// lands, the server's figure replaces it when the response arrives,
// and an out_of_credits refusal raises the run-out sheet
// (stores/credits.js) instead of vanishing into a catch.
//
// Resolves to the response body; rejects only with the ApiError, after
// the sheet is up, so a caller may still `.catch(() => {})` as before.
export async function postReview(path, session, body, { cleared = 0 } = {}) {
  applySpend(1)
  try {
    const res = await apiJson(path, session, { method: 'POST', body: JSON.stringify(body) })
    reconcileCredits(res?.credits)
    return res
  } catch (e) {
    if (e instanceof ApiError && e.code === 'out_of_credits') {
      markRunOut({ balance: e.body?.balance ?? 0, refillAt: e.body?.refillAt ?? null, cleared })
    }
    throw e
  }
}
