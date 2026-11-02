// ── The sentence a comprehension question is about ─────────────────
// The generator quotes the text in 「」 in every question that asks
// about a word or a construction (routes/reading.py: "quote the exact
// word/kanji from the text", "the relevant sentence fragment"), and the
// breakdown serves the text sentence by sentence with each sentence's
// own words (`jp`). So a missed question can open the sentence it came
// from. Pure, so the one rule lives in one tested place.

// The quoted fragments of a question, two characters or longer: a
// quoted は or を is in half the sentences and points at none.
export function quotedFragments(question) {
  const out = []
  for (const m of String(question ?? '').matchAll(/「([^」]+)」/g)) {
    const fragment = m[1].trim()
    if ([...fragment].length >= 2) out.push(fragment)
  }
  return out
}

// The index of the one sentence a fragment is in, or -1. A fragment in
// several sentences names none of them — opening the first would point
// at the wrong one as often as not.
export function sentenceFor(sentences, fragments) {
  for (const fragment of fragments ?? []) {
    const hits = (sentences ?? []).flatMap((s, i) => ((s?.jp ?? '').includes(fragment) ? [i] : []))
    if (hits.length === 1) return hits[0]
  }
  return -1
}

// The sentence(s) a question's right option rests on (plan 298b): the
// ones the question names (`at`, indices into the breakdown, which every
// seed question and every exercise written since carries), else the one
// sentence its quote is in, else none. Sorted, each once, in range.
export function answerSentences(question, sentences) {
  const n = sentences?.length ?? 0
  const at = Array.isArray(question?.at)
    ? [...new Set(question.at.filter(i => Number.isInteger(i) && i >= 0 && i < n))].sort((a, b) => a - b)
    : []
  if (at.length) return at
  const k = sentenceFor(sentences, quotedFragments(question?.question))
  return k >= 0 ? [k] : []
}
