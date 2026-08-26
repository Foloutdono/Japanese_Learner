// ── 次は — the in-car next-stop display ──────────────────
// The strip above a train door that names the stop you are pulling into.
// Here it is both the most recognisable piece of Japanese in-train
// information design and the answer to "how do I read this passage
// straight through" -- the route map is for jumping, this is for going
// on.
//
// Renders NOTHING on the last Sentence. An inert "next" at the end of a
// line is worse than no control: it says there is more when there is not.
//
// The Japanese-over-plain-language pairing is the same one NextService,
// SectionHeader and every station plate use.
export function NextStop({ sentences, activeIndex, onAdvance, t }) {
  const next = sentences[activeIndex + 1]
  if (!next) return null

  return (
    <button type="button" className="anl-next" onClick={onAdvance}>
      <span className="anl-next__jp" lang="ja">次は</span>
      <span className="anl-next__latin">{t.nextStop}</span>
      <span className="anl-next__text" lang="ja">{next.text}</span>
      <span className="anl-next__go" aria-hidden="true">▶</span>
    </button>
  )
}
