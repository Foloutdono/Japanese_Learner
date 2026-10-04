import { apiFetch } from './api'

// ── A practice result, posted and not lost quietly (plan 178) ──────────
// Reading's and translation's runs post each rated sentence to its own
// /result endpoint, and that row IS the learner's history -- the station's
// record, its missed sentences, the last ride, the daily streak. They did
// it fire-and-forget, `.catch(() => {})`: a post that failed (a dropped
// connection, a server error) cost the sentence its place in the record
// and showed nothing, so a record that stayed empty had no symptom to
// report. This tries twice, a beat apart, on what a retry can fix --
// the network, a 5xx, a 429 -- and tells the caller whether the row
// landed, so the run can say so when it did not.
//
// Resolves { saved, data }: `data` is the response body, null unless it
// was saved. Never rejects: the run goes on whatever the answer.
const RETRY_AFTER_MS = 1500

const worthRetrying = status => status >= 500 || status === 429 || status === 408

export async function postResult(path, session, body) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, RETRY_AFTER_MS))
    try {
      const response = await apiFetch(path, session, { method: 'POST', body: JSON.stringify(body) })
      if (response.ok) return { saved: true, data: await response.json().catch(() => null) }
      if (!worthRetrying(response.status)) break
    } catch {
      // The network: worth the second try.
    }
  }
  return { saved: false, data: null }
}
