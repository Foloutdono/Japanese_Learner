import { apiFetch } from './api'
import { countUse } from './screenTrail'

// ── The deep tier, bought on demand (plan 095, owner-directed) ──
// The practice modes fetch the local tier for every sentence they
// show -- free, instant, no model -- and buy the explanation only when
// the learner presses Explain under the breakdown, the way the
// analyzer's own Explain works (docs/adr/0001: bought explicitly, per
// Sentence, never automatically). The result is the whole analysis
// with the deep tier merged on, so it replaces what the screen holds.
// `save: false` keeps practice out of the analyzer's own history, and
// `whole: true` takes the exercise as one sentence however many 。 it
// holds -- split, 「雨がふりました。しかし、学校へ行きました。」 came
// back a Passage of two with no rows to draw (routes/phrase.py's
// PhraseRequest.whole). Every practice fetch of the local tier sends it too.
export async function explainSentence(session, phrase, lang) {
  countUse('explain', 'open')   // 足跡 (plan 218): opened, never the sentence
  const r = await apiFetch('/api/phrase/analyze', session, {
    method: 'POST',
    body: JSON.stringify({ phrase, save: false, deep: true, whole: true, lang }),
  })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

// What a failed Explain says, in the learner's language: a 429 is the
// day's explanations spent (routes/phrase.py's DEEP_DAILY_LIMIT, the
// only 429 an explain route gives), which "Try again" would only
// spend again; a 503 is the provider down. Reads an ApiError's
// `status` or explainSentence's own Error('503').
export function explainErrorText(e, t) {
  const status = e?.status ?? Number(e?.message)
  if (status === 429) return t.explainLimitReached
  if (status === 503) return t.explainUnavailable
  return t.explainFailed
}
