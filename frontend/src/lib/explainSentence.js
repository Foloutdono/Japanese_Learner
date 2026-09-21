import { apiFetch } from './api'

// ── The deep tier, bought on demand (plan 095, owner-directed) ──
// The practice modes fetch the local tier for every sentence they
// show -- free, instant, no model -- and buy the explanation only when
// the learner presses Explain under the breakdown, the way the
// analyzer's own Explain works (docs/adr/0001: bought explicitly, per
// Sentence, never automatically). The result is the whole analysis
// with the deep tier merged on, so it replaces what the screen holds.
// `save: false` keeps practice out of the analyzer's own history.
export async function explainSentence(session, phrase, lang) {
  const r = await apiFetch('/api/phrase/analyze', session, {
    method: 'POST',
    body: JSON.stringify({ phrase, save: false, deep: true, lang }),
  })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
